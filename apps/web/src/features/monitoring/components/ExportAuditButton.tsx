import { Download } from 'lucide-react';

import { useExportAuditLogsMutation } from '@/features/monitoring/api/mutations';
import type { AuditLogFilters } from '@/features/monitoring/types';
import { McButton } from '@/shared/components/ui/mc-button';

interface ExportAuditButtonProps {
  filters: AuditLogFilters;
}

function ExportAuditButton({ filters }: ExportAuditButtonProps) {
  const mutation = useExportAuditLogsMutation();

  return (
    <div className="flex items-center gap-3">
      {mutation.isError ? (
        <span className="paragraph-xs font-semibold text-error">Export failed.</span>
      ) : null}
      <McButton
        type="button"
        variant="secondary"
        size="sm"
        icon="leading"
        iconDefinition={<Download aria-hidden="true" />}
        onClick={() => mutation.mutate(filters)}
        isLoading={mutation.isPending}
        aria-busy={mutation.isPending}
      >
        Export CSV
      </McButton>
    </div>
  );
}

export { ExportAuditButton };
