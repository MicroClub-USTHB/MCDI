'use client';

import type { ReactNode } from 'react';

import { DataTable, type DataTableColumn } from './data-table';
import { Pagination } from './pagination';
import type { PaginatedResponse } from '@/shared/types';
import type { MemberListItem } from '@/features/members/types';

interface MemberTableProps {
  members: MemberListItem[];
  columns: DataTableColumn<MemberListItem>[];
  pagination: PaginatedResponse<MemberListItem>;
  onRowClick?: (member: MemberListItem) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  isLoading?: boolean;
  emptyState?: ReactNode;
}

export function MemberTable({
  members,
  columns,
  pagination,
  onRowClick,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
  emptyState,
}: MemberTableProps) {
  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={members}
        getRowId={(member) => member.memberId}
        isLoading={isLoading}
        onRowClick={onRowClick}
        emptyState={emptyState}
        ariaLabel="Members table"
      />
      <Pagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pagination.total}
        totalPages={pagination.totalPages}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
