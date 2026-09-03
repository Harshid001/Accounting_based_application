import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { signInWithEmail, signInWithGoogle, signUpWithEmail } from '@/api/authClient';
import { AuthCard, GoogleMark } from '@/routes/auth/components/AuthCard';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { InlineError } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';
import { useSession } from '@/context/SessionContext';
import { normaliseError } from '@/lib/errors';
import { homePathFor } from '@/lib/permissions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { signUpSchema } from '@/schemas/auth.schema';
import type { SignUpValues } from '@/schemas/auth.schema';

export function SignUp() {
  usePageTitle('Create an account');
  const navigate = useNavigate();
  const { status, user, refresh } = useSession();
  const [formError, setFormError] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  if (status === 'authenticated' && user !== null) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signUpWithEmail({ name: values.name, email: values.email, password: values.password });
      await signInWithEmail({ email: values.email, password: values.password, rememberMe: true });
      await refresh();
      navigate('/', { replace: true });
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
      title="Create an account"
      description="Anyone can sign up. Your firm decides what you can see."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/sign-in" className="text-[var(--fd-accent)] underline underline-offset-4">
            Sign in
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
        {formError === null ? null : <InlineError message={formError} />}

        <FormField label="Full name" required error={form.formState.errors.name?.message}>
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              autoComplete="name"
              invalid={invalid}
              aria-describedby={describedBy}
              {...form.register('name')}
            />
          )}
        </FormField>

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

        <FormField
          label="Password"
          required
          helper={`At least ${MIN_PASSWORD_LENGTH} characters. A short sentence works well and is easier to remember.`}
          error={form.formState.errors.password?.message}
        >
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              type="password"
              autoComplete="new-password"
              invalid={invalid}
              aria-describedby={describedBy}
              {...form.register('password')}
            />
          )}
        </FormField>

        <FormField
          label="Confirm password"
          required
          error={form.formState.errors.confirmPassword?.message}
        >
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              type="password"
              autoComplete="new-password"
              invalid={invalid}
              aria-describedby={describedBy}
              {...form.register('confirmPassword')}
            />
          )}
        </FormField>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={form.formState.isSubmitting}
          loadingLabel="Creating your account"
        >
          Create account
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
