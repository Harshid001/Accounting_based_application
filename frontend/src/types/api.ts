export const API_ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'EMAIL_UNVERIFIED',
  'FORBIDDEN',
  'ACCOUNT_UNLINKED',
  'NOT_FOUND',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'RATE_LIMITED',
  'INTERNAL',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export type NormalisedErrorCode = ApiErrorCode | 'NETWORK' | 'UNKNOWN';

export interface FieldError {
  field: string;
  message: string;
}

export interface ResponseMeta {
  requestId: string;
  [key: string]: unknown;
}

export interface PageMeta extends ResponseMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  data: T;
  meta: ResponseMeta;
}

export interface ApiListEnvelope<T> {
  data: T[];
  meta: PageMeta;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  requestId: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: FieldError[];
  requestId?: string;
}

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;
