import type { Types } from 'mongoose';

import { validationFailed } from '../lib/errors.js';
import { WORKSTATION_FRESHNESS_MS } from '../lib/enums.js';
import { DesktopCommand } from '../models/desktopCommand.model.js';
import type { DesktopCommandAttributes } from '../models/desktopCommand.model.js';
import { Workstation } from '../models/workstation.model.js';
import type { RequestActor } from '../types/context.js';
import { recordAudit } from './audit.service.js';

export const READ_ONLY_COMMANDS = new Set(['powershell.exe', 'pwsh.exe', 'cmd.exe']);
export const LAUNCHABLE_APPS = new Map<string, string>([
  ['chrome', 'chrome.exe'],
  ['edge', 'msedge.exe'],
  ['excel', 'excel.exe'],
  ['tally', 'tally.exe'],
  ['calculator', 'calc.exe'],
  ['notepad', 'notepad.exe'],
]);
export const MAX_LOCAL_FILE_BYTES = 512 * 1024;
const stringArg = (value: unknown, field: string, max = 400): string => {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw validationFailed('Provide ' + field + ' as non-empty text of at most ' + max + ' characters.');
  }
  return value.trim();
};
const stringArrayArg = (value: unknown): string[] => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length > 400)) {
    throw validationFailed('Provide arguments as an array of short strings.');
  }
  return value as string[];
};

type ControlPayload = NonNullable<DesktopCommandAttributes['payload']>;

const requireOnlineWorkstation = async (
  userId: Types.ObjectId,
): Promise<{ id: Types.ObjectId; deviceName: string }> => {
  const workstation = await Workstation.findOne({
    user: userId,
    revoked: { $ne: true },
    lastSeenAt: { $gte: new Date(Date.now() - WORKSTATION_FRESHNESS_MS) },
  })
    .sort({ lastSeenAt: -1 })
    .select('_id deviceName')
    .exec();
  if (workstation === null) {
    throw validationFailed('No online FirmDesk desktop workstation is connected to your account.');
  }
  return { id: workstation._id, deviceName: workstation.deviceName };
};

const queueControl = async (
  userId: Types.ObjectId,
  actor: RequestActor,
  type: DesktopCommandAttributes['type'],
  payload: ControlPayload,
  summary: string,
): Promise<{ commandId: string; workstation: string }> => {
  const workstation = await requireOnlineWorkstation(userId);
  const command = await DesktopCommand.create({ user: userId, type, status: 'queued', payload });
  await recordAudit({ actor, action: 'tally_sync_enqueue', entityKind: 'desktopCommand', entityId: command._id, summary });
  return { commandId: command._id.toString(), workstation: workstation.deviceName };
};

export const enqueueShellCommand = async (
  userId: Types.ObjectId,
  actor: RequestActor,
  input: { command: string; arguments?: string[]; timeoutMs?: number },
): Promise<{ commandId: string; workstation: string }> => {
  const command = stringArg(input.command, 'command', 80).toLowerCase();
  if (!READ_ONLY_COMMANDS.has(command)) throw validationFailed('Only PowerShell or CMD can be queued.');
  const args = stringArrayArg(input.arguments ?? []);
  const blocked = /\b(remove-item|rm|del|erase|format|shutdown|restart|reg delete|taskkill|stop-process)\b/i;
  if (blocked.test(args.join(' '))) throw validationFailed('Terminal control is read-only.');
  const timeoutMs = Math.min(Math.max(input.timeoutMs ?? 10000, 1000), 30000);
  return queueControl(userId, actor, 'shell_command', { operation: 'run', command, arguments: args, timeoutMs }, 'Queued terminal command');
};

export const enqueueAppLaunch = async (
  userId: Types.ObjectId,
  actor: RequestActor,
  input: { application: string; url?: string },
): Promise<{ commandId: string; workstation: string }> => {
  const key = stringArg(input.application, 'application', 40).toLowerCase();
  const application = LAUNCHABLE_APPS.get(key);
  if (application === undefined) throw validationFailed('That application is not allowlisted.');
  let url: string | undefined;
  if (input.url !== undefined) {
    const parsed = new URL(stringArg(input.url, 'url', 2048));
    if (parsed.protocol !== 'https:') throw validationFailed('Launch URLs must use HTTPS.');
    url = parsed.toString();
  }
  return queueControl(userId, actor, 'launch_app', { operation: 'launch', application, url }, 'Queued ' + key + ' launch');
};

export const enqueueProcessAction = async (
  userId: Types.ObjectId,
  actor: RequestActor,
  input: { action: 'list' | 'terminate'; target?: string },
): Promise<{ commandId: string; workstation: string }> => {
  if (input.action === 'list') {
    return queueControl(userId, actor, 'process_action', { operation: 'list', action: 'list' }, 'Queued process list');
  }
  throw validationFailed('Process termination is disabled until a confirmation gate exists.');
};

export const enqueueFilesystemOperation = async (
  userId: Types.ObjectId,
  actor: RequestActor,
  input: { operation: 'read' | 'write' | 'create'; path: string; content?: string; encoding?: string },
): Promise<{ commandId: string; workstation: string }> => {
  const path = stringArg(input.path, 'path', 1000);
  if (input.operation === 'read') {
    return queueControl(userId, actor, 'fs_operation', { operation: 'read', path }, 'Queued file read');
  }
  if (input.content !== undefined && input.content.length > MAX_LOCAL_FILE_BYTES) {
    throw validationFailed('Local files are limited to 512 KB.');
  }
  return queueControl(userId, actor, 'fs_operation', { operation: input.operation, path, content: input.content, encoding: input.encoding }, 'Queued file write');
};
