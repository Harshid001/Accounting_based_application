import { expect, test, type Page } from '@playwright/test';

const unauthenticated = async (page: Page): Promise<void> => {
  await page.route('**/api/v1/me', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.', requestId: 'e2e-me' },
      }),
    });
  });
};

test('renders the dedicated web client sign-in surface', async ({ page }) => {
  await unauthenticated(page);
  await page.goto('/sign-in?portal=client');

  await expect(page.getByRole('heading', { name: 'Client Portal Sign In' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Client Portal', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google as Client' })).toBeVisible();
  await expect(page.locator('nav[aria-label="Main"]')).toHaveCount(0);

  await page.screenshot({ path: 'test-results/web-client-sign-in.png', fullPage: true });
});
