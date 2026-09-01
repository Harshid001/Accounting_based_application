import { API_ERROR_CODES } from '@/types/api';
import type { ApiErrorCode, FieldError, NormalisedErrorCode } from '@/types/api';

export interface NormalisedError {
  code: NormalisedErrorCode;
  message: string;
  fieldErrors: FieldError[];
  requestId: string | null;
  status: number | null;
  retryAfterSeconds: number | null;
}

export class ApiError extends Error {
  readonly normalised: NormalisedError;

  constructor(normalised: NormalisedError) {
    super(normalised.message);
    this.name = 'ApiError';
    this.normalised = normalised;
  }
}

const FALLBACK_MESSAGES: Record<NormalisedErrorCode, string> = {
  VALIDATION_FAILED: 'Some fields need attention before this can be saved.',
  UNAUTHENTICATED: 'Your session has ended. Sign in to continue.',
  EMAIL_UNVERIFIED: 'Verify your email address before using FirmDesk.',
  FORBIDDEN: 'You do not have access to this action.',
  ACCOUNT_UNLINKED: 'Your account is not linked to a client record yet.',
  NOT_FOUND: 'We could not find that record.',
  CONFLICT: 'That change conflicts with something already saved.',
  PAYLOAD_TOO_LARGE: 'That file is larger than the 25 MB limit.',
  UNSUPPORTED_MEDIA_TYPE: 'FirmDesk does not accept that file type.',
  RATE_LIMITED: 'Too many requests. Wait a moment and try again.',
  INTERNAL: 'Something went wrong on our side. Try again in a moment.',
  NETWORK: 'FirmDesk could not reach the server. Check your connection and try again.',
  UNKNOWN: 'Something unexpected happened. Try again.',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readString = (source: Record<string, unknown>, key: string): string | null => {
  const value = source[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
};

const readCode = (value: string | null): ApiErrorCode | null =>
  value !== null && (API_ERROR_CODES as readonly string[]).includes(value)
    ? (value as ApiErrorCode)
    : null;

const readFieldErrors = (value: unknown): FieldError[] => {
  if (!Array.isArray(value)) return [];
  const out: FieldError[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const field = readString(entry, 'field');
    const message = readString(entry, 'message');
    if (field !== null && message !== null) out.push({ field, message });
  }
  return out;
};

const codeForStatus = (status: number): NormalisedErrorCode => {
  switch (status) {
    case 400:
      return 'VALIDATION_FAILED';
    case 401:
      return 'UNAUTHENTICATED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 413:
      return 'PAYLOAD_TOO_LARGE';
    case 415:
      return 'UNSUPPORTED_MEDIA_TYPE';
    case 429:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'INTERNAL' : 'UNKNOWN';
  }
};

export interface EnvelopeInput {
  body: unknown;
  status: number;
  requestId: string | null;
  retryAfterSeconds: number | null;
}

export const errorFromEnvelope = (input: EnvelopeInput): NormalisedError => {
  const envelope = isRecord(input.body) ? input.body : {};
  const error = isRecord(envelope.error) ? envelope.error : {};
  const code = readCode(readString(error, 'code')) ?? codeForStatus(input.status);
  const message = readString(error, 'message') ?? FALLBACK_MESSAGES[code];
  return {
    code,
    message,
    fieldErrors: readFieldErrors(error.details),
    requestId: readString(error, 'requestId') ?? input.requestId,
    status: input.status,
    retryAfterSeconds: input.retryAfterSeconds,
  };
};

export const networkError = (message?: string): NormalisedError => ({
  code: 'NETWORK',
  message: message ?? FALLBACK_MESSAGES.NETWORK,
  fieldErrors: [],
  requestId: null,
  status: null,
  retryAfterSeconds: null,
});

export const normaliseError = (error: unknown): NormalisedError => {
  if (error instanceof ApiError) return error.normalised;

  if (error instanceof DOMException && error.name === 'AbortError') {
    return {
      code: 'NETWORK',
      message: 'That request was cancelled before it finished.',
      fieldErrors: [],
      requestId: null,
      status: null,
      retryAfterSeconds: null,
    };
  }

  if (error instanceof TypeError) return networkError();

  if (error instanceof Error && error.message.length > 0) {
    return {
      code: 'UNKNOWN',
      message: error.message,
      fieldErrors: [],
      requestId: null,
      status: null,
      retryAfterSeconds: null,
    };
  }

  if (typeof error === 'string' && error.length > 0) {
    return {
      code: 'UNKNOWN',
      message: error,
      fieldErrors: [],
      requestId: null,
      status: null,
      retryAfterSeconds: null,
    };
  }

  return {
    code: 'UNKNOWN',
    message: FALLBACK_MESSAGES.UNKNOWN,
    fieldErrors: [],
    requestId: null,
    status: null,
    retryAfterSeconds: null,
  };
};

export const stripFieldPrefix = (field: string): string =>
  field.replace(/^(body|query|params)\./, '');

export const fieldErrorMap = (error: NormalisedError): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const entry of error.fieldErrors) {
    const key = stripFieldPrefix(entry.field);
    if (out[key] === undefined) out[key] = entry.message;
  }
  return out;
};

export const isCode = (error: unknown, ...codes: NormalisedErrorCode[]): boolean =>
  codes.includes(normaliseError(error).code);

export const messageFor = (code: NormalisedErrorCode): string => FALLBACK_MESSAGES[code];
