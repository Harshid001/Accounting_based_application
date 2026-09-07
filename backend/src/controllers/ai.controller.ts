import { sendData } from '../lib/http.js';
import type { RouteContext } from '../middleware/validate.js';
import { runAiAgent } from '../services/aiAgent.service.js';
import { detectModels } from '../services/aiModels.service.js';
import { getAiConfigView, updateAiConfig } from '../services/settings.service.js';
import type { AiChatBody, AiConfigBody, AiModelsBody } from '../validators/ai.validators.js';

export const chat = async (input: { body: AiChatBody }, ctx: RouteContext): Promise<void> => {
  const reply = await runAiAgent({
    user: ctx.user,
    actor: ctx.actor,
    message: input.body.message,
    history: input.body.history,
    currentRoute: input.body.currentRoute ?? null,
    image: input.body.image ?? null,
  });
  sendData(ctx.res, reply);
};

export const readConfig = async (_input: unknown, ctx: RouteContext): Promise<void> => {
  const config = await getAiConfigView();
  sendData(ctx.res, config);
};

export const updateConfig = async (
  input: { body: AiConfigBody },
  ctx: RouteContext,
): Promise<void> => {
  const config = await updateAiConfig(input.body, ctx.actor);
  sendData(ctx.res, config);
};

export const listModels = async (
  input: { body: AiModelsBody },
  ctx: RouteContext,
): Promise<void> => {
  const result = await detectModels(input.body.provider, input.body.apiKey, input.body.baseUrl);
  sendData(ctx.res, result);
};
