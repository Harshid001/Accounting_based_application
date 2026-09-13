import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  Download,
  ExternalLink,
  FolderDown,
  MonitorSmartphone,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { fetchDesktopManifest, type DesktopManifest } from '@/api/desktop.api';
import { Button } from '@/components/ui/button';
import { DESKTOP_DOWNLOAD_URL } from '@/lib/shell';
import { usePageTitle } from '@/hooks/usePageTitle';

const REQUIREMENTS = [
  'Windows 10 or 11 (64-bit)',
  'Tally ERP 9 or TallyPrime, running with the company open',
  'In Tally, once: Gateway of Tally → F3 → Settings → Client/Server Configurations → "Tally acts as" = Both, port 9000',
] as const;

const GITHUB_REPO_URL = 'https://github.com/Harshid001/Accounting_based_website';

/**
 * The public download page the web interstitial sends staff to. Hosted on the
 * same static site as the portal. Provides direct download links for the Windows
 * NSIS installer, portable executable, and release notes.
 */
export function DesktopDownload() {
  usePageTitle('FirmDesk Desktop');

  const { data: manifest } = useQuery<DesktopManifest>({
    queryKey: ['desktop-manifest'],
    queryFn: fetchDesktopManifest,
    staleTime: 60_000,
    retry: 1,
  });

  const version = manifest?.latestShellVersion || '0.1.1';

  // If a valid external download URL is configured, respect it;
  // otherwise, direct users to the official release installer on GitHub.
  const installerUrl =
    DESKTOP_DOWNLOAD_URL && DESKTOP_DOWNLOAD_URL !== '/desktop-download'
      ? DESKTOP_DOWNLOAD_URL
      : `${GITHUB_REPO_URL}/releases/download/firmdesk-desktop-v${version}/FirmDesk_${version}_x64-setup.exe`;

  const portableUrl = `${GITHUB_REPO_URL}/releases/download/firmdesk-desktop-v${version}/FirmDesk-${version}-portable-x64.exe`;
  const releasesUrl = `${GITHUB_REPO_URL}/releases/latest`;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--fd-bg)] px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] p-6 shadow-xl">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--fd-accent)]/10 text-[var(--fd-accent)]">
          <MonitorSmartphone size={24} aria-hidden="true" />
        </div>
        <h1 className="text-center text-xl font-semibold text-[var(--fd-text-primary)]">
          FirmDesk Desktop
        </h1>
        <div className="mt-1 flex items-center justify-center">
          <span className="inline-flex items-center rounded-full border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] px-2.5 py-0.5 text-xs font-medium text-[var(--fd-text-secondary)]">
            v{version} · Windows (64-bit)
          </span>
        </div>
        <p className="mt-3 text-center text-sm leading-relaxed text-[var(--fd-text-secondary)]">
          The admin & staff workspace for Windows — client books, compliance filings, the automation
          monitor, and the live Tally bridge, signed in once.
        </p>

        {/* Primary Download: Windows Installer */}
        <Button asChild className="mt-6 w-full" size="lg">
          <a href={installerUrl} download>
            <Download size={16} aria-hidden="true" />
            Download for Windows (Installer .exe)
          </a>
        </Button>

        {/* Secondary Download options */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs">
          <a
            href={portableUrl}
            download
            className="flex items-center gap-1.5 font-medium text-[var(--fd-text-secondary)] transition-colors hover:text-[var(--fd-text-primary)]"
          >
            <FolderDown size={14} aria-hidden="true" />
            Portable Edition (.exe)
          </a>
          <span className="text-[var(--fd-border)]" aria-hidden="true">
            •
          </span>
          <a
            href={releasesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 font-medium text-[var(--fd-accent)] hover:underline"
          >
            <ExternalLink size={14} aria-hidden="true" />
            Release Notes
          </a>
        </div>

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

        <div className="mt-4 flex flex-col items-center gap-2 text-center text-2xs leading-relaxed text-[var(--fd-text-tertiary)]">
          <p>
            The desktop app talks only to jvaccounting.in over HTTPS and to Tally on your own machine
            (localhost:9000). Nothing is exposed to the network. Clients never need this app — the
            client portal stays in the browser.
          </p>
          <Link
            to="/portal"
            className="mt-1 flex items-center gap-1 text-xs font-medium text-[var(--fd-accent)] hover:underline"
          >
            <Building2 size={13} aria-hidden="true" />
            Looking for Client Portal? Continue in browser
          </Link>
        </div>
      </div>
    </main>
  );
}

