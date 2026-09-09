import { Types } from 'mongoose';

import {
  buildCompanyPingRequest,
  buildLedgerListRequest,
  buildVoucherImportRequest,
} from '../lib/tally.js';
import type { TallyVoucher } from '../lib/tally.js';
import { conflict, notFound, validationFailed } from '../lib/errors.js';
import { WORKSTATION_FRESHNESS_MS } from '../lib/enums.js';
import { Client } from '../models/client.model.js';
import { DesktopCommand } from '../models/desktopCommand.model.js';
import type { DesktopCommandAttributes } from '../models/desktopCommand.model.js';
import { JournalVoucher } from '../models/journalVoucher.model.js';
import { Account } from '../models/ledgerAccount.model.js';
import { Workstation } from '../models/workstation.model.js';
import type { RequestActor } from '../types/context.js';
import type { Lean } from '../types/lean.js';
import { createAccount } from './books.service.js';
import { recordAudit } from './audit.service.js';

const MAX_POST_BATCH = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const clientWithTally = async (clientId: Types.ObjectId) => {
  const client = await Client.findById(clientId)
    .select('displayName booksMode tallyConfig')
    .lean()
    .exec();
  if (!client) throw notFound('client');
  if (client.booksMode === 'native') {
    throw conflict(
      'This client keeps books in FirmDesk (native mode). Switch them to Tally or hybrid mode in their client record before posting to Tally.',
    );
  }
  if (!client.tallyConfig) {
    throw validationFailed('This client has no Tally company configured.', [
      { field: 'tallyConfig', message: 'Set the Tally company name and edition first.' },
    ]);
  }
  return { name: client.displayName, companyName: client.tallyConfig.companyName };
};

const requireOnlineWorkstation = async (
  userId: Types.ObjectId,
): Promise<Lean<{ deviceId: string; deviceName: string }>> => {
  const record = await Workstation.findOne({
    user: userId,
    revoked: { $ne: true },
    lastSeenAt: { $gte: new Date(Date.now() - WORKSTATION_FRESHNESS_MS) },
  })
    .select('deviceId deviceName')
    .lean()
    .exec();
  if (!record) {
    throw conflict(
      'No FirmDesk desktop app is online for your account. Launch it on the machine where Tally runs and try again.',
    );
  }
  return record;
};

const ledgerNameFor = async (
  clientId: Types.ObjectId,
  accountId: Types.ObjectId,
  systemLedgers: Map<string, string>,
): Promise<string> => {
  const account = await Account.findOne({ _id: accountId, client: clientId })
    .select('name subType isSystem')
    .lean()
    .exec();
  if (!account) throw notFound('account');
  if (account.isSystem && account.subType && systemLedgers.has(account.subType)) {
    return systemLedgers.get(account.subType) as string;
  }
  return account.name;
};

/**
 * The ledger names the client's Tally company uses for GST/TDS duty ledgers.
 * Until a mapping is stored per client, we post under the same names as
 * FirmDesk's engine accounts ("GST Output Tax" etc.); phase-5 spike against a
 * real company may refine these into Client.tallyConfig.ledgerAliases.
 */
const SYSTEM_LEDGER_NAMES: Record<string, string> = {
  gst_output: 'GST Output Tax',
  gst_input: 'GST Input Tax Credit',
  tds_payable: 'TDS Payable',
  tds_receivable: 'TDS Receivable',
  rounding: 'Rounding Off',
};

const systemLedgerMap = (): Map<string, string> => new Map(Object.entries(SYSTEM_LEDGER_NAMES));

// ---------------------------------------------------------------------------
// Status (UI + agent + health checks)
// ---------------------------------------------------------------------------

export interface TallyConnectionStatus {
  booksMode: 'native' | 'tally' | 'hybrid';
  companyName: string | null;
  workstation: {
    online: boolean;
    deviceName: string | null;
    lastSeenAt: Date | null;
  };
  tally: {
    reachable: boolean;
    companyName: string | null;
    educationMode: boolean;
    checkedAt: Date | null;
  };
  pendingPosts: number;
  recentCommands: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: Date;
    error: string | null;
  }>;
}

export const getTallyStatus = async (
  clientId: Types.ObjectId,
  userId: Types.ObjectId,
): Promise<TallyConnectionStatus> => {
  const client = await Client.findById(clientId)
    .select('booksMode tallyConfig')
    .lean()
    .exec();
  if (!client) throw notFound('client');
  const companyName = client.tallyConfig?.companyName ?? null;

  const workstation = await Workstation.findOne({ user: userId, revoked: { $ne: true } })
    .sort({ lastSeenAt: -1 })
    .lean()
    .exec();
  const online =
    workstation !== null &&
    Date.now() - workstation.lastSeenAt.getTime() <= WORKSTATION_FRESHNESS_MS;

  const recent = await DesktopCommand.find({ client: clientId })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('type status createdAt result.error')
    .lean()
    .exec();

  return {
    booksMode: client.booksMode,
    companyName,
    workstation: {
      online,
      deviceName: workstation?.deviceName ?? null,
      lastSeenAt: workstation?.lastSeenAt ?? null,
    },
    tally: {
      reachable: workstation?.tallyReachable ?? false,
      companyName: workstation?.tallyCompanyName ?? null,
      educationMode: workstation?.tallyEducationMode ?? false,
      checkedAt: workstation?.tallyCheckedAt ?? null,
    },
    pendingPosts: await JournalVoucher.countDocuments({
      client: clientId,
      status: { $in: ['posted', 'locked'] },
      'tallySync.status': 'pending',
    }).exec(),
    recentCommands: recent.map((row) => ({
      id: row._id.toString(),
      type: row.type,
      status: row.status,
      createdAt: row.createdAt,
      error: row.result?.error ?? null,
    })),
  };
};

/** Enqueues a zero-risk health probe; the desktop app relays it. */
export const enqueueTallyHealthCheck = async (
  clientId: Types.ObjectId,
  userId: Types.ObjectId,
  actor: RequestActor,
): Promise<Lean<DesktopCommandAttributes>> => {
  const { companyName } = await clientWithTally(clientId);
  const workstation = await requireOnlineWorkstation(userId);
  const command = await DesktopCommand.create({
    user: userId,
    type: 'tally_health',
    status: 'queued',
    client: clientId,
    payload: { requestXml: buildCompanyPingRequest(), companyName },
  });
  await recordAudit({
    actor,
    action: 'tally_sync_enqueue',
    entityKind: 'desktopCommand',
    entityId: command._id,
    client: clientId,
    summary: `Tally health check for ${companyName} via ${workstation.deviceName}`,
  });
  return command.toObject();
};

// ---------------------------------------------------------------------------
// Post vouchers -> Tally
// ---------------------------------------------------------------------------

export const enqueueTallyPost = async (
  clientId: Types.ObjectId,
  voucherIds: string[],
  userId: Types.ObjectId,
  actor: RequestActor,
): Promise<{ commandId: string; vouchers: string[]; companyName: string; workstation: string }> => {
  if (voucherIds.length > MAX_POST_BATCH) {
    throw validationFailed(`Post at most ${MAX_POST_BATCH} vouchers to Tally at a time.`, [
      { field: 'voucherIds', message: `At most ${MAX_POST_BATCH} per batch.` },
    ]);
  }
  const { companyName } = await clientWithTally(clientId);
  const workstation = await requireOnlineWorkstation(userId);

  const vouchers = await JournalVoucher.find({
    _id: { $in: voucherIds.map((id) => new Types.ObjectId(id)) },
    client: clientId,
  }).exec();
  if (vouchers.length !== voucherIds.length) {
    throw notFound('voucher');
  }
  for (const voucher of vouchers) {
    if (voucher.status === 'draft' || voucher.status === 'reversed') {
      throw conflict(
        `${voucher.voucherNo ?? 'A draft voucher'} is ${voucher.status}; only posted or locked vouchers go to Tally.`,
      );
    }
    if (voucher.tallySync?.status === 'synced') {
      throw conflict(`${voucher.voucherNo} is already synced to Tally.`);
    }
  }

  const ledgers = systemLedgerMap();
  const tallyVouchers: TallyVoucher[] = [];
  for (const voucher of vouchers) {
    const entries = [];
    for (const line of voucher.lines) {
      entries.push({
        ledgerName: await ledgerNameFor(clientId, line.account, ledgers),
        isDebit: line.debitPaise > 0,
        paise: Math.max(line.debitPaise, line.creditPaise),
      });
    }
    tallyVouchers.push({
      date: voucher.date.toISOString().slice(0, 10),
      type: voucher.type,
      narration: voucher.narration ?? null,
      reference: voucher.reference ?? null,
      firmdeskId: voucher._id.toString(),
      firmdeskVoucherNo: voucher.voucherNo ?? null,
      entries,
    });
  }

  const command = await DesktopCommand.create({
    user: userId,
    type: 'tally_post',
    status: 'queued',
    client: clientId,
    voucherIds: vouchers.map((voucher) => voucher._id),
    payload: {
      requestXml: buildVoucherImportRequest({ companyName }, tallyVouchers),
      companyName,
    },
  });

  // Mark intent on the vouchers immediately; result flips them to synced/failed.
  // tallySync defaults to null on the model, so set the whole subdocument.
  await JournalVoucher.updateMany(
    { _id: { $in: vouchers.map((voucher) => voucher._id) } },
    {
      $set: {
        tallySync: {
          status: 'pending',
          voucherRef: null,
          syncedAt: null,
          error: null,
        },
      },
    },
  ).exec();

  await recordAudit({
    actor,
    action: 'tally_sync_enqueue',
    entityKind: 'desktopCommand',
    entityId: command._id,
    client: clientId,
    summary: `Queued ${vouchers.length} voucher${vouchers.length === 1 ? '' : 's'} for Tally post into ${companyName}`,
  });

  return {
    commandId: command._id.toString(),
    vouchers: vouchers.map((voucher) => voucher.voucherNo ?? voucher._id.toString()),
    companyName,
    workstation: workstation.deviceName,
  };
};

/**
 * Applies a tally_post result to the vouchers. Called by the workstation
 * result endpoint. One-way: only the sync status moves — voucher data never
 * flows back from Tally.
 */
export const applyTallyPostResult = async (
  command: Lean<DesktopCommandAttributes>,
  ok: boolean,
  detail: Record<string, unknown>,
  error: string | null,
): Promise<void> => {
  if (command.type !== 'tally_post' || !command.voucherIds || command.voucherIds.length === 0) return;
  const status = ok ? 'synced' : 'failed';
  const voucherRef = typeof detail.firmdeskVoucherNo === 'string' ? detail.firmdeskVoucherNo : null;
  await JournalVoucher.updateMany(
    { _id: { $in: command.voucherIds } },
    {
      $set: {
        tallySync: {
          status,
          voucherRef,
          syncedAt: ok ? new Date() : null,
          error: ok ? null : (error ?? 'Tally reported a failure.'),
        },
      },
    },
  ).exec();
};

// ---------------------------------------------------------------------------
// Import accounts from Tally (read-only direction)
// ---------------------------------------------------------------------------

export const enqueueTallyImport = async (
  clientId: Types.ObjectId,
  userId: Types.ObjectId,
  actor: RequestActor,
): Promise<{ commandId: string; companyName: string; workstation: string }> => {
  const { companyName } = await clientWithTally(clientId);
  const workstation = await requireOnlineWorkstation(userId);
  const command = await DesktopCommand.create({
    user: userId,
    type: 'tally_import',
    status: 'queued',
    client: clientId,
    payload: { requestXml: buildLedgerListRequest({ companyName }), companyName },
  });
  await recordAudit({
    actor,
    action: 'tally_sync_enqueue',
    entityKind: 'desktopCommand',
    entityId: command._id,
    client: clientId,
    summary: `Queued Tally ledger import from ${companyName}`,
  });
  return { commandId: command._id.toString(), companyName, workstation: workstation.deviceName };
};

const TALLY_GROUP_TO_TYPE: Record<string, 'asset' | 'liability' | 'equity' | 'income' | 'expense'> = {
  'cash-in-hand': 'asset',
  'bank accounts': 'asset',
  'sundry debtors': 'asset',
  'fixed assets': 'asset',
  'current assets': 'asset',
  'sundry creditors': 'liability',
  'duties & taxes': 'liability',
  'current liabilities': 'liability',
  'capital account': 'equity',
  'loans (liability)': 'liability',
  'sales accounts': 'income',
  'other income': 'income',
  'purchase accounts': 'expense',
  'direct expenses': 'expense',
  'indirect expenses': 'expense',
};

const tallyGroupToAccountType = (parent: string | null): 'asset' | 'liability' | 'equity' | 'income' | 'expense' => {
  if (parent === null) return 'asset';
  return TALLY_GROUP_TO_TYPE[parent.toLowerCase().trim()] ?? 'asset';
};

/**
 * Creates accounts from an imported Tally ledger list. Never overwrites an
 * existing FirmDesk account (one-way read-only import; fuzzy name matches are
 * reported, not guessed).
 */
export const applyTallyImportResult = async (
  command: Lean<DesktopCommandAttributes>,
  ok: boolean,
  detail: Record<string, unknown>,
  actor: RequestActor,
): Promise<{ created: number; skipped: number; conflicts: string[] }> => {
  if (command.type !== 'tally_import' || !ok || command.client === null || command.client === undefined) {
    return { created: 0, skipped: 0, conflicts: [] };
  }
  const ledgers = Array.isArray(detail.ledgers) ? (detail.ledgers as Record<string, unknown>[]) : [];
  const clientId = command.client;
  const existing = await Account.find({ client: clientId }).select('name').lean().exec();
  const existingNames = new Set(
    existing.map((account: { name: string }) => account.name.toLowerCase()),
  );

  let created = 0;
  const conflicts: string[] = [];
  let index = 0;
  for (const ledger of ledgers) {
    const name = typeof ledger.name === 'string' ? ledger.name.trim() : '';
    if (name.length === 0 || name.toLowerCase().startsWith('sys-')) continue;
    index += 1;
    if (existingNames.has(name.toLowerCase())) {
      conflicts.push(name);
      continue;
    }
    await createAccount(
      clientId,
      {
        code: `TALLY-${index.toString().padStart(4, '0')}`,
        name,
        type: tallyGroupToAccountType(
          typeof ledger.parent === 'string' ? ledger.parent : null,
        ),
        subType: null,
        parentId: undefined,
        party: null,
        openingBalance: {
          paise: typeof ledger.openingPaise === 'number' ? ledger.openingPaise : 0,
          asOf: new Date(),
          isDebit: ledger.openingIsDebit !== false,
        },
      },
      actor,
    );
    existingNames.add(name.toLowerCase());
    created += 1;
  }
  return { created, skipped: ledgers.length - created, conflicts };
};
