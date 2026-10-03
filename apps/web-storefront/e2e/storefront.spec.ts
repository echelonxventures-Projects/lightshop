import { expect, test } from '@playwright/test';

test('Acme Mart: B2C marketplace home → PDP with buy box and other sellers', async ({ page }) => {
  await page.goto('http://acme.localhost:3100/');
  await expect(page).toHaveTitle('Acme Mart');
  await expect(page.locator('html')).toHaveAttribute('data-tenant', 'acme-mart');
  await page.getByRole('link', { name: /Nova X2 Smartphone/ }).click();
  await expect(page.getByTestId('pdp-title')).toHaveText('Nova X2 Smartphone 128 GB');
  const buyBox = page.getByRole('region', { name: 'Buy box' });
  await expect(buyBox).toContainText('$479.00');
  await expect(buyBox).toContainText('sel_gadgetco');
  await expect(page.getByText('Other sellers (2)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to cart' })).toBeVisible();
});

test('Verde Wholesale: same deployment, different brand, theme and B2B behavior', async ({ page }) => {
  await page.goto('http://verde.localhost:3100/p/prd_demo_bolts');
  await expect(page).toHaveTitle(/Verde Wholesale/);
  const primary = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ls-color-primary').trim());
  expect(primary).toBe('#0F7B5F');
  await expect(page.getByRole('region', { name: 'Buy box' })).toContainText('Minimum order: 25');
  await expect(page.getByRole('button', { name: 'Request custom quote' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Categories' })).not.toContainText('Electronics');
});

test('Unknown host shows store not found', async ({ page }) => {
  const res = await page.goto('http://nobody.localhost:3100/');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Store not found' })).toBeVisible();
});
