import type * as ReactQuery from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof ReactQuery>('@tanstack/react-query');

  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

import { useQuery } from '@tanstack/react-query';

import { useSystemHealthQuery } from '@/features/monitoring/api/queries';

describe('monitoring query wiring', () => {
  it('wires the 60 second health refetch interval', () => {
    useSystemHealthQuery();

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        refetchInterval: 60_000,
        retry: false,
      })
    );
  });
});
