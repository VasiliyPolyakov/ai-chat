import { expect, test } from '@playwright/test';

test('the SPA loads and reaches the API through the proxy', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'AI Chat' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('API: ok');
});

test('deep links fall back to the SPA', async ({ page }) => {
  const response = await page.goto('/some/deep/link');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'AI Chat' })).toBeVisible();
});

test('/api/health is served by the API, not by the SPA fallback', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ status: 'ok', checks: { db: { status: 'up' } } });
});
