import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { ProgressBar } from '@/components/ui/progress-bar';

export interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
}

export interface ChecklistProps {
  items: readonly ChecklistItem[];
  onToggle: (id: string, done: boolean) => void;
  onAdd?: (title: string) => void;
  onRemove?: (id: string) => void;
  readOnly?: boolean;
  emptyLabel?: string;
  className?: string;
}

export function Checklist({
  items,
  onToggle,
  onAdd,
  onRemove,
  readOnly = false,
  emptyLabel = 'No sub-tasks yet.',
  className,
}: ChecklistProps) {
  const [draft, setDraft] = useState('');
  const done = items.filter((item) => item.done).length;

  const submitDraft = (): void => {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || onAdd === undefined) return;
    onAdd(trimmed);
    setDraft('');
  };

  return (
    <div className={cn('space-y-3', className)}>
      {items.length > 0 ? (
        <ProgressBar
          value={done}
          max={items.length}
          showValue
          tone={done === items.length ? 'done' : 'accent'}
          label={`${done} of ${items.length} sub-tasks done`}
        />
      ) : null}

      {items.length === 0 ? (
        <p className="text-xs text-[var(--fd-text-tertiary)]">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-2">
              <Checkbox
                checked={item.done}
                disabled={readOnly}
                label={item.title}
                onCheckedChange={(checked) => {
                  onToggle(item.id, checked);
                }}
                className={item.done ? 'opacity-70' : ''}
              />
              {readOnly || onRemove === undefined ? null : (
                <IconButton
                  label={`Remove ${item.title}`}
                  size="sm"
                  icon={<Trash2 size={13} aria-hidden="true" />}
                  onClick={() => {
                    onRemove(item.id);
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {readOnly || onAdd === undefined ? null : (
        <div className="flex gap-2">
          <Input
            value={draft}
            aria-label="New sub-task"
            placeholder="Add a sub-task"
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submitDraft();
              }
            }}
          />
          <Button size="sm" variant="secondary" disabled={draft.trim().length === 0} onClick={submitDraft}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
