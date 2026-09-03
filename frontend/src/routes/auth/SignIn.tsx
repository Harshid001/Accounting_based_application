import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

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
import { usePageTitle } from '@/hooks/usePageTitle';
import { signInSchema } from '@/schemas/auth.schema';
import type { SignInValues } from '@/schemas/auth.schema';

const safeRedirect = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
};

export function SignIn() {
  usePageTitle('Sign in');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { status, user, refresh } = useSession();
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

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '', rememberMe: true },
  });

  if (status === 'authenticated' && user !== null) {
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
    setGoogleBusy(true);
    void signInWithGoogle()
      .catch((error: unknown) => {
        setFormError(normaliseError(error).message);
      })
      .finally(() => {
        setGoogleBusy(false);
      });
  };

  return (
    <AuthCard
      title="Sign in"
      description="Use the email address your firm holds for you."
      footer={
        <>
          New here?{' '}
          <Link to="/sign-up" className="text-[var(--fd-accent)] underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        className="space-y-4"
        noValidate
      >
        {displayError === null ? null : <InlineError message={displayError} />}

        <FormField label="Email address" required error={form.formState.errors.email?.message}>
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              type="email"
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
          loadingLabel="Signing you in"
        >
          Sign in
        </Button>
      </form>

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
        loadingLabel="Opening Google"
        iconLeft={<GoogleMark />}
        onClick={google}
      >
        Continue with Google
      </Button>
    </AuthCard>
  );
}
