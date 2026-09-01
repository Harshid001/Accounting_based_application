import { describe, expect, it } from 'vitest';

import {
  ApiError,
  errorFromEnvelope,
  fieldErrorMap,
  networkError,
  normaliseError,
  stripFieldPrefix,
} from '@/lib/errors';

describe('errorFromEnvelope', () => {
  it('reads the machine code, message, details and requestId from the envelope', () => {
    const result = errorFromEnvelope({
      body: {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Some fields need attention.',
          details: [{ field: 'body.pan', message: 'A PAN looks like ABCDE1234F.' }],
          requestId: 'req-42',
        },
      },
      status: 400,
      requestId: 'header-id',
      retryAfterSeconds: null,
    });

    expect(result.code).toBe('VALIDATION_FAILED');
    expect(result.message).toBe('Some fields need attention.');
    expect(result.fieldErrors).toEqual([
      { field: 'body.pan', message: 'A PAN looks like ABCDE1234F.' },
    ]);
    expect(result.requestId).toBe('req-42');
    expect(result.status).toBe(400);
  });

  it('falls back to the header requestId when the envelope omits one', () => {
    const result = errorFromEnvelope({
      body: { error: { code: 'INTERNAL', message: 'Something went wrong.' } },
      status: 500,
      requestId: 'header-id',
      retryAfterSeconds: null,
    });
    expect(result.requestId).toBe('header-id');
  });

  it('derives a code from the status when the body is not an envelope', () => {
    const result = errorFromEnvelope({
      body: '<html>502 Bad Gateway</html>',
      status: 502,
      requestId: null,
      retryAfterSeconds: null,
    });
    expect(result.code).toBe('INTERNAL');
    expect(result.message.length).toBeGreaterThan(0);
    expect(result.fieldErrors).toEqual([]);
  });

  it('keeps Retry-After on a rate-limited response', () => {
    const result = errorFromEnvelope({
      body: { error: { code: 'RATE_LIMITED', message: 'Too many requests.' } },
      status: 429,
      requestId: null,
      retryAfterSeconds: 42,
    });
    expect(result.code).toBe('RATE_LIMITED');
    expect(result.retryAfterSeconds).toBe(42);
  });

  it('maps every documented status to its code', () => {
    const cases: Array<[number, string]> = [
      [400, 'VALIDATION_FAILED'],
      [401, 'UNAUTHENTICATED'],
      [403, 'FORBIDDEN'],
      [404, 'NOT_FOUND'],
      [409, 'CONFLICT'],
      [413, 'PAYLOAD_TOO_LARGE'],
      [415, 'UNSUPPORTED_MEDIA_TYPE'],
      [429, 'RATE_LIMITED'],
      [500, 'INTERNAL'],
    ];
    for (const [status, code] of cases) {
      const result = errorFromEnvelope({
        body: null,
        status,
        requestId: null,
        retryAfterSeconds: null,
      });
      expect(result.code).toBe(code);
    }
  });
});

describe('normaliseError', () => {
  it('returns the same shape for an ApiError, a network failure and an unknown value', () => {
    const fromApi = normaliseError(new ApiError(networkError('Offline.')));
    const fromTypeError = normaliseError(new TypeError('Failed to fetch'));
    const fromNothing = normaliseError(undefined);

    for (const result of [fromApi, fromTypeError, fromNothing]) {
      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('fieldErrors');
      expect(result).toHaveProperty('requestId');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('retryAfterSeconds');
    }

    expect(fromApi.code).toBe('NETWORK');
    expect(fromTypeError.code).toBe('NETWORK');
    expect(fromNothing.code).toBe('UNKNOWN');
  });

  it('treats an aborted request as a network condition, not a failure to report', () => {
    const aborted = new DOMException('The operation was aborted.', 'AbortError');
    expect(normaliseError(aborted).code).toBe('NETWORK');
  });

  it('keeps a plain Error message', () => {
    expect(normaliseError(new Error('Boom')).message).toBe('Boom');
  });
});

describe('field error mapping', () => {
  it('strips the section prefix the server adds', () => {
    expect(stripFieldPrefix('body.primaryContact.email')).toBe('primaryContact.email');
    expect(stripFieldPrefix('query.sort')).toBe('sort');
    expect(stripFieldPrefix('pan')).toBe('pan');
  });

  it('builds a field to message map that React Hook Form can consume', () => {
    const error = errorFromEnvelope({
      body: {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Some fields need attention.',
          details: [
            { field: 'body.pan', message: 'A PAN looks like ABCDE1234F.' },
            { field: 'body.pan', message: 'Duplicate message ignored.' },
            { field: 'body.primaryContact.email', message: 'Enter a complete email address.' },
          ],
        },
      },
      status: 400,
      requestId: null,
      retryAfterSeconds: null,
    });

    expect(fieldErrorMap(error)).toEqual({
      pan: 'A PAN looks like ABCDE1234F.',
      'primaryContact.email': 'Enter a complete email address.',
    });
  });
});
