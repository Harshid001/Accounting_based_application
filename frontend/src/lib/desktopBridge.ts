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
