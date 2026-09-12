import { Building2, Download, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { DESKTOP_DOWNLOAD_URL } from '@/lib/shell';

export function StaffDesktopRequired() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--fd-bg)] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] p-6 text-center shadow-xl">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--fd-accent)]/10 text-[var(--fd-accent)]">
          <ShieldCheck size={24} aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold text-[var(--fd-text-primary)]">
          Staff access is desktop-only
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--fd-text-secondary)]">
          The client portal remains in this browser. Admin and staff workspace, books, compliance,
          and Tally operations now run in the FirmDesk desktop app.
        </p>
        <Button asChild className="mt-6 w-full">
          <a href={DESKTOP_DOWNLOAD_URL}>
            <Download size={16} aria-hidden="true" />
            Download FirmDesk Desktop
          </a>
        </Button>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-2xs text-[var(--fd-text-tertiary)]">
          <Building2 size={12} aria-hidden="true" />
          Already a client? Continue from the web portal.
        </p>
        <Link
          to="/portal"
          className="mt-2 inline-block text-xs font-medium text-[var(--fd-accent)] underline underline-offset-4"
        >
          Open client portal
        </Link>
      </div>
    </main>
  );
}
