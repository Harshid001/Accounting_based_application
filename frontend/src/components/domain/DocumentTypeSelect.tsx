import { DOCUMENT_TYPE_LABELS } from '@/lib/constants';
import { Select } from '@/components/ui/select';
import { DOCUMENT_TYPES } from '@/types/enums';
import type { DocumentType } from '@/types/enums';

export interface DocumentTypeSelectProps {
  value: DocumentType;
  onChange: (value: DocumentType) => void;
  id?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string | undefined;
  invalid?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export const documentTypeOptions = DOCUMENT_TYPES.map((type) => ({
  value: type,
  label: DOCUMENT_TYPE_LABELS[type],
}));

export function DocumentTypeSelect({
  value,
  onChange,
  id,
  ariaLabel = 'Document type',
  ariaDescribedBy,
  invalid = false,
  disabled = false,
  size = 'md',
}: DocumentTypeSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        onChange(next as DocumentType);
      }}
      options={documentTypeOptions}
      {...(id === undefined ? {} : { id })}
      ariaLabel={ariaLabel}
      ariaDescribedBy={ariaDescribedBy}
      invalid={invalid}
      disabled={disabled}
      size={size}
    />
  );
}
