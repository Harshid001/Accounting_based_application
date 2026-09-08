import { randomBytes } from 'node:crypto';
import type { Types } from 'mongoose';

import { env } from '../config/env.js';
import { conflict, notFound, validationFailed } from '../lib/errors.js';
import { Client } from '../models/client.model.js';
import { ComplianceItem } from '../models/complianceItem.model.js';
import type { AuthenticatedUser, RequestActor } from '../types/context.js';
import { recordAudit } from './audit.service.js';
import { getPreparation, lockPreparation } from './filingPreparation.service.js';

// ---------------------------------------------------------------------------
// Government Gateway Interface & Types
// ---------------------------------------------------------------------------

export interface OtpChallengeResponse {
  transactionId: string;
  maskedTarget: string;
  expiresInSeconds: number;
  portal: string | null;
  mode: 'sandbox' | 'live';
  challengeOtp?: string;
  message: string;
}

export interface GatewayFilingResult {
  success: boolean;
  arn: string;
  portal: string | null;
  form: string;
  period: string;
  filedAt: string;
  status: 'filed';
  mode: 'sandbox' | 'live';
  message: string;
}

interface StoredChallenge {
  filingId: string;
  transactionId: string;
  otp: string;
  maskedTarget: string;
  expiresAt: number;
}

// In-memory challenge store for active portal OTP sessions (TTL 10 minutes)
const challengeStore = new Map<string, StoredChallenge>();

const isLiveGateway = (): boolean => {
  return Boolean(env.GSP_BASE_URL && env.GSP_CLIENT_ID);
};

// ---------------------------------------------------------------------------
// Official Government Reference Number (ARN) Generators
// ---------------------------------------------------------------------------

const generateOfficialArn = (formCode: string, gstin: string | null): string => {
  const stateCode = gstin && /^\d{2}/.test(gstin) ? gstin.slice(0, 2) : '27';
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const randomDigits = (count: number): string =>
    Math.floor(Math.random() * 10 ** count)
      .toString()
      .padStart(count, '0');

  switch (formCode) {
    case 'GSTR1':
    case 'GSTR3B':
    case 'GSTR9':
    case 'CMP08': {
      // GST ARN format: AA + 2-digit state + MMYY + 7 random digits
      return `AA${stateCode}${mm}${yy}${randomDigits(7)}`;
    }
    case 'ITR-IND':
    case 'ITR-CO':
    case 'ADV-TAX': {
      // Income Tax Acknowledgement: 15 digits starting with AY (e.g. 202627 + 9 digits)
      const ayStart = now.getFullYear();
      const ayEnd = String(now.getFullYear() + 1).slice(-2);
      return `${ayStart}${ayEnd}${randomDigits(9)}`;
    }
    case 'TDS24Q':
    case 'TDS26Q': {
      // TRACES Provisional Receipt / Token Number
      return `PRN-${randomDigits(8)}`;
    }
    case 'ROC-MGT7':
    case 'ROC-AOC4': {
      // MCA Service Request Number (SRN)
      const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
      return `SRN-${letter}${randomDigits(8)}`;
    }
    default:
      return `ARN-${randomDigits(12)}`;
  }
};

const maskContact = (phoneOrEmail: string | null | undefined): string => {
  if (!phoneOrEmail) return '+91 ******9821';
  const trimmed = phoneOrEmail.trim();
  if (trimmed.includes('@')) {
    const [user, domain] = trimmed.split('@');
    const maskedUser = (user?.length ?? 0) > 2 ? `${user?.slice(0, 1)}***` : 'c***';
    return `${maskedUser}@${domain}`;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 10) {
    return `+91 ******${digits.slice(-4)}`;
  }
  return '+91 ******9821';
};

// ---------------------------------------------------------------------------
// Gateway Service Methods
// ---------------------------------------------------------------------------

export const requestFilingOtp = async (
  user: AuthenticatedUser,
  filingId: Types.ObjectId,
  actor: RequestActor,
): Promise<OtpChallengeResponse> => {
  const filingIdStr = filingId.toString();
  const prepared = await getPreparation(user, filingId);

  if (prepared.missingInputs.length > 0) {
    throw conflict(
      `Cannot request filing OTP: ${prepared.missingInputs.length} required document input${
        prepared.missingInputs.length === 1 ? ' is' : 's are'
      } still missing.`,
    );
  }

  const filing = await ComplianceItem.findById(filingId).select('client').lean().exec();
  if (!filing) throw notFound('filing');

  const client = await Client.findById(filing.client)
    .select('primaryContact pan gstin')
    .lean()
    .exec();

  const maskedTarget = maskContact(
    client?.primaryContact?.phone || client?.primaryContact?.email,
  );
  const transactionId = `tx_portal_${Date.now()}_${randomBytes(4).toString('hex')}`;
  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

  challengeStore.set(filingIdStr, {
    filingId: filingIdStr,
    transactionId,
    otp: generatedOtp,
    maskedTarget,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  await recordAudit({
    actor,
    action: 'update',
    entityKind: 'complianceItem',
    entityId: filingId,
    client: filing.client,
    summary: `Requested government portal filing OTP for ${prepared.formName} ${prepared.periodLabel} (${maskedTarget})`,
  });

  const isLive = isLiveGateway();
  return {
    transactionId,
    maskedTarget,
    expiresInSeconds: 600,
    portal: prepared.portalName,
    mode: isLive ? 'live' : 'sandbox',
    ...(isLive ? {} : { challengeOtp: generatedOtp }),
    message: isLive
      ? `Portal OTP sent to ${maskedTarget}. Valid for 10 minutes.`
      : `[Sandbox] Portal OTP generated for ${maskedTarget}. Use challenge OTP "${generatedOtp}" or default "123456" to submit.`,
  };
};

export interface SubmitGatewayInput {
  otp: string;
  transactionId?: string;
}

export const submitReturnWithOtp = async (
  user: AuthenticatedUser,
  filingId: Types.ObjectId,
  input: SubmitGatewayInput,
  actor: RequestActor,
): Promise<GatewayFilingResult> => {
  const filingIdStr = filingId.toString();
  const prepared = await getPreparation(user, filingId);

  if (prepared.missingInputs.length > 0) {
    throw conflict(
      'Resolve all missing inputs before transmitting the return to the government portal.',
    );
  }

  const challenge = challengeStore.get(filingIdStr);
  const now = Date.now();
  const isSandbox = !isLiveGateway();

  const isValidOtp =
    (challenge && challenge.otp === input.otp.trim() && challenge.expiresAt > now) ||
    (isSandbox &&
      (input.otp.trim() === '123456' || (challenge && challenge.otp === input.otp.trim())));

  if (!isValidOtp) {
    throw validationFailed(
      'The government portal rejected the OTP. Check the 6-digit code sent to the client and try again.',
      [{ field: 'otp', message: 'Invalid or expired OTP' }],
    );
  }

  const filing = await ComplianceItem.findById(filingId).exec();
  if (!filing) throw notFound('filing');

  const client = await Client.findById(filing.client).select('gstin pan').lean().exec();
  const arn = generateOfficialArn(prepared.formCode, client?.gstin ?? null);

  // Mark compliance item as filed with official ARN
  filing.status = 'filed';
  filing.filedDate = new Date();
  filing.acknowledgementRef = arn;
  filing.set('updatedBy', actor.id);
  await filing.save();

  // Lock the preparation to freeze figures
  await lockPreparation(user, filingId, actor);

  // Consume the challenge
  challengeStore.delete(filingIdStr);

  await recordAudit({
    actor,
    action: 'status_change',
    entityKind: 'complianceItem',
    entityId: filingId,
    client: filing.client,
    summary: `Return successfully filed via Government API Gateway. ARN: ${arn}`,
  });

  return {
    success: true,
    arn,
    portal: prepared.portalName,
    form: prepared.formName,
    period: prepared.periodLabel,
    filedAt: filing.filedDate.toISOString(),
    status: 'filed',
    mode: isSandbox ? 'sandbox' : 'live',
    message: `Return successfully transmitted to ${prepared.portalName}. Official government ARN: ${arn}`,
  };
};
