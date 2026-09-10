/**
 * Desktop-only affordances mounted inside StaffLayout (spec §5.6):
 *  - the workstation agent (register → heartbeat → poll → Tally bridge)
 *  - OS-lock auto-logout (rule: session dies when the workstation locks)
 *  - the version gate: below minShellVersion = hard update wall at login;
 *    below latestShellVersion = update banner.
 * Renders null in the web build — these live inside admin/staff routes only,
 * so the web bundle never carries the desktop-only code paths.
 */
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, RefreshCw } from 'lucide-react';

import { fetchDesktopManifest, type DesktopManifest } from '@/api/desktop.api';
import { signOutEverywhere } from '@/api/authClient';
import { Button } from '@/components/ui/button';
import { useSession } from '@/context/SessionContext';
import { useWorkstationAgent } from '@/hooks/useWorkstationAgent';
import { appInfo, onOsLock, type DesktopAppInfo } from '@/lib/desktopBridge';
import { DESKTOP_UPDATE_URL, isDesktop } from '@/lib/shell';

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

export function DesktopShellGate() {
  const { user, clear } = useSession();
  const [versionStatus, setVersionStatus] = useState<VersionStatus>('ok');
  const [updateUrl, setUpdateUrl] = useState<string>(DESKTOP_UPDATE_URL);

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

  // Version gate (rule 7): check the manifest on mount.
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
        // No bridge (tests, dev browser): skip the gate rather than lock
        // the user out on a version we cannot read.
        if (!cancelled) setVersionStatus('ok');
      });
    return () => {
      cancelled = true;
    };
  }, [manifest.data]);

  if (!isDesktop) return null;

  if (versionStatus === 'update-required') {
    return (
      <div
        role="alert"
        className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--fd-bg)]/95 px-4"
      >
        <div className="w-full max-w-md rounded-2xl border border-[var(--fd-status-danger)] bg-[var(--fd-surface-1)] p-6 text-center shadow-xl">
          <h1 className="text-lg font-semibold text-[var(--fd-text-primary)]">
            Update required
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--fd-text-secondary)]">
            This version of FirmDesk Desktop is no longer allowed to reach client books and
            filings. Install the update and sign in again.
          </p>
          <Button className="mt-5 w-full" asChild>
            <a href={updateUrl}>
              <Download size={16} aria-hidden="true" />
              Download the update
            </a>
          </Button>
        </div>
      </div>
    );
  }

  if (versionStatus === 'update-available') {
    return (
      <div
        role="status"
        data-print="hide"
        className="fixed bottom-4 left-1/2 z-[65] flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-lg border border-[var(--fd-border)] bg-[var(--fd-surface-1)] p-3 shadow-[var(--fd-shadow-overlay)]"
      >
        <RefreshCw size={16} aria-hidden="true" className="shrink-0 text-[var(--fd-accent)]" />
        <p className="min-w-0 flex-1 text-base text-[var(--fd-text-primary)]">
          A new version of FirmDesk Desktop is available.
        </p>
        <Button size="sm" variant="secondary" asChild>
          <a href={updateUrl}>Update</a>
        </Button>
      </div>
    );
  }

  return null;
}
