export const ERROR_CODES = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  EMAIL_UNVERIFIED: 403,
  FORBIDDEN: 403,
  ACCOUNT_UNLINKED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export interface FieldError {
  field: string;
  message: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: FieldError[] | undefined;
  readonly expose: boolean;

  constructor(code: ErrorCode, message: string, details?: FieldError[]) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_CODES[code];
    this.details = details;
    this.expose = code !== 'INTERNAL';
    Error.captureStackTrace?.(this, AppError);
  }
}

export const isAppError = (value: unknown): value is AppError => value instanceof AppError;

export const validationFailed = (message: string, details?: FieldError[]): AppError =>
  new AppError('VALIDATION_FAILED', message, details);

export const unauthenticated = (message = 'Sign in to continue.'): AppError =>
  new AppError('UNAUTHENTICATED', message);

export const emailUnverified = (
  message = 'Verify your email address before using FirmDesk.',
): AppError => new AppError('EMAIL_UNVERIFIED', message);

export const forbidden = (message = 'You do not have access to this action.'): AppError =>
  new AppError('FORBIDDEN', message);

export const accountUnlinked = (
  message = 'Your account is not linked to a client record yet. Your firm has been notified.',
): AppError => new AppError('ACCOUNT_UNLINKED', message);

export const notFound = (what = 'record'): AppError =>
  new AppError('NOT_FOUND', `We could not find that ${what}.`);

export const conflict = (message: string, details?: FieldError[]): AppError =>
  new AppError('CONFLICT', message, details);

export const payloadTooLarge = (message: string): AppError =>
  new AppError('PAYLOAD_TOO_LARGE', message);

export const unsupportedMediaType = (message: string): AppError =>
  new AppError('UNSUPPORTED_MEDIA_TYPE', message);

export const rateLimited = (
  message = 'Too many requests. Wait a moment and try again.',
): AppError => new AppError('RATE_LIMITED', message);

export const internal = (message = 'Something went wrong on our side.'): AppError =>
  new AppError('INTERNAL', message);
