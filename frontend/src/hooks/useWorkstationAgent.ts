/**
 * The workstation agent (spec §5.2): the Tauri app IS the agent that
 * desktop/agent.mjs used to be. Runs inside the desktop shell's webview:
 *   boot:  register workstation (device id from keychain or generated)
 *   loop:  heartbeat ping every 60s (freshness 120s) with a live Tally probe
 *   loop:  poll the command queue every 10s; execute each against Tally via
 *          the Rust bridge (localhost:9000); POST the parsed result back.
 * The API wrapper attaches session cookies automatically; every endpoint
 * stays behind capability gates server-side.
 */
import { useEffect, useRef } from 'react';

import { apiList, apiPost } from '@/api/client';
import {
  appInfo,
  isDesktopBridgeAvailable,
  keychainGet,
  keychainSet,
  setTrayStatus,
  tallyPost,
  tallyProbe,
} from '@/lib/desktopBridge';
import { isCode } from '@/lib/errors';
import { isDesktop } from '@/lib/shell';
import type { Me } from '@/types/models';

const HEARTBEAT_MS = 60_000;
const POLL_MS = 10_000;
const DEVICE_KEY = 'workstation-device-id';

export interface WorkstationAgentState {
  deviceId: string;
  deviceName: string;
  online: boolean;
  tally: { reachable: boolean; companyName: string | null; educationMode: boolean };
}

type CommandType = 'tally_post' | 'tally_import' | 'tally_health';

interface QueuedCommand {
  id: string;
  type: CommandType;
  client: string | null;
  voucherIds: string[];
  payload: { requestXml: string };
}

/** Front-end mirror of the Tally reply interpretation (backend lib/tally.ts).
 *  Exported for deterministic mock-Tally tests (spec §9.3). */
export const interpretReply = (type: string, reply: string): { ok: boolean; detail: Record<string, unknown>; error?: string } => {
  const lineError = /<LINEERROR>([\s\S]*?)<\/LINEERROR>/i.exec(reply)?.[1] ?? null;
  const alreadyExists = /DUPLICATE|ALREADY EXIST/i.test(reply);
  if (type === 'tally_post') {
    if (lineError !== null && !alreadyExists) {
      return { ok: false, error: lineError.trim().slice(0, 2000), detail: { reply: reply.slice(0, 2000) } };
    }
    const created = /<CREATED>(\d+)<\/CREATED>/i.exec(reply)?.[1];
    return {
      ok: true,
      detail: {
        created: created !== undefined ? Number(created) : 1,
        alreadyExists,
        reply: reply.slice(0, 2000),
      },
    };
  }
  if (type === 'tally_import') {
    if (lineError !== null) {
      return { ok: false, error: lineError.trim().slice(0, 2000), detail: { reply: reply.slice(0, 2000) } };
    }
    const ledgers: Array<Record<string, unknown>> = [];
    for (const block of reply.split(/<LEDGER[\s>]/i).slice(1)) {
      const name = /<NAME>([\s\S]*?)<\/NAME>/i.exec(block)?.[1];
      if (!name) continue;
      const parent = /<PARENT>([\s\S]*?)<\/PARENT>/i.exec(block)?.[1] ?? null;
      const openingRaw = /<OPENINGBALANCE>([\s\S]*?)<\/OPENINGBALANCE>/i.exec(block)?.[1]?.trim() ?? '';
      const cleaned = openingRaw.replace(/[, ]/g, '');
      let openingPaise = 0;
      let openingIsDebit = true;
      if (/^-?\d+(\.\d{1,2})?$/.test(cleaned)) {
        const negative = cleaned.startsWith('-');
        const [whole, fraction = ''] = cleaned.replace('-', '').split('.');
        openingPaise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
        openingIsDebit = negative;
      }
      ledgers.push({
        name,
        parent,
        openingPaise,
        openingIsDebit,
        isBillWise: /<ISBILLWISEON>\s*Yes/i.test(block),
      });
    }
    return { ok: true, detail: { ledgers, count: ledgers.length } };
  }
  // tally_health
  const name = /<NAME>([\s\S]*?)<\/NAME>/i.exec(reply)?.[1] ?? /<COMPANYNAME>([\s\S]*?)<\/COMPANYNAME>/i.exec(reply)?.[1];
  const reachable = name !== undefined && name.length > 0;
  return {
    ok: reachable,
    ...(reachable ? {} : { error: 'Tally did not report an open company.' }),
    detail: { reachable, companyName: name ?? null, educationMode: /EDUCATION/i.test(reply) },
  };
};

const randomDeviceId = (): string => {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `WS-${hex}`;
};

const resolveDeviceId = async (): Promise<string> => {
  const existing = await keychainGet(DEVICE_KEY).catch(() => null);
  if (existing !== null && existing.length >= 8) return existing;
  const generated = randomDeviceId();
  await keychainSet(DEVICE_KEY, generated).catch(() => undefined);
  return generated;
};

/**
 * Boots and runs the agent while the signed-in admin/staff user is on any
 * staff route in the desktop shell. No-op in the web shell; no-op for
 * clients (they never reach the staff layout in this shell).
 */
export function useWorkstationAgent(user: Me | null): void {
  const activeRef = useRef(false);
  const userId = user?.id ?? null;
  const userRole = user?.role ?? null;

  useEffect(() => {
    if (!isDesktop || userId === null) return;
    if (userRole !== 'admin' && userRole !== 'staff') return;
    if (!isDesktopBridgeAvailable()) return;

    let stopped = false;
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    const run = async (): Promise<void> => {
      activeRef.current = true;
      let deviceId = '';
      let deviceName = 'FirmDesk Workstation';
      let platform = 'windows';
      let appVersion = '0.1.0';

      try {
        const info = await appInfo();
        deviceName = info.deviceName;
        platform = info.platform;
        appVersion = info.version;
      } catch {
        // Bridge gaps (dev shell) fall back to browser identifiers.
      }

      try {
        deviceId = await resolveDeviceId();
      } catch {
        deviceId = randomDeviceId();
      }

      let lastTally: { reachable: boolean; companyName: string | null; educationMode: boolean } = {
        reachable: false,
        companyName: null,
        educationMode: false,
      };

      const heartbeat = async (): Promise<void> => {
        try {
          const probe = await tallyProbe().catch(() => null);
          if (probe !== null) {
            lastTally = {
              reachable: probe.reachable,
              companyName: probe.companyName,
              educationMode: probe.educationMode,
            };
          }
          await apiPost('/desktop/workstation/ping', {
            deviceId,
            appVersion,
            tally: {
              reachable: lastTally.reachable,
              companyName: lastTally.companyName,
              educationMode: lastTally.educationMode,
            },
          });
          await setTrayStatus(
            true,
            lastTally.reachable,
            lastTally.companyName ?? '',
          ).catch(() => undefined);
        } catch (error) {
          if (isCode(error, 'UPGRADE_REQUIRED')) {
            // Rule 7: the server has retired this shell version. Stop the
            // loops entirely — the DesktopShellGate overlay takes over with
            // the update wall. Never silently re-register through the gate.
            stopped = true;
            for (const timer of timers) clearTimeout(timer);
            await setTrayStatus(false, false, '').catch(() => undefined);
            return;
          }
          // Revoked or offline: ping 403s; re-register on the next beat.
          try {
            await apiPost('/desktop/workstation/register', { deviceId, deviceName, platform, appVersion });
          } catch {
            // Unauthenticated — the session layer redirects to sign-in.
          }
          await setTrayStatus(false, false, '').catch(() => undefined);
        }
      };

      const drain = async (): Promise<void> => {
        let commands: QueuedCommand[];
        try {
          const page = await apiList<QueuedCommand>('/desktop/workstation/commands', {
            method: 'GET',
            query: { deviceId, page: 1, limit: 10 },
          });
          commands = page.items;
        } catch {
          return;
        }
        for (const command of commands) {
          let outcome: { ok: boolean; detail: Record<string, unknown>; error?: string };
          try {
            const result = await tallyPost(command.payload.requestXml);
            outcome = result.ok
              ? interpretReply(command.type, result.reply)
              : {
                  ok: false,
                  error: result.lineError ?? 'Tally rejected the import.',
                  detail: {},
                };
          } catch (error) {
            outcome = {
              ok: false,
              error: error instanceof Error ? error.message : 'Could not reach Tally.',
              detail: {},
            };
          }
          try {
            await apiPost('/desktop/workstation/results', {
              deviceId,
              commandId: command.id,
              ok: outcome.ok,
              ...(outcome.error === undefined ? {} : { error: outcome.error }),
              detail: outcome.detail,
            });
          } catch {
            // Reporting failed; the server keeps the command dispatched and
            // it eventually expires. Do not retry in the same tick.
          }
        }
      };

      // Boot: register, then heartbeat immediately.
      try {
        await apiPost('/desktop/workstation/register', { deviceId, deviceName, platform, appVersion });
      } catch (error) {
        if (isCode(error, 'UPGRADE_REQUIRED')) {
          // Rule 7: this shell version is retired. Stop everything; the
          // DesktopShellGate overlay (manifest-driven) shows the update wall.
          stopped = true;
          for (const timer of timers) clearTimeout(timer);
          await setTrayStatus(false, false, '').catch(() => undefined);
          return;
        }
        return; // Session not usable; the router will handle it.
      }
      await heartbeat();

      let beats = 0;
      const loop = (): void => {
        if (stopped) return;
        void drain();
        // Full heartbeat every 60s (server freshness window is 120s);
        // every other beat rides the cached probe result only.
        beats += 1;
        if (beats % (HEARTBEAT_MS / POLL_MS) === 1) void heartbeat();
        timers.push(setTimeout(loop, POLL_MS));
      };
      timers.push(setTimeout(loop, POLL_MS));
    };

    void run();
    return () => {
      stopped = true;
      for (const timer of timers) clearTimeout(timer);
      activeRef.current = false;
    };
  }, [userId, userRole]);
}

export const isWorkstationAgentShell = (): boolean => isDesktop && isDesktopBridgeAvailable();
