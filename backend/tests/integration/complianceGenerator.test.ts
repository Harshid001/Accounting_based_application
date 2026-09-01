import request from 'supertest';
import type { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';

import { utcMidnight } from '../../src/lib/date.js';
import { ComplianceItem } from '../../src/models/complianceItem.model.js';
import { DocumentRequest } from '../../src/models/documentRequest.model.js';
import { generateComplianceItems } from '../../src/jobs/generateComplianceItems.job.js';
import { planBulk, commitPlan } from '../../src/services/complianceGenerator.service.js';
import { systemActor } from '../../src/types/context.js';
import {
  assignStaff,
  makeClient,
  makeClientService,
  makeComplianceType,
} from '../helpers/factories.js';
import type { TestAccount } from '../helpers/auth.js';
import { app, auth, createAccount } from '../helpers/auth.js';

let admin: TestAccount;
let staff: TestAccount;
let clientId: Types.ObjectId;
let typeId: Types.ObjectId;

beforeEach(async () => {
  admin = await createAccount({ role: 'admin' });
  staff = await createAccount({ role: 'staff' });
  clientId = await makeClient({ displayName: 'Recurring Client' });
  await assignStaff(clientId, [staff.id]);
  typeId = await makeComplianceType({
    name: 'Monthly Return',
    defaultFrequency: 'monthly',
    dueDateRule: { kind: 'day_of_following_month', day: 20, monthsAfter: 1 },
  });
});

describe('bulk generation', () => {
  it('previews without writing anything', async () => {
    const response = await request(app())
      .post('/api/v1/compliance/generate/preview')
      .set(auth(admin))
      .send({
        complianceTypeId: typeId.toString(),
        periodStart: '2026-04-01',
        periodEnd: '2026-06-30',
      });
    expect(response.status).toBe(200);
    expect((response.body.data.willCreate as unknown[]).length).toBe(3);
    expect(await ComplianceItem.countDocuments()).toBe(0);
  });

  it('creates exactly what the preview listed', async () => {
    const body = {
      complianceTypeId: typeId.toString(),
      periodStart: '2026-04-01',
      periodEnd: '2026-06-30',
    };
    const preview = await request(app())
      .post('/api/v1/compliance/generate/preview')
      .set(auth(admin))
      .send(body);
    const planned = (preview.body.data.willCreate as unknown[]).length;

    const generated = await request(app())
      .post('/api/v1/compliance/generate')
      .set(auth(admin))
      .send(body);
    expect(generated.status).toBe(200);
    expect((generated.body.data as { created: number }).created).toBe(planned);
    expect(await ComplianceItem.countDocuments()).toBe(planned);
  });

  it('creates nothing extra on a second run', async () => {
    const body = {
      complianceTypeId: typeId.toString(),
      periodStart: '2026-04-01',
      periodEnd: '2026-06-30',
    };
    await request(app()).post('/api/v1/compliance/generate').set(auth(admin)).send(body);
    const before = await ComplianceItem.countDocuments();

    const second = await request(app())
      .post('/api/v1/compliance/generate')
      .set(auth(admin))
      .send(body);
    expect((second.body.data as { created: number }).created).toBe(0);
    expect((second.body.data as { skipped: number }).skipped).toBe(before);
    expect(await ComplianceItem.countDocuments()).toBe(before);
  });

  it('reports each skip with a reason a human can read', async () => {
    const body = {
      complianceTypeId: typeId.toString(),
      periodStart: '2026-04-01',
      periodEnd: '2026-05-31',
    };
    await request(app()).post('/api/v1/compliance/generate').set(auth(admin)).send(body);
    const preview = await request(app())
      .post('/api/v1/compliance/generate/preview')
      .set(auth(admin))
      .send(body);
    const skips = preview.body.data.willSkip as Array<{ reason: string }>;
    expect(skips).toHaveLength(2);
    expect(skips.every((skip) => skip.reason === 'it already exists')).toBe(true);
  });

  it('computes the due date from the catalogue rule', async () => {
    await request(app())
      .post('/api/v1/compliance/generate')
      .set(auth(admin))
      .send({
        complianceTypeId: typeId.toString(),
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
      });
    const item = await ComplianceItem.findOne({ periodLabel: 'Jun 2026' }).lean().exec();
    expect(item?.dueDate).toEqual(utcMidnight(2026, 7, 20));
    expect(item?.dueDateOverridden).toBe(false);
  });

  it('materialises the catalogue checklist as document requests', async () => {
    const withChecklist = await makeComplianceType({
      name: 'Checklist Filing',
      defaultDocumentChecklist: [
        { title: 'Bank statement', documentType: 'bank_statement', description: null },
        { title: 'Sales register', documentType: 'sales_invoice', description: null },
      ],
    });
    await request(app())
      .post('/api/v1/compliance/generate')
      .set(auth(admin))
      .send({
        complianceTypeId: withChecklist.toString(),
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
      });
    expect(await DocumentRequest.countDocuments({ client: clientId })).toBe(2);
  });
});

describe('an overridden due date', () => {
  it('survives a later generation run', async () => {
    const body = {
      complianceTypeId: typeId.toString(),
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
    };
    await request(app()).post('/api/v1/compliance/generate').set(auth(admin)).send(body);
    const created = await ComplianceItem.findOne({ periodLabel: 'Jun 2026' }).lean().exec();
    if (!created) throw new Error('expected a generated item');

    const patched = await request(app())
      .patch(`/api/v1/compliance/${created._id.toString()}`)
      .set(auth(admin))
      .send({ dueDate: '2026-08-05' });
    expect(patched.status).toBe(200);
    expect((patched.body.data as { dueDateOverridden: boolean }).dueDateOverridden).toBe(true);

    await request(app()).post('/api/v1/compliance/generate').set(auth(admin)).send(body);
    const after = await ComplianceItem.findById(created._id).lean().exec();
    expect(after?.dueDate).toEqual(utcMidnight(2026, 8, 5));
    expect(after?.dueDateOverridden).toBe(true);
  });
});

describe('the rolling scheduler job', () => {
  it('generates from active client services and is safe to repeat', async () => {
    await makeClientService(clientId, typeId, {
      startDate: utcMidnight(2020, 1, 1),
      assignedStaff: staff.id,
    });

    const first = await generateComplianceItems();
    expect(first.ran).toBe(true);
    const created = await ComplianceItem.countDocuments();
    expect(created).toBeGreaterThan(0);

    const second = await generateComplianceItems();
    expect(second.ran).toBe(true);
    expect(second.result.created).toBe(0);
    expect(await ComplianceItem.countDocuments()).toBe(created);
  });

  it('skips an archived client and says why', async () => {
    const archived = await makeClient({ displayName: 'Archived Client', archived: true });
    await makeClientService(archived, typeId, { startDate: utcMidnight(2020, 1, 1) });

    const { planFromClientServices } = await import(
      '../../src/services/complianceGenerator.service.js'
    );
    const plan = await planFromClientServices(utcMidnight(2026, 1, 1), utcMidnight(2026, 3, 31));
    expect(plan.willCreate).toEqual([]);
    expect(plan.willSkip[0]?.reason).toBe('the client is archived');
  });

  it('never generates before the service start date or after its end date', async () => {
    await makeClientService(clientId, typeId, {
      startDate: utcMidnight(2026, 3, 1),
      endDate: utcMidnight(2026, 5, 31),
    });
    const { planFromClientServices } = await import(
      '../../src/services/complianceGenerator.service.js'
    );
    const plan = await planFromClientServices(utcMidnight(2026, 1, 1), utcMidnight(2026, 12, 31));
    const labels = plan.willCreate.map((item) => item.period.periodLabel);
    expect(labels).toEqual(['Mar 2026', 'Apr 2026', 'May 2026']);
  });

  it('assigns generated items to the service assignee', async () => {
    await makeClientService(clientId, typeId, {
      startDate: utcMidnight(2026, 6, 1),
      endDate: utcMidnight(2026, 6, 30),
      assignedStaff: staff.id,
    });
    const { planFromClientServices } = await import(
      '../../src/services/complianceGenerator.service.js'
    );
    const plan = await planFromClientServices(utcMidnight(2026, 6, 1), utcMidnight(2026, 6, 30));
    await commitPlan(plan, 'scheduler', systemActor());
    const item = await ComplianceItem.findOne({ periodLabel: 'Jun 2026' }).lean().exec();
    expect(item?.assignedStaff?.toString()).toBe(staff.id.toString());
  });
});

describe('the unique index', () => {
  it('makes a duplicate impossible even when two runs race', async () => {
    const plan = await planBulk({
      complianceTypeId: typeId.toString(),
      periodStart: utcMidnight(2026, 6, 1),
      periodEnd: utcMidnight(2026, 6, 30),
    });
    const [first, second] = await Promise.all([
      commitPlan(plan, 'bulk', systemActor()),
      commitPlan(plan, 'bulk', systemActor()),
    ]);
    expect(first.created + second.created).toBe(1);
    expect(await ComplianceItem.countDocuments()).toBe(1);
  });
});
