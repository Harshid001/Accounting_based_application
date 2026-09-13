import { expect, test, type Page, type Route } from '@playwright/test';

type Session = 'anonymous' | 'admin';

const fulfill = async (route: Route, status: number, data: unknown): Promise<void> => {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ data, meta: { requestId: 'e2e-request' } }),
  });
};

const loginUser = {
  id: 'user-e2e-admin',
  name: 'Priya Nair',
  email: 'priya@firm.example',
  emailVerified: true,
  role: 'admin',
  status: 'active',
  phone: null,
  image: null,
  linkedClients: [],
  pinnedClients: [],
  notificationPreferences: {
    emailOnAssignment: true,
    emailDeadlineReminders: true,
    emailDailyDigest: false,
  },
  unlinked: false,
  permissions: {
    'client:read': true,
    'client:create': true,
    'compliance:read': true,
    'compliance:bulk': true,
    'task:read': true,
    'task:create': true,
    'document:read': true,
    'settings:write': true,
  },
};

const routeDesktopApi = async (page: Page, session: Session): Promise<void> => {
  await page.route('**/api/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;

    if (pathname.endsWith('/desktop/manifest')) {
      await fulfill(route, 200, {
        minShellVersion: '0.1.1',
        latestShellVersion: '0.1.1',
        updateUrl: 'https://example.test/desktop-download',
      });
      return;
    }

    if (pathname.endsWith('/me')) {
      if (session === 'anonymous') {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'UNAUTHENTICATED',
              message: 'Sign in to continue.',
              requestId: 'e2e-me',
            },
          }),
        });
        return;
      }
      await fulfill(route, 200, loginUser);
      return;
    }

    if (pathname.endsWith('/reports/dashboard')) {
      await fulfill(route, 200, {
        clientCount: 1,
        tasksByStatus: { not_started: 0, in_progress: 1, review: 0, done: 0 },
        dueIn7: 1,
        dueIn14: 0,
        dueIn30: 0,
        overdueFilings: 0,
        awaitingClient: 0,
        openRequests: 0,
        workload: [],
      });
      return;
    }

    if (pathname.endsWith('/notifications/unread-count')) {
      await fulfill(route, 200, { notifications: 0, messages: 0 });
      return;
    }

    await fulfill(route, 200, []);
  });
};

test('renders the dedicated desktop sign-in surface', async ({ page }) => {
  await routeDesktopApi(page, 'anonymous');
  await page.goto('/sign-in');

  await expect(page.getByRole('heading', { name: 'Desktop Workspace Sign In' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Staff & Admin' })).toBeVisible();
  await expect(page.getByRole('button', { name: /google/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /client portal/i })).toHaveCount(0);

  await page.screenshot({ path: 'test-results/desktop-staff-sign-in.png', fullPage: true });
});

test('keeps the desktop workspace sidebar persistent', async ({ page }) => {
  await routeDesktopApi(page, 'admin');
  await page.goto('/dashboard');

  const sidebar = page.locator('nav[aria-label="Main"]');
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole('link', { name: /dashboard/i }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Collapse the sidebar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open navigation menu' })).toHaveCount(0);

  await page.screenshot({ path: 'test-results/desktop-persistent-sidebar.png', fullPage: true });
});
