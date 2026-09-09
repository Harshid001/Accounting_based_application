import { Types } from 'mongoose';

import { env } from '../../src/config/env.js';
import { encryptField } from '../../src/lib/crypto.js';
import { utcMidnight } from '../../src/lib/date.js';
import type { DueDateRule } from '../../src/lib/dueDate.js';
import type { ComplianceCategory, Frequency } from '../../src/lib/enums.js';
import type { AccountSubType, AccountType } from '../../src/lib/enums.js';
import type { ClientAttributes } from '../../src/models/client.model.js';
import type { ChecklistEntry } from '../../src/models/complianceType.model.js';
import { Account } from '../../src/models/ledgerAccount.model.js';
import { Client } from '../../src/models/client.model.js';
import { ClientService } from '../../src/models/clientService.model.js';
import { ComplianceItem } from '../../src/models/complianceItem.model.js';
import { ComplianceType } from '../../src/models/complianceType.model.js';
import { DocumentModel } from '../../src/models/document.model.js';
import { DocumentRequest } from '../../src/models/documentRequest.model.js';
import { Task } from '../../src/models/task.model.js';

let panCounter = 0;

const nextPan = (): string => {
  panCounter += 1;
  const digits = panCounter.toString().padStart(4, '0');
  return `ABCDE${digits}F`;
};

export const makeClient = async (
  overrides: Partial<ClientAttributes> & { aadhaar?: string } = {},
): Promise<Types.ObjectId> => {
  const { aadhaar, ...rest } = overrides;
  const doc = new Client({
    clientType: 'individual',
    displayName: `Client ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    status: 'active',
    pan: nextPan(),
    primaryContact: {
      name: 'Meena Contact',
      email: `contact.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@firmdesk.test`,
      phone: '9876543210',
    },
    ...rest,
  });
  if (aadhaar !== undefined) {
    doc.set(
      'aadhaarEncrypted',
      encryptField(aadhaar, env.FIELD_ENCRYPTION_KEY, env.FIELD_ENCRYPTION_KEY_VERSION),
    );
  }
  await doc.save();
  return doc._id;
};

export const makeBusinessClient = async (
  overrides: Partial<ClientAttributes> = {},
): Promise<Types.ObjectId> =>
  makeClient({
    clientType: 'business',
    entityType: 'pvt_ltd',
    gstin: `27ABCDE${Math.floor(1000 + Math.random() * 8999).toString()}F1Z5`,
    ...overrides,
  });

export const makeComplianceType = async (
  overrides: Partial<{
    name: string;
    code: string;
    category: ComplianceCategory;
    isRecurring: boolean;
    defaultFrequency: Frequency;
    dueDateRule: DueDateRule;
    defaultDocumentChecklist: ChecklistEntry[];
  }> = {},
): Promise<Types.ObjectId> => {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  const doc = await ComplianceType.create({
    name: overrides.name ?? `Filing ${suffix}`,
    code: overrides.code ?? `CODE-${suffix}`,
    category: overrides.category ?? 'gst',
    isRecurring: overrides.isRecurring ?? true,
    defaultFrequency: overrides.defaultFrequency ?? 'monthly',
    dueDateRule: overrides.dueDateRule ?? {
      kind: 'day_of_following_month',
      day: 20,
      monthsAfter: 1,
    },
    defaultDocumentChecklist: overrides.defaultDocumentChecklist ?? [],
    reminderOffsetsDays: [7, 3, 1],
    isSeeded: false,
    active: true,
  });
  return doc._id;
};

export const makeClientService = async (
  clientId: Types.ObjectId,
  complianceTypeId: Types.ObjectId,
  overrides: Partial<{
    startDate: Date;
    endDate: Date | null;
    assignedStaff: Types.ObjectId;
  }> = {},
): Promise<Types.ObjectId> => {
  const doc = await ClientService.create({
    client: clientId,
    complianceType: complianceTypeId,
    startDate: overrides.startDate ?? utcMidnight(2026, 1, 1),
    endDate: overrides.endDate ?? null,
    assignedStaff: overrides.assignedStaff ?? null,
    active: true,
  });
  return doc._id;
};

export const makeComplianceItem = async (
  clientId: Types.ObjectId,
  complianceTypeId: Types.ObjectId,
  overrides: Partial<{
    periodStart: Date;
    periodEnd: Date;
    dueDate: Date;
    status:
      | 'pending'
      | 'in_progress'
      | 'awaiting_client'
      | 'filed'
      | 'acknowledged'
      | 'not_applicable';
    assignedStaff: Types.ObjectId;
    filedDate: Date;
  }> = {},
): Promise<Types.ObjectId> => {
  const doc = await ComplianceItem.create({
    client: clientId,
    complianceType: complianceTypeId,
    periodType: 'month',
    periodStart: overrides.periodStart ?? utcMidnight(2026, 6, 1),
    periodEnd: overrides.periodEnd ?? utcMidnight(2026, 6, 30),
    periodLabel: 'Jun 2026',
    dueDate: overrides.dueDate ?? utcMidnight(2026, 7, 20),
    status: overrides.status ?? 'pending',
    assignedStaff: overrides.assignedStaff ?? null,
    filedDate: overrides.filedDate ?? null,
    generatedBy: 'manual',
  });
  return doc._id;
};

export const makeTask = async (
  overrides: Partial<{
    title: string;
    client: Types.ObjectId | null;
    assignee: Types.ObjectId;
    status: 'not_started' | 'in_progress' | 'review' | 'done';
    internalOnly: boolean;
    blockedBy: Types.ObjectId[];
  }> & { assignee: Types.ObjectId },
): Promise<Types.ObjectId> => {
  const doc = await Task.create({
    title: overrides.title ?? 'Prepare working papers',
    client: overrides.client ?? null,
    assignee: overrides.assignee,
    status: overrides.status ?? 'not_started',
    priority: 'normal',
    internalOnly: overrides.internalOnly ?? false,
    blockedBy: overrides.blockedBy ?? [],
  });
  return doc._id;
};

export const makeDocument = async (
  clientId: Types.ObjectId,
  uploadedBy: Types.ObjectId,
  overrides: Partial<{ title: string; uploadedByRole: 'admin' | 'staff' | 'client' }> = {},
): Promise<Types.ObjectId> => {
  const doc = await DocumentModel.create({
    client: clientId,
    title: overrides.title ?? 'Bank statement — Mar 2026',
    documentType: 'bank_statement',
    versions: [
      {
        version: 1,
        storageKey: `clients/${clientId.toString()}/${Math.random().toString(36).slice(2)}.pdf`,
        originalFilename: 'statement.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        uploadedBy,
        uploadedAt: new Date(),
      },
    ],
    currentVersion: 1,
    uploadedByRole: overrides.uploadedByRole ?? 'staff',
    createdBy: uploadedBy,
  });
  return doc._id;
};

export const makeDocumentRequest = async (
  clientId: Types.ObjectId,
  requestedBy: Types.ObjectId,
  overrides: Partial<{ title: string; status: 'open' | 'fulfilled' | 'cancelled' }> = {},
): Promise<Types.ObjectId> => {
  const doc = await DocumentRequest.create({
    client: clientId,
    title: overrides.title ?? 'Bank statement for March',
    documentType: 'bank_statement',
    status: overrides.status ?? 'open',
    requestedBy,
  });
  return doc._id;
};

export const makeAccount = async (
  clientId: Types.ObjectId,
  overrides: Partial<{
    code: string;
    name: string;
    type: AccountType;
    subType: AccountSubType | null;
    openingPaise: number;
    openingIsDebit: boolean;
    isActive: boolean;
  }> = {},
): Promise<Types.ObjectId> => {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  const doc = await Account.create({
    client: clientId,
    code: overrides.code ?? `AC-${suffix}`,
    name: overrides.name ?? `Account ${suffix}`,
    type: overrides.type ?? 'asset',
    subType: overrides.subType ?? null,
    openingBalance: {
      paise: overrides.openingPaise ?? 0,
      asOf: utcMidnight(2026, 4, 1),
      isDebit: overrides.openingIsDebit ?? true,
    },
    isActive: overrides.isActive ?? true,
    isSystem: false,
  });
  return doc._id;
};

export interface ChartOfAccounts {
  cash: Types.ObjectId;
  bank: Types.ObjectId;
  debtor: Types.ObjectId;
  creditor: Types.ObjectId;
  sales: Types.ObjectId;
  rent: Types.ObjectId;
}

export const makeChart = async (clientId: Types.ObjectId): Promise<ChartOfAccounts> => ({
  cash: await makeAccount(clientId, {
    code: '1001',
    name: 'Cash in Hand',
    type: 'asset',
    subType: 'cash',
  }),
  bank: await makeAccount(clientId, {
    code: '1002',
    name: 'HDFC Bank',
    type: 'asset',
    subType: 'bank',
  }),
  debtor: await makeAccount(clientId, {
    code: '1101',
    name: 'Sharma Traders',
    type: 'asset',
    subType: 'debtor',
  }),
  creditor: await makeAccount(clientId, {
    code: '2101',
    name: 'Office Supplies Co',
    type: 'liability',
    subType: 'creditor',
  }),
  sales: await makeAccount(clientId, { code: '4001', name: 'Sales', type: 'income' }),
  rent: await makeAccount(clientId, { code: '5001', name: 'Rent', type: 'expense' }),
});

export const assignStaff = async (
  clientId: Types.ObjectId,
  staffIds: Types.ObjectId[],
): Promise<void> => {
  await Client.updateOne({ _id: clientId }, { $set: { assignedStaff: staffIds } }).exec();
};

export const ORPHAN_ID = new Types.ObjectId('0123456789abcdef01234567');
