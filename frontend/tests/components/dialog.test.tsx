import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        Open dialog
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Reveal Aadhaar"
        description="Shown once, then cleared."
        footer={
          <Button
            onClick={() => {
              setOpen(false);
            }}
          >
            Done
          </Button>
        }
      >
        <input aria-label="Notes" />
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('is closed until the trigger is used', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens with an accessible name and description', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open dialog' }));

    const dialog = await screen.findByRole('dialog', { name: 'Reveal Aadhaar' });
    expect(within(dialog).getByText('Shown once, then cleared.')).toBeInTheDocument();
  });

  it('traps focus inside itself while open', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open dialog' }));
    const dialog = await screen.findByRole('dialog');

    for (let step = 0; step < 8; step += 1) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });

    await userEvent.click(trigger);
    await screen.findByRole('dialog');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it('offers a labelled close control', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open dialog' }));
    const dialog = await screen.findByRole('dialog');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

describe('ConfirmDialog', () => {
  it('holds the destructive action back until the exact string is typed', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete Bank statement — Mar 2026?"
        body="Every version is removed from storage. This cannot be undone."
        confirmLabel="Delete permanently"
        destructive
        typedConfirmation="Bank statement — Mar 2026"
        onConfirm={onConfirm}
      />,
    );

    const confirm = screen.getByRole('button', { name: 'Delete permanently' });
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Type Bank statement/), 'Bank statement');
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Type Bank statement/), ' — Mar 2026');
    await waitFor(() => {
      expect(confirm).toBeEnabled();
    });

    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('confirms straight away when no typed confirmation is required', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Archive Acme Traders?"
        body="It disappears from every default list and becomes read-only."
        confirmLabel="Archive client"
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Archive client' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancels without calling the action', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Archive Acme Traders?"
        body="It becomes read-only."
        confirmLabel="Archive client"
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
