import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminMembersService } from './admin-members.service';
import { DRIZZLE } from '../../database/database.module';

describe('AdminMembersService', () => {
  let service: AdminMembersService;
  let mockDb: any;

  // Helpers to create chainable query builders
  const chainable = (resolveValue: any) => {
    const chain: any = {};
    const methods = [
      'select',
      'selectDistinct',
      'from',
      'where',
      'innerJoin',
      'leftJoin',
      'orderBy',
      'limit',
      'offset',
      'then',
    ];
    for (const m of methods) {
      chain[m] = jest.fn().mockReturnValue(chain);
    }
    // Make it thenable so await works
    chain.then = jest.fn((resolve: any) => resolve(resolveValue));
    return chain;
  };

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      selectDistinct: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminMembersService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();

    service = module.get<AdminMembersService>(AdminMembersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMemberCrossServerView', () => {
    it('should throw NotFoundException when member does not exist', async () => {
      // First select returns empty array (member not found)
      const memberQuery = chainable([]);
      mockDb.select.mockReturnValue(memberQuery);

      await expect(
        service.getMemberCrossServerView('unknown-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return cross-server view for existing member', async () => {
      const member = {
        id: '123',
        username: 'testuser',
        globalName: 'Test User',
        displayName: 'Test',
        avatar: 'avatar-hash',
        isClubMember: true,
      };

      const memberships = [
        {
          serverId: 's1',
          joinedAt: new Date('2025-01-01'),
          serverName: 'Main Server',
          serverIcon: null,
          isMainServer: true,
        },
      ];

      const roles = [
        {
          roleId: 'r1',
          roleName: 'Admin',
          roleColor: 0xff0000,
          rolePosition: 10,
          serverId: 's1',
        },
      ];

      // Call 1: member lookup
      const memberChain = chainable([member]);
      // Call 2: memberships
      const membershipChain = chainable(memberships);
      // Call 3: roles
      const roleChain = chainable(roles);

      mockDb.select
        .mockReturnValueOnce(memberChain)
        .mockReturnValueOnce(membershipChain)
        .mockReturnValueOnce(roleChain);

      const result = await service.getMemberCrossServerView('123');

      expect(result.memberId).toBe('123');
      expect(result.username).toBe('testuser');
      expect(result.isClubMember).toBe(true);
      expect(result.servers).toHaveLength(1);
      expect(result.servers[0].serverId).toBe('s1');
      expect(result.servers[0].roles).toHaveLength(1);
      expect(result.servers[0].roles[0].name).toBe('Admin');
    });
  });
});
