import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { resendVerificationEmail, signOutEverywhere } from '@/api/authClient';
import { AuthCard } from '@/routes/auth/components/AuthCard';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/error-state';
import { Spinner } from '@/components/ui/skeleton';
import { useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { normaliseError } from '@/lib/errors';
import { homePathFor } from '@/lib/permissions';
import { usePageTitle } from '@/hooks/usePageTitle';

export function VerifyEmail() {
  usePageTitle('Verify your email');
  const { status, user, pendingVerification, refresh, clear } = useSession();
  const { success } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'loading') {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={22} label="Checking your account" />
      </div>
    );
  }

  if (status === 'anonymous') return <Navigate to="/sign-in" replace />;
  if (status === 'authenticated' && user !== null) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }

  const email = pendingVerification?.email ?? null;

  const resend = (): void => {
    if (email === null) return;
    setBusy(true);
    setError(null);
    void resendVerificationEmail(email)
      .then(() => {
        success('Verification email sent', `Check the inbox for ${email}.`);
      })
      .catch((cause: unknown) => {
        setError(normaliseError(cause).message);
      })
      .finally(() => {
        setBusy(false);
      });
  };

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
      title="Verify your email"
      description={
        email === null
          ? 'Open the link we emailed you, then come back and refresh.'
          : `Open the link we emailed to ${email}, then come back and refresh. The link expires after 24 hours.`
      }
      footer={
        <button
          type="button"
          onClick={signOut}
          className="rounded-sm text-[var(--fd-accent)] underline underline-offset-4"
        >
          Sign out and use a different account
        </button>
      }
    >
      <div className="space-y-4">
        {error === null ? null : <InlineError message={error} />}

        <p className="text-base text-[var(--fd-text-secondary)]">
          Until the address is verified, FirmDesk will not show you any client information.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={() => {
              void refresh();
            }}
          >
            I have verified, refresh
          </Button>
          <Button
            variant="secondary"
            loading={busy}
            loadingLabel="Sending another email"
            disabled={email === null}
            onClick={resend}
          >
            Send the email again
          </Button>
        </div>

        <p className="text-xs text-[var(--fd-text-tertiary)]">
          Resends are limited to five in fifteen minutes.{' '}
          <Link to="/sign-in" className="text-[var(--fd-accent)] underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
