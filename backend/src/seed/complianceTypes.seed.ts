import { logger } from '../config/logger.js';
import type { DueDateRule } from '../lib/dueDate.js';
import type { ComplianceCategory, DocumentType, Frequency } from '../lib/enums.js';
import { ComplianceType } from '../models/complianceType.model.js';

interface SeedEntry {
  name: string;
  code: string;
  category: ComplianceCategory;
  isRecurring: boolean;
  defaultFrequency: Frequency;
  dueDateRule: DueDateRule | null;
  defaultDocumentChecklist: Array<{
    title: string;
    documentType: DocumentType;
    description?: string;
  }>;
  reminderOffsetsDays: number[];
}

export const SEEDED_COMPLIANCE_TYPES: SeedEntry[] = [
  {
    name: 'GSTR-1',
    code: 'GSTR1',
    category: 'gst',
    isRecurring: true,
    defaultFrequency: 'monthly',
    dueDateRule: { kind: 'day_of_following_month', day: 11, monthsAfter: 1 },
    defaultDocumentChecklist: [
      { title: 'Sales register for the period', documentType: 'sales_invoice' },
      { title: 'Credit and debit notes issued', documentType: 'sales_invoice' },
    ],
    reminderOffsetsDays: [7, 3, 1],
  },
  {
    name: 'GSTR-3B',
    code: 'GSTR3B',
    category: 'gst',
    isRecurring: true,
    defaultFrequency: 'monthly',
    dueDateRule: { kind: 'day_of_following_month', day: 20, monthsAfter: 1 },
    defaultDocumentChecklist: [
      { title: 'Purchase register for the period', documentType: 'purchase_invoice' },
      { title: 'Sales register for the period', documentType: 'sales_invoice' },
      { title: 'Bank statement for the period', documentType: 'bank_statement' },
    ],
    reminderOffsetsDays: [7, 3, 1],
  },
  {
    name: 'GSTR-9 Annual Return',
    code: 'GSTR9',
    category: 'gst',
    isRecurring: true,
    defaultFrequency: 'annual',
    dueDateRule: { kind: 'fixed_day_month_after_period', day: 31, month: 12, yearsAfter: 0 },
    defaultDocumentChecklist: [
      { title: 'Annual sales summary', documentType: 'sales_invoice' },
      { title: 'Annual purchase summary', documentType: 'purchase_invoice' },
      { title: 'Audited financial statements', documentType: 'audit_document' },
    ],
    reminderOffsetsDays: [30, 14, 7, 1],
  },
  {
    name: 'CMP-08 (Composition)',
    code: 'CMP08',
    category: 'gst',
    isRecurring: true,
    defaultFrequency: 'quarterly',
    dueDateRule: { kind: 'day_of_following_month', day: 18, monthsAfter: 1 },
    defaultDocumentChecklist: [
      { title: 'Quarterly turnover summary', documentType: 'sales_invoice' },
    ],
    reminderOffsetsDays: [7, 3, 1],
  },
  {
    name: 'TDS Return 24Q (Salary)',
    code: 'TDS24Q',
    category: 'tds',
    isRecurring: true,
    defaultFrequency: 'quarterly',
    dueDateRule: { kind: 'day_of_following_month', day: 31, monthsAfter: 1 },
    defaultDocumentChecklist: [
      { title: 'Salary register for the quarter', documentType: 'expense_document' },
      { title: 'Challan copies for TDS deposited', documentType: 'tax_document' },
    ],
    reminderOffsetsDays: [14, 7, 3, 1],
  },
  {
    name: 'TDS Return 26Q (Non-salary)',
    code: 'TDS26Q',
    category: 'tds',
    isRecurring: true,
    defaultFrequency: 'quarterly',
    dueDateRule: { kind: 'day_of_following_month', day: 31, monthsAfter: 1 },
    defaultDocumentChecklist: [
      { title: 'Vendor payment summary', documentType: 'expense_document' },
      { title: 'Challan copies for TDS deposited', documentType: 'tax_document' },
    ],
    reminderOffsetsDays: [14, 7, 3, 1],
  },
  {
    name: 'Income Tax Return — Individual',
    code: 'ITR-IND',
    category: 'income_tax',
    isRecurring: true,
    defaultFrequency: 'annual',
    dueDateRule: { kind: 'fixed_day_month_after_period', day: 31, month: 7, yearsAfter: 0 },
    defaultDocumentChecklist: [
      { title: 'Form 16 or salary certificate', documentType: 'income_proof' },
      { title: 'Bank statements for the year', documentType: 'bank_statement' },
      { title: 'Investment and deduction proofs', documentType: 'tax_document' },
    ],
    reminderOffsetsDays: [30, 14, 7, 1],
  },
  {
    name: 'Income Tax Return — Company',
    code: 'ITR-CO',
    category: 'income_tax',
    isRecurring: true,
    defaultFrequency: 'annual',
    dueDateRule: { kind: 'fixed_day_month_after_period', day: 31, month: 10, yearsAfter: 0 },
    defaultDocumentChecklist: [
      { title: 'Audited financial statements', documentType: 'audit_document' },
      { title: 'Tax audit report', documentType: 'audit_document' },
      { title: 'Advance tax challans', documentType: 'tax_document' },
    ],
    reminderOffsetsDays: [30, 14, 7, 1],
  },
  {
    name: 'Advance Tax Instalment',
    code: 'ADV-TAX',
    category: 'income_tax',
    isRecurring: true,
    defaultFrequency: 'quarterly',
    dueDateRule: { kind: 'days_after_period_end', days: 15 },
    defaultDocumentChecklist: [
      { title: 'Projected income working', documentType: 'income_proof' },
    ],
    reminderOffsetsDays: [14, 7, 3],
  },
  {
    name: 'ROC Annual Return MGT-7',
    code: 'ROC-MGT7',
    category: 'roc',
    isRecurring: true,
    defaultFrequency: 'annual',
    dueDateRule: { kind: 'fixed_day_month_after_period', day: 28, month: 11, yearsAfter: 0 },
    defaultDocumentChecklist: [
      { title: 'Register of members', documentType: 'other', description: 'Statutory register' },
      { title: 'Board meeting minutes', documentType: 'other', description: 'Minutes book extract' },
    ],
    reminderOffsetsDays: [30, 14, 7, 1],
  },
  {
    name: 'ROC Financial Statements AOC-4',
    code: 'ROC-AOC4',
    category: 'roc',
    isRecurring: true,
    defaultFrequency: 'annual',
    dueDateRule: { kind: 'fixed_day_month_after_period', day: 30, month: 10, yearsAfter: 0 },
    defaultDocumentChecklist: [
      { title: 'Audited financial statements', documentType: 'audit_document' },
      { title: "Director's report", documentType: 'other', description: 'Signed report' },
    ],
    reminderOffsetsDays: [30, 14, 7, 1],
  },
  {
    name: 'Advisory Retainer',
    code: 'ADVISORY',
    category: 'advisory',
    isRecurring: false,
    defaultFrequency: 'one_time',
    dueDateRule: null,
    defaultDocumentChecklist: [],
    reminderOffsetsDays: [7],
  },
];

export const seedComplianceTypes = async (): Promise<{ created: number; existing: number }> => {
  let created = 0;
  let existing = 0;

  for (const entry of SEEDED_COMPLIANCE_TYPES) {
    const found = await ComplianceType.findOne({ code: entry.code }).select('_id').lean().exec();
    if (found) {
      existing += 1;
      continue;
    }
    await ComplianceType.create({
      ...entry,
      defaultDocumentChecklist: entry.defaultDocumentChecklist.map((item) => ({
        title: item.title,
        documentType: item.documentType,
        description: item.description ?? null,
      })),
      isSeeded: true,
      active: true,
    });
    created += 1;
  }

  logger.info(
    { event: 'seed.complianceTypes', created, existing },
    'compliance catalogue seeded; every entry is a firm-verifiable default, not legal advice',
  );
  return { created, existing };
};
