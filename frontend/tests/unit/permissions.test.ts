import { describe, expect, it } from 'vitest';

import { CAPABILITY_KEYS, can, canAll, canAny, homePathFor, isAdmin, isClient, isStaffSide, isKnownCapability } from '@/lib/permissions';
import { makeMe, permissionsFor } from '../helpers/server';

describe('capability list', () => {
  it('mirrors the backend table exactly, with no duplicates', () => {
    expect(new Set(CAPABILITY_KEYS).size).toBe(CAPABILITY_KEYS.length);
    expect(CAPABILITY_KEYS).toContain('client:reveal_aadhaar');
    expect(CAPABILITY_KEYS).toContain('portal:write');
    expect(CAPABILITY_KEYS).toHaveLength(55);
  });

  it('recognises a real capability and rejects an invented one', () => {
    expect(isKnownCapability('audit:read')).toBe(true);
    expect(isKnownCapability('audit:write')).toBe(false);
  });
});

describe('render-time predicates', () => {
  it('lets an admin see the privileged actions', () => {
    const admin = makeMe({ role: 'admin', permissions: permissionsFor('admin') });
    expect(can(admin, 'client:create')).toBe(true);
    expect(can(admin, 'client:reveal_aadhaar')).toBe(true);
    expect(can(admin, 'audit:read')).toBe(true);
    expect(can(admin, 'user:manage')).toBe(true);
    expect(isAdmin(admin)).toBe(true);
    expect(isStaffSide(admin)).toBe(true);
  });

  it('withholds the admin-only actions from staff', () => {
    const staff = makeMe({ role: 'staff', permissions: permissionsFor('staff') });
    expect(can(staff, 'client:read')).toBe(true);
    expect(can(staff, 'compliance:status')).toBe(true);
    expect(can(staff, 'client:create')).toBe(false);
    expect(can(staff, 'client:reveal_aadhaar')).toBe(false);
    expect(can(staff, 'audit:read')).toBe(false);
    expect(can(staff, 'user:manage')).toBe(false);
    expect(isAdmin(staff)).toBe(false);
    expect(isStaffSide(staff)).toBe(true);
  });

  it('gives a client only the portal surface', () => {
    const client = makeMe({ role: 'client', permissions: permissionsFor('client') });
    expect(can(client, 'portal:read')).toBe(true);
    expect(can(client, 'document:write')).toBe(true);
    expect(can(client, 'client:read')).toBe(false);
    expect(can(client, 'task_comment:read')).toBe(false);
    expect(can(client, 'compliance:read')).toBe(false);
    expect(isClient(client)).toBe(true);
    expect(isStaffSide(client)).toBe(false);
  });

  it('denies everything when there is no signed-in user', () => {
    expect(can(null, 'client:read')).toBe(false);
    expect(canAny(undefined, ['client:read', 'portal:read'])).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it('combines capabilities with any and all', () => {
    const staff = makeMe({ role: 'staff', permissions: permissionsFor('staff') });
    expect(canAny(staff, ['client:create', 'client:read'])).toBe(true);
    expect(canAll(staff, ['client:create', 'client:read'])).toBe(false);
    expect(canAll(staff, ['client:read', 'task:read'])).toBe(true);
  });
});

describe('homePathFor', () => {
  it('sends each role to its own workspace', () => {
    expect(homePathFor('admin')).toBe('/dashboard');
    expect(homePathFor('staff')).toBe('/dashboard');
    expect(homePathFor('client')).toBe('/portal');
    expect(homePathFor(null)).toBe('/sign-in');
  });
});
