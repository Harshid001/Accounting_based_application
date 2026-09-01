import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { ErrorState } from '@/components/ui/error-state';
import { Spinner } from '@/components/ui/skeleton';
import { useSession } from '@/context/SessionContext';

export interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { status, user, refresh, error } = useSession();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--fd-bg)]">
        <Spinner size={24} label="Checking your session" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--fd-bg)] px-4">
        <ErrorState
          error={error}
          title="We could not confirm who you are"
          onRetry={() => {
            void refresh();
          }}
        />
      </div>
    );
  }

  if (status === 'anonymous') {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/sign-in" replace state={{ from }} />;
  }

  if (status === 'unverified') {
    return <Navigate to="/verify-email" replace />;
  }

  if (user !== null && user.unlinked) {
    return <Navigate to="/unlinked" replace />;
  }

  return <>{children}</>;
}
