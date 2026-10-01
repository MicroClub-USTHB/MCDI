import { randomBytes } from 'crypto';
import { ConflictException, Logger } from '@nestjs/common';
import {
  encryptSecret,
  resetEncryptionKeyCache,
} from '../../common/utils/crypto.util';
import { signPayload } from '../../common/utils/inbound-webhook-signature.util';
import { InboundWebhooksService } from './inbound-webhooks.service';
import type { Field } from './schema/form-schema.types';

const WEBHOOK = 'wh-1';
const PROJECT = 'project-1';
const SECRET = 'whsec_test';
const NOW = Date.parse('2026-01-01T00:00:00Z');

/** Stands in for Redis SET NX PX: a key is "seen" until its TTL runs out. */
const fakeRedis = () => {
  const expiresAt = new Map<string, number>();
  return {
    setIfAbsent: (key: string, _value: string, ttlMs: number) => {
      if ((expiresAt.get(key) ?? 0) > Date.now()) {
        return Promise.resolve('exists');
      }
      expiresAt.set(key, Date.now() + ttlMs);
      return Promise.resolve('set');
    },
    incr: () => Promise.resolve(1),
    expire: () => Promise.resolve(),
  };
};

describe('InboundWebhooksService.ingest', () => {
  let repository: { insertSubmission: jest.Mock; [key: string]: jest.Mock };
  let service: InboundWebhooksService;

  const build = (fields: Field[]) => {
    repository = {
      findByIdWithSecret: jest.fn().mockResolvedValue({
        id: WEBHOOK,
        projectId: PROJECT,
        isActive: true,
        acceptedOrigins: [],
        requireSignature: true,
        rejectUnknownFields: true,
        signingSecretEnc: encryptSecret(SECRET),
        schema: { version: 1, steps: [{ key: 'step', fields }] },
      }),
      findFilesByIds: jest.fn().mockResolvedValue([]),
      insertSubmission: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ id: 'sub-1', receivedAt: new Date() }),
        ),
    };
    service = new InboundWebhooksService(
      repository as never,
      { insert: jest.fn().mockResolvedValue(undefined) } as never,
      fakeRedis() as never,
      { get: (_key: string, fallback: unknown) => fallback } as never,
    );
  };

  const submit = (body: Record<string, unknown>, timestamp: number) => {
    const rawBody = Buffer.from(JSON.stringify(body));
    return service.ingest(WEBHOOK, body, {
      projectId: PROJECT,
      rawBody,
      signatureHeader: signPayload(SECRET, rawBody, timestamp),
    });
  };

  beforeAll(() => {
    process.env.INBOUND_WEBHOOK_ENCRYPTION_KEY =
      randomBytes(32).toString('base64');
    resetEncryptionKeyCache();
  });

  afterAll(() => {
    delete process.env.INBOUND_WEBHOOK_ENCRYPTION_KEY;
    resetEncryptionKeyCache();
  });

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'queueMicrotask'] });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('replay protection', () => {
    const body = { step: { a: 'x' } };

    beforeEach(() => build([{ key: 'a', type: 'string', required: true }]));

    it('rejects an immediate replay', async () => {
      const t = NOW / 1000;
      await submit(body, t);

      await expect(submit(body, t)).rejects.toThrow(ConflictException);
      expect(repository.insertSubmission).toHaveBeenCalledTimes(1);
    });

    it('rejects a replay for as long as a future-dated signature stays valid', async () => {
      // The sender's clock runs 4 minutes fast, so the signature verifies until
      // t + tolerance = 9 minutes from now, well past one tolerance window.
      const t = NOW / 1000 + 240;
      await submit(body, t);

      jest.setSystemTime(NOW + 301_000);

      await expect(submit(body, t)).rejects.toThrow(ConflictException);
      expect(repository.insertSubmission).toHaveBeenCalledTimes(1);
    });
  });

  describe('a stored pattern that times out', () => {
    beforeEach(() =>
      build([{ key: 'a', type: 'string', required: true, pattern: '(a+)+$' }]),
    );

    it('rejects the submission and warns, naming the webhook', async () => {
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      await expect(
        submit({ step: { a: 'a'.repeat(40) + '!' } }, NOW / 1000),
      ).rejects.toMatchObject({
        response: { errors: [{ path: 'step.a', code: 'PATTERN_TIMEOUT' }] },
      });
      expect(repository.insertSubmission).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/wh-1.*step\.a/));
    });
  });
});
