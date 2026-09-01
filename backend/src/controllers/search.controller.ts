import type { z } from 'zod';

import { sendData } from '../lib/http.js';
import type { RouteContext } from '../middleware/validate.js';
import { search } from '../services/search.service.js';
import type { searchQuery } from '../validators/report.validators.js';

type SearchQuery = z.infer<typeof searchQuery>;

export const run = async (
  input: { query: SearchQuery },
  ctx: RouteContext,
): Promise<void> => {
  sendData(ctx.res, await search(ctx.user, input.query.q));
};
