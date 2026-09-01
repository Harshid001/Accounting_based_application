import { env } from '@/lib/env';
import { ACTIVE_CLIENT_HEADER, REQUEST_ID_HEADER } from '@/lib/constants';
import { ApiError, errorFromEnvelope, networkError } from '@/lib/errors';
import type { ApiListEnvelope, Paged, QueryParams } from '@/types/api';

let activeClientId: string | null = null;

export const setActiveClientHeader = (clientId: string | null): void => {
  activeClientId = clientId;
};

export const getActiveClientHeader = (): string | null => activeClientId;

export const buildQuery = (params: QueryParams | undefined): string => {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    const encoded = typeof value === 'boolean' ? String(value) : String(value);
    if (encoded.length === 0) continue;
    search.set(key, encoded);
  }
  const query = search.toString();
  return query.length > 0 ? `?${query}` : '';
};

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: QueryParams;
  signal?: AbortSignal;
  skipActiveClient?: boolean;
}

const retryAfterFrom = (response: Response): number | null => {
  const header = response.headers.get('Retry-After');
  if (header === null) return null;
  const seconds = Number.parseInt(header, 10);
  return Number.isFinite(seconds) ? seconds : null;
};

const parseBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) return null;
  const contentType = response.headers.get('Content-Type') ?? '';
  if (!contentType.includes('json')) {
    const text = await response.text().catch(() => '');
    return text.length > 0 ? { error: { message: text.slice(0, 400) } } : null;
  }
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
};

const headersFor = (options: RequestOptions): HeadersInit => {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.skipActiveClient !== true && activeClientId !== null) {
    headers[ACTIVE_CLIENT_HEADER] = activeClientId;
  }
  return headers;
};

const performFetch = async (path: string, options: RequestOptions): Promise<Response> => {
  const url = `${env.apiBaseUrl}${path}${buildQuery(options.query)}`;
  try {
    return await fetch(url, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: headersFor(options),
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(networkError());
  }
};

interface RawResult {
  body: unknown;
  requestId: string | null;
}

const send = async (path: string, options: RequestOptions): Promise<RawResult> => {
  const response = await performFetch(path, options);
  const requestId = response.headers.get(REQUEST_ID_HEADER);
  const body = await parseBody(response);

  if (!response.ok) {
    throw new ApiError(
      errorFromEnvelope({
        body,
        status: response.status,
        requestId,
        retryAfterSeconds: retryAfterFrom(response),
      }),
    );
  }
  return { body, requestId };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const unwrap = <T>(result: RawResult): T => {
  if (!isRecord(result.body) || !('data' in result.body)) {
    return undefined as T;
  }
  return result.body.data as T;
};

export const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> =>
  unwrap<T>(await send(path, options));

export const apiRequestWithMeta = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; requestId: string | null }> => {
  const result = await send(path, options);
  return { data: unwrap<T>(result), requestId: result.requestId };
};

export const apiList = async <T>(path: string, options: RequestOptions = {}): Promise<Paged<T>> => {
  const result = await send(path, options);
  const envelope = (isRecord(result.body) ? result.body : {}) as Partial<ApiListEnvelope<T>>;
  const items = Array.isArray(envelope.data) ? envelope.data : [];
  const meta = envelope.meta;
  const limit = typeof meta?.limit === 'number' ? meta.limit : items.length;
  return {
    items,
    total: typeof meta?.total === 'number' ? meta.total : items.length,
    page: typeof meta?.page === 'number' ? meta.page : 1,
    limit,
    totalPages: typeof meta?.totalPages === 'number' ? meta.totalPages : 1,
    requestId: meta?.requestId ?? result.requestId ?? '',
  };
};

export const apiGet = <T>(path: string, query?: QueryParams, signal?: AbortSignal): Promise<T> =>
  apiRequest<T>(path, { method: 'GET', ...(query ? { query } : {}), ...(signal ? { signal } : {}) });

export const apiPost = <T>(path: string, body?: unknown): Promise<T> =>
  apiRequest<T>(path, { method: 'POST', ...(body === undefined ? {} : { body }) });

export const apiPatch = <T>(path: string, body: unknown): Promise<T> =>
  apiRequest<T>(path, { method: 'PATCH', body });

export const apiPut = <T>(path: string, body: unknown): Promise<T> =>
  apiRequest<T>(path, { method: 'PUT', body });

export const apiDelete = <T>(path: string, body?: unknown): Promise<T> =>
  apiRequest<T>(path, { method: 'DELETE', ...(body === undefined ? {} : { body }) });

export const apiBlob = async (path: string, query?: QueryParams): Promise<Blob> => {
  const url = `${env.apiBaseUrl}${path}${buildQuery(query)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: headersFor({}),
    });
  } catch {
    throw new ApiError(networkError());
  }
  if (!response.ok) {
    const requestId = response.headers.get(REQUEST_ID_HEADER);
    const body = await parseBody(response);
    throw new ApiError(
      errorFromEnvelope({
        body,
        status: response.status,
        requestId,
        retryAfterSeconds: retryAfterFrom(response),
      }),
    );
  }
  return response.blob();
};

export const putToStorage = async (
  uploadUrl: string,
  file: File,
  mimeType: string,
): Promise<void> => {
  let response: Response;
  try {
    response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': mimeType },
    });
  } catch {
    throw new ApiError(
      networkError('The file could not be sent to storage. Check your connection and try again.'),
    );
  }
  if (!response.ok) {
    throw new ApiError({
      code: response.status === 403 ? 'FORBIDDEN' : 'INTERNAL',
      message:
        response.status === 403
          ? 'The upload link expired before the file finished. Try uploading it again.'
          : 'Storage rejected the upload. Try again in a moment.',
      fieldErrors: [],
      requestId: null,
      status: response.status,
      retryAfterSeconds: null,
    });
  }
};
