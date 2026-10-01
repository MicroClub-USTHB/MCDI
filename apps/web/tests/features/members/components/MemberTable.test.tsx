import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MemberTable } from '@/features/members/components/MemberTable';
import type { MemberListItem } from '@/features/members/types';
import type { DataTableColumn } from '@/features/members/components/data-table';

const members: MemberListItem[] = [
  {
    memberId: '123',
    username: 'clubber',
    globalName: 'Clubber Lang',
    displayName: 'Clubber Lang',
    avatar: null,
    avatarUrl: null,
    avatarInitials: 'CL',
    isClubMember: true,
    serverCount: 1,
    servers: [
      {
        serverId: '1',
        serverName: 'Main',
        isMainServer: true,
        joinedAt: null,
        roleNames: ['Admin'],
      },
    ],
  },
];

const columns: DataTableColumn<MemberListItem>[] = [
  { id: 'member', header: 'Member', cell: (member) => member.displayName },
];

describe('MemberTable', () => {
  it('forwards row clicks to the navigation handler', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();

    render(
      <MemberTable
        members={members}
        columns={columns}
        pagination={{ data: members, total: 1, page: 1, pageSize: 50, totalPages: 1 }}
        onRowClick={onRowClick}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    await user.click(screen.getByText('Clubber Lang'));
    expect(onRowClick).toHaveBeenCalledWith(members[0]);
  });
});
