import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { requestPasswordResetEmail } from '@/api/authClient';
import { AuthCard } from '@/routes/auth/components/AuthCard';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { InlineError } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { normaliseError } from '@/lib/errors';
import { usePageTitle } from '@/hooks/usePageTitle';
import { forgotPasswordSchema } from '@/schemas/auth.schema';
import type { ForgotPasswordValues } from '@/schemas/auth.schema';

export function ForgotPassword() {
  usePageTitle('Reset your password');
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await requestPasswordResetEmail(values.email);
      setSent(true);
    } catch (error) {
      setFormError(normaliseError(error).message);
    }
  });

  if (sent) {
    return (
      <AuthCard
        title="Check your email"
        description="If that address has an account, a reset link is on its way. The link works once and expires in an hour."
        footer={
          <Link to="/sign-in" className="text-[var(--fd-accent)] underline underline-offset-4">
            Back to sign in
          </Link>
        }
      >
        <p className="text-base text-[var(--fd-text-secondary)]">
          Nothing arrived? Check your spam folder, then try again in a few minutes. FirmDesk never
          says whether an address is registered.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Tell us the address you sign in with and we will email a reset link."
      footer={
        <Link to="/sign-in" className="text-[var(--fd-accent)] underline underline-offset-4">
          Back to sign in
        </Link>
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

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={form.formState.isSubmitting}
          loadingLabel="Sending your reset link"
        >
          Send reset link
        </Button>
      </form>
    </AuthCard>
  );
}
