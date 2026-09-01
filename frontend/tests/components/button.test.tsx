import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';

describe('Button', () => {
  it('renders its label and fires on click', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Add client</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Add client' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('defaults to type button so it never submits a form by accident', () => {
    render(<Button>Archive</Button>);
    expect(screen.getByRole('button', { name: 'Archive' })).toHaveAttribute('type', 'button');
  });

  it('does not fire when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Archive
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Archive' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps the label in the layout while loading, so the width does not jump', () => {
    const { rerender } = render(<Button>Send reminder</Button>);
    const before = screen.getByRole('button').textContent;

    rerender(<Button loading>Send reminder</Button>);
    const button = screen.getByRole('button');

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.textContent).toContain(before ?? '');
  });

  it('announces what it is doing while loading', () => {
    render(
      <Button loading loadingLabel="Saving this client">
        Save
      </Button>,
    );
    expect(screen.getByRole('button', { name: /Saving this client/ })).toBeInTheDocument();
  });

  it('is reachable and operable from the keyboard', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Export CSV</Button>);

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders as a child element when asked, keeping one accessible control', () => {
    render(
      <Button asChild>
        <a href="/clients">All clients</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'All clients' })).toHaveAttribute('href', '/clients');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('IconButton', () => {
  it('exposes an accessible name even though it shows only an icon', () => {
    render(<IconButton label="Pin Acme Traders" icon={<span aria-hidden="true">*</span>} />);
    expect(screen.getByRole('button', { name: 'Pin Acme Traders' })).toBeInTheDocument();
  });

  it('is disabled while loading and does not fire', async () => {
    const onClick = vi.fn();
    render(
      <IconButton
        loading
        label="Delete document"
        icon={<span aria-hidden="true">*</span>}
        onClick={onClick}
      />,
    );

    const button = screen.getByRole('button', { name: 'Delete document' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
