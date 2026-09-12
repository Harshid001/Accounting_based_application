import { CheckCircle2, Download, MonitorSmartphone, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DESKTOP_DOWNLOAD_URL } from '@/lib/shell';
import { usePageTitle } from '@/hooks/usePageTitle';

const REQUIREMENTS = [
  'Windows 10 or 11 (64-bit)',
  'Tally ERP 9 or TallyPrime, running with the company open',
  'In Tally, once: Gateway of Tally → F3 → Settings → Client/Server Configurations → "Tally acts as" = Both, port 9000',
] as const;

/**
 * The public download page the web interstitial sends staff to. Hosted on the
 * same static site as the portal, so the default DESKTOP_DOWNLOAD_URL
 * (`/desktop-download`) never 404s; a configured absolute URL (releases
 * page, CDN) overrides it per environment.
 */
export function DesktopDownload() {
  usePageTitle('FirmDesk Desktop');

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--fd-bg)] px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] p-6 shadow-xl">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--fd-accent)]/10 text-[var(--fd-accent)]">
          <MonitorSmartphone size={24} aria-hidden="true" />
        </div>
        <h1 className="text-center text-xl font-semibold text-[var(--fd-text-primary)]">
          FirmDesk Desktop
        </h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-[var(--fd-text-secondary)]">
          The admin & staff workspace for Windows — client books, compliance filings, the automation
          monitor, and the live Tally bridge, signed in once.
        </p>

        <Button asChild className="mt-6 w-full" size="lg">
          <a href={DESKTOP_DOWNLOAD_URL === '/desktop-download' ? '#download' : DESKTOP_DOWNLOAD_URL}>
            <Download size={16} aria-hidden="true" />
            Download for Windows
          </a>
        </Button>

        <div className="mt-6 rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] p-4">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--fd-text-tertiary)]">
            <ShieldCheck size={13} aria-hidden="true" />
            Before you install
          </h2>
          <ul className="mt-2.5 space-y-2">
            {REQUIREMENTS.map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm text-[var(--fd-text-secondary)]">
                <CheckCircle2
                  size={14}
                  aria-hidden="true"
                  className="mt-1 shrink-0 text-[var(--fd-status-done)]"
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-center text-2xs leading-relaxed text-[var(--fd-text-tertiary)]">
          The desktop app talks only to jvaccounting.in over HTTPS and to Tally on your own machine
          (localhost:9000). Nothing is exposed to the network. Clients never need this app — the
          client portal stays in the browser.
        </p>
      </div>
    </main>
  );
}
