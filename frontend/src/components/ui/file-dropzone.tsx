import { FileUp, Paperclip, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { cn } from '@/lib/cn';
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_LABEL, UPLOAD_ACCEPT_ATTRIBUTE } from '@/lib/constants';
import { formatBytes, maskFilename } from '@/lib/format';
import { IconButton } from '@/components/ui/icon-button';
import { InlineError } from '@/components/ui/error-state';
import { ProgressBar } from '@/components/ui/progress-bar';

export type DropzoneState = 'idle' | 'dragging' | 'uploading' | 'error';

export interface FileDropzoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  state: DropzoneState;
  error?: string | null;
  progress?: number;
  disabled?: boolean;
  label?: string;
  className?: string;
}

const ACCEPT_HINT = `${ALLOWED_EXTENSIONS.join(', ').toUpperCase()} up to ${MAX_UPLOAD_LABEL}`;

export function FileDropzone({
  file,
  onFileChange,
  state,
  error,
  progress,
  disabled = false,
  label = 'Choose a file to upload',
  className,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const hintId = useId();
  const uploading = state === 'uploading';
  const active = dragging || state === 'dragging';

  const pick = (): void => {
    if (!disabled && !uploading) inputRef.current?.click();
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div
        role="button"
        tabIndex={disabled || uploading ? -1 : 0}
        aria-label={label}
        aria-describedby={hintId}
        aria-disabled={disabled || uploading}
        onClick={pick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            pick();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && !uploading) setDragging(true);
        }}
        onDragLeave={() => {
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (disabled || uploading) return;
          const dropped = event.dataTransfer.files.item(0);
          if (dropped !== null) onFileChange(dropped);
        }}
        className={cn(
          'flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg',
          'border border-dashed px-4 py-5 text-center transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]',
          active
            ? 'border-[var(--fd-accent)] bg-[var(--fd-accent-subtle-bg)]'
            : 'border-[var(--fd-border-strong)] bg-[var(--fd-surface-2)] hover:border-[var(--fd-accent)]',
          state === 'error' && 'border-[var(--fd-status-danger)]',
          (disabled || uploading) && 'cursor-not-allowed opacity-70',
        )}
      >
        <FileUp size={20} aria-hidden="true" className="text-[var(--fd-text-tertiary)]" />
        <p className="text-base text-[var(--fd-text-primary)]">
          {active ? 'Drop the file here' : 'Drop a file here, or click to choose one'}
        </p>
        <p id={hintId} className="text-xs text-[var(--fd-text-tertiary)]">
          {ACCEPT_HINT}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={UPLOAD_ACCEPT_ATTRIBUTE}
        disabled={disabled || uploading}
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          const chosen = event.target.files?.item(0) ?? null;
          onFileChange(chosen);
          event.target.value = '';
        }}
      />

      {file === null ? null : (
        <div className="flex items-center gap-2 rounded-md border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] px-3 py-2">
          <Paperclip size={14} aria-hidden="true" className="shrink-0 text-[var(--fd-text-tertiary)]" />
          <span className="min-w-0 flex-1 truncate text-base text-[var(--fd-text-primary)]">
            {maskFilename(file.name)}
          </span>
          <span className="numeric shrink-0 text-xs text-[var(--fd-text-tertiary)]">
            {formatBytes(file.size)}
          </span>
          {uploading ? null : (
            <IconButton
              label={`Remove ${file.name}`}
              size="sm"
              icon={<X size={13} aria-hidden="true" />}
              onClick={() => {
                onFileChange(null);
              }}
            />
          )}
        </div>
      )}

      {uploading ? (
        <ProgressBar value={progress ?? 40} max={100} label="Upload progress" />
      ) : null}

      {typeof error === 'string' && error.length > 0 ? <InlineError message={error} /> : null}
    </div>
  );
}
