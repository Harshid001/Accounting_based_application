import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClientForm } from '@/routes/clients/components/ClientForm';
import type { ClientFormValues } from '@/schemas/client.schema';
import { renderWithProviders } from '../helpers/render';
import { stubFetch } from '../helpers/server';

const setup = (props: Partial<React.ComponentProps<typeof ClientForm>> = {}) => {
  const onSubmit = vi.fn<(values: ClientFormValues) => Promise<void>>(() => Promise.resolve());
  renderWithProviders(
    <ClientForm
      mode="create"
      canEditPrivileged
      submitLabel="Add client"
      formError={null}
      fieldErrors={{}}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
      {...props}
    />,
  );
  return { onSubmit };
};

const fillRequired = async (): Promise<void> => {
  await userEvent.type(screen.getByLabelText(/^Display name/), 'Acme Traders');
  await userEvent.type(screen.getByLabelText(/^Name/), 'Meena Rao');
  await userEvent.type(screen.getByLabelText(/^Email/), 'meena@acme.example');
};

beforeEach(() => {
  stubFetch([{ match: '/users/staff', data: [] }]);
});

describe('ClientForm identifier fieldset', () => {
  it('shows the business identifiers by default and no individual ones', () => {
    setup();
    expect(screen.getByLabelText('GSTIN')).toBeInTheDocument();
    expect(screen.getByLabelText('TAN')).toBeInTheDocument();
    expect(screen.getByLabelText('CIN')).toBeInTheDocument();
    expect(screen.queryByLabelText('Aadhaar')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Date of birth')).not.toBeInTheDocument();
  });

  it('swaps the whole fieldset when the client type changes to individual', async () => {
    setup();
    await userEvent.click(screen.getByRole('radio', { name: /Individual/ }));

    expect(await screen.findByLabelText('Aadhaar')).toBeInTheDocument();
    expect(screen.getByLabelText('Date of birth')).toBeInTheDocument();
    expect(screen.queryByLabelText('GSTIN')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('CIN')).not.toBeInTheDocument();
  });

  it('keeps PAN on both types, because both need it', async () => {
    setup();
    expect(screen.getByLabelText('PAN')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Individual/ }));
    expect(await screen.findByLabelText('PAN')).toBeInTheDocument();
  });

  it('locks the type on an existing record instead of offering the radios', () => {
    setup({ mode: 'edit' });
    expect(screen.queryByRole('radio', { name: /Individual/ })).not.toBeInTheDocument();
    expect(screen.getByText(/cannot change between individual and business/)).toBeInTheDocument();
  });
});

describe('ClientForm validation', () => {
  it('refuses an invalid PAN and says what was expected', async () => {
    const { onSubmit } = setup();
    await fillRequired();
    await userEvent.type(screen.getByLabelText('PAN'), 'NOTAPAN');
    await userEvent.click(screen.getByRole('button', { name: 'Add client' }));

    expect(await screen.findByText('A PAN looks like ABCDE1234F.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('accepts a well-formed PAN and submits', async () => {
    const { onSubmit } = setup();
    await fillRequired();
    await userEvent.type(screen.getByLabelText('PAN'), 'ABCDE1234F');
    await userEvent.click(screen.getByRole('button', { name: 'Add client' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    const values = onSubmit.mock.calls[0]?.[0];
    expect(values?.pan).toBe('ABCDE1234F');
    expect(values?.clientType).toBe('business');
  });

  it('uppercases an identifier typed in lower case', async () => {
    const { onSubmit } = setup();
    await fillRequired();
    await userEvent.type(screen.getByLabelText('PAN'), 'abcde1234f');
    await userEvent.click(screen.getByRole('button', { name: 'Add client' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(onSubmit.mock.calls[0]?.[0].pan).toBe('ABCDE1234F');
  });

  it('refuses a malformed GSTIN', async () => {
    const { onSubmit } = setup();
    await fillRequired();
    await userEvent.type(screen.getByLabelText('GSTIN'), '27ABC');
    await userEvent.click(screen.getByRole('button', { name: 'Add client' }));

    expect(
      await screen.findByText('A GSTIN is 15 characters, such as 27ABCDE1234F1Z5.'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refuses an Aadhaar that is not twelve digits', async () => {
    const { onSubmit } = setup();
    await userEvent.click(screen.getByRole('radio', { name: /Individual/ }));
    await fillRequired();
    await userEvent.type(await screen.findByLabelText('Aadhaar'), '1234');
    await userEvent.click(screen.getByRole('button', { name: 'Add client' }));

    expect(await screen.findByText('An Aadhaar number is twelve digits.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('requires a display name and a primary contact', async () => {
    const { onSubmit } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Add client' }));

    expect(await screen.findByText('Enter the name this client is known by.')).toBeInTheDocument();
    expect(screen.getByText('Enter the contact name.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('locks identifiers to read-only when the caller cannot edit them', () => {
    setup({ canEditPrivileged: false, mode: 'edit' });
    expect(screen.getByLabelText('PAN')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('GSTIN')).toHaveAttribute('readonly');
    expect(screen.getByText(/Statutory identifiers are administrator-only/)).toBeInTheDocument();
  });

  it('surfaces a server field error against the right field', async () => {
    setup({ fieldErrors: { pan: 'PAN already belongs to another client record.' } });
    expect(
      await screen.findByText('PAN already belongs to another client record.'),
    ).toBeInTheDocument();
  });
});
