import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { getActiveClientHeader, setActiveClientHeader } from '@/api/client';
import { EntitySwitcher } from '@/components/domain/EntitySwitcher';
import { ActiveClientProvider } from '@/context/ActiveClientContext';
import { SessionProvider } from '@/context/SessionContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { makeQueryClient } from '../helpers/render';
import { makeMe, permissionsFor, stubFetch } from '../helpers/server';
import type { FetchStub } from '../helpers/server';

interface Linked {
  id: string;
  displayName: string;
}

const renderSwitcher = (
  linkedClients: string[],
  portalClients: Linked[],
): { stub: FetchStub } => {
  const stub = stubFetch([
    {
      match: '/portal/clients',
      data: portalClients,
    },
    {
      match: '/me',
      data: makeMe({
        role: 'client',
        linkedClients,
        unlinked: linkedClients.length === 0,
        permissions: permissionsFor('client'),
      }),
    },
  ]);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={makeQueryClient()}>
      <ThemeProvider>
        <ToastProvider>
          <MemoryRouter>
            <SessionProvider>
              <ActiveClientProvider>{children}</ActiveClientProvider>
            </SessionProvider>
          </MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );

  render(<EntitySwitcher />, { wrapper });
  return { stub };
};

afterEach(() => {
  setActiveClientHeader(null);
  window.localStorage.clear();
});

describe('the portal entity switcher', () => {
  it('does not render for a user linked to exactly one client', async () => {
    renderSwitcher(['client-1'], [{ id: 'client-1', displayName: 'Anil Kumar' }]);

    await waitFor(() => {
      expect(getActiveClientHeader()).toBe('client-1');
    });
    expect(screen.queryByRole('combobox', { name: 'Active entity' })).not.toBeInTheDocument();
  });

  it('renders for a user linked to more than one client', async () => {
    renderSwitcher(
      ['client-1', 'client-2'],
      [
        { id: 'client-1', displayName: 'Anil Kumar' },
        { id: 'client-2', displayName: 'Kumar Textiles' },
      ],
    );

    expect(await screen.findByRole('combobox', { name: 'Active entity' })).toBeInTheDocument();
  });

  it('defaults the active client to the first linked record', async () => {
    renderSwitcher(
      ['client-1', 'client-2'],
      [
        { id: 'client-1', displayName: 'Anil Kumar' },
        { id: 'client-2', displayName: 'Kumar Textiles' },
      ],
    );

    await waitFor(() => {
      expect(getActiveClientHeader()).toBe('client-1');
    });
    expect(await screen.findByText('Anil Kumar')).toBeInTheDocument();
  });

  it('changes the header that every later request carries when the entity changes', async () => {
    renderSwitcher(
      ['client-1', 'client-2'],
      [
        { id: 'client-1', displayName: 'Anil Kumar' },
        { id: 'client-2', displayName: 'Kumar Textiles' },
      ],
    );

    const switcher = await screen.findByRole('combobox', { name: 'Active entity' });
    await waitFor(() => {
      expect(getActiveClientHeader()).toBe('client-1');
    });

    await userEvent.click(switcher);
    await userEvent.click(await screen.findByRole('option', { name: 'Kumar Textiles' }));

    await waitFor(() => {
      expect(getActiveClientHeader()).toBe('client-2');
    });
  });

  it('remembers the choice for that user across a remount', async () => {
    const first = renderSwitcher(
      ['client-1', 'client-2'],
      [
        { id: 'client-1', displayName: 'Anil Kumar' },
        { id: 'client-2', displayName: 'Kumar Textiles' },
      ],
    );

    const switcher = await screen.findByRole('combobox', { name: 'Active entity' });
    await userEvent.click(switcher);
    await userEvent.click(await screen.findByRole('option', { name: 'Kumar Textiles' }));
    await waitFor(() => {
      expect(getActiveClientHeader()).toBe('client-2');
    });
    first.stub.restore();

    setActiveClientHeader(null);
    renderSwitcher(
      ['client-1', 'client-2'],
      [
        { id: 'client-1', displayName: 'Anil Kumar' },
        { id: 'client-2', displayName: 'Kumar Textiles' },
      ],
    );

    await waitFor(() => {
      expect(getActiveClientHeader()).toBe('client-2');
    });
  });

  it('ignores a stored client the account is no longer linked to', async () => {
    window.localStorage.setItem('firmdesk.activeClient.user-1', 'client-9');

    renderSwitcher(
      ['client-1', 'client-2'],
      [
        { id: 'client-1', displayName: 'Anil Kumar' },
        { id: 'client-2', displayName: 'Kumar Textiles' },
      ],
    );

    await waitFor(() => {
      expect(getActiveClientHeader()).toBe('client-1');
    });
  });

  it('sends no active-client header at all for an unlinked account', async () => {
    renderSwitcher([], []);

    await waitFor(() => {
      expect(getActiveClientHeader()).toBeNull();
    });
    expect(screen.queryByRole('combobox', { name: 'Active entity' })).not.toBeInTheDocument();
  });
});
