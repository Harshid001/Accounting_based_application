import { Types } from 'mongoose';

import { sendCreated, sendData, sendList, sendNoContent } from '../lib/http.js';
import { buildPageMeta, toPageRequest } from '../lib/pagination.js';
import type { RouteContext } from '../middleware/validate.js';
import { recordAudit } from '../services/audit.service.js';
import {
  enqueueTallyHealthCheck,
  enqueueTallyImport,
  enqueueTallyPost,
  getTallyStatus,
} from '../services/tally.service.js';
import {
  claimCommands,
  listWorkstations,
  pingWorkstation,
  registerWorkstation,
  reportCommandResult,
  revokeWorkstation,
} from '../services/workstation.service.js';
import { applyTallyImportResult, applyTallyPostResult } from '../services/tally.service.js';
import type {
  PostToTallyBody,
  WorkstationCommandsQuery,
  WorkstationListQuery,
  WorkstationPingBody,
  WorkstationRegisterBody,
  WorkstationResultBody,
} from '../validators/desktop.validators.js';

type IdParams = { params: { id: string } };

// ---------------------------------------------------------------------------
// Tally (staff-facing)
// ---------------------------------------------------------------------------

export const tallyStatus = async (
  _input: { query: { client: string } },
  ctx: RouteContext,
): Promise<void> => {
  sendData(ctx.res, await getTallyStatus(ctx.clientId(), ctx.user.id));
};

export const tallyPost = async (input: { body: PostToTallyBody }, ctx: RouteContext): Promise<void> => {
  const { clientId: _clientId, voucherIds } = input.body;
  const result = await enqueueTallyPost(ctx.clientId(), voucherIds, ctx.user.id, ctx.actor);
  sendCreated(ctx.res, result);
};

export const tallyImport = async (
  _input: { body: { clientId: string } },
  ctx: RouteContext,
): Promise<void> => {
  const result = await enqueueTallyImport(ctx.clientId(), ctx.user.id, ctx.actor);
  sendCreated(ctx.res, result);
};

export const tallyHealth = async (
  _input: { query: { client: string } },
  ctx: RouteContext,
): Promise<void> => {
  const command = await enqueueTallyHealthCheck(ctx.clientId(), ctx.user.id, ctx.actor);
  sendCreated(ctx.res, { commandId: command._id.toString(), status: command.status });
};

// ---------------------------------------------------------------------------
// Workstation (desktop app)
// ---------------------------------------------------------------------------

export const workstationRegister = async (
  input: { body: WorkstationRegisterBody },
  ctx: RouteContext,
): Promise<void> => {
  const record = await registerWorkstation(ctx.user.id, input.body, ctx.actor);
  sendCreated(ctx.res, { workstationId: record._id.toString(), deviceId: record.deviceId });
};

export const workstationPing = async (
  input: { body: WorkstationPingBody },
  ctx: RouteContext,
): Promise<void> => {
  const result = await pingWorkstation(
    ctx.user.id,
    input.body.deviceId,
    input.body.tally,
    input.body.appVersion,
  );
  sendData(ctx.res, result);
};

export const workstationCommands = async (
  input: { query: WorkstationCommandsQuery },
  ctx: RouteContext,
): Promise<void> => {
  const commands = await claimCommands(ctx.user.id);
  void input.query.deviceId;
  sendList(
    ctx.res,
    commands.map((command) => ({
      id: command._id.toString(),
      type: command.type,
      client: command.client?.toString() ?? null,
      voucherIds: command.voucherIds?.map((id) => id.toString()) ?? [],
      payload: command.payload,
    })),
    { ...buildPageMeta(commands.length, toPageRequest(1, 100)) },
  );
};

export const workstationResult = async (
  input: { body: WorkstationResultBody },
  ctx: RouteContext,
): Promise<void> => {
  const command = await reportCommandResult(ctx.user.id, input.body, ctx.actor);
  if (input.body.ok) {
    if (command.type === 'tally_post') {
      await applyTallyPostResult(command, input.body.ok, input.body.detail ?? {}, null);
    }
    if (command.type === 'tally_import') {
      const outcome = await applyTallyImportResult(
        command,
        input.body.ok,
        input.body.detail ?? {},
        ctx.actor,
      );
      sendData(ctx.res, { commandId: command._id.toString(), status: command.status, import: outcome });
      return;
    }
  } else if (command.type === 'tally_post') {
    await applyTallyPostResult(
      command,
      false,
      {},
      input.body.error ?? 'The desktop app could not reach Tally.',
    );
  }
  sendData(ctx.res, { commandId: command._id.toString(), status: command.status });
};

// ---------------------------------------------------------------------------
// Workstation (admin views)
// ---------------------------------------------------------------------------

export const workstationsList = async (
  input: { query: WorkstationListQuery },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const { items, total } = await listWorkstations(input.query, page);
  sendList(
    ctx.res,
    items.map((item) => ({
      ...item,
      lastSeenAt: item.lastSeenAt.toISOString(),
      tally: { ...item.tally, checkedAt: item.tally.checkedAt?.toISOString() ?? null },
    })),
    buildPageMeta(total, page),
  );
};

export const workstationRevoke = async (input: IdParams, ctx: RouteContext): Promise<void> => {
  await revokeWorkstation(new Types.ObjectId(input.params.id), ctx.actor);
  await recordAudit({
    actor: ctx.actor,
    action: 'update',
    entityKind: 'workstation',
    entityId: new Types.ObjectId(input.params.id),
    summary: 'Workstation revoked via admin UI',
  });
  sendNoContent(ctx.res);
};
