import { Camera, Menu, Search } from 'lucide-react';

import { AccountMenu } from '@/layouts/components/AccountMenu';
import { IconButton } from '@/components/ui/icon-button';
import { NotificationBell } from '@/components/domain/NotificationBell';
import { ThemeToggle } from '@/components/domain/ThemeToggle';
import { LanguageSwitcher } from '@/components/domain/LanguageSwitcher';
import { AiChatTrigger } from '@/components/domain/AiChatDropdown';
import type { AttachedImageData } from '@/context/AiChatContext';

export interface TopbarProps {
  onOpenDrawer: () => void;
  onOpenPalette: (image?: AttachedImageData | null) => void;
}

export function Topbar({ onOpenDrawer, onOpenPalette }: TopbarProps) {
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              onOpenPalette({
                dataUrl: reader.result,
                name: file.name || 'Pasted image',
                mimeType: file.type,
              });
            }
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    }
  };

  return (
    <header
      aria-label="Application header"
      className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--fd-border)] bg-[var(--fd-surface-1)] px-3 sm:px-6"
    >
      <div className="flex items-center gap-2">
        <IconButton
          label="Open navigation menu"
          onClick={onOpenDrawer}
          className="lg:hidden"
          icon={<Menu size={18} aria-hidden="true" />}
        />
        <button
          type="button"
          onClick={() => onOpenPalette()}
          onPaste={handlePaste}
          title="Search FirmDesk or paste image (Ctrl+V)"
          className="group flex h-9 w-9 sm:w-72 min-w-0 items-center justify-center sm:justify-start gap-2 rounded-md border border-[var(--fd-border)] bg-[var(--fd-surface-2)] px-2 sm:px-3 text-left text-[var(--fd-text-tertiary)] transition-colors hover:border-[var(--fd-border-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]"
        >
          <Search size={14} aria-hidden="true" className="shrink-0" />
          <span className="hidden truncate text-base sm:block">Search FirmDesk</span>
          <span className="ml-auto hidden items-center gap-1.5 sm:flex">
            <span
              title="You can paste images (Ctrl+V) or screenshots directly into search"
              className="inline-flex items-center text-[11px] text-[var(--fd-text-tertiary)] group-hover:text-indigo-500 transition-colors"
            >
              <Camera size={13} aria-hidden="true" />
            </span>
            <kbd className="rounded border border-[var(--fd-border)] px-1.5 py-0.5 text-[10px]">
              Ctrl K
            </kbd>
          </span>
        </button>
      </div>

      <div className="flex items-center gap-1 sm:gap-1.5">
        <AiChatTrigger />
        <LanguageSwitcher compact />
        <ThemeToggle />
        <NotificationBell enabled />
        <AccountMenu profilePath="/profile" />
      </div>
    </header>
  );
}

