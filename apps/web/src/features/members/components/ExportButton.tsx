'use client';

import { Download, Loader2 } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { useExportMembersMutation } from '@/features/members/api/mutations';
import type { MemberFilters } from '@/features/members/types';

interface ExportButtonProps {
  format: 'csv' | 'json';
  filters: MemberFilters;
}

export function ExportButton({ format, filters }: ExportButtonProps) {
  const exportMutation = useExportMembersMutation();

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() => exportMutation.mutate({ filters, format })}
      disabled={exportMutation.isPending}
      aria-busy={exportMutation.isPending}
      className="bg-surface-elevated"
    >
      {exportMutation.isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
      <span>
        {exportMutation.isPending
          ? `Exporting ${format.toUpperCase()}…`
          : `Export ${format.toUpperCase()}`}
      </span>
    </Button>
  );
}
