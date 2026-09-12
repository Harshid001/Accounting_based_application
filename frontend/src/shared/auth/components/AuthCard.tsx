import type { ReactNode } from 'react';

export interface AuthCardProps {
  title: string;
  description?: string;
  badge?: ReactNode;
  headerExtra?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthCard({ title, description, badge, headerExtra, children, footer }: AuthCardProps) {
  return (
    <div className="rounded-xl border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] p-4 sm:p-6 shadow-sm">
      {headerExtra}
      {badge && <div className="mb-2">{badge}</div>}
      <h1
        id="page-title"
        tabIndex={-1}
        className="text-2xl font-semibold text-[var(--fd-text-primary)] outline-none"
      >
        {title}
      </h1>
      {description === undefined ? null : (
        <p className="mt-1 mb-5 text-sm text-[var(--fd-text-secondary)]">{description}</p>
      )}
      <div className={description === undefined ? 'mt-5' : ''}>{children}</div>
      {footer === undefined ? null : (
        <div className="mt-5 border-t border-[var(--fd-border-subtle)] pt-4 text-center text-base text-[var(--fd-text-secondary)]">
          {footer}
        </div>
      )}
    </div>
  );
}

export function GoogleMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8h-4v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6v-3.1h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z"
      />
    </svg>
  );
}
