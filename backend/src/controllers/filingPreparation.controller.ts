import { Types } from 'mongoose';

import { sendData, sendJsonFile } from '../lib/http.js';
import type { RouteContext } from '../middleware/validate.js';
import {
  getPreparation,
  lockPreparation,
  prepareFiling,
  updateGuideStep,
} from '../services/filingPreparation.service.js';
import {
  requestFilingOtp,
  submitReturnWithOtp,
} from '../services/governmentGateway.service.js';
import type {
  GatewaySubmitBody,
  GuideStepBody,
} from '../validators/filingPreparation.validators.js';

export const prepare = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  const prepared = await prepareFiling(
    ctx.user,
    new Types.ObjectId(input.params.id),
    ctx.actor,
  );
  sendData(ctx.res, prepared);
};

export const detail = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  const prepared = await getPreparation(ctx.user, new Types.ObjectId(input.params.id));
  sendData(ctx.res, prepared);
};

export const updateStep = async (
  input: { params: { id: string }; body: GuideStepBody },
  ctx: RouteContext,
): Promise<void> => {
  const prepared = await updateGuideStep(
    ctx.user,
    new Types.ObjectId(input.params.id),
    { stepIndex: input.body.stepIndex, done: input.body.done },
    ctx.actor,
  );
  sendData(ctx.res, prepared);
};

export const lock = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  const prepared = await lockPreparation(
    ctx.user,
    new Types.ObjectId(input.params.id),
    ctx.actor,
  );
  sendData(ctx.res, prepared);
};

export const downloadPayload = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  const prepared = await getPreparation(ctx.user, new Types.ObjectId(input.params.id));
  const sanitizedPeriod = prepared.periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${prepared.formCode}_${sanitizedPeriod}.json`;
  sendJsonFile(ctx.res, filename, prepared.portalPayload ?? prepared.computed);
};

export const requestGatewayOtp = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  const challenge = await requestFilingOtp(
    ctx.user,
    new Types.ObjectId(input.params.id),
    ctx.actor,
  );
  sendData(ctx.res, challenge);
};

export const submitGatewayReturn = async (
  input: { params: { id: string }; body: GatewaySubmitBody },
  ctx: RouteContext,
): Promise<void> => {
  const result = await submitReturnWithOtp(
    ctx.user,
    new Types.ObjectId(input.params.id),
    input.body,
    ctx.actor,
  );
  sendData(ctx.res, result);
};
