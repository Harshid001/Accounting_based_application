import * as Radix from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface MenuAction {
  id: string;
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
}

export interface DropdownMenuProps {
  trigger: ReactNode;
  actions: readonly MenuAction[];
  ariaLabel: string;
  align?: 'start' | 'end';
  className?: string;
}

export function DropdownMenu({
  trigger,
  actions,
  ariaLabel,
  align = 'end',
  className,
}: DropdownMenuProps) {
  return (
    <Radix.Root>
      <Radix.Trigger asChild aria-label={ariaLabel}>
        {trigger}
      </Radix.Trigger>
      <Radix.Portal>
        <Radix.Content
          align={align}
          sideOffset={4}
          collisionPadding={12}
          className={cn(
            'z-50 min-w-48 rounded-lg border border-[var(--fd-border)] bg-[var(--fd-surface-1)]',
            'p-1 shadow-[var(--fd-shadow-overlay)]',
            className,
          )}
        >
          {actions.map((action) => (
            <div key={action.id}>
              {action.separatorBefore === true ? (
                <Radix.Separator className="my-1 h-px bg-[var(--fd-border-subtle)]" />
              ) : null}
              <Radix.Item
                disabled={action.disabled === true}
                onSelect={() => {
                  action.onSelect();
                }}
                className={cn(
                  'flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-base outline-none',
                  'data-[highlighted]:bg-[var(--fd-surface-3)]',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                  action.danger === true
                    ? 'text-[var(--fd-status-danger)]'
                    : 'text-[var(--fd-text-primary)]',
                )}
              >
                {action.icon === undefined ? null : (
                  <span className="shrink-0 text-[var(--fd-text-tertiary)]">{action.icon}</span>
                )}
                {action.label}
              </Radix.Item>
            </div>
          ))}
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  );
}
