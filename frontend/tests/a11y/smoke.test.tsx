import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppRoutes } from '@/app/router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ActiveClientProvider } from '@/context/ActiveClientContext';
import { SessionProvider } from '@/context/SessionContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { makeQueryClient } from '../helpers/render';
import { makeMe, permissionsFor, stubFetch } from '../helpers/server';
import type { StubRoute } from '../helpers/server';
import type { Role } from '@/types/enums';

const EMPTY_LIST: StubRoute[] = [
  { match: '/reports/dashboard', data: { clientCount: 0, tasksByStatus: {}, dueIn7: 0, dueIn14: 0, dueIn30: 0, overdueFilings: 0, awaitingClient: 0, openRequests: 0, workload: [] } },
  { match: '/reports/compliance', data: { totals: {}, rows: [] } },
  { match: '/reports/workload', data: [] },
  { match: '/reports/roster', data: [] },
  { match: '/portal/overview', data: { dueSoon: 0, overdue: 0, awaitingYou: 0, openRequests: 0, unreadMessages: 0, upcoming: [] } },
  { match: '/portal/clients', data: [{ id: 'client-1', displayName: 'Anil Kumar' }] },
  { match: '/portal/activity', data: [] },
  { match: '/portal/compliance', data: [] },
  { match: '/portal/requests', data: [] },
  { match: '/portal/tasks', data: [] },
  { match: '/settings/firm', data: { firmName: 'Test Firm', address: null, contactEmail: null, contactPhone: null, logoStorageKey: null, financialYearStartMonth: 4 } },
  { match: '/messages/threads', data: [] },
  { match: '/notifications/unread-count', data: { notifications: 0, messages: 0 } },
  { match: '/notifications', data: [] },
  { match: '/compliance-types', data: [] },
  { match: '/users/staff', data: [] },
  { match: '/users', data: [] },
  { match: '/clients', data: [] },
  { match: '/compliance', data: [] },
  { match: '/tasks', data: [] },
  { match: '/documents', data: [] },
  { match: '/document-requests', data: [] },
  { match: '/my-work', data: [] },
  { match: '/audit', data: [] },
  { match: '/jobs', data: [] },
  { match: '/me/sessions', data: [] },
];

const RULES: axe.RunOptions = {
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
  },
  rules: {
    'color-contrast': { enabled: false },
  },
};

function Harness({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      <ThemeProvider>
        <ToastProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const renderRoute = async (
  route: string,
  role: Role | null,
  extra: readonly StubRoute[] = [],
): Promise<HTMLElement> => {
  const me =
    role === null
      ? ({ match: '/me', errorCode: 'UNAUTHENTICATED', status: 401 } satisfies StubRoute)
      : ({
          match: '/me',
          data: makeMe({
            role,
            permissions: permissionsFor(role),
            ...(role === 'client' ? { linkedClients: ['client-1'], unlinked: false } : {}),
          }),
        } satisfies StubRoute);

  stubFetch([me, ...extra, ...EMPTY_LIST]);

  const { container } = render(
    <Harness>
      <MemoryRouter initialEntries={[route]}>
        <SessionProvider>
          <ActiveClientProvider>
            <Suspense fallback={<p>Loading</p>}>
              <AppRoutes />
            </Suspense>
          </ActiveClientProvider>
        </SessionProvider>
      </MemoryRouter>
    </Harness>,
  );

  await waitFor(
    () => {
      expect(screen.queryByText('Loading')).not.toBeInTheDocument();
    },
    { timeout: 5000 },
  );

  return container;
};

const expectNoViolations = async (container: HTMLElement): Promise<void> => {
  const results = await axe.run(container, RULES);
  const summary = results.violations.map(
    (violation) => `${violation.id}: ${violation.nodes.length} node(s) — ${violation.help}`,
  );
  expect(summary).toEqual([]);
};

describe('accessibility smoke across the top-level routes', () => {
  const publicRoutes = ['/sign-in', '/sign-up', '/forgot-password', '/403', '/404'];
  for (const route of publicRoutes) {
    it(`reports no violations on ${route}`, async () => {
      await expectNoViolations(await renderRoute(route, null));
    });
  }

  const staffRoutes = [
    '/dashboard',
    '/my-work',
    '/clients',
    '/clients/new',
    '/compliance',
    '/tasks',
    '/documents',
    '/requests',
    '/messages',
    '/reports/compliance',
    '/reports/workload',
    '/reports/roster',
    '/notifications',
    '/profile',
  ];
  for (const route of staffRoutes) {
    it(`reports no violations on ${route}`, async () => {
      await expectNoViolations(await renderRoute(route, 'admin'));
    });
  }

  const adminRoutes = [
    '/settings/firm',
    '/settings/users',
    '/settings/catalogue',
    '/settings/unlinked-accounts',
    '/settings/audit',
    '/settings/jobs',
  ];
  for (const route of adminRoutes) {
    it(`reports no violations on ${route}`, async () => {
      await expectNoViolations(await renderRoute(route, 'admin'));
    });
  }

  const portalRoutes = [
    '/portal',
    '/portal/compliance',
    '/portal/documents',
    '/portal/requests',
    '/portal/tasks',
    '/portal/messages',
  ];
  for (const route of portalRoutes) {
    it(`reports no violations on ${route}`, async () => {
      await expectNoViolations(await renderRoute(route, 'client'));
    });
  }
});
