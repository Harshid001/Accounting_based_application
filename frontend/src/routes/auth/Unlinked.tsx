import { Navigate } from 'react-router-dom';

import { signOutEverywhere } from '@/api/authClient';
import { AuthCard } from '@/routes/auth/components/AuthCard';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/skeleton';
import { useSession } from '@/context/SessionContext';
import { homePathFor } from '@/lib/permissions';
import { usePageTitle } from '@/hooks/usePageTitle';

export function Unlinked() {
  usePageTitle('Waiting for your firm');
  const { status, user, refresh, clear } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={22} label="Checking your account" />
      </div>
    );
  }

  if (status === 'anonymous') return <Navigate to="/sign-in" replace />;
  if (status === 'unverified') return <Navigate to="/verify-email" replace />;
  if (user !== null && !user.unlinked) return <Navigate to={homePathFor(user.role)} replace />;

  const signOut = (): void => {
    void signOutEverywhere()
      .then(() => {
        clear();
      })
      .catch(() => {
        clear();
      });
  };

  return (
    <AuthCard
      title="Your firm has been notified"
      description="Your account exists and your email is verified. Someone at the firm now has to link it to your client record."
      footer={
        <button
          type="button"
          onClick={signOut}
          className="rounded-sm text-[var(--fd-accent)] underline underline-offset-4"
        >
          Sign out
        </button>
      }
    >
      <div className="space-y-4">
        <p className="text-base text-[var(--fd-text-secondary)]">
          There is nothing for you to do here yet. Once the firm links your account you will see
          your filings, documents and messages the next time you sign in.
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            void refresh();
          }}
        >
          Check again
        </Button>
      </div>
    </AuthCard>
  );
}
