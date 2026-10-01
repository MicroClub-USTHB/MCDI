import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { expect, test as setup } from '@playwright/test';

const authFile = resolve(process.env.PLAYWRIGHT_STORAGE_STATE ?? 'e2e/.auth/admin.json');

setup.setTimeout(300_000);

setup('authenticate as a real Discord admin', async ({ page, context }) => {
  await mkdir(dirname(authFile), { recursive: true });
  await page.goto('/login');
  await page.getByRole('link', { name: 'Login with Discord' }).click();

  await expect(page).toHaveURL(/\/dashboard(?:\/|$)/, { timeout: 300_000 });
  await context.storageState({ path: authFile });
});
