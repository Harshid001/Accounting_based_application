import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, ShieldCheck } from 'lucide-react';

import { signInWithEmail, signInWithGoogle } from '@/api/authClient';
import { AuthCard, GoogleMark } from '@/routes/auth/components/AuthCard';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { InlineError } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { useSession } from '@/context/SessionContext';
import { normaliseError } from '@/lib/errors';
import { homePathFor } from '@/lib/permissions';
import { readSignInHint } from '@/lib/signInHint';
import { isDesktop, isWeb, webStaffAccess } from '@/lib/shell';
import { usePageTitle } from '@/hooks/usePageTitle';
import { signInSchema } from '@/schemas/auth.schema';
import type { SignInValues } from '@/schemas/auth.schema';

const safeRedirect = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
};

export function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { status, user, refresh } = useSession();

  const requestedPortal = searchParams.get('portal')?.toLowerCase();
  const shellDefaultPortal = isDesktop ? 'admin' : 'client';
  const [selectedPortal, setSelectedPortal] = useState<'admin' | 'client'>(shellDefaultPortal);
  const activePortal =
    requestedPortal === 'admin' || requestedPortal === 'client'
      ? requestedPortal
      : selectedPortal;

  const switchPortal = (portal: 'admin' | 'client'): void => {
    setSelectedPortal(portal);
    setFormError(null);
    void navigate(`?portal=${portal}`, { replace: true });
  };

  usePageTitle(activePortal === 'admin' ? 'Staff & Admin Sign In' : 'Client Portal Sign In');

  const [formError, setFormError] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  const urlError = searchParams.get('error');
  const urlErrorMessage =
    urlError === 'state_mismatch'
      ? 'Google sign-in session expired or was blocked by browser shields. Please try again or sign in with your email and password below.'
      : urlError
        ? `Authentication notice: ${urlError}. Please sign in with your email and password below.`
        : null;
  const displayError = formError ?? urlErrorMessage;

  // Desktop boot-restore (spec §5.3): pre-fill the remembered account
  // from the keychain-backed hint; web shells always start empty.
  const rememberedEmail = isDesktop ? readSignInHint() : null;

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: rememberedEmail ?? '', password: '', rememberMe: true },
  });

  if (status === 'authenticated' && user !== null) {
    if (isWeb && !webStaffAccess() && (user.role === 'admin' || user.role === 'staff')) {
      return <Navigate to="/desktop-required" replace />;
    }
    if (isDesktop && user.role === 'client') {
      return <Navigate to="/web-portal-required" replace />;
    }
    const intended = safeRedirect((location.state as { from?: unknown } | null)?.from);
    return <Navigate to={intended ?? homePathFor(user.role)} replace />;
  }
  if (status === 'unverified') return <Navigate to="/verify-email" replace />;

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signInWithEmail(values);
      await refresh();
      const intended = safeRedirect((location.state as { from?: unknown } | null)?.from);
      void navigate(intended ?? '/', { replace: true });
    } catch (error) {
      setFormError(normaliseError(error).message);
    }
  });

  const google = (): void => {
    setFormError(null);
    if (isDesktop || activePortal !== 'client') return;

    // Web shell (client portal only): standard better-auth
    // redirect flow in this browser.
    setGoogleBusy(true);
    void signInWithGoogle('/portal')
      .catch((error: unknown) => {
        setFormError(normaliseError(error).message);
      })
      .finally(() => {
        setGoogleBusy(false);
      });
  };

  const adminOnlySwitcher = (
    <div className="mb-5 grid grid-cols-1 gap-1.5 rounded-lg border border-[var(--fd-border)] bg-[var(--fd-surface-2)] p-1">
      <button
        type="button"
        id="portal-tab-admin"
        onClick={() => switchPortal('admin')}
        className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-2xs font-semibold transition-all sm:gap-2 sm:px-3 sm:py-2.5 sm:text-xs ${
          activePortal === 'admin'
            ? 'bg-[var(--fd-surface-1)] text-[var(--fd-text-primary)] shadow-sm ring-1 ring-[var(--fd-border)]'
            : 'text-[var(--fd-text-secondary)] hover:text-[var(--fd-text-primary)]'
        }`}
      >
        <ShieldCheck
          size={15}
          className={`shrink-0 ${activePortal === 'admin' ? 'text-[var(--fd-accent)]' : ''}`}
        />
        <span className="truncate">Staff & Admin</span>
      </button>
    </div>
  );

  const clientOnlySwitcher = (
    <div className="mb-5 grid grid-cols-1 gap-1.5 rounded-lg border border-[var(--fd-border)] bg-[var(--fd-surface-2)] p-1">
      <button
        type="button"
        id="portal-tab-client"
        onClick={() => switchPortal('client')}
        className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-2xs font-semibold transition-all sm:gap-2 sm:px-3 sm:py-2.5 sm:text-xs ${
          activePortal === 'client'
            ? 'bg-[var(--fd-surface-1)] text-[var(--fd-text-primary)] shadow-sm ring-1 ring-[var(--fd-border)]'
            : 'text-[var(--fd-text-secondary)] hover:text-[var(--fd-text-primary)]'
        }`}
      >
        <Building2
          size={15}
          className={`shrink-0 ${activePortal === 'client' ? 'text-[var(--fd-accent)]' : ''}`}
        />
        <span className="truncate">Client Portal</span>
      </button>
    </div>
  );

  const dualSwitcher = (
    <div className="mb-5 grid grid-cols-2 gap-1.5 rounded-lg border border-[var(--fd-border)] bg-[var(--fd-surface-2)] p-1">
      <button
        type="button"
        id="portal-tab-client"
        onClick={() => switchPortal('client')}
        className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-2xs font-semibold transition-all sm:gap-2 sm:px-3 sm:py-2.5 sm:text-xs ${
          activePortal === 'client'
            ? 'bg-[var(--fd-surface-1)] text-[var(--fd-text-primary)] shadow-sm ring-1 ring-[var(--fd-border)]'
            : 'text-[var(--fd-text-secondary)] hover:text-[var(--fd-text-primary)]'
        }`}
      >
        <Building2
          size={15}
          className={`shrink-0 ${activePortal === 'client' ? 'text-[var(--fd-accent)]' : ''}`}
        />
        <span className="truncate">Client Portal</span>
      </button>
      <button
        type="button"
        id="portal-tab-admin"
        onClick={() => switchPortal('admin')}
        className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-2xs font-semibold transition-all sm:gap-2 sm:px-3 sm:py-2.5 sm:text-xs ${
          activePortal === 'admin'
            ? 'bg-[var(--fd-surface-1)] text-[var(--fd-text-primary)] shadow-sm ring-1 ring-[var(--fd-border)]'
            : 'text-[var(--fd-text-secondary)] hover:text-[var(--fd-text-primary)]'
        }`}
      >
        <ShieldCheck
          size={15}
          className={`shrink-0 ${activePortal === 'admin' ? 'text-[var(--fd-accent)]' : ''}`}
        />
        <span className="truncate">Staff & Admin</span>
      </button>
    </div>
  );

  const portalSwitcher = isDesktop
    ? adminOnlySwitcher
    : webStaffAccess()
      ? dualSwitcher
      : clientOnlySwitcher;

  const portalBadge =
    activePortal === 'admin' ? (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--fd-accent)]/30 bg-[var(--fd-accent)]/10 px-2.5 py-0.5 text-2xs font-medium text-[var(--fd-accent)]">
        <ShieldCheck size={12} />
        <span>Firm Operations & Management</span>
      </div>
    ) : (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--fd-status-done)]/30 bg-[var(--fd-status-done-bg)] px-2.5 py-0.5 text-2xs font-medium text-[var(--fd-status-done)]">
        <Building2 size={12} />
        <span>Accounting Client Portal</span>
      </div>
    );

  const portalTitle = activePortal === 'admin' ? 'Staff & Admin Sign In' : 'Client Portal Sign In';
  const portalDescription =
    activePortal === 'admin'
      ? 'Sign in to access your firm management console, client tax filings, and practice tasks.'
      : 'Sign in to view your GST & ITR returns, compliance status, documents, and messages.';

  const emailLabel = activePortal === 'admin' ? 'Practice Email Address' : 'Client Email Address';
  const emailPlaceholder =
    activePortal === 'admin' ? 'e.g. name@firm.com' : 'e.g. name@company.com';

  const submitLabel =
    activePortal === 'admin' ? 'Sign In to Admin Console' : 'Sign In to Client Portal';
  const googleLabel = 'Continue with Google as Client';

  const adminFooter = (
    <div className="space-y-2 text-xs text-[var(--fd-text-secondary)]">
      <p className="text-2xs text-[var(--fd-text-tertiary)]">
        Internal access is restricted to authorized practice personnel. Sign in with your practice credentials.
      </p>
    </div>
  );

  const clientFooter = (
    <div className="space-y-2 text-xs text-[var(--fd-text-secondary)]">
      <p>
        New client?{' '}
        <Link
          to="/sign-up"
          className="font-medium text-[var(--fd-accent)] underline underline-offset-4"
        >
          Start onboarding & register account
        </Link>
      </p>
      <p className="text-2xs text-[var(--fd-text-tertiary)]">
        Practice staff and partners sign in through the FirmDesk desktop app.
      </p>
    </div>
  );

  const portalFooter = activePortal === 'admin' ? adminFooter : clientFooter;

  return (
    <AuthCard
      headerExtra={portalSwitcher}
      badge={portalBadge}
      title={portalTitle}
      description={portalDescription}
      footer={portalFooter}
    >
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        className="space-y-4"
        noValidate
      >
        {displayError === null ? null : <InlineError message={displayError} />}

        <FormField label={emailLabel} required error={form.formState.errors.email?.message}>
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              type="email"
              placeholder={emailPlaceholder}
              autoComplete="email"
              invalid={invalid}
              aria-describedby={describedBy}
              {...form.register('email')}
            />
          )}
        </FormField>

        <FormField label="Password" required error={form.formState.errors.password?.message}>
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              type="password"
              placeholder="••••••••••••"
              autoComplete="current-password"
              invalid={invalid}
              aria-describedby={describedBy}
              {...form.register('password')}
            />
          )}
        </FormField>

        <div className="flex items-center justify-between gap-3">
          <Controller
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
                label="Keep me signed in"
              />
            )}
          />
          <Link
            to="/forgot-password"
            className="rounded-sm text-xs text-[var(--fd-accent)] underline underline-offset-4"
          >
            Forgot your password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={form.formState.isSubmitting}
          loadingLabel="Signing you in..."
        >
          {submitLabel}
        </Button>
      </form>

      {!isDesktop && activePortal === 'client' && (
        <>
          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-[var(--fd-border-subtle)]" aria-hidden="true" />
            <span className="text-2xs text-[var(--fd-text-tertiary)] uppercase">or</span>
            <span className="h-px flex-1 bg-[var(--fd-border-subtle)]" aria-hidden="true" />
          </div>

          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            loading={googleBusy}
            loadingLabel="Opening Google..."
            iconLeft={<GoogleMark />}
            onClick={google}
          >
            {googleLabel}
          </Button>
        </>
      )}
    </AuthCard>
  );
}
