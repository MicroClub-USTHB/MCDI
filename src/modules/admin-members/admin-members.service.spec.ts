import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminMembersService } from './admin-members.service';
import { AdminMembersRepository } from './admin-members.repository';

describe('AdminMembersService', () => {
  let service: AdminMembersService;
  let repository: jest.Mocked<AdminMembersRepository>;

  beforeEach(async () => {
    const mockRepository: Partial<jest.Mocked<AdminMembersRepository>> = {
      findMemberById: jest.fn(),
      findMembershipsByMemberId: jest.fn(),
      findRolesByMemberId: jest.fn(),
      countMembers: jest.fn(),
      findMembersPaginated: jest.fn(),
      findMembershipsByMemberIds: jest.fn(),
      findRoleNamesByMemberIds: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminMembersService,
        { provide: AdminMembersRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<AdminMembersService>(AdminMembersService);
    repository = module.get(AdminMembersRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMemberCrossServerView', () => {
    it('should throw NotFoundException when member does not exist', async () => {
      repository.findMemberById.mockResolvedValue(null);

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
        syncedAt: new Date(),
      };

      const memberships = [
        {
          memberId: '123',
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

      repository.findMemberById.mockResolvedValue(member);
      repository.findMembershipsByMemberId.mockResolvedValue(memberships);
      repository.findRolesByMemberId.mockResolvedValue(roles);

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

  describe('getCrossServerList', () => {
    it('should return empty data when no members match', async () => {
      repository.countMembers.mockResolvedValue(0);
      repository.findMembersPaginated.mockResolvedValue([]);

      const result = await service.getCrossServerList({
        filter: 'all',
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should return paginated cross-server list', async () => {
      repository.countMembers.mockResolvedValue(1);
      repository.findMembersPaginated.mockResolvedValue([
        { id: '123', username: 'testuser', globalName: 'Test', avatar: null },
      ]);
      repository.findMembershipsByMemberIds.mockResolvedValue([
        {
          memberId: '123',
          serverId: 's1',
          joinedAt: new Date('2025-01-01'),
          serverName: 'Main Server',
          isMainServer: true,
        },
      ]);
      repository.findRoleNamesByMemberIds.mockResolvedValue([
        { memberId: '123', serverId: 's1', roleName: 'Admin' },
      ]);

      const result = await service.getCrossServerList({
        filter: 'all',
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].memberId).toBe('123');
      expect(result.data[0].isClubMember).toBe(true);
      expect(result.data[0].servers[0].roleNames).toContain('Admin');
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });
});
