import { Plus, Trash2 } from 'lucide-react';
import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DocumentTypeSelect } from '@/components/domain/DocumentTypeSelect';
import type { ChecklistEntryValues, ComplianceTypeFormValues } from '@/schemas/complianceType.schema';

export interface ChecklistEditorProps {
  form: UseFormReturn<ComplianceTypeFormValues>;
  fields: UseFieldArrayReturn<ComplianceTypeFormValues, 'defaultDocumentChecklist'>;
}

const emptyEntry: ChecklistEntryValues = { title: '', documentType: 'other', description: '' };

export function ChecklistEditor({ form, fields }: ChecklistEditorProps) {
  const entries = form.watch('defaultDocumentChecklist');

  const errorAt = (index: number): { title?: { message?: string } } | undefined => {
    const list = form.formState.errors.defaultDocumentChecklist;
    if (!Array.isArray(list)) return undefined;
    const entry: unknown = list[index];
    return typeof entry === 'object' && entry !== null ? entry : undefined;
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--fd-text-tertiary)]">
        When a filing is generated from this entry, each line below becomes a document request
        against the client automatically.
      </p>

      {entries.length === 0 ? (
        <p className="text-base text-[var(--fd-text-tertiary)]">
          No default checklist. Filings generate with no document requests.
        </p>
      ) : (
        <ul className="space-y-3">
          {fields.fields.map((field, index) => (
            <li
              key={field.id}
              className="rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--fd-text-secondary)]">
                  Checklist item {index + 1}
                </span>
                <IconButton
                  label={`Remove checklist item ${index + 1}`}
                  size="sm"
                  icon={<Trash2 size={13} aria-hidden="true" />}
                  onClick={() => {
                    fields.remove(index);
                  }}
                />
              </div>

              <div className="space-y-3">
                <FormField label="What to ask for" required error={errorAt(index)?.title?.message}>
                  {({ inputId, describedBy, invalid }) => (
                    <Input
                      id={inputId}
                      invalid={invalid}
                      aria-describedby={describedBy}
                      placeholder="Sales register for the period"
                      {...form.register(`defaultDocumentChecklist.${index}.title`)}
                    />
                  )}
                </FormField>

                <FormField label="Document type" required>
                  {({ inputId }) => (
                    <DocumentTypeSelect
                      id={inputId}
                      size="sm"
                      value={form.watch(`defaultDocumentChecklist.${index}.documentType`)}
                      onChange={(value) => {
                        form.setValue(`defaultDocumentChecklist.${index}.documentType`, value, {
                          shouldDirty: true,
                        });
                      }}
                    />
                  )}
                </FormField>

                <FormField label="Note for the client">
                  {({ inputId, describedBy }) => (
                    <Textarea
                      id={inputId}
                      rows={2}
                      aria-describedby={describedBy}
                      {...form.register(`defaultDocumentChecklist.${index}.description`)}
                    />
                  )}
                </FormField>
              </div>
            </li>
          ))}
        </ul>
      )}

      {entries.length >= 20 ? (
        <p className="text-xs text-[var(--fd-text-tertiary)]">Twenty checklist items is the limit.</p>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          iconLeft={<Plus size={14} aria-hidden="true" />}
          onClick={() => {
            fields.append(emptyEntry);
          }}
        >
          Add a checklist item
        </Button>
      )}
    </div>
  );
}
