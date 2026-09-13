import { Controller } from 'react-hook-form';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

import { AuthCard } from '@/shared/auth/components/AuthCard';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { InlineError } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { useSession } from '@/context/SessionContext';
import { homePathFor } from '@/lib/permissions';
import { useShellSignIn } from '@/shared/auth/useShellSignIn';

const safeRedirect = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
};

export function DesktopSignIn() {
  const location = useLocation();
  const { status, user } = useSession();
  const { form, formError, submit } = useShellSignIn({ restoreDesktopEmail: true });

  const intendedPath = safeRedirect((location.state as { from?: unknown } | null)?.from);
  if (status === 'authenticated' && user !== null) {
    if (user.role === 'client') return <Navigate to="/web-portal-required" replace />;
    return <Navigate to={intendedPath ?? homePathFor(user.role)} replace />;
  }
  if (status === 'unverified') return <Navigate to="/verify-email" replace />;

  const portalSwitcher = (
    <div className="mb-5 grid grid-cols-1 gap-1.5 rounded-lg border border-[var(--fd-border)] bg-[var(--fd-surface-2)] p-1">
      <button
        type="button"
        id="portal-tab-admin"
        className="flex items-center justify-center gap-2 rounded-md bg-[var(--fd-surface-1)] px-3 py-2.5 text-xs font-semibold text-[var(--fd-text-primary)] shadow-sm ring-1 ring-[var(--fd-border)]"
      >
        <ShieldCheck size={15} className="shrink-0 text-[var(--fd-accent)]" />
        <span className="truncate">Staff & Admin</span>
      </button>
    </div>
  );

  const submitHandler = (event: React.FormEvent<HTMLFormElement>): void => {
    void submit(event);
  };

  return (
    <AuthCard
      headerExtra={portalSwitcher}
      badge={
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--fd-accent)]/30 bg-[var(--fd-accent)]/10 px-2.5 py-0.5 text-2xs font-medium text-[var(--fd-accent)]">
          <ShieldCheck size={12} />
          <span>Firm Operations & Management</span>
        </div>
      }
      title="Desktop Workspace Sign In"
      description="Use your practice credentials to access FirmDesk on this workstation."
      footer={
        <div className="space-y-2 text-xs text-[var(--fd-text-secondary)]">
          <p className="text-2xs text-[var(--fd-text-tertiary)]">
            Internal access is restricted to authorized practice personnel.
          </p>
        </div>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitHandler(event);
        }}
        className="space-y-4"
        noValidate
      >
        {formError === null ? null : <InlineError message={formError} />}
        <FormField
          label="Workstation Email Address"
          required
          error={form.formState.errors.email?.message}
        >
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              type="email"
              placeholder="e.g. name@firm.com"
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
          loadingLabel="Unlocking your workspace..."
        >
          Open FirmDesk
        </Button>
      </form>
    </AuthCard>
  );
}
