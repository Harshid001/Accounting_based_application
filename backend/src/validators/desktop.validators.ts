import { z } from 'zod';

import { objectId, pageQuery, searchTerm, trimmedString } from './common.validators.js';

// ---------------------------------------------------------------------------
// Tally (staff-facing, under /books)
// ---------------------------------------------------------------------------

export const tallyStatusQuery = z.object({ client: objectId });

export const postToTallyBody = z.object({
  clientId: objectId,
  /** Posted (or locked) voucher ids; the service caps and re-validates. */
  voucherIds: z.array(objectId).min(1, 'Choose at least one voucher.').max(20, 'Post at most 20 vouchers at a time.'),
});

export const importTallyAccountsBody = z.object({
  clientId: objectId,
});

// ---------------------------------------------------------------------------
// Workstation (desktop app auth'd endpoints)
// ---------------------------------------------------------------------------

const deviceName = trimmedString(1, 120);

export const workstationRegisterBody = z.object({
  deviceId: trimmedString(8, 64),
  deviceName,
  platform: trimmedString(1, 80).optional(),
  appVersion: trimmedString(1, 40).optional(),
});

export const workstationPingBody = z.object({
  deviceId: trimmedString(8, 64),
  /** Shell version reported on every beat — the server re-checks the min gate. */
  appVersion: trimmedString(1, 40).optional(),
  /** Optional live Tally probe outcome relayed by the desktop app. */
  tally: z
    .object({
      reachable: z.boolean(),
      companyName: z.union([trimmedString(1, 200), z.null()]).optional(),
      educationMode: z.boolean().optional(),
      version: z.union([trimmedString(1, 40), z.null()]).optional(),
    })
    .optional(),
});

export const workstationCommandsQuery = pageQuery.extend({
  /** Only queued commands are returned; dispatch marks them claimed. */
  deviceId: trimmedString(8, 64),
});

export const workstationResultBody = z.object({
  deviceId: trimmedString(8, 64),
  commandId: objectId,
  ok: z.boolean(),
  error: trimmedString(1, 2000).optional(),
  /** Parsed envelope detail from lib/tally: created, alreadyExists, companyName, ledgers, ... */
  detail: z.record(z.string(), z.unknown()).optional(),
});

export const workstationListQuery = pageQuery.extend({
  q: searchTerm,
});

export type WorkstationRegisterBody = z.infer<typeof workstationRegisterBody>;
export type WorkstationPingBody = z.infer<typeof workstationPingBody>;
export type WorkstationResultBody = z.infer<typeof workstationResultBody>;
export type WorkstationCommandsQuery = z.infer<typeof workstationCommandsQuery>;
export type WorkstationListQuery = z.infer<typeof workstationListQuery>;
export type PostToTallyBody = z.infer<typeof postToTallyBody>;
