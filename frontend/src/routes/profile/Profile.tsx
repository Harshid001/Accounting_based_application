import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { updateProfile } from '@/api/me.api';
import { queryKeys } from '@/api/queryKeys';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { FieldRow, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { PreferencesPanel } from '@/routes/profile/components/PreferencesPanel';
import { SessionsPanel } from '@/routes/profile/components/SessionsPanel';
import { useCurrentUser } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ROLE_LABELS } from '@/lib/constants';
import { fieldErrorMap, normaliseError } from '@/lib/errors';
import { profileSchema } from '@/schemas/profile.schema';
import type { ProfileValues } from '@/schemas/profile.schema';

export function Profile() {
  usePageTitle('Your profile');
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const { success } = useToast();

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, phone: user.phone ?? '' },
  });

  const mutation = useMutation({
    mutationFn: (values: ProfileValues) =>
      updateProfile({
        name: values.name,
        phone: values.phone.trim().length === 0 ? null : values.phone.trim(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
      success('Profile saved');
    },
    onError: (error: unknown) => {
      const normalised = normaliseError(error);
      for (const [field, message] of Object.entries(fieldErrorMap(normalised))) {
        form.setError(field as keyof ProfileValues, { type: 'server', message });
      }
    },
  });

  const submit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync(values).catch(() => undefined);
  });

  return (
    <>
      <PageHeader
        title="Your profile"
        description="Your details, your email preferences and the devices you are signed in on."
      />

      <div className="max-w-[880px] space-y-4">
        <Card>
          <div className="flex items-center gap-4">
            <Avatar name={user.name} image={user.image} size="lg" />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-lg font-semibold text-[var(--fd-text-primary)]">
                {user.name}
                <Badge tone="accent">{ROLE_LABELS[user.role]}</Badge>
              </p>
              <p className="text-base break-all text-[var(--fd-text-secondary)]">{user.email}</p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Your details"
            description="Your email address is fixed to the account and cannot be changed here."
          />
          <form
            onSubmit={(event) => {
              void submit(event);
            }}
            className="space-y-4"
            noValidate
          >
            <FieldRow>
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

              <FormField label="Mobile" error={form.formState.errors.phone?.message}>
                {({ inputId, describedBy, invalid }) => (
                  <Input
                    id={inputId}
                    inputMode="numeric"
                    className="numeric"
                    invalid={invalid}
                    aria-describedby={describedBy}
                    placeholder="9876543210"
                    {...form.register('phone')}
                  />
                )}
              </FormField>
            </FieldRow>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                loading={mutation.isPending}
                loadingLabel="Saving your profile"
              >
                Save changes
              </Button>
            </div>
          </form>
        </Card>

        <PreferencesPanel preferences={user.notificationPreferences} />
        <SessionsPanel />
      </div>
    </>
  );
}
