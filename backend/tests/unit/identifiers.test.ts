import { describe, expect, it } from 'vitest';

import {
  escapeRegex,
  gstinMatchesPan,
  isValidAadhaar,
  isValidCin,
  isValidGstin,
  isValidPan,
  isValidPhone,
  isValidPincode,
  isValidTan,
  stripHeaderInjection,
} from '../../src/lib/identifiers.js';

describe('PAN', () => {
  it('accepts the five-letter, four-digit, one-letter shape', () => {
    expect(isValidPan('ABCDE1234F')).toBe(true);
    expect(isValidPan('abcde1234f')).toBe(true);
  });

  it('rejects wrong length, wrong order and stray characters', () => {
    expect(isValidPan('ABCD1234F')).toBe(false);
    expect(isValidPan('ABCDE12345')).toBe(false);
    expect(isValidPan('ABCDE1234')).toBe(false);
    expect(isValidPan('ABCDE-1234F')).toBe(false);
    expect(isValidPan('')).toBe(false);
  });
});

describe('GSTIN', () => {
  it('accepts a fifteen character GSTIN', () => {
    expect(isValidGstin('27ABCDE1234F1Z5')).toBe(true);
  });

  it('rejects a GSTIN without the leading state code', () => {
    expect(isValidGstin('ABCDE1234F1Z5')).toBe(false);
  });

  it('rejects a GSTIN of the wrong length', () => {
    expect(isValidGstin('27ABCDE1234F1Z')).toBe(false);
    expect(isValidGstin('27ABCDE1234F1Z55')).toBe(false);
  });

  it('confirms the embedded PAN when it matches', () => {
    expect(gstinMatchesPan('27ABCDE1234F1Z5', 'ABCDE1234F')).toBe(true);
    expect(gstinMatchesPan('27ABCDE1234F1Z5', 'ZZZZZ9999Z')).toBe(false);
  });
});

describe('TAN, CIN, Aadhaar, pincode and phone', () => {
  it('accepts a well-formed TAN and rejects a malformed one', () => {
    expect(isValidTan('MUMA12345B')).toBe(true);
    expect(isValidTan('MUM12345B')).toBe(false);
  });

  it('requires a CIN of exactly 21 characters', () => {
    expect(isValidCin('L17110MH1973PLC019786')).toBe(true);
    expect(isValidCin('L17110MH1973PLC01978')).toBe(false);
    expect(isValidCin('L17110MH1973PLC0197866')).toBe(false);
  });

  it('accepts twelve Aadhaar digits with or without separators', () => {
    expect(isValidAadhaar('123456789012')).toBe(true);
    expect(isValidAadhaar('1234 5678 9012')).toBe(true);
    expect(isValidAadhaar('1234-5678-9012')).toBe(true);
    expect(isValidAadhaar('12345678901')).toBe(false);
    expect(isValidAadhaar('12345678901a')).toBe(false);
  });

  it('requires a six digit pincode that does not start with zero', () => {
    expect(isValidPincode('400001')).toBe(true);
    expect(isValidPincode('040001')).toBe(false);
    expect(isValidPincode('40001')).toBe(false);
  });

  it('accepts Indian mobile numbers in bare and +91 form', () => {
    expect(isValidPhone('9876543210')).toBe(true);
    expect(isValidPhone('+919876543210')).toBe(true);
    expect(isValidPhone('98765 43210')).toBe(true);
    expect(isValidPhone('1234567890')).toBe(false);
    expect(isValidPhone('98765')).toBe(false);
  });
});

describe('input hardening helpers', () => {
  it('escapes every regular expression metacharacter', () => {
    const escaped = escapeRegex('a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o');
    expect(new RegExp(escaped).test('a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o')).toBe(true);
    expect(new RegExp(escaped).test('axbxcxd')).toBe(false);
  });

  it('removes carriage returns and newlines from email headers', () => {
    expect(stripHeaderInjection('Subject\r\nBcc: attacker@evil.test')).toBe(
      'Subject Bcc: attacker@evil.test',
    );
    expect(stripHeaderInjection('  padded  ')).toBe('padded');
  });
});
