'use client';

import { Download } from 'lucide-react';

import { McButton } from '@/shared/components/ui/mc-button';
import { useExportMembersMutation } from '@/features/members/api/mutations';
import type { MemberFilters } from '@/features/members/types';

interface ExportButtonProps {
  format: 'csv' | 'json';
  filters: MemberFilters;
}

export function ExportButton({ format, filters }: ExportButtonProps) {
  const exportMutation = useExportMembersMutation();

  return (
    <McButton
      type="button"
      variant="secondary"
      icon="leading"
      iconDefinition={<Download aria-hidden="true" />}
      isLoading={exportMutation.isPending}
      onClick={() => exportMutation.mutate({ filters, format })}
      aria-busy={exportMutation.isPending}
    >
      {exportMutation.isPending
        ? `Exporting ${format.toUpperCase()}…`
        : `Export ${format.toUpperCase()}`}
    </McButton>
  );
}
