import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { AppRoutes } from '@/app/router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ActiveClientProvider } from '@/context/ActiveClientContext';
import { SessionProvider } from '@/context/SessionContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { SHELL } from '@/lib/shell';
import { makeQueryClient } from '../helpers/render';
import { makeMe, permissionsFor, stubFetch } from '../helpers/server';
import type { StubRoute } from '../helpers/server';

/**
 * Shell isolation matrix (spec §9.1): this suite runs in BOTH shell modes —
 * `npm run test:web` and `npm run test:desktop` execute it with
 * VITE_APP_SHELL set, so `SHELL` is a per-run build constant.
 */

const EMPTY_LIST: StubRoute[] = [
  {
    match: '/reports/dashboard',
    data: { clientCount: 0, tasksByStatus: {}, dueIn7: 0, dueIn14: 0, dueIn30: 0, overdueFilings: 0, awaitingClient: 0, openRequests: 0, workload: [] },
  },
  { match: '/portal/clients', data: [{ id: 'client-1', displayName: 'Anil Kumar' }] },
  { match: '/portal/overview', data: { dueSoon: 0, overdue: 0, awaitingYou: 0, openRequests: 0, unreadMessages: 0, upcoming: [] } },
  { match: '/desktop/manifest', data: { minShellVersion: '0.1.0', latestShellVersion: '0.1.0', updateUrl: 'https://example.test/download' } },
  { match: '/me/sessions', data: [] },
  { match: '/messages/threads', data: [] },
  { match: '/notifications/unread-count', data: { notifications: 0, messages: 0 } },
  { match: '/users/staff', data: [] },
];

type Role = 'admin' | 'staff' | 'client' | null;

const stubSession = (role: Role): StubRoute[] =>
  role === null
    ? [{ match: '/me', errorCode: 'UNAUTHENTICATED', status: 401 }]
    : [
        {
          match: '/me',
          data: makeMe({
            role,
            permissions: permissionsFor(role),
            ...(role === 'client' ? { linkedClients: ['client-1'], unlinked: false } : {}),
          }),
        },
      ];

const renderAppAt = async (route: string, role: Role): Promise<void> => {
  stubFetch([...stubSession(role), ...EMPTY_LIST]);
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <ThemeProvider>
        <ToastProvider>
          <TooltipProvider>
            <MemoryRouter initialEntries={[route]}>
              <SessionProvider>
                <ActiveClientProvider>
                  <Suspense fallback={<p>Loading</p>}>
                    <AppRoutes />
                  </Suspense>
                </ActiveClientProvider>
              </SessionProvider>
            </MemoryRouter>
          </TooltipProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  await waitFor(
    () => {
      expect(screen.queryByText('Loading')).not.toBeInTheDocument();
    },
    { timeout: 5000 },
  );
};

afterEach(() => {
  window.localStorage.clear();
});

describe(`shell isolation (${SHELL} build)`, () => {
  it('computes the shell from the build flag', () => {
    expect(['web', 'desktop']).toContain(SHELL);
  });

  if (SHELL === 'web') {
    it('serves the landing page at / for anonymous visitors', async () => {
      await renderAppAt('/', null);
      await waitFor(() => {
        expect(document.title).toContain('JV Tax Consultancy');
      });
    });

    it('serves the client portal for client sessions', async () => {
      await renderAppAt('/portal', 'client');
      expect((await screen.findAllByText(/hello|overview|compliance|documents/i)).length).toBeGreaterThan(0);
    });

    it('serves the staff dashboard for an admin session on web', async () => {
      await renderAppAt('/dashboard', 'admin');
      await waitFor(() => {
        expect(screen.queryAllByText(/dashboard|workload|filings|due/i).length).toBeGreaterThan(0);
      });
    });

    it('serves the clients view for a staff session on web', async () => {
      await renderAppAt('/clients', 'staff');
      await waitFor(() => {
        expect(screen.queryAllByText(/clients|records|search/i).length).toBeGreaterThan(0);
      });
    });

    it('keeps client-only auth flows (sign-up) available', async () => {
      await renderAppAt('/sign-up', null);
      expect(
        await screen.findByRole('button', { name: /create account|sign ?up|register|start/i }),
      ).toBeTruthy();
    });
  }

  if (SHELL === 'desktop') {
    it('redirects / to sign-in with only the staff & admin tab', async () => {
      await renderAppAt('/', null);
      expect(await screen.findByRole('button', { name: /staff & admin/i }, { timeout: 10000 })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /client portal/i })).not.toBeInTheDocument();
    });

    it('shows the web-portal-required screen for a client session', async () => {
      await renderAppAt('/dashboard', 'client');
      expect(await screen.findByText(/clients use the web portal/i, {}, { timeout: 10000 })).toBeTruthy();
    });

    it('serves the staff dashboard for an admin session', async () => {
      await renderAppAt('/dashboard', 'admin');
      await waitFor(() => {
        expect((screen.queryAllByText(/dashboard|workload|filings|due/i)).length).toBeGreaterThan(0);
      });
    });
  }
});
