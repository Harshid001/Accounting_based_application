import { useEffect, useState, useCallback } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Download, Sparkles, X, RefreshCw } from 'lucide-react';

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
  const [update, setUpdate] = useState<Update | null>(null);
  const [updating, setUpdating] = useState<boolean>(false);
  const [updateProgress, setUpdateProgress] = useState<number>(0);
  const [updateDone, setUpdateDone] = useState<boolean>(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const installUpdate = async (): Promise<void> => {
    if (update === null) return;
    setUpdating(true);
    setUpdateProgress(0);
    setUpdateDone(false);
    setUpdateError(null);
    try {
      let downloaded = 0;
      let total = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0;
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          if (total > 0) {
            setUpdateProgress(Math.min(99, Math.round((downloaded / total) * 100)));
          }
        } else if (event.event === 'Finished') {
          setUpdateProgress(100);
          setUpdateDone(true);
        }
      });
      setUpdateProgress(100);
      setUpdateDone(true);
      setTimeout(async () => {
        try {
          await relaunch();
        } catch {
          // In case relaunch is not supported on certain platforms
        }
      }, 2000);
    } catch (error) {
      setUpdateError(
        error instanceof Error
          ? error.message
          : 'Update failed. Please download the installer manually.',
      );
      setUpdating(false);
    }
  };

  // Check Tauri updater periodically every 5 minutes
  const checkForTauriUpdate = useCallback(() => {
    if (!isDesktop) return;
    check()
      .then((available) => {
        setUpdate(available);
        if (available) {
          setDismissed(false);
        }
      })
      .catch(() => {
        setUpdate(null);
      });
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    checkForTauriUpdate();
    const interval = setInterval(checkForTauriUpdate, 5 * 60 * 1000);
    return () => {
      clearInterval(interval);
    };
  }, [checkForTauriUpdate]);

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

  // Version gate: poll the manifest every 5 minutes and on window focus
  const manifest = useQuery<DesktopManifest>({
    queryKey: ['desktop', 'manifest'],
    queryFn: fetchDesktopManifest,
    enabled: isDesktop,
    staleTime: 60_000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
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
        if (status !== 'ok') {
          setDismissed(false);
        }
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
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 px-4 backdrop-blur-md"
      >
        <div className="w-full max-w-lg space-y-5 rounded-2xl border border-[var(--fd-status-danger)]/50 bg-[var(--fd-surface-1)] p-7 text-left shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--fd-status-danger)]/10 text-[var(--fd-status-danger)] ring-1 ring-[var(--fd-status-danger)]/20">
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

          <div className="flex items-center justify-between rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-2)] p-3.5 text-xs">
            <div className="space-y-0.5">
              <span className="text-2xs font-semibold tracking-wider text-[var(--fd-text-tertiary)] uppercase">
                Installed
              </span>
              <div className="font-mono font-medium text-[var(--fd-text-primary)]">
                v{currentVersion}
              </div>
            </div>
            <ArrowRight size={16} className="text-[var(--fd-text-tertiary)]" />
            <div className="space-y-0.5 text-right">
              <span className="text-2xs font-semibold tracking-wider text-[var(--fd-accent)] uppercase">
                Required Minimum
              </span>
              <div className="font-mono font-bold text-[var(--fd-accent)]">v{minVersion}</div>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-[var(--fd-text-secondary)]">
            To ensure the security of your practice books, client tax filings, and GST returns, this
            older version cannot communicate with the server. Please install the update to regain
            access.
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
  if (versionStatus === 'update-available' || update !== null) {
    // If dismissed, show sleek reminder pill in bottom right
    if (dismissed && !updating && !updateDone) {
      return (
        <button
          type="button"
          onClick={() => setDismissed(false)}
          className="fixed right-5 bottom-5 z-[65] flex cursor-pointer items-center gap-2 rounded-full border border-[var(--fd-accent)]/40 bg-[var(--fd-surface-1)]/95 px-3.5 py-2 text-xs font-semibold text-[var(--fd-text-primary)] shadow-lg backdrop-blur-md transition-all hover:scale-105 hover:border-[var(--fd-accent)] hover:shadow-[0_0_20px_rgba(255,106,0,0.3)]"
        >
          <Sparkles size={14} className="animate-pulse text-[var(--fd-accent)]" />
          <span>Update v{latestVersion} Available</span>
        </button>
      );
    }

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-modal-title"
        className="animate-in fade-in fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs duration-200"
      >
        <div className="relative w-full max-w-md space-y-5 rounded-2xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] p-6 text-left shadow-2xl">
          {/* Close button (only when not updating) */}
          {!updating && !updateDone && (
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="absolute top-4 right-4 cursor-pointer rounded-lg p-1.5 text-[var(--fd-text-tertiary)] transition-colors hover:bg-[var(--fd-surface-2)] hover:text-[var(--fd-text-primary)]"
              aria-label="Dismiss update"
            >
              <X size={18} />
            </button>
          )}

          {/* Update Completed State */}
          {updateDone ? (
            <div className="space-y-4 py-2 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
                <CheckCircle2 size={30} />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-base font-bold text-[var(--fd-text-primary)]">
                  Update Installed Successfully!
                </h2>
                <p className="text-xs text-[var(--fd-text-secondary)]">
                  FirmDesk has been updated to v{latestVersion}. The app will restart now to apply all changes.
                </p>
              </div>
              <Button
                variant="primary"
                size="md"
                className="w-full gap-2 font-semibold"
                onClick={() => {
                  void relaunch().catch(() => undefined);
                }}
              >
                <RefreshCw size={14} />
                Restart Now
              </Button>
            </div>
          ) : (
            <>
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
                  <p className="mt-0.5 text-xs text-[var(--fd-text-secondary)]">
                    A new version is ready with practice updates, speed enhancements, and bug fixes.
                  </p>
                </div>
              </div>

              {/* Version comparison row */}
              <div className="flex items-center justify-between rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-2)] p-3 text-xs">
                <div className="space-y-0.5">
                  <span className="text-2xs font-medium tracking-wider text-[var(--fd-text-tertiary)] uppercase">
                    Your Version
                  </span>
                  <div className="font-mono text-[var(--fd-text-secondary)]">v{currentVersion}</div>
                </div>
                <ArrowRight size={14} className="text-[var(--fd-text-tertiary)]" />
                <div className="space-y-0.5">
                  <span className="text-2xs font-semibold tracking-wider text-[var(--fd-accent)] uppercase">
                    New Version
                  </span>
                  <div className="font-mono font-bold text-[var(--fd-accent)]">v{latestVersion}</div>
                </div>
                <span className="rounded-full border border-[var(--fd-accent)]/20 bg-[var(--fd-accent)]/10 px-2 py-0.5 text-2xs font-bold tracking-wider text-[var(--fd-accent)] uppercase">
                  Recommended
                </span>
              </div>

              {/* Progress bar when updating */}
              {updating ? (
                <div className="space-y-2.5 rounded-xl border border-[var(--fd-accent)]/30 bg-[var(--fd-accent)]/5 p-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--fd-text-primary)]">
                      Downloading & Installing Update...
                    </span>
                    <span className="font-mono font-bold text-[var(--fd-accent)]">
                      {updateProgress > 0 ? `${updateProgress}%` : 'In progress...'}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--fd-surface-2)]">
                    <div
                      className="h-full bg-[var(--fd-accent)] transition-all duration-300 ease-out"
                      style={{ width: `${Math.max(8, updateProgress)}%` }}
                    />
                  </div>
                  <p className="text-2xs text-[var(--fd-text-tertiary)]">
                    Please keep FirmDesk open. The update will be applied automatically.
                  </p>
                </div>
              ) : (
                /* Highlights */
                <div className="space-y-2 rounded-xl border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)]/60 p-3 text-xs text-[var(--fd-text-secondary)]">
                  <div className="text-2xs font-semibold tracking-wider text-[var(--fd-text-primary)] uppercase">
                    What&apos;s New in this Release:
                  </div>
                  <ul className="space-y-1.5 text-2xs text-[var(--fd-text-secondary)]">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={13} className="shrink-0 text-[var(--fd-accent)]" />
                      <span>Desktop session and credentials bridge authentication fix</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={13} className="shrink-0 text-[var(--fd-accent)]" />
                      <span>Enhanced GST, TDS, and ITR compliance calendar accuracy</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={13} className="shrink-0 text-[var(--fd-accent)]" />
                      <span>Performance optimizations and workstation bridge stability</span>
                    </li>
                  </ul>
                </div>
              )}

              {updateError !== null && (
                <p
                  role="alert"
                  className="rounded-lg border border-[var(--fd-status-blocking)]/40 bg-[var(--fd-status-blocking-bg)] px-3 py-2 text-2xs text-[var(--fd-status-blocking)]"
                >
                  {updateError}
                </p>
              )}

              {/* Actions */}
              {!updating && (
                <div className="flex items-center gap-2.5 pt-1">
                  <Button
                    variant="secondary"
                    size="md"
                    className="flex-1 text-xs"
                    onClick={() => setDismissed(true)}
                  >
                    Remind Me Later
                  </Button>
                  {update === null ? (
                    <Button variant="primary" size="md" className="flex-1 text-xs font-semibold" asChild>
                      <a href={downloadTarget} target="_blank" rel="noreferrer">
                        <Download size={14} />
                        Update Now
                      </a>
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="md"
                      className="flex-1 gap-1.5 text-xs font-semibold"
                      loading={updating}
                      loadingLabel="Installing update..."
                      onClick={() => {
                        void installUpdate();
                      }}
                    >
                      <Download size={14} />
                      Update Now
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
}
