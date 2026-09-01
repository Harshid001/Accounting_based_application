import { Plus, Trash2 } from 'lucide-react';
import type { FieldValues, Path, UseFormRegister } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { FieldRow, Fieldset, FormField } from '@/components/ui/form-field';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import type { ContactValues } from '@/schemas/client.schema';

export interface ContactErrors {
  name?: { message?: string };
  role?: { message?: string };
  email?: { message?: string };
  phone?: { message?: string };
}

export interface ContactPaths<T extends FieldValues> {
  name: Path<T>;
  role: Path<T>;
  email: Path<T>;
  phone: Path<T>;
}

export interface ContactFieldsProps<T extends FieldValues> {
  legend: string;
  description?: string;
  paths: ContactPaths<T>;
  register: UseFormRegister<T>;
  errors: ContactErrors | undefined;
  readOnly: boolean;
  hideLegend?: boolean;
}

export function ContactFields<T extends FieldValues>({
  legend,
  description,
  paths,
  register,
  errors,
  readOnly,
  hideLegend = false,
}: ContactFieldsProps<T>) {
  return (
    <Fieldset
      legend={legend}
      className={hideLegend ? '[&>legend]:sr-only' : ''}
      {...(description === undefined ? {} : { description })}
    >
      <FieldRow>
        <FormField label="Name" required error={errors?.name?.message}>
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              readOnly={readOnly}
              invalid={invalid}
              aria-describedby={describedBy}
              autoComplete="off"
              {...register(paths.name)}
            />
          )}
        </FormField>
        <FormField label="Role at the client" error={errors?.role?.message}>
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              readOnly={readOnly}
              invalid={invalid}
              aria-describedby={describedBy}
              placeholder="Director, accountant, owner"
              {...register(paths.role)}
            />
          )}
        </FormField>
      </FieldRow>

      <FieldRow>
        <FormField label="Email" required error={errors?.email?.message}>
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              type="email"
              readOnly={readOnly}
              invalid={invalid}
              aria-describedby={describedBy}
              {...register(paths.email)}
            />
          )}
        </FormField>
        <FormField label="Mobile" error={errors?.phone?.message}>
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              inputMode="numeric"
              readOnly={readOnly}
              invalid={invalid}
              aria-describedby={describedBy}
              placeholder="9876543210"
              className="numeric"
              {...register(paths.phone)}
            />
          )}
        </FormField>
      </FieldRow>
    </Fieldset>
  );
}

export interface AdditionalContactsProps<T extends FieldValues> {
  contacts: readonly ContactValues[];
  register: UseFormRegister<T>;
  pathsFor: (index: number) => ContactPaths<T>;
  errorAt: (index: number) => ContactErrors | undefined;
  readOnly: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

export function AdditionalContacts<T extends FieldValues>({
  contacts,
  register,
  pathsFor,
  errorAt,
  readOnly,
  onAdd,
  onRemove,
}: AdditionalContactsProps<T>) {
  return (
    <div className="space-y-4">
      {contacts.map((_contact, index) => (
        <div
          key={index}
          className="rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] p-4"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--fd-text-secondary)]">
              Additional contact {index + 1}
            </span>
            {readOnly ? null : (
              <IconButton
                label={`Remove additional contact ${index + 1}`}
                size="sm"
                icon={<Trash2 size={13} aria-hidden="true" />}
                onClick={() => {
                  onRemove(index);
                }}
              />
            )}
          </div>
          <ContactFields
            hideLegend
            legend={`Additional contact ${index + 1}`}
            paths={pathsFor(index)}
            register={register}
            errors={errorAt(index)}
            readOnly={readOnly}
          />
        </div>
      ))}

      {readOnly || contacts.length >= 10 ? null : (
        <Button
          variant="secondary"
          size="sm"
          onClick={onAdd}
          iconLeft={<Plus size={14} aria-hidden="true" />}
        >
          Add another contact
        </Button>
      )}
    </div>
  );
}
