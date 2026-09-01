export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/;
export const TAN_PATTERN = /^[A-Z]{4}[0-9]{5}[A-Z]$/;
export const CIN_PATTERN = /^[A-Z0-9]{21}$/;
export const AADHAAR_PATTERN = /^[0-9]{12}$/;
export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;
export const PHONE_PATTERN = /^(?:\+91[6-9][0-9]{9}|[6-9][0-9]{9}|\+[1-9][0-9]{7,14})$/;

export const normaliseIdentifier = (value: string): string =>
  value.replace(/\s+/g, '').toUpperCase();

export const normaliseAadhaar = (value: string): string => value.replace(/[\s-]/g, '');

export const isValidPan = (value: string): boolean =>
  PAN_PATTERN.test(normaliseIdentifier(value));

export const isValidGstin = (value: string): boolean =>
  GSTIN_PATTERN.test(normaliseIdentifier(value));

export const isValidTan = (value: string): boolean =>
  TAN_PATTERN.test(normaliseIdentifier(value));

export const isValidCin = (value: string): boolean =>
  CIN_PATTERN.test(normaliseIdentifier(value));

export const isValidAadhaar = (value: string): boolean =>
  AADHAAR_PATTERN.test(normaliseAadhaar(value));

export const isValidPincode = (value: string): boolean => PINCODE_PATTERN.test(value.trim());

export const isValidPhone = (value: string): boolean =>
  PHONE_PATTERN.test(value.replace(/[\s-]/g, ''));

export const gstinMatchesPan = (gstin: string, pan: string): boolean => {
  const normalisedGstin = normaliseIdentifier(gstin);
  const normalisedPan = normaliseIdentifier(pan);
  if (!GSTIN_PATTERN.test(normalisedGstin) || !PAN_PATTERN.test(normalisedPan)) return false;
  return normalisedGstin.slice(2, 12) === normalisedPan;
};

export const BUSINESS_ONLY_FIELDS = [
  'gstin',
  'tan',
  'cin',
  'entityType',
  'incorporationDate',
] as const;

export const INDIVIDUAL_ONLY_FIELDS = ['aadhaar', 'dateOfBirth'] as const;

export type BusinessOnlyField = (typeof BUSINESS_ONLY_FIELDS)[number];
export type IndividualOnlyField = (typeof INDIVIDUAL_ONLY_FIELDS)[number];

export const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const stripHeaderInjection = (value: string): string =>
  value.replace(/[\r\n]+/g, ' ').trim();
