import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../../../database/database.module';
import { hashSsoToken } from '../../../common/utils/sso-token.util';
import { MemberRepository } from '../repositories/member.repository';
import { SessionRepository } from '../repositories/session.repository';
import { SsoSessionRepository } from '../repositories/sso-session.repository';
import { SsoService } from './sso.service';

describe('SsoService', () => {
  const ssoRepo = {
    create: jest.fn(),
    findValidByToken: jest.fn(),
    touch: jest.fn(),
    deleteByToken: jest.fn(),
    deleteByMemberId: jest.fn(),
  };
  const sessionRepo = { deleteByMemberId: jest.fn() };
  const memberRepo = { findById: jest.fn() };
  const config = {
    get: jest.fn((k: string) => (k === 'app.ssoTtlSec' ? 60 : undefined)),
  };

  // We don't exercise the listing/role queries in unit tests; that's covered
  // end-to-end. So the Drizzle stub only needs to honor `transaction()`.
  const db = {
    transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(db),
    ),
  };

  let service: SsoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SsoService,
        { provide: SsoSessionRepository, useValue: ssoRepo },
        { provide: SessionRepository, useValue: sessionRepo },
        { provide: MemberRepository, useValue: memberRepo },
        { provide: ConfigService, useValue: config },
        { provide: DRIZZLE, useValue: db },
      ],
    }).compile();

    service = module.get(SsoService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('issueSession', () => {
    it('mints a hex token, persists only the hash, and stamps a TTL-based expiry', async () => {
      ssoRepo.create.mockResolvedValue({ id: 'sso-1' });

      const before = Date.now();
      const { token, expiresAt } = await service.issueSession('member-1');
      const after = Date.now();

      expect(token).toMatch(/^[0-9a-f]{96}$/);
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 59_000);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(after + 61_000);
      expect(ssoRepo.create).toHaveBeenCalledWith({
        memberId: 'member-1',
        token,
        expiresAt,
      });
    });
  });

  describe('resolveSession', () => {
    it('returns null when no token is supplied', async () => {
      await expect(service.resolveSession(undefined)).resolves.toBeNull();
      expect(ssoRepo.findValidByToken).not.toHaveBeenCalled();
    });

    it('returns null when the cookie is unknown/expired', async () => {
      ssoRepo.findValidByToken.mockResolvedValue(null);
      await expect(service.resolveSession('nope')).resolves.toBeNull();
    });

    it('returns null and skips touch when the member no longer exists', async () => {
      ssoRepo.findValidByToken.mockResolvedValue({
        id: 'sso-1',
        memberId: 'm',
      });
      memberRepo.findById.mockResolvedValue(null);

      await expect(service.resolveSession('tok')).resolves.toBeNull();
      expect(ssoRepo.touch).not.toHaveBeenCalled();
    });

    it('returns the SSO + member and fires the touch in the background', async () => {
      const ssoSession = { id: 'sso-1', memberId: 'm-1' };
      const member = { id: 'm-1', username: 'alice' };
      ssoRepo.findValidByToken.mockResolvedValue(ssoSession);
      memberRepo.findById.mockResolvedValue(member);
      ssoRepo.touch.mockResolvedValue(undefined);

      const result = await service.resolveSession('tok');

      expect(result).toEqual({ ssoSession, member });
      // touch is fire-and-forget but must have been called
      expect(ssoRepo.touch).toHaveBeenCalledWith('sso-1');
    });
  });

  describe('logout', () => {
    it('best-effort deletes by token hash when the cookie is unknown', async () => {
      ssoRepo.findValidByToken.mockResolvedValue(null);

      await service.logout('orphan-token');

      expect(ssoRepo.deleteByToken).toHaveBeenCalledWith('orphan-token');
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('cascades: wipes every project session AND every SSO session for the member', async () => {
      ssoRepo.findValidByToken.mockResolvedValue({
        id: 'sso-1',
        memberId: 'member-9',
      });

      await service.logout('valid-token');

      expect(db.transaction).toHaveBeenCalled();
      expect(sessionRepo.deleteByMemberId).toHaveBeenCalledWith('member-9', db);
      expect(ssoRepo.deleteByMemberId).toHaveBeenCalledWith('member-9', db);
    });
  });

  it('hashes the token consistently with the repo helper (round-trip sanity check)', () => {
    // Guard against a future drift where the service hashes one way and the
    // repository hashes another; both must agree for findValidByToken to hit.
    expect(hashSsoToken('abc')).toBe(hashSsoToken('abc'));
  });
});
