import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateProfile } from '@/api/me.api';
import { queryKeys } from '@/api/queryKeys';
import { Card, CardHeader } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/context/ToastContext';
import type { NotificationPreferences } from '@/types/models';

const OPTIONS: Array<{
  key: keyof NotificationPreferences;
  label: string;
  description: string;
}> = [
  {
    key: 'emailOnAssignment',
    label: 'Email me when work is assigned to me',
    description: 'A task lands on your plate, or one you own moves to someone else.',
  },
  {
    key: 'emailDeadlineReminders',
    label: 'Email me deadline reminders',
    description: 'Filings you own entering their reminder window.',
  },
  {
    key: 'emailDailyDigest',
    label: 'Email me the daily digest',
    description: 'One morning summary of overdue work and what is due this week.',
  },
];

export function PreferencesPanel({ preferences }: { preferences: NotificationPreferences }) {
  const queryClient = useQueryClient();
  const { success, errorToast } = useToast();

  const mutation = useMutation({
    mutationFn: (next: Partial<NotificationPreferences>) =>
      updateProfile({ notificationPreferences: next }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
      success('Preference saved');
    },
    onError: (error: unknown) => {
      errorToast(error, 'That preference did not save');
    },
  });

  return (
    <Card>
      <CardHeader
        title="Email preferences"
        description="Verification and password-reset emails are always sent and cannot be switched off."
      />
      <div className="space-y-4">
        {OPTIONS.map((option) => (
          <Switch
            key={option.key}
            label={option.label}
            description={option.description}
            checked={preferences[option.key]}
            disabled={mutation.isPending}
            onCheckedChange={(checked) => {
              mutation.mutate({ [option.key]: checked });
            }}
          />
        ))}
      </div>
    </Card>
  );
}
