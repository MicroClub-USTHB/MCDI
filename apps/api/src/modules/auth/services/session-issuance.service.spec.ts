import { Test, TestingModule } from '@nestjs/testing';
import { SessionIssuanceService } from './session-issuance.service';
import { SessionRepository } from '../repositories/session.repository';

const mockSessionRepository = {
  create: jest.fn(),
};

describe('SessionIssuanceService', () => {
  let service: SessionIssuanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionIssuanceService,
        { provide: SessionRepository, useValue: mockSessionRepository },
      ],
    }).compile();

    service = module.get(SessionIssuanceService);
  });

  afterEach(() => jest.clearAllMocks());

  it('issues a token and persists the session with the requested TTL', async () => {
    mockSessionRepository.create.mockResolvedValue({ id: 'sess-1' });

    const before = Date.now();
    const result = await service.issueSession({
      memberId: 'member-1',
      ttlSeconds: 3600,
      projectId: 'proj-1',
      serverId: 'srv-1',
    });
    const after = Date.now();

    expect(result.token).toHaveLength(96);
    expect(result.session).toEqual({ id: 'sess-1' });
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 3_599_000,
    );
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + 3_601_000);
    expect(mockSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: 'member-1',
        projectId: 'proj-1',
        serverId: 'srv-1',
        token: result.token,
        expiresAt: result.expiresAt,
      }),
      undefined,
    );
  });

  it('generates a refresh token and persists client metadata', async () => {
    mockSessionRepository.create.mockResolvedValue({ id: 'sess-3' });

    const result = await service.issueSession({
      memberId: 'member-3',
      ttlSeconds: 60,
      clientUserAgent: 'jest-agent',
      clientIpAddress: '1.2.3.4',
    });

    expect(result.refreshToken).toMatch(/^[0-9a-f]{96}$/);
    expect(mockSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        token: result.token,
        refreshToken: result.refreshToken,
        clientUserAgent: 'jest-agent',
        clientIpAddress: '1.2.3.4',
      }),
      undefined,
    );
  });

  it('passes the transaction through when provided', async () => {
    const tx = { id: 'tx-1' } as any;
    mockSessionRepository.create.mockResolvedValue({ id: 'sess-2' });

    await service.issueSession(
      {
        memberId: 'member-2',
        ttlSeconds: 60,
      },
      tx,
    );

    expect(mockSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: 'member-2',
        projectId: undefined,
        serverId: undefined,
      }),
      tx,
    );
  });
});
