import { describe, expect, it } from 'vitest';

import {
  mapMemberDetail,
  mapMemberListItem,
  mapMemberListResponse,
  mapMemberServersResponse,
} from '@/features/members/api/mappers';
import type {
  CrossServerListItemDto,
  MemberDetailDto,
  MemberCrossServerViewDto,
  PaginatedCrossServerListDto,
} from '@/features/members/types';

const listItem: CrossServerListItemDto = {
  memberId: '123',
  username: 'clubber',
  globalName: 'Clubber Lang',
  avatar: 'abc123',
  isClubMember: true,
  serverCount: 2,
  servers: [
    {
      serverId: '1',
      serverName: 'Main',
      isMainServer: true,
      joinedAt: '2026-08-01T10:00:00.000Z',
      roleNames: ['Admin', 'Mod'],
    },
  ],
};

const detailItem: MemberCrossServerViewDto = {
  memberId: '123',
  username: 'clubber',
  globalName: 'Clubber Lang',
  displayName: 'Clubber',
  avatar: 'abc123',
  isClubMember: true,
  servers: [
    {
      serverId: '1',
      serverName: 'Main',
      serverIcon: null,
      isMainServer: true,
      joinedAt: '2026-08-01T10:00:00.000Z',
      roles: [
        { id: 'r1', name: 'Admin', color: 16711680, position: 10 },
        { id: 'r2', name: 'Mod', color: null, position: 9 },
      ],
    },
  ],
};

const profileItem: MemberDetailDto = {
  memberId: '123',
  username: 'clubber',
  globalName: 'Clubber Lang',
  displayName: 'Clubber',
  avatar: 'abc123',
  isClubMember: true,
};

describe('members mappers', () => {
  it('maps a list item into the domain shape with avatar helpers', () => {
    expect(mapMemberListItem(listItem)).toEqual({
      memberId: '123',
      username: 'clubber',
      globalName: 'Clubber Lang',
      displayName: 'Clubber Lang',
      avatar: 'abc123',
      avatarUrl: 'https://cdn.discordapp.com/avatars/123/abc123.png?size=64',
      avatarInitials: 'CL',
      isClubMember: true,
      serverCount: 2,
      servers: listItem.servers,
    });
  });

  it('uses the animated avatar extension when Discord returns an animated hash', () => {
    expect(
      mapMemberListItem({
        ...listItem,
        avatar: 'a_animatedhash',
      })
    ).toMatchObject({
      avatarUrl: 'https://cdn.discordapp.com/avatars/123/a_animatedhash.gif?size=64',
    });
  });

  it('renames limit to pageSize while mapping every item', () => {
    const dto: PaginatedCrossServerListDto = {
      data: [listItem],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };

    expect(mapMemberListResponse(dto)).toEqual({
      data: [mapMemberListItem(listItem)],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
  });

  it('maps the member profile response into the detail shape', () => {
    expect(mapMemberDetail(profileItem)).toEqual({
      memberId: '123',
      username: 'clubber',
      globalName: 'Clubber Lang',
      displayName: 'Clubber',
      avatar: 'abc123',
      avatarUrl: 'https://cdn.discordapp.com/avatars/123/abc123.png?size=64',
      avatarInitials: 'CL',
      isClubMember: true,
      servers: [],
    });
  });

  it('maps cross-server roles into hex badge colors', () => {
    expect(mapMemberServersResponse(detailItem)).toEqual({
      memberId: '123',
      username: 'clubber',
      globalName: 'Clubber Lang',
      displayName: 'Clubber',
      avatar: 'abc123',
      avatarUrl: 'https://cdn.discordapp.com/avatars/123/abc123.png?size=64',
      avatarInitials: 'CL',
      isClubMember: true,
      servers: [
        {
          serverId: '1',
          serverName: 'Main',
          serverIcon: null,
          isMainServer: true,
          joinedAt: '2026-08-01T10:00:00.000Z',
          roles: [
            { id: 'r1', name: 'Admin', color: '#ff0000', position: 10 },
            { id: 'r2', name: 'Mod', color: null, position: 9 },
          ],
        },
      ],
    });
  });
});
