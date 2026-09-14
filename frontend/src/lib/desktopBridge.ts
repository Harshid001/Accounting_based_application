/**
 * Typed bridge to the Tauri 2 host — the single module allowed to invoke
 * Rust commands (spec §5.2). Everything else goes through these functions.
 * In the web shell every call rejects with `DesktopBridgeUnavailable`, so
 * callers can guard with `isDesktopShell()` and stay shell-agnostic.
 */
import { invoke, isTauri } from '@tauri-apps/api/core';

import { isDesktop } from '@/lib/shell';

export class DesktopBridgeUnavailable extends Error {
  constructor() {
    super('This feature requires the FirmDesk desktop app.');
    this.name = 'DesktopBridgeUnavailable';
  }
}

const call = async <T>(command: string, payload?: Record<string, unknown>): Promise<T> => {
  if (!isDesktop || !isTauri()) throw new DesktopBridgeUnavailable();
  return invoke<T>(command, payload);
};

// --- Tally bridge (localhost:9000, outbound-only) ---------------------------

export interface TallyProbe {
  reachable: boolean;
  companyName: string | null;
  educationMode: boolean;
  version: string | null;
}

export interface TallyPostResult {
  ok: boolean;
  created: number;
  alreadyExists: boolean;
  reply: string;
  lineError: string | null;
}

/** POST a ready-made XML envelope to Tally's localhost server. */
export const tallyPost = (xml: string): Promise<TallyPostResult> =>
  call<TallyPostResult>('tally_post', { xml });

/** Probe Tally: is it running, which company is open, education mode? */
export const tallyProbe = (): Promise<TallyProbe> => call<TallyProbe>('tally_probe');

// --- OS keychain (Windows Credential Manager) --------------------------------

export const keychainSet = (key: string, value: string): Promise<void> =>
  call<void>('keychain_set', { key, value });

export const keychainGet = (key: string): Promise<string | null> =>
  call<string | null>('keychain_get', { key });

export const keychainDelete = (key: string): Promise<void> =>
  call<void>('keychain_delete', { key });

// --- Window / session -------------------------------------------------------

/** Lock the workstation now: clears in-memory session state immediately. */
export const lockNow = (): Promise<void> => call<void>('lock_now');

// --- External browser (Google sign-in consent pages only) --------------------

/**
 * Open a URL in the user's system browser. The capability scope restricts
 * this to Google's OAuth pages; anything else is rejected by the OS layer
 * and surfaces here as an error.
 */
export const openExternalUrl = async (url: string): Promise<void> => {
  if (!isDesktop || !isTauri()) throw new DesktopBridgeUnavailable();
  const { openUrl } = await import('@tauri-apps/plugin-opener');
  await openUrl(url);
};

// --- Deep links (Google sign-in handoff) -------------------------------------

/**
 * Subscribe to firmdesk:// deep links arriving from the OS (system browser →
 * app). The URL is forwarded verbatim by the Rust shell; validate it with
 * parseAuthDeepLink before use.
 */
export const onDeepLink = (handler: (url: string) => void): (() => void) => {
  if (!isDesktop || !isTauri()) return () => undefined;
  let unlisten: (() => void) | null = null;
  void import('@tauri-apps/api/event')
    .then(({ listen }) => listen<string>('firmdesk://deep-link', (event) => handler(event.payload)))
    .then((stop) => {
      unlisten = stop;
    })
    .catch(() => undefined);
  return () => {
    unlisten?.();
  };
};

/**
 * Deep links that started the app cold (delivered before the webview was
 * listening) are available once via the plugin's current state. Returns the
 * most recent URL or null.
 */
export const currentDeepLink = async (): Promise<string | null> => {
  if (!isDesktop || !isTauri()) return null;
  const { getCurrent } = await import('@tauri-apps/plugin-deep-link');
  const urls = await getCurrent().catch(() => null);
  if (urls === null || urls.length === 0) return null;
  return urls[urls.length - 1] ?? null;
};

// --- App info (workstation registration payload) ----------------------------

export interface DesktopAppInfo {
  version: string;
  deviceName: string;
  platform: string;
  osVersion: string;
}

export const appInfo = (): Promise<DesktopAppInfo> => call<DesktopAppInfo>('app_info');

/** Push heartbeat state to the tray tooltip: online · Tally · company. */
export const setTrayStatus = (
  online: boolean,
  tally: boolean,
  company: string,
): Promise<void> => call<void>('set_tray_status', { online, tally, company });

export interface ShellCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}
export interface ProcessInfo {
  pid: number;
  name: string;
  memoryBytes: number | null;
}
export interface LocalFileResult {
  content: string;
  bytes: number;
}

export const runShellCommand = (input: { command: string; arguments?: string[]; timeoutMs?: number }): Promise<ShellCommandResult> =>
  call<ShellCommandResult>('run_shell_command', input);
export const launchInteractiveApp = (input: { application: string; url?: string }): Promise<void> =>
  call<void>('launch_interactive_app', input);
export const listProcesses = (): Promise<ProcessInfo[]> => call<ProcessInfo[]>('list_processes');
export const readLocalFile = (path: string): Promise<LocalFileResult> =>
  call<LocalFileResult>('read_local_file', { path });
export const writeLocalFile = (path: string, content: string): Promise<void> =>
  call<void>('write_local_file', { path, content, createOnly: true });

/** Subscribe to OS-level lock/unlock events (auto-logout on OS lock). */
export const onOsLock = (handler: (locked: boolean) => void): (() => void) => {
  if (!isDesktop || !isTauri()) return () => undefined;
  let unlisten: (() => void) | null = null;
  void import('@tauri-apps/api/event')
    .then(({ listen }) => listen<boolean>('firmdesk://os-lock', (event) => handler(event.payload)))
    .then((stop) => {
      unlisten = stop;
    })
    .catch(() => undefined);
  return () => {
    unlisten?.();
  };
};

export const isDesktopBridgeAvailable = (): boolean => isDesktop && isTauri();
