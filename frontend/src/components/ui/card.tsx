import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
}

export function Card({ children, className, padded = true, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)]',
        padded && 'p-4',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  as?: 'h2' | 'h3';
  className?: string;
}

export function CardHeader({
  title,
  description,
  actions,
  as: Heading = 'h2',
  className,
}: CardHeaderProps) {
  return (
    <div className={cn('mb-3 flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <Heading className="text-lg font-semibold text-[var(--fd-text-primary)]">{title}</Heading>
        {description === undefined ? null : (
          <p className="mt-0.5 text-xs text-[var(--fd-text-tertiary)]">{description}</p>
        )}
      </div>
      {actions === undefined ? null : (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export function CardSection({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('border-t border-[var(--fd-border-subtle)] pt-3 first:border-0 first:pt-0', className)}>
      {children}
    </div>
  );
}

export function DefinitionList({
  items,
  className,
}: {
  items: ReadonlyArray<{ label: string; value: ReactNode }>;
  className?: string;
}) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3 sm:grid-cols-2', className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-2xs tracking-wide text-[var(--fd-text-tertiary)] uppercase">
            {item.label}
          </dt>
          <dd className="mt-0.5 text-base break-words text-[var(--fd-text-primary)]">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
