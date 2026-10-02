import { ConflictException, Logger } from '@nestjs/common';
import { encryptSecret } from '../../common/utils/encryption.util';
import { signPayload } from '../../common/utils/inbound-webhook-signature.util';
import { InboundWebhooksService } from './inbound-webhooks.service';
import type { Field } from './schema/form-schema.types';

const WEBHOOK = 'wh-1';
const PROJECT = 'project-1';
const SECRET = 'whsec_test';
const NOW = Date.parse('2026-01-01T00:00:00Z');
const KEY = 'ab'.repeat(32);
const RATE_LIMIT = 120;

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
    delete: (key: string) => Promise.resolve(Number(expiresAt.delete(key))),
    incr: jest.fn().mockResolvedValue(1),
    expire: () => Promise.resolve(),
  };
};

describe('InboundWebhooksService.ingest', () => {
  let repository: { insertSubmission: jest.Mock; [key: string]: jest.Mock };
  let redis: ReturnType<typeof fakeRedis>;
  let service: InboundWebhooksService;

  const build = (fields: Field[], key = KEY) => {
    redis = fakeRedis();
    repository = {
      findByIdWithSecret: jest.fn().mockResolvedValue({
        id: WEBHOOK,
        projectId: PROJECT,
        isActive: true,
        acceptedOrigins: [],
        requireSignature: true,
        rejectUnknownFields: true,
        signingSecretEnc: encryptSecret(SECRET, KEY),
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
      redis as never,
      {
        get: (name: string, fallback: unknown) =>
          name === 'app.inboundWebhookEncryptionKey' ? key : fallback,
      } as never,
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

  describe('retrying a request that was never stored', () => {
    const body = { step: { a: 'x' } };
    const t = NOW / 1000;

    beforeEach(() => build([{ key: 'a', type: 'string', required: true }]));

    it('accepts the same signed request after a rate-limit rejection', async () => {
      redis.incr.mockResolvedValueOnce(RATE_LIMIT + 1);
      await expect(submit(body, t)).rejects.toMatchObject({ status: 429 });

      await expect(submit(body, t)).resolves.toMatchObject({ id: 'sub-1' });
    });

    it('accepts the same signed request after the insert failed', async () => {
      repository.insertSubmission.mockRejectedValueOnce(new Error('db down'));
      await expect(submit(body, t)).rejects.toThrow('db down');

      await expect(submit(body, t)).resolves.toMatchObject({ id: 'sub-1' });
    });

    it('reports a validation failure again instead of a replay', async () => {
      const invalid = { step: {} };
      await expect(submit(invalid, t)).rejects.toMatchObject({ status: 422 });

      await expect(submit(invalid, t)).rejects.toMatchObject({ status: 422 });
    });
  });

  describe('file references', () => {
    const FILE_ID = '3f1c0a7e-9b2d-4c1a-8e5f-0a1b2c3d4e5f';

    it('never queries the uuid column with a value that is not a uuid', async () => {
      build([{ key: 'blob', type: 'json', required: true, maxBytes: 1000 }]);
      const blob = [
        { fileId: 'abc' },
        { fileId: FILE_ID },
        { fileId: FILE_ID },
      ];

      await submit({ step: { blob } }, NOW / 1000);

      expect(repository.findFilesByIds).toHaveBeenCalledWith([FILE_ID]);
    });

    it('reports a malformed file id as a field error', async () => {
      build([
        {
          key: 'cv',
          type: 'file',
          required: true,
          accept: ['application/pdf'],
          maxSizeBytes: 1000,
        },
      ]);

      await expect(
        submit({ step: { cv: { fileId: 'iwf_nope' } } }, NOW / 1000),
      ).rejects.toMatchObject({
        status: 422,
        response: { errors: [{ path: 'step.cv', code: 'FILE_NOT_FOUND' }] },
      });
      expect(repository.findFilesByIds).toHaveBeenCalledWith([]);
    });
  });

  describe('encryption key', () => {
    it('fails with a named error when the key is not configured', async () => {
      build([{ key: 'a', type: 'string', required: true }], '');

      await expect(
        submit({ step: { a: 'x' } }, NOW / 1000),
      ).rejects.toMatchObject({
        status: 500,
        response: { code: 'ENCRYPTION_KEY_MISSING' },
      });
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
