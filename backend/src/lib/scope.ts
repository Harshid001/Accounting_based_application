import type { QueryFilter } from 'mongoose';
import { Types } from 'mongoose';

import type { Role } from './enums.js';

export interface ScopeSubject {
  id: Types.ObjectId;
  role: Role;
  linkedClients: Types.ObjectId[];
}

export const isObjectId = (value: unknown): value is string =>
  typeof value === 'string' && Types.ObjectId.isValid(value) && /^[a-f\d]{24}$/i.test(value);

export const toObjectId = (value: string): Types.ObjectId => new Types.ObjectId(value);

export const sameId = (
  a: Types.ObjectId | string | null | undefined,
  b: Types.ObjectId | string | null | undefined,
): boolean => {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return String(a) === String(b);
};

export const containsId = (
  haystack: ReadonlyArray<Types.ObjectId | string>,
  needle: Types.ObjectId | string,
): boolean => haystack.some((entry) => sameId(entry, needle));

export type ScopeFilter = QueryFilter<Record<string, unknown>>;

export const clientScopeFilter = (subject: ScopeSubject): ScopeFilter => {
  switch (subject.role) {
    case 'admin':
      return {};
    case 'staff':
      return { assignedStaff: subject.id };
    case 'client':
      return { _id: { $in: subject.linkedClients } };
  }
};

export const scopedClientIdFilter = (
  subject: ScopeSubject,
  field = 'client',
): ScopeFilter => {
  switch (subject.role) {
    case 'admin':
      return {};
    case 'staff':
      return {};
    case 'client':
      return { [field]: { $in: subject.linkedClients } };
  }
};

export const requiresClientIdNarrowing = (subject: ScopeSubject): boolean =>
  subject.role !== 'admin';

export const isUnlinkedClientAccount = (subject: ScopeSubject): boolean =>
  subject.role === 'client' && subject.linkedClients.length === 0;
