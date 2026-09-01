import { Types } from 'mongoose';

import { formatDateOnly } from '../lib/date.js';

export interface PersonRef {
  id: string;
  name: string;
  email: string | null;
}

export interface NamedRef {
  id: string;
  name: string;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !(value instanceof Types.ObjectId)
    ? (value as Record<string, unknown>)
    : null;

export const idOf = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Types.ObjectId) return value.toString();
  const record = asRecord(value);
  const id = record?._id;
  return id instanceof Types.ObjectId ? id.toString() : null;
};

export const textOf = (value: unknown, key: string): string | null => {
  const record = asRecord(value);
  const found = record?.[key];
  return typeof found === 'string' ? found : null;
};

export const personRef = (value: unknown): PersonRef | null => {
  const id = idOf(value);
  if (id === null) return null;
  const name = textOf(value, 'name');
  if (name === null) return null;
  return { id, name, email: textOf(value, 'email') };
};

export const personRefs = (values: readonly unknown[] | undefined): PersonRef[] =>
  (values ?? [])
    .map((value) => personRef(value))
    .filter((value): value is PersonRef => value !== null);

export const namedRef = (value: unknown, key = 'name'): NamedRef | null => {
  const id = idOf(value);
  if (id === null) return null;
  const name = textOf(value, key);
  return name === null ? { id, name: '' } : { id, name };
};

export const dateOnly = (value: Date | null | undefined): string | null => formatDateOnly(value);

export const timestamp = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null;
