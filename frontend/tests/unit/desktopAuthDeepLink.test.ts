import { describe, expect, it } from 'vitest';

import {
  consumePendingAuthDeepLink,
  parkPendingAuthKey,
  parseAuthDeepLink,
} from '@/lib/desktopAuthDeepLink';

const KEY = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdEfGhIjKlMnOpQrSt';

/**
 * The deep-link parser is the security boundary between the OS and the
 * Google sign-in handoff: only firmdesk://auth-complete?key=<base64url>
 * may carry data into the app, and only the one-time key ever crosses.
 */
describe('parseAuthDeepLink', () => {
  it('accepts the Windows shape (host carries the path)', () => {
    expect(parseAuthDeepLink(`firmdesk://auth-complete?key=${KEY}`)).toEqual({ key: KEY });
  });

  it('accepts the macOS/Linux shape (empty host, path carries it)', () => {
    expect(parseAuthDeepLink(`firmdesk:///auth-complete?key=${KEY}`)).toEqual({ key: KEY });
  });

  it('accepts mixed case in the host part (schemes are case-insensitive)', () => {
    expect(parseAuthDeepLink(`FIRMDESK://AUTH-COMPLETE?key=${KEY}`)).toEqual({ key: KEY });
  });

  it('rejects other deep-link paths inside the firmdesk scheme', () => {
    expect(parseAuthDeepLink('firmdesk://other?key=value')).toBeNull();
    expect(parseAuthDeepLink('firmdesk://auth-complete/extra?key=' + KEY)).toBeNull();
  });

  it('rejects other schemes entirely', () => {
    expect(parseAuthDeepLink(`https://auth-complete?key=${KEY}`)).toBeNull();
    expect(parseAuthDeepLink(`javascript://auth-complete?key=${KEY}`)).toBeNull();
    expect(parseAuthDeepLink(`ms-excel://auth-complete?key=${KEY}`)).toBeNull();
  });

  it('rejects links without exactly one key param', () => {
    expect(parseAuthDeepLink('firmdesk://auth-complete')).toBeNull();
    expect(
      parseAuthDeepLink(`firmdesk://auth-complete?key=${KEY}&extra=1`),
    ).toBeNull();
  });

  it('rejects malformed keys: too short, too long, wrong alphabet', () => {
    expect(parseAuthDeepLink('firmdesk://auth-complete?key=short')).toBeNull();
    expect(parseAuthDeepLink(`firmdesk://auth-complete?key=${'a'.repeat(300)}`)).toBeNull();
    expect(parseAuthDeepLink('firmdesk://auth-complete?key=has spaces and symbols!')).toBeNull();
    expect(parseAuthDeepLink('firmdesk://auth-complete?key=abc+def/ghi')).toBeNull();
  });

  it('rejects garbage inputs outright', () => {
    expect(parseAuthDeepLink('')).toBeNull();
    expect(parseAuthDeepLink('not a url')).toBeNull();
    expect(parseAuthDeepLink('firmdesk://')).toBeNull();
  });
});

describe('pending-key parking', () => {
  it('parks a valid link and yields it exactly once', () => {
    consumePendingAuthDeepLink(); // drain any leakage between tests
    parkPendingAuthKey(`firmdesk://auth-complete?key=${KEY}`);
    expect(consumePendingAuthDeepLink()).toBe(KEY);
    expect(consumePendingAuthDeepLink()).toBeNull();
  });

  it('never parks an invalid link', () => {
    parkPendingAuthKey('firmdesk://evil?key=https://evil.example');
    expect(consumePendingAuthDeepLink()).toBeNull();
  });
});
