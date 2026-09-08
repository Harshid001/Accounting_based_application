import type { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';

import { utcMidnight, todayIST, addDays } from '../../src/lib/date.js';
import type { ComplianceStatus } from '../../src/lib/enums.js';
import { AutomationRun } from '../../src/models/automationRun.model.js';
import { ComplianceItem } from '../../src/models/complianceItem.model.js';
import { FilingPreparation } from '../../src/models/filingPreparation.model.js';
import {
  findAutomationSuggestions,
  AUTOMATION_SUGGESTION_HORIZON_DAYS,
} from '../../src/services/automationSuggester.service.js';
import { assignStaff, makeBusinessClient, makeComplianceType } from '../helpers/factories.js';
import type { TestAccount } from '../helpers/auth.js';
import { createAccount } from '../helpers/auth.js';

let admin: TestAccount;
let clientId: Types.ObjectId;
let gstr1Type: Types.ObjectId;
let seedCounter = 0;

beforeEach(async () => {
  admin = await createAccount({ role: 'admin' });
  clientId = await makeBusinessClient({ gstin: '27ABCDE1234F1Z5' });
  await assignStaff(clientId, [admin.id]);
  gstr1Type = await makeComplianceType({ name: 'GSTR-1', code: 'GSTR1', category: 'gst' });
});

const makeFiling = async (
  overrides: Partial<{ dueDate: Date; status: ComplianceStatus; filedDate: Date | null }> = {},
) => {
  seedCounter += 1;
  const periodStart = utcMidnight(2025, seedCounter, 1);
  return ComplianceItem.create({
    client: clientId,
    complianceType: gstr1Type,
    periodType: 'month',
    periodStart,
    periodEnd: utcMidnight(2025, seedCounter, 28),
    periodLabel: `2025 M${seedCounter}`,
    dueDate: overrides.dueDate ?? addDays(todayIST(), 3),
    status: overrides.status ?? 'in_progress',
    filedDate: overrides.filedDate ?? null,
    assignedStaff: admin.id,
    generatedBy: 'manual',
  });
};

describe('findAutomationSuggestions', () => {
  it('suggests an automatable filing due inside the horizon', async () => {
    const filing = await makeFiling({ dueDate: addDays(todayIST(), 2) });
    const suggestions = await findAutomationSuggestions();
    const match = suggestions.find((s) => s.filingId === filing._id.toString());
    expect(match).toBeDefined();
    expect(match!.clientName.length).toBeGreaterThan(0);
    expect(match!.formCode).toBe('GSTR1');
    expect(match!.preparationStatus).toBeNull();
    expect(match!.overdue).toBe(false);
  });

  it('excludes filings due beyond the horizon', async () => {
    const farFiling = await makeFiling({ dueDate: addDays(todayIST(), 30) });
    const suggestions = await findAutomationSuggestions();
    expect(suggestions.some((s) => s.filingId === farFiling._id.toString())).toBe(false);
  });

  it('excludes filings already covered by a live run', async () => {
    const filing = await makeFiling({});
    const prep = await FilingPreparation.create({
      complianceItem: filing._id,
      client: clientId,
      formCode: 'GSTR1',
      periodLabel: 'P',
      periodStart: utcMidnight(2025, 1, 1),
      periodEnd: utcMidnight(2025, 1, 28),
      status: 'ready',
      summary: {},
      computed: {},
      portalPayload: {},
      portalName: 'GST Portal (gst.gov.in)',
      guideSteps: [],
      missingInputs: [],
      preparedBy: admin.id,
      lockedAt: null,
    });
    await AutomationRun.create({
      client: clientId,
      complianceItem: filing._id,
      filingPreparation: prep._id,
      portal: 'gst',
      form: 'GSTR-1',
      mode: 'recipe',
      status: 'waiting_human',
      recipeVersion: 1,
      initiatedBy: admin.id,
      actorRole: 'admin',
      steps: [],
      handoffs: [],
      result: { arn: null, acknowledgementRef: null, portalRef: null },
      finishedAt: null,
      error: null,
    });

    const suggestions = await findAutomationSuggestions();
    expect(suggestions.some((s) => s.filingId === filing._id.toString())).toBe(false);
  });

  it('marks overdue filings and reports ready preparations', async () => {
    const overdue = await makeFiling({ dueDate: addDays(todayIST(), -2) });
    await FilingPreparation.create({
      complianceItem: overdue._id,
      client: clientId,
      formCode: 'GSTR1',
      periodLabel: 'P',
      periodStart: utcMidnight(2025, 1, 1),
      periodEnd: utcMidnight(2025, 1, 28),
      status: 'ready',
      summary: {},
      computed: {},
      portalPayload: {},
      portalName: 'GST Portal (gst.gov.in)',
      guideSteps: [],
      missingInputs: [],
      preparedBy: admin.id,
      lockedAt: null,
    });

    const suggestions = await findAutomationSuggestions();
    const match = suggestions.find((s) => s.filingId === overdue._id.toString());
    expect(match).toBeDefined();
    expect(match!.overdue).toBe(true);
    expect(match!.preparationStatus).toBe('ready');
  });

  it('excludes closed filings', async () => {
    const closed = await makeFiling({
      status: 'filed',
      dueDate: addDays(todayIST(), -2),
      filedDate: addDays(todayIST(), -1),
    });
    const suggestions = await findAutomationSuggestions();
    expect(suggestions.some((s) => s.filingId === closed._id.toString())).toBe(false);
  });

  it('excludes forms with no automation recipe (non-GSTR1 type)', async () => {
    const itrType = await makeComplianceType({
      name: 'ITR Individual',
      code: 'ITR-IND',
      category: 'income_tax',
    });
    seedCounter += 1;
    const itrFiling = await ComplianceItem.create({
      client: clientId,
      complianceType: itrType,
      periodType: 'financial_year',
      periodStart: utcMidnight(2025, 4, 1),
      periodEnd: utcMidnight(2026, 3, 31),
      periodLabel: 'FY 2025-26',
      dueDate: addDays(todayIST(), 2),
      status: 'pending',
      assignedStaff: admin.id,
      generatedBy: 'manual',
    });
    const suggestions = await findAutomationSuggestions();
    expect(suggestions.some((s) => s.filingId === itrFiling._id.toString())).toBe(false);
  });

  it('honors the horizon constant', () => {
    expect(AUTOMATION_SUGGESTION_HORIZON_DAYS).toBe(7);
  });
});
