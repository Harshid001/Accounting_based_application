import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { completePasswordReset } from '@/api/authClient';
import { AuthCard } from '@/routes/auth/components/AuthCard';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { InlineError } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';
import { normaliseError } from '@/lib/errors';
import { usePageTitle } from '@/hooks/usePageTitle';
import { resetPasswordSchema } from '@/schemas/auth.schema';
import type { ResetPasswordValues } from '@/schemas/auth.schema';

export function ResetPassword() {
  usePageTitle('Choose a new password');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const submit = form.handleSubmit(async (values) => {
    if (token === null) return;
    setFormError(null);
    try {
      await completePasswordReset({ token, newPassword: values.password });
      setDone(true);
      window.setTimeout(() => {
        void navigate('/sign-in', { replace: true });
      }, 1800);
    } catch (error) {
      setFormError(normaliseError(error).message);
    }
  });

  if (token === null) {
    return (
      <AuthCard
        title="That link is incomplete"
        description="The reset link is missing its token, so we cannot tell which account it belongs to."
        footer={
          <Link
            to="/forgot-password"
            className="text-[var(--fd-accent)] underline underline-offset-4"
          >
            Ask for a new link
          </Link>
        }
      >
        <p className="text-base text-[var(--fd-text-secondary)]">
          Reset links work once and expire after an hour. Request a fresh one and open it from the
          email directly.
        </p>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard
        title="Password changed"
        description="Every other session has been signed out. Taking you to sign in now."
      >
        <Link
          to="/sign-in"
          className="text-base text-[var(--fd-accent)] underline underline-offset-4"
        >
          Go to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      description="Pick something you have not used here before."
    >
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        className="space-y-4"
        noValidate
      >
        {formError === null ? null : <InlineError message={formError} />}

        <FormField
          label="New password"
          required
          helper={`At least ${MIN_PASSWORD_LENGTH} characters.`}
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
          label="Confirm new password"
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
          loadingLabel="Saving your new password"
        >
          Save new password
        </Button>
      </form>
    </AuthCard>
  );
}
