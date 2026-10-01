import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';

import { server } from '../../setup';
import { AuditLogFilters, ExportAuditButton } from '@/features/monitoring/components';
import type { AuditLogFilters as AuditLogFilterState } from '@/features/monitoring/types';

const BASE_URL = 'http://localhost:3000/api';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function MonitoringFlowHarness() {
  const [filters, setFilters] = useState<AuditLogFilterState>({});

  return (
    <div className="space-y-4">
      <AuditLogFilters filters={filters} onChange={setFilters} />
      <ExportAuditButton filters={filters} />
    </div>
  );
}

describe('monitoring flow', () => {
  it('filters audit logs by date range and severity, then exports CSV', async () => {
    let exportRequestUrl: URL | undefined;
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:audit');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    server.use(
      http.get(`${BASE_URL}/admin/audit/logs/export`, ({ request }) => {
        exportRequestUrl = new URL(request.url);
        return new HttpResponse('timestamp,actor\n2026-04-01,admin-1\n', {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="audit-logs.csv"',
          },
        });
      })
    );

    const user = userEvent.setup();

    render(<MonitoringFlowHarness />, { wrapper });

    fireEvent.change(screen.getByLabelText('Date from'), { target: { value: '2026-04-01' } });
    fireEvent.change(screen.getByLabelText('Date to'), { target: { value: '2026-04-30' } });
    await user.selectOptions(screen.getByLabelText('Severity'), 'error');
    await user.click(screen.getByLabelText('Auth'));
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalledOnce());

    expect(exportRequestUrl?.searchParams.get('dateFrom')).toBe('2026-04-01');
    expect(exportRequestUrl?.searchParams.get('dateTo')).toBe('2026-04-30');
    expect(exportRequestUrl?.searchParams.get('severity')).toBe('error');
    expect(exportRequestUrl?.searchParams.get('actionType')).toBe('auth');
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:audit');

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    clickSpy.mockRestore();
  });
});
