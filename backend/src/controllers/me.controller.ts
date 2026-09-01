import { sendData, sendNoContent } from '../lib/http.js';
import type { RouteContext } from '../middleware/validate.js';
import { User } from '../models/user.model.js';
import { serialiseMe, serialiseSession } from '../serializers/user.serializer.js';
import {
  listSessionsFor,
  revokeOtherSessions,
  updateSelf,
} from '../services/user.service.js';
import type { UpdateMeBody } from '../validators/user.validators.js';

export const readMe = async (_input: unknown, ctx: RouteContext): Promise<void> => {
  const record = await User.findById(ctx.user.id).select('image phone').lean().exec();
  sendData(ctx.res, {
    ...serialiseMe(ctx.user, record?.image ?? null),
    phone: record?.phone ?? null,
  });
};

export const patchMe = async (
  input: { body: UpdateMeBody },
  ctx: RouteContext,
): Promise<void> => {
  const updated = await updateSelf(
    ctx.user.id,
    {
      name: input.body.name,
      phone: input.body.phone,
      image: input.body.image,
      notificationPreferences: input.body.notificationPreferences,
    },
    ctx.actor,
  );
  sendData(ctx.res, {
    ...serialiseMe(
      {
        ...ctx.user,
        name: updated.name,
        notificationPreferences: updated.notificationPreferences,
      },
      updated.image ?? null,
    ),
    phone: updated.phone ?? null,
  });
};

export const listMySessions = async (_input: unknown, ctx: RouteContext): Promise<void> => {
  const sessions = await listSessionsFor(ctx.user.id, ctx.req.sessionToken);
  sendData(ctx.res, sessions.map(serialiseSession));
};

export const signOutEverywhereElse = async (
  _input: unknown,
  ctx: RouteContext,
): Promise<void> => {
  await revokeOtherSessions(ctx.user.id, ctx.req.sessionToken);
  sendNoContent(ctx.res);
};
