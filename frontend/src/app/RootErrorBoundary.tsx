import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

import { apiRequest } from '@/api/client';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

const report = (error: Error): void => {
  const payload = {
    message: error.message.slice(0, 2000),
    stack: error.stack?.slice(0, 6000) ?? undefined,
    path: `${window.location.pathname}${window.location.search}`.slice(0, 500),
    userAgent: window.navigator.userAgent.slice(0, 400),
  };
  void apiRequest('/client-errors', { method: 'POST', body: payload }).catch(() => undefined);
};

export class RootErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, _info: ErrorInfo): void {
    report(error);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: 'var(--fd-bg, #0A0A0A)',
          color: 'var(--fd-text-primary, #F5F2ED)',
          fontFamily: 'InterVariable, ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div style={{ maxWidth: '32rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 8px' }}>
            FirmDesk hit an unexpected problem
          </h1>
          <p style={{ fontSize: '14px', margin: '0 0 20px', opacity: 0.85 }}>
            The screen you were on stopped responding. Your firm has been told automatically.
            Reloading usually clears it.
          </p>
          <button
            type="button"
            onClick={() => {
              window.location.reload();
            }}
            style={{
              borderRadius: '6px',
              border: '1px solid var(--fd-border, #262626)',
              background: 'var(--fd-accent, #FF6A00)',
              color: 'var(--fd-accent-contrast, #0A0A0A)',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Reload FirmDesk
          </button>
          <p
            style={{
              marginTop: '16px',
              fontSize: '11px',
              fontFamily: 'ui-monospace, monospace',
              opacity: 0.6,
              wordBreak: 'break-word',
            }}
          >
            {error.message}
          </p>
        </div>
      </div>
    );
  }
}
