import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Download, Sparkles, X } from 'lucide-react';

import { fetchDesktopManifest, type DesktopManifest } from '@/api/desktop.api';
import { signOutEverywhere } from '@/api/authClient';
import { Button } from '@/components/ui/button';
import { useSession } from '@/context/SessionContext';
import { useWorkstationAgent } from '@/hooks/useWorkstationAgent';
import { appInfo, onOsLock, type DesktopAppInfo } from '@/lib/desktopBridge';
import { DESKTOP_DOWNLOAD_URL, DESKTOP_UPDATE_URL, isDesktop } from '@/lib/shell';

type VersionStatus = 'ok' | 'update-available' | 'update-required';

const compareSemver = (a: string, b: string): number => {
  const key = (v: string): number => {
    const parts = v
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0)
      .slice(0, 3);
    return (parts[0] ?? 0) * 1_000_000 + (parts[1] ?? 0) * 1_000 + (parts[2] ?? 0);
  };
  return key(a) - key(b);
};

const sanitizeDownloadUrl = (url: string | undefined): string => {
  if (!url || url.length === 0) {
    return (
      DESKTOP_DOWNLOAD_URL ||
      'https://github.com/Harshid001/Accounting_based_website/releases/latest'
    );
  }
  // Avoid sending users to the raw JSON manifest
  if (url.endsWith('/latest.json') || url.endsWith('.json')) {
    return url.replace(/\/download\/latest\.json$/, '').replace(/\/latest\.json$/, '');
  }
  return url;
};

export function DesktopShellGate() {
  const { user, clear } = useSession();
  const [versionStatus, setVersionStatus] = useState<VersionStatus>('ok');
  const [currentVersion, setCurrentVersion] = useState<string>('0.1.0');
  const [latestVersion, setLatestVersion] = useState<string>('0.1.0');
  const [minVersion, setMinVersion] = useState<string>('0.1.0');
  const [updateUrl, setUpdateUrl] = useState<string>(DESKTOP_UPDATE_URL);
  const [dismissed, setDismissed] = useState<boolean>(false);

  // The workstation agent loop: no-op outside the desktop shell.
  useWorkstationAgent(user);

  // OS-lock auto-logout: the bridge emits firmdesk://os-lock on lock.
  useEffect(() => {
    if (!isDesktop || user === null) return;
    return onOsLock((locked) => {
      if (!locked) return;
      void signOutEverywhere()
        .catch(() => undefined)
        .finally(() => {
          clear();
        });
    });
  }, [user, clear]);

  // Version gate: check the manifest on mount.
  const manifest = useQuery<DesktopManifest>({
    queryKey: ['desktop', 'manifest'],
    queryFn: fetchDesktopManifest,
    enabled: isDesktop,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!isDesktop || manifest.data === undefined) return;
    let cancelled = false;
    void appInfo()
      .then((info: DesktopAppInfo) => {
        if (cancelled) return;
        setCurrentVersion(info.version);
        setLatestVersion(manifest.data.latestShellVersion);
        setMinVersion(manifest.data.minShellVersion);

        const status: VersionStatus =
          compareSemver(info.version, manifest.data.minShellVersion) < 0
            ? 'update-required'
            : compareSemver(info.version, manifest.data.latestShellVersion) < 0
              ? 'update-available'
              : 'ok';
        setVersionStatus(status);
        setUpdateUrl(manifest.data.updateUrl || DESKTOP_UPDATE_URL);
      })
      .catch(() => {
        if (!cancelled) setVersionStatus('ok');
      });
    return () => {
      cancelled = true;
    };
  }, [manifest.data]);

  if (!isDesktop) return null;

  const downloadTarget = sanitizeDownloadUrl(updateUrl);

  // Required update barrier
  if (versionStatus === 'update-required') {
    return (
      <div
        role="alert"
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-md px-4"
      >
        <div className="w-full max-w-lg rounded-2xl border border-[var(--fd-status-danger)]/50 bg-[var(--fd-surface-1)] p-7 text-left shadow-2xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
              <Download size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--fd-text-primary)]">
                FirmDesk Update Required
              </h2>
              <p className="text-xs text-[var(--fd-text-secondary)]">
                Security & compliance policy requires updating to continue
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-2)] p-3.5 flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <span className="text-2xs uppercase tracking-wider text-[var(--fd-text-tertiary)] font-semibold">
                Installed
              </span>
              <div className="font-mono font-medium text-[var(--fd-text-primary)]">
                v{currentVersion}
              </div>
            </div>
            <ArrowRight size={16} className="text-[var(--fd-text-tertiary)]" />
            <div className="space-y-0.5 text-right">
              <span className="text-2xs uppercase tracking-wider text-emerald-400 font-semibold">
                Required Minimum
              </span>
              <div className="font-mono font-bold text-emerald-400">v{minVersion}</div>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-[var(--fd-text-secondary)]">
            To ensure the security of your practice books, client tax filings, and GST returns,
            this older version cannot communicate with the server. Please install the update to
            regain access.
          </p>

          <Button
            size="lg"
            variant="primary"
            className="w-full gap-2 text-sm font-semibold"
            asChild
          >
            <a href={downloadTarget} target="_blank" rel="noreferrer">
              <Download size={16} />
              Download Required Update
            </a>
          </Button>
        </div>
      </div>
    );
  }

  // Available update popup
  if (versionStatus === 'update-available') {
    // If dismissed, show a sleek reminder pill in the corner so user can reopen it anytime
    if (dismissed) {
      return (
        <button
          type="button"
          onClick={() => setDismissed(false)}
          className="fixed bottom-5 right-5 z-[65] flex items-center gap-2 rounded-full border border-[var(--fd-accent)]/40 bg-[var(--fd-surface-1)]/95 px-3.5 py-2 text-xs font-semibold text-[var(--fd-text-primary)] shadow-lg backdrop-blur-md transition-all hover:scale-105 hover:border-[var(--fd-accent)] hover:shadow-[0_0_20px_rgba(20,184,166,0.3)] cursor-pointer"
        >
          <Sparkles size={14} className="text-[var(--fd-accent)] animate-pulse" />
          <span>Update v{latestVersion} Available</span>
        </button>
      );
    }

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-modal-title"
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      >
        <div className="relative w-full max-w-md rounded-2xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] p-6 shadow-2xl space-y-5 text-left">
          {/* Close button */}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="absolute top-4 right-4 rounded-lg p-1.5 text-[var(--fd-text-tertiary)] hover:bg-[var(--fd-surface-2)] hover:text-[var(--fd-text-primary)] transition-colors cursor-pointer"
            aria-label="Dismiss update"
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div className="flex items-start gap-3.5 pr-6">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--fd-accent)]/15 text-[var(--fd-accent)] ring-1 ring-[var(--fd-accent)]/30">
              <Sparkles size={20} />
            </div>
            <div>
              <h2
                id="update-modal-title"
                className="text-base font-bold text-[var(--fd-text-primary)]"
              >
                FirmDesk Update Available
              </h2>
              <p className="text-xs text-[var(--fd-text-secondary)] mt-0.5">
                A new version is ready with practice updates and fixes.
              </p>
            </div>
          </div>

          {/* Version comparison row */}
          <div className="rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-2)] p-3 flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <span className="text-2xs uppercase tracking-wider text-[var(--fd-text-tertiary)] font-medium">
                Your Version
              </span>
              <div className="font-mono text-[var(--fd-text-secondary)]">v{currentVersion}</div>
            </div>
            <ArrowRight size={14} className="text-[var(--fd-text-tertiary)]" />
            <div className="space-y-0.5">
              <span className="text-2xs uppercase tracking-wider text-[var(--fd-accent)] font-semibold">
                New Version
              </span>
              <div className="font-mono font-bold text-[var(--fd-accent)]">v{latestVersion}</div>
            </div>
            <span className="text-2xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              Recommended
            </span>
          </div>

          {/* Highlights */}
          <div className="space-y-2 rounded-xl bg-[var(--fd-surface-2)]/60 border border-[var(--fd-border-subtle)] p-3 text-xs text-[var(--fd-text-secondary)]">
            <div className="font-semibold text-[var(--fd-text-primary)] text-2xs uppercase tracking-wider">
              What&apos;s New in this Release:
            </div>
            <ul className="space-y-1.5 text-2xs text-[var(--fd-text-secondary)]">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-[var(--fd-accent)] shrink-0" />
                <span>Single-click Google & Staff sign-in for FirmDesk desktop</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-[var(--fd-accent)] shrink-0" />
                <span>Enhanced GST, TDS, and ITR compliance calendar accuracy</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-[var(--fd-accent)] shrink-0" />
                <span>Performance optimizations and workstation bridge stability</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2.5 pt-1">
            <Button
              variant="secondary"
              size="md"
              className="flex-1 text-xs"
              onClick={() => setDismissed(true)}
            >
              Remind Me Later
            </Button>
            <Button
              variant="primary"
              size="md"
              className="flex-1 gap-1.5 text-xs font-semibold"
              asChild
            >
              <a href={downloadTarget} target="_blank" rel="noreferrer">
                <Download size={14} />
                Update Now
              </a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
