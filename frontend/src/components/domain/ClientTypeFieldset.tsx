import type { UseFormReturn } from 'react-hook-form';

import { Fieldset, FieldRow, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { ENTITY_TYPE_LABELS } from '@/lib/constants';
import { ENTITY_TYPES } from '@/types/enums';
import type { ClientFormValues } from '@/schemas/client.schema';

export interface ClientTypeFieldsetProps {
  form: UseFormReturn<ClientFormValues>;
  clientType: ClientFormValues['clientType'];
  readOnly: boolean;
  aadhaarOnFile?: boolean;
}

export function ClientTypeFieldset({
  form,
  clientType,
  readOnly,
  aadhaarOnFile = false,
}: ClientTypeFieldsetProps) {
  const { register, formState, setValue, watch } = form;

  if (clientType === 'individual') {
    return (
      <Fieldset
        legend="Individual identifiers"
        description="PAN is the one identifier every individual file needs. Aadhaar is optional and is encrypted at rest."
      >
        <FieldRow>
          <FormField label="PAN" error={formState.errors.pan?.message}>
            {({ inputId, describedBy, invalid }) => (
              <Input
                id={inputId}
                invalid={invalid}
                readOnly={readOnly}
                aria-describedby={describedBy}
                placeholder="ABCDE1234F"
                autoCapitalize="characters"
                className="numeric uppercase"
                {...register('pan')}
              />
            )}
          </FormField>

          <FormField
            label="Date of birth"
            error={formState.errors.dateOfBirth?.message}
          >
            {({ inputId, describedBy, invalid }) => (
              <DatePicker
                id={inputId}
                value={watch('dateOfBirth').length === 0 ? null : watch('dateOfBirth')}
                onChange={(value) => {
                  setValue('dateOfBirth', value ?? '', { shouldDirty: true });
                }}
                disabled={readOnly}
                invalid={invalid}
                ariaDescribedBy={describedBy}
                ariaLabel="Date of birth"
              />
            )}
          </FormField>
        </FieldRow>

        <FormField
          label="Aadhaar"
          error={formState.errors.aadhaar?.message}
          helper={
            aadhaarOnFile
              ? 'An Aadhaar number is already on file. Leave this blank to keep it, or type a new one to replace it.'
              : 'Twelve digits. Stored encrypted, never shown in a list, an export or a log.'
          }
        >
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              invalid={invalid}
              readOnly={readOnly}
              aria-describedby={describedBy}
              inputMode="numeric"
              autoComplete="off"
              placeholder={aadhaarOnFile ? '•••• •••• ••••' : '1234 5678 9012'}
              className="numeric"
              {...register('aadhaar')}
            />
          )}
        </FormField>
      </Fieldset>
    );
  }

  return (
    <Fieldset
      legend="Business identifiers"
      description="Only fill in what the entity actually holds. A blank field is better than a guessed one."
    >
      <FieldRow>
        <FormField label="PAN" error={formState.errors.pan?.message}>
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              invalid={invalid}
              readOnly={readOnly}
              aria-describedby={describedBy}
              placeholder="ABCDE1234F"
              className="numeric uppercase"
              {...register('pan')}
            />
          )}
        </FormField>

        <FormField label="GSTIN" error={formState.errors.gstin?.message}>
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              invalid={invalid}
              readOnly={readOnly}
              aria-describedby={describedBy}
              placeholder="27ABCDE1234F1Z5"
              className="numeric uppercase"
              {...register('gstin')}
            />
          )}
        </FormField>
      </FieldRow>

      <FieldRow>
        <FormField label="TAN" error={formState.errors.tan?.message}>
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              invalid={invalid}
              readOnly={readOnly}
              aria-describedby={describedBy}
              placeholder="MUMA12345B"
              className="numeric uppercase"
              {...register('tan')}
            />
          )}
        </FormField>

        <FormField label="CIN" error={formState.errors.cin?.message}>
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              invalid={invalid}
              readOnly={readOnly}
              aria-describedby={describedBy}
              placeholder="U74999MH2020PTC123456"
              className="numeric uppercase"
              {...register('cin')}
            />
          )}
        </FormField>
      </FieldRow>

      <FieldRow>
        <FormField label="Entity type" error={formState.errors.entityType?.message}>
          {({ inputId, describedBy, invalid }) => (
            <Select
              id={inputId}
              invalid={invalid}
              disabled={readOnly}
              ariaDescribedBy={describedBy}
              ariaLabel="Entity type"
              value={watch('entityType')}
              onValueChange={(value) => {
                setValue('entityType', value as ClientFormValues['entityType'], {
                  shouldDirty: true,
                });
              }}
              options={ENTITY_TYPES.map((type) => ({
                value: type,
                label: ENTITY_TYPE_LABELS[type],
              }))}
            />
          )}
        </FormField>

        <FormField
          label="Date of incorporation"
          error={formState.errors.incorporationDate?.message}
        >
          {({ inputId, describedBy, invalid }) => (
            <DatePicker
              id={inputId}
              value={watch('incorporationDate').length === 0 ? null : watch('incorporationDate')}
              onChange={(value) => {
                setValue('incorporationDate', value ?? '', { shouldDirty: true });
              }}
              disabled={readOnly}
              invalid={invalid}
              ariaDescribedBy={describedBy}
              ariaLabel="Date of incorporation"
            />
          )}
        </FormField>
      </FieldRow>
    </Fieldset>
  );
}
