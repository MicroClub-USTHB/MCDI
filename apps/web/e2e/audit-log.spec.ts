import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

test('filters audit logs by date and severity, then exports CSV', async ({ page }) => {
  await page.goto('/dashboard/monitoring');

  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'System Monitoring' })).toBeVisible();

  const dateFrom = page.getByLabel('Date from');
  const dateTo = page.getByLabel('Date to');
  const severity = page.getByLabel('Severity');
  const auditTable = page.getByRole('table', { name: 'Audit logs' });

  await expect(dateFrom).toBeVisible();
  await dateFrom.fill('2020-01-01');
  await dateTo.fill('2099-12-31');

  const filteredLogsResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === 'GET' &&
      url.pathname.endsWith('/admin/audit/logs') &&
      url.searchParams.get('dateFrom') === '2020-01-01' &&
      url.searchParams.get('dateTo') === '2099-12-31' &&
      url.searchParams.get('severity') === 'info'
    );
  });
  await severity.selectOption('info');
  await filteredLogsResponse;

  const rows = auditTable.locator('tbody tr:has(td:nth-child(6))');
  await expect
    .poll(async () => {
      const currentRows = await rows.count();
      if (currentRows === 0) return 'empty';

      const severityCells = await rows.locator('td:nth-child(6)').allTextContents();
      return severityCells.every((text) => text.trim().toLowerCase() === 'info')
        ? 'filtered'
        : 'pending';
    })
    .toMatch(/^(empty|filtered)$/);
  const rowCount = await rows.count();
  if (rowCount > 0) {
    const severityCells = rows.locator('td:nth-child(6)');
    await expect(severityCells).toHaveCount(rowCount);
    const visibleSeverities = await severityCells.allTextContents();
    expect(visibleSeverities.every((text) => text.trim().toLowerCase() === 'info')).toBe(true);
  } else {
    await expect(page.getByText('No audit logs found')).toBeVisible();
  }

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error('Playwright did not provide a downloaded file path');
  const csv = await readFile(downloadPath, 'utf8');
  expect(csv.trim().length).toBeGreaterThan(0);

  await dateFrom.fill('');
  await dateTo.fill('');
  await severity.selectOption('');
});
