import type { z } from 'zod';

import { sendList } from '../lib/http.js';
import { buildPageMeta, toPageRequest } from '../lib/pagination.js';
import type { RouteContext } from '../middleware/validate.js';
import { serialiseAuditEntry } from '../serializers/audit.serializer.js';
import { listAudit } from '../services/audit.service.js';
import type { auditListQuery } from '../validators/report.validators.js';

type ListQuery = z.infer<typeof auditListQuery>;

export const list = async (
  input: { query: ListQuery },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const { items, total } = await listAudit(
    {
      actor: input.query.actor,
      entityKind: input.query.entityKind,
      entityId: input.query.entityId,
      client: input.query.client,
      action: input.query.action,
      dateFrom: input.query.dateFrom,
      dateTo: input.query.dateTo,
    },
    page,
  );
  sendList(ctx.res, items.map(serialiseAuditEntry), buildPageMeta(total, page));
};
