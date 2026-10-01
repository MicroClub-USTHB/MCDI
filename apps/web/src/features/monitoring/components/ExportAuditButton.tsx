import { Download, LoaderCircle } from 'lucide-react';

import { useExportAuditLogsMutation } from '@/features/monitoring/api/mutations';
import type { AuditLogFilters } from '@/features/monitoring/types';
import { Button } from '@/shared/components/ui/button';

interface ExportAuditButtonProps {
  filters: AuditLogFilters;
}

function ExportAuditButton({ filters }: ExportAuditButtonProps) {
  const mutation = useExportAuditLogsMutation();

  return (
    <div className="flex items-center gap-3">
      {mutation.isError ? <span className="text-overline text-error">Export failed.</span> : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => mutation.mutate(filters)}
        disabled={mutation.isPending}
        aria-busy={mutation.isPending}
      >
        {mutation.isPending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Download aria-hidden="true" />
        )}
        Export CSV
      </Button>
    </div>
  );
}

export { ExportAuditButton };
