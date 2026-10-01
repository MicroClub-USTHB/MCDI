'use client';

import { useMutation } from '@tanstack/react-query';
import { exportMembers } from '@/features/members/api/service';
import type { MemberFilters } from '@/features/members/types';

export interface ExportMembersVariables {
  filters: MemberFilters;
  format: 'csv' | 'json';
}

export function useExportMembersMutation() {
  return useMutation({
    mutationFn: async ({ filters, format }: ExportMembersVariables) => {
      await exportMembers(filters, format);
    },
  });
}
