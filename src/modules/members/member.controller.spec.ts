import { Test, TestingModule } from '@nestjs/testing';
import { MemberController } from './member.controller';
import { MemberService } from './member.service';
import { PermissionsService } from '../permissions/permissions.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

const mockMemberService = {
  getMember: jest.fn(),
  searchMembers: jest.fn(),
};

const mockPermissionsService = {
  getMemberPermissions: jest.fn(),
};

describe('MemberController', () => {
  let controller: MemberController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MemberController],
      providers: [
        { provide: MemberService, useValue: mockMemberService },
        { provide: PermissionsService, useValue: mockPermissionsService },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(MemberController);
  });

  afterEach(() => jest.clearAllMocks());

  it('getMember delegates to memberService', async () => {
    mockMemberService.getMember.mockResolvedValue({ discordId: 'u1' });
    const result = await controller.getMember('s1', 'u1');
    expect(mockMemberService.getMember).toHaveBeenCalledWith('s1', 'u1');
    expect(result).toMatchObject({ discordId: 'u1' });
  });

  it('searchMembers returns paginated response', async () => {
    mockMemberService.searchMembers.mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
        hasNext: false,
        hasPrev: false,
      },
    });
    const queryDto = {
      getDbPagination: () => ({ page: 1, limit: 20, offset: 0 }),
    } as any;
    const result = await controller.searchMembers('s1', queryDto);
    expect(result.data).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
  });

  it('getMemberPermissions delegates to permissionsService', async () => {
    mockPermissionsService.getMemberPermissions.mockResolvedValue({
      permissions: ['READ_MEMBERS'],
    });
    const result = await controller.getMemberPermissions('s1', 'u1');
    expect(mockPermissionsService.getMemberPermissions).toHaveBeenCalledWith(
      's1',
      'u1',
    );
    expect(result).toMatchObject({ permissions: ['READ_MEMBERS'] });
  });
});
