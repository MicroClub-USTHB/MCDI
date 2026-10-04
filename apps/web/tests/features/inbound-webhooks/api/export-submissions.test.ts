import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../setup';
import {
  ExportCancelled,
  buildExportRows,
  csvCell,
  exportCellText,
  exportSubmissions,
  toCsv,
} from '@/features/inbound-webhooks/api/export-submissions';

const API_URL = 'http://localhost:3000/api';

describe('csvCell', () => {
  it('leaves a plain value alone', () => {
    expect(csvCell('hello world')).toBe('hello world');
  });

  it('quotes a value with a comma, a quote or a line break, doubling the quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell('two\r\nlines')).toBe('"two\r\nlines"');
  });
});

describe('toCsv', () => {
  it('writes a header and one line per row, ended by CRLF', () => {
    expect(
      toCsv(
        ['id', 'name'],
        [
          ['1', 'Ada, A.'],
          ['2', ''],
        ]
      )
    ).toBe('id,name\r\n1,"Ada, A."\r\n2,');
  });
});

describe('exportCellText', () => {
  it('writes scalars as they are, a missing value as nothing', () => {
    expect(exportCellText('Ada')).toBe('Ada');
    expect(exportCellText(7)).toBe('7');
    expect(exportCellText(-5)).toBe('-5');
    expect(exportCellText(false)).toBe('false');
    expect(exportCellText(undefined)).toBe('');
    expect(exportCellText(null)).toBe('');
  });

  it('writes a list or an object as JSON, in full', () => {
    expect(exportCellText(['a', 'b'])).toBe('["a","b"]');
    expect(exportCellText({ a: 1 })).toBe('{"a":1}');
    expect(exportCellText('x'.repeat(500))).toHaveLength(500);
  });

  it.each(['=SUM(A1:A9)', '+1+1', '-2+3', '@cmd', '\tsneaky'])(
    'defuses text that a spreadsheet would run as a formula: %j',
    (text) => {
      expect(exportCellText(text)).toBe(`'${text}`);
    }
  );

  it('does not touch a negative number, which is a number and not a formula', () => {
    expect(exportCellText(-5)).toBe('-5');
  });
});

describe('buildExportRows', () => {
  const schema = {
    version: 1,
    steps: [
      {
        key: 'identity',
        fields: [
          { key: 'firstname', type: 'string' },
          { key: 'tags', type: 'array', item: { key: 'tag', type: 'string' } },
        ],
      },
    ],
  };

  it('has id and receivedAt, then one column per answer in schema order', () => {
    const { header, rows } = buildExportRows(schema, [
      {
        id: 's1',
        receivedAt: '2026-10-04T10:00:00.000Z',
        origin: null,
        payload: { identity: { firstname: 'Ada', tags: ['a', 'b'] } },
      },
      { id: 's2', receivedAt: '2026-10-04T11:00:00.000Z', origin: null, payload: {} },
    ]);

    expect(header).toEqual(['id', 'receivedAt', 'identity.firstname', 'identity.tags']);
    expect(rows).toEqual([
      ['s1', '2026-10-04T10:00:00.000Z', 'Ada', '["a","b"]'],
      ['s2', '2026-10-04T11:00:00.000Z', '', ''],
    ]);
  });

  it('names flat columns by their own key', () => {
    const { header } = buildExportRows(
      { version: 1, fields: [{ key: 'title', type: 'string' }] },
      []
    );

    expect(header).toEqual(['id', 'receivedAt', 'title']);
  });
});

describe('exportSubmissions', () => {
  const schema = { version: 1, fields: [{ key: 'n', type: 'number' }] };

  function serve(total: number) {
    const requests: URL[] = [];
    server.use(
      http.get(`${API_URL}/inbound-webhooks/wh_1/submissions`, ({ request }) => {
        const url = new URL(request.url);
        requests.push(url);
        const offset = Number(url.searchParams.get('offset'));
        const limit = Number(url.searchParams.get('limit'));
        const count = Math.max(0, Math.min(limit, total - offset));
        return HttpResponse.json({
          submissions: Array.from({ length: count }, (_, i) => ({
            id: `s${offset + i}`,
            receivedAt: '2026-10-04T10:00:00.000Z',
            origin: null,
            payload: { n: offset + i },
          })),
          total,
          limit,
          offset,
        });
      })
    );
    return requests;
  }

  it('pages through everything, two hundred at a time, reporting progress', async () => {
    const requests = serve(450);
    const progress: [number, number][] = [];

    const csv = await exportSubmissions({
      webhookId: 'wh_1',
      schema,
      filters: {},
      onProgress: (done, total) => progress.push([done, total]),
    });

    expect(requests.map((r) => r.searchParams.get('offset'))).toEqual(['0', '200', '400']);
    expect(requests.every((r) => r.searchParams.get('limit') === '200')).toBe(true);
    expect(progress).toEqual([
      [200, 450],
      [400, 450],
      [450, 450],
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('id,receivedAt,n');
    expect(lines).toHaveLength(451);
    expect(lines[451 - 1]).toBe('s449,2026-10-04T10:00:00.000Z,449');
  });

  it('keeps the date filters, to the end of the chosen last day', async () => {
    const requests = serve(1);

    await exportSubmissions({
      webhookId: 'wh_1',
      schema,
      filters: { dateFrom: '2026-10-01', dateTo: '2026-10-04' },
    });

    expect(requests[0]?.searchParams.get('dateFrom')).toBe('2026-10-01');
    expect(requests[0]?.searchParams.get('dateTo')).toBe('2026-10-04T23:59:59.999Z');
  });

  it('gives just the header when there is nothing', async () => {
    serve(0);

    await expect(exportSubmissions({ webhookId: 'wh_1', schema, filters: {} })).resolves.toBe(
      'id,receivedAt,n'
    );
  });

  it('stops between pages when cancelled', async () => {
    const requests = serve(1000);
    const controller = new AbortController();

    const promise = exportSubmissions({
      webhookId: 'wh_1',
      schema,
      filters: {},
      signal: controller.signal,
      onProgress: () => controller.abort(),
    });

    await expect(promise).rejects.toBeInstanceOf(ExportCancelled);
    expect(requests).toHaveLength(1);
  });

  it('fails with the API error when a page fails', async () => {
    server.use(
      http.get(`${API_URL}/inbound-webhooks/wh_1/submissions`, () =>
        HttpResponse.json({ message: 'Not Found', error: 'Not Found' }, { status: 404 })
      )
    );

    await expect(
      exportSubmissions({ webhookId: 'wh_1', schema, filters: {} })
    ).rejects.toMatchObject({ status: 404 });
  });
});
