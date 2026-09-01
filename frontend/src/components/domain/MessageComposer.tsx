import { zodResolver } from '@hookform/resolvers/zod';
import { Send } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { messageSchema } from '@/schemas/message.schema';
import type { MessageValues } from '@/schemas/message.schema';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Textarea } from '@/components/ui/textarea';

export interface MessageComposerProps {
  onSend: (body: string) => Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
  placeholder?: string;
}

export function MessageComposer({
  onSend,
  disabled = false,
  disabledReason,
  placeholder = 'Write a message to the client',
}: MessageComposerProps) {
  const form = useForm<MessageValues>({
    resolver: zodResolver(messageSchema),
    defaultValues: { body: '' },
  });

  const submit = form.handleSubmit(async (values) => {
    await onSend(values.body);
    form.reset({ body: '' });
  });

  if (disabled) {
    return (
      <p className="rounded-md border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] px-3 py-2 text-xs text-[var(--fd-text-tertiary)]">
        {disabledReason ?? 'You cannot post to this thread.'}
      </p>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      className="space-y-2"
    >
      <FormField label="Message" hideLabel error={form.formState.errors.body?.message}>
        {({ inputId, describedBy, invalid }) => (
          <Textarea
            id={inputId}
            rows={3}
            placeholder={placeholder}
            invalid={invalid}
            aria-describedby={describedBy}
            {...form.register('body')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void submit();
              }
            }}
          />
        )}
      </FormField>

      <div className="flex items-center justify-between gap-2">
        <p className="text-2xs text-[var(--fd-text-tertiary)]">
          Press Ctrl or Cmd with Enter to send.
        </p>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={form.formState.isSubmitting}
          loadingLabel="Sending your message"
          iconLeft={<Send size={14} aria-hidden="true" />}
        >
          Send message
        </Button>
      </div>
    </form>
  );
}
