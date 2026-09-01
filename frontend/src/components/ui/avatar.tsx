import * as RadixAvatar from '@radix-ui/react-avatar';

import { cn } from '@/lib/cn';
import { initialsOf } from '@/lib/format';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<AvatarSize, string> = {
  xs: 'h-5 w-5 text-2xs',
  sm: 'h-6 w-6 text-2xs',
  md: 'h-8 w-8 text-xs',
  lg: 'h-11 w-11 text-base',
};

export interface AvatarProps {
  name: string | null | undefined;
  image?: string | null;
  size?: AvatarSize;
  className?: string;
}

export function Avatar({ name, image, size = 'md', className }: AvatarProps) {
  const label = name ?? 'Unknown person';

  return (
    <RadixAvatar.Root
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        'bg-[var(--fd-surface-3)] font-medium text-[var(--fd-text-secondary)] select-none',
        SIZES[size],
        className,
      )}
    >
      {typeof image === 'string' && image.length > 0 ? (
        <RadixAvatar.Image src={image} alt="" className="h-full w-full object-cover" />
      ) : null}
      <RadixAvatar.Fallback delayMs={0} className="leading-none">
        <span aria-hidden="true">{initialsOf(name)}</span>
        <span className="sr-only">{label}</span>
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  );
}

export function AvatarGroup({
  names,
  max = 3,
  size = 'sm',
}: {
  names: readonly string[];
  max?: number;
  size?: AvatarSize;
}) {
  if (names.length === 0) {
    return <span className="text-xs text-[var(--fd-text-tertiary)]">Unassigned</span>;
  }
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;

  return (
    <span className="inline-flex items-center -space-x-1.5">
      {shown.map((name) => (
        <Avatar
          key={name}
          name={name}
          size={size}
          className="ring-1 ring-[var(--fd-surface-1)]"
        />
      ))}
      {rest > 0 ? (
        <span className="text-2xs ml-2.5 text-[var(--fd-text-tertiary)]">+{rest}</span>
      ) : null}
    </span>
  );
}
