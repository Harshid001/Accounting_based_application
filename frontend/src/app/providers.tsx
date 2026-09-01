import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { queryKeys } from '@/api/queryKeys';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ActiveClientProvider } from '@/context/ActiveClientContext';
import { SessionProvider } from '@/context/SessionContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider, useToast } from '@/context/ToastContext';
import { PUBLIC_PATHS } from '@/lib/constants';
import { normaliseError } from '@/lib/errors';
import type { NormalisedError } from '@/lib/errors';

const isPublicPath = (pathname: string): boolean =>
  (PUBLIC_PATHS as readonly string[]).some((path) => pathname.startsWith(path));

interface Handlers {
  navigate: (to: string, options?: { replace?: boolean; state?: unknown }) => void;
  toastRateLimit: (error: NormalisedError) => void;
  pathname: string;
  search: string;
}

let activeHandlers: Handlers | null = null;

const createClient = (): QueryClient => {
  const route = (error: unknown): void => {
    const handlers = activeHandlers;
    if (handlers === null) return;
    const normalised = normaliseError(error);

    switch (normalised.code) {
      case 'UNAUTHENTICATED':
        if (!isPublicPath(handlers.pathname)) {
          handlers.navigate('/sign-in', {
            replace: true,
            state: { from: `${handlers.pathname}${handlers.search}` },
          });
        }
        break;
      case 'EMAIL_UNVERIFIED':
        if (handlers.pathname !== '/verify-email') {
          handlers.navigate('/verify-email', { replace: true });
        }
        break;
      case 'ACCOUNT_UNLINKED':
        if (handlers.pathname !== '/unlinked') handlers.navigate('/unlinked', { replace: true });
        break;
      case 'FORBIDDEN':
        if (handlers.pathname !== '/403') handlers.navigate('/403', { replace: true });
        break;
      case 'RATE_LIMITED':
        handlers.toastRateLimit(normalised);
        break;
      default:
        break;
    }
  };

  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => {
          const { code } = normaliseError(error);
          if (code === 'NETWORK' && failureCount < 2) return true;
          return code === 'INTERNAL' && failureCount < 1;
        },
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: { retry: false },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.queryKey[0] === queryKeys.me[0]) return;
        route(error);
      },
    }),
    mutationCache: new MutationCache({ onError: route }),
  });
};

function QueryProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    activeHandlers = {
      navigate: (to, options) => {
        void navigate(to, options);
      },
      toastRateLimit: (error) => {
        toast({
          tone: 'warning',
          title: 'Slow down for a moment',
          description:
            error.retryAfterSeconds === null
              ? error.message
              : `${error.message} Try again in ${error.retryAfterSeconds} seconds.`,
        });
      },
      pathname: location.pathname,
      search: location.search,
    };
    return () => {
      activeHandlers = null;
    };
  }, [navigate, toast, location.pathname, location.search]);

  const [client] = useState(() => createClient());

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <TooltipProvider>
          <QueryProvider>
            <SessionProvider>
              <ActiveClientProvider>{children}</ActiveClientProvider>
            </SessionProvider>
          </QueryProvider>
        </TooltipProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
