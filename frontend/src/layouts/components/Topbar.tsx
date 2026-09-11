import { Camera, Menu, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { AccountMenu } from '@/layouts/components/AccountMenu';
import { IconButton } from '@/components/ui/icon-button';
import { NotificationBell } from '@/components/domain/NotificationBell';
import { ThemeToggle } from '@/components/domain/ThemeToggle';
import { LanguageSwitcher } from '@/components/domain/LanguageSwitcher';
import { AiChatTrigger } from '@/components/domain/AiChatDropdown';
import type { AttachedImageData } from '@/context/AiChatContext';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function DigitalClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const day = DAYS[now.getDay()] ?? 'Monday';
  const date = now.getDate();
  const month = MONTHS[now.getMonth()] ?? 'January';
  const year = now.getFullYear();

  return (
    <div className="hidden md:flex flex-col items-center select-none" aria-label="Current date and time">
      {/* Time row */}
      <div className="flex items-baseline gap-0.5 leading-none">
        <span
          className="font-bold tabular-nums tracking-widest text-[var(--fd-text-primary)]"
          style={{ fontSize: '18px', fontFamily: 'var(--font-sans)', letterSpacing: '0.12em' }}
        >
          {hh}
        </span>
        <span
          className="font-bold text-[var(--fd-accent)] animate-pulse"
          style={{ fontSize: '16px' }}
        >
          :
        </span>
        <span
          className="font-bold tabular-nums tracking-widest text-[var(--fd-text-primary)]"
          style={{ fontSize: '18px', fontFamily: 'var(--font-sans)', letterSpacing: '0.12em' }}
        >
          {mm}
        </span>
        <span
          className="font-bold text-[var(--fd-accent)] animate-pulse"
          style={{ fontSize: '16px' }}
        >
          :
        </span>
        <span
          className="font-bold tabular-nums tracking-widest text-[var(--fd-text-secondary)]"
          style={{ fontSize: '14px', fontFamily: 'var(--font-sans)', letterSpacing: '0.1em' }}
        >
          {ss}
        </span>
      </div>

      {/* Date row */}
      <div
        className="flex items-center gap-1 text-[var(--fd-text-tertiary)] font-bold tracking-wider"
        style={{ fontSize: '10px', fontFamily: 'var(--font-sans)', letterSpacing: '0.08em', marginTop: '2px' }}
      >
        <span>{day.slice(0, 3).toUpperCase()}</span>
        <span className="text-[var(--fd-accent)]">·</span>
        <span>{String(date).padStart(2, '0')}</span>
        <span className="text-[var(--fd-accent)]">·</span>
        <span>{month.slice(0, 3).toUpperCase()}</span>
        <span className="text-[var(--fd-accent)]">·</span>
        <span>{year}</span>
      </div>
    </div>
  );
}

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
      {/* Left: Hamburger + Search */}
      <div className="flex items-center gap-2">
        <IconButton
          label="Open navigation menu"
          onClick={onOpenDrawer}
          icon={<Menu size={18} aria-hidden="true" />}
        />
        <button
          type="button"
          onClick={() => onOpenPalette()}
          onPaste={handlePaste}
          title="Search FirmDesk or paste image (Ctrl+V)"
          className="group flex h-9 w-9 sm:w-72 min-w-0 items-center justify-center sm:justify-start gap-2 rounded-md border border-[var(--fd-border)] bg-[var(--fd-surface-2)] px-2 sm:px-3 text-left text-[var(--fd-text-tertiary)] transition-all duration-200 hover:border-[var(--fd-accent)]/50 hover:bg-[var(--fd-surface-3)] hover:shadow-xs active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)] cursor-pointer"
        >
          <Search size={14} aria-hidden="true" className="shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:text-[var(--fd-accent)]" />
          <span className="hidden truncate text-base sm:block">Search FirmDesk</span>
          <span className="ml-auto hidden items-center gap-1.5 sm:flex">
            <span
              title="You can paste images (Ctrl+V) or screenshots directly into search"
              className="inline-flex items-center text-[11px] text-[var(--fd-text-tertiary)] group-hover:text-[var(--fd-accent-hover)] transition-all group-hover:scale-110"
            >
              <Camera size={13} aria-hidden="true" />
            </span>
            <kbd className="rounded border border-[var(--fd-border)] px-1.5 py-0.5 text-[10px] transition-colors group-hover:border-[var(--fd-accent)]/40">
              Ctrl K
            </kbd>
          </span>
        </button>
      </div>

      {/* Center: Digital Clock */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <DigitalClock />
      </div>

      {/* Right: Actions */}
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
