import { Types } from 'mongoose';

import { WORKSTATION_FRESHNESS_MS } from '../lib/enums.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';
import type { PageRequest } from '../lib/pagination.js';
import { buildPageMeta } from '../lib/pagination.js';
import { DesktopCommand } from '../models/desktopCommand.model.js';
import type { DesktopCommandAttributes } from '../models/desktopCommand.model.js';
import { Workstation } from '../models/workstation.model.js';
import type { WorkstationAttributes } from '../models/workstation.model.js';
import type { RequestActor } from '../types/context.js';
import type { Lean } from '../types/lean.js';
import { buildDiff, recordAudit } from './audit.service.js';
import type { WorkstationListQuery, WorkstationResultBody } from '../validators/desktop.validators.js';

export interface WorkstationView {
  id: string;
  user: string | null;
  userName: string | null;
  deviceId: string;
  deviceName: string;
  platform: string | null;
  appVersion: string | null;
  lastSeenAt: Date;
  online: boolean;
  tally: {
    reachable: boolean;
    companyName: string | null;
    educationMode: boolean;
    checkedAt: Date | null;
  };
  revoked: boolean;
}

const isOnline = (record: { lastSeenAt: Date; revoked: boolean }): boolean =>
  !record.revoked && Date.now() - record.lastSeenAt.getTime() <= WORKSTATION_FRESHNESS_MS;

// ---------------------------------------------------------------------------
// Registration + heartbeat
// ---------------------------------------------------------------------------

export const registerWorkstation = async (
  userId: Types.ObjectId,
  body: { deviceId: string; deviceName: string; platform?: string; appVersion?: string },
  actor: RequestActor,
): Promise<Lean<WorkstationAttributes>> => {
  const existing = await Workstation.findOne({ user: userId, deviceId: body.deviceId }).exec();
  const now = new Date();
  if (existing) {
    existing.set({
      deviceName: body.deviceName,
      platform: body.platform ?? existing.platform,
      appVersion: body.appVersion ?? existing.appVersion,
      lastSeenAt: now,
      revoked: false,
      revokedAt: null,
      revokedBy: null,
    });
    await existing.save();
    return existing.toObject();
  }
  const doc = await Workstation.create({
    user: userId,
    deviceId: body.deviceId,
    deviceName: body.deviceName,
    platform: body.platform ?? null,
    appVersion: body.appVersion ?? null,
    lastSeenAt: now,
  });
  await recordAudit({
    actor,
    action: 'create',
    entityKind: 'workstation',
    entityId: doc._id,
    summary: `Registered workstation "${body.deviceName}"`,
  });
  return doc.toObject();
};

export const pingWorkstation = async (
  userId: Types.ObjectId,
  deviceId: string,
  tally?: { reachable: boolean; companyName?: string | null; educationMode?: boolean; version?: string | null },
): Promise<{ online: boolean }> => {
  const record = await Workstation.findOne({ user: userId, deviceId }).exec();
  if (!record) throw notFound('workstation');
  if (record.revoked) {
    throw forbidden('This workstation was revoked. Re-register it from the desktop app after an admin restores access.');
  }
  record.set('lastSeenAt', new Date());
  if (tally) {
    record.set('tallyReachable', tally.reachable);
    record.set('tallyCompanyName', tally.companyName ?? null);
    record.set('tallyEducationMode', tally.educationMode ?? false);
    record.set('tallyCheckedAt', new Date());
  }
  await record.save();
  return { online: true };
};

// ---------------------------------------------------------------------------
// Admin views
// ---------------------------------------------------------------------------

export const listWorkstations = async (
  query: Omit<WorkstationListQuery, 'page' | 'limit'>,
  page: PageRequest,
): Promise<{ items: WorkstationView[]; total: number }> => {
  const filter: Record<string, unknown> = {};
  if (query.q) {
    const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { deviceName: new RegExp(escaped, 'i') },
      { deviceId: new RegExp(escaped, 'i') },
    ];
  }
  const [records, total] = await Promise.all([
    Workstation.find(filter)
      .sort({ lastSeenAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate('user', 'name email')
      .lean()
      .exec(),
    Workstation.countDocuments(filter).exec(),
  ]);
  const items: WorkstationView[] = records.map((record) => ({
    id: record._id.toString(),
    user: record.user instanceof Types.ObjectId ? record.user.toString() : (record.user as { _id?: Types.ObjectId } | null)?._id?.toString() ?? null,
    userName:
      record.user !== null && typeof record.user === 'object' && !(record.user instanceof Types.ObjectId)
        ? (record.user as { name?: string }).name ?? null
        : null,
    deviceId: record.deviceId,
    deviceName: record.deviceName,
    platform: record.platform ?? null,
    appVersion: record.appVersion ?? null,
    lastSeenAt: record.lastSeenAt,
    online: isOnline(record),
    tally: {
      reachable: record.tallyReachable ?? false,
      companyName: record.tallyCompanyName ?? null,
      educationMode: record.tallyEducationMode ?? false,
      checkedAt: record.tallyCheckedAt ?? null,
    },
    revoked: record.revoked ?? false,
  }));
  void buildPageMeta;
  return { items, total };
};

export const revokeWorkstation = async (
  id: Types.ObjectId,
  actor: RequestActor,
): Promise<void> => {
  const record = await Workstation.findById(id).exec();
  if (!record) throw notFound('workstation');
  const before = { revoked: record.revoked };
  record.set({ revoked: true, revokedAt: new Date(), revokedBy: actor.id });
  await record.save();
  // Abandon anything still queued for this machine's owner so nothing lingers.
  await DesktopCommand.updateMany(
    { user: record.user, status: 'queued' },
    { $set: { status: 'abandoned' } },
  ).exec();
  await recordAudit({
    actor,
    action: 'update',
    entityKind: 'workstation',
    entityId: record._id,
    summary: `Revoked workstation "${record.deviceName}"`,
    diff: buildDiff(before, { revoked: true }),
  });
};

// ---------------------------------------------------------------------------
// Command queue (drained by the desktop poll)
// ---------------------------------------------------------------------------

/**
 * Claims up to N queued commands for this user atomically: each command flips
 * queued -> dispatched exactly once, so two pollers can never both claim it.
 */
export const claimCommands = async (
  userId: Types.ObjectId,
  limit = 3,
): Promise<Lean<DesktopCommandAttributes>[]> => {
  const claimed: Lean<DesktopCommandAttributes>[] = [];
  for (let i = 0; i < limit; i += 1) {
    const command = await DesktopCommand.findOneAndUpdate(
      { user: userId, status: 'queued' },
      {
        $set: { status: 'dispatched', dispatchedAt: new Date() },
        $inc: { dispatchedCount: 1 },
      },
      { new: true, sort: { createdAt: 1 } },
    ).exec();
    if (!command) break;
    claimed.push(command.toObject());
    if (command.dispatchedCount >= 5) {
      // Too many delivery attempts — give up rather than loop forever.
      await DesktopCommand.updateOne({ _id: command._id }, { $set: { status: 'abandoned' } }).exec();
    }
  }
  return claimed;
};

export const reportCommandResult = async (
  userId: Types.ObjectId,
  body: WorkstationResultBody,
  actor: RequestActor,
): Promise<Lean<DesktopCommandAttributes>> => {
  const command = await DesktopCommand.findById(body.commandId).exec();
  if (!command) throw notFound('command');
  if (!command.user.equals(userId)) throw notFound('command');
  if (command.status === 'succeeded' || command.status === 'failed') {
    throw conflict('This command already reported a result.');
  }
  const workstation = await Workstation.findOne({ user: userId, deviceId: body.deviceId })
    .select('_id')
    .lean()
    .exec();
  if (!workstation) throw notFound('workstation');

  command.set('status', body.ok ? 'succeeded' : 'failed');
  command.set('result', {
    ok: body.ok,
    detail: body.detail ?? {},
    error: body.error ?? null,
    reportedAt: new Date(),
    workstation: workstation._id,
  });
  await command.save();
  await recordAudit({
    actor,
    action: 'tally_sync_result',
    entityKind: 'desktopCommand',
    entityId: command._id,
    client: command.client ?? null,
    summary: `Tally ${command.type} ${body.ok ? 'succeeded' : 'failed'}${
      body.error === undefined ? '' : `: ${body.error.slice(0, 200)}`
    }`,
  });
  return command.toObject();
};
