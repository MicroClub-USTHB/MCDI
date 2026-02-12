/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { MemberService } from './member.service';
import { MemberRepository } from './member.repository';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('MemberService', () => {
  let service: MemberService;
  let repository: MemberRepository;

  const mockRepository = {
    findMemberByDiscordId: jest.fn(),
    searchMembers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemberService,
        {
          provide: MemberRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<MemberService>(MemberService);
    repository = module.get<MemberRepository>(MemberRepository);
  });

  describe('getMember', () => {
    it('should return member when found', async () => {
      const mockMember = {
        discordId: '123456789012345678',
        username: 'testuser',
        roles: [],
      };
      mockRepository.findMemberByDiscordId.mockResolvedValue(mockMember);

      const result = await service.getMember('server123', '123456789012345678');

      expect(result).toEqual(mockMember);
      expect(repository.findMemberByDiscordId).toHaveBeenCalledWith(
        'server123',
        '123456789012345678',
      );
    });

    it('should throw NotFoundException when member not found', async () => {
      mockRepository.findMemberByDiscordId.mockResolvedValue(null);

      await expect(
        service.getMember('server123', 'invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid Discord ID', async () => {
      await expect(service.getMember('server123', 'short')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('searchMembers', () => {
    it('should return paginated results', async () => {
      const mockResults = {
        members: [
          { id: '123', username: 'user1', isClubMember: true },
          { id: '456', username: 'user2', isClubMember: false },
        ],
        total: 2,
      };
      mockRepository.searchMembers.mockResolvedValue(mockResults);

      const queryDto = {
        query: 'user',
        roleId: undefined,
        page: 1,
        limit: 20,
        getDbPagination: () => ({ offset: 0, limit: 20, page: 1 }),
      };

      const result = await service.searchMembers('server123', queryDto);

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });
  });
});
