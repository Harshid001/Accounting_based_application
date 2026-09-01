import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { homePathFor } from '@/lib/permissions';
import { useSession } from '@/context/SessionContext';
import type { Role } from '@/types/enums';

export interface RoleGateProps {
  roles: readonly Role[];
  children: ReactNode;
  fallback?: 'home' | 'forbidden';
}

export function RoleGate({ roles, children, fallback = 'forbidden' }: RoleGateProps) {
  const { user } = useSession();

  if (user === null) return <Navigate to="/sign-in" replace />;

  if (!roles.includes(user.role)) {
    return <Navigate to={fallback === 'home' ? homePathFor(user.role) : '/403'} replace />;
  }

  return <>{children}</>;
}

export function HomeRedirect() {
  const { user } = useSession();
  return <Navigate to={homePathFor(user?.role)} replace />;
}
