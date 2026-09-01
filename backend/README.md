# FirmDesk — API and scheduler

The backend half of FirmDesk: an Express API plus an in-process scheduler for a single Indian
accounting practice. It is independently installable, runnable and deployable — copy this folder
into an empty repository and it works with no edits.

## Requirements

- Node 22.12 or newer (the process is ESM; `better-auth` ships ESM only)
- MongoDB 6 or newer (Atlas in production, including GridFS file storage)
- An SMTP account

## Getting started

```bash
npm ci
cp .env.example .env    # then fill in real values
npm run dev
```

`src/config/env.ts` parses the environment at import time and exits naming every missing or
invalid variable. Nothing else in the codebase reads `process.env`.

| Script | What it does |
|---|---|
| `npm run dev` | nodemon + tsx, watching `src/` |
| `npm run build` | `tsc` to `dist/` |
| `npm start` | `node dist/src/server.js` |
| `npm run typecheck` | `tsc --noEmit` over `src`, `tests` and `scripts` |
| `npm run lint` | ESLint, zero warnings tolerated |
| `npm test` | Vitest against an ephemeral in-memory MongoDB |
| `npm run indexes` | Builds production indexes explicitly — a deploy never blocks on this |
| `npm run reencrypt` | `FIELD_ENCRYPTION_KEY` rotation pass |
| `npm run verify` | typecheck → lint → test → build. The CI contract. |

## Shape

```
src/config      env, database, Better Auth, GridFS file storage, mail, logger
src/lib         pure helpers: errors, enums, dates, periods, due dates, crypto, identifiers
src/models      one Mongoose schema per collection, with its indexes and invariants
src/middleware  request context, auth, the capability table, client scope, validation, limits
src/services    all business logic; the only layer that touches models
src/serializers role-aware projections; the only place a field is withheld from a role
src/controllers thin HTTP adapters
src/routes      each line declares guard, capability, rate-limit class and schema together
src/jobs        five scheduled jobs behind a database lock, each also an Admin trigger
src/email       transport wrapper and one module per template
src/seed        idempotent catalogue seeding and first-admin bootstrap
```

## How identity is stored

Better Auth 1.6 owns identity: `email`, `emailVerified`, credentials and linked OAuth accounts.
Its MongoDB adapter maps `id` to a real `_id` `ObjectId` and, with `usePlural` left at its default,
creates the collections `user`, `session`, `account` and `verification`.

Mongoose therefore addresses **the same `user` collection** for profile fields — `role`, `status`,
`phone`, `linkedClients`, `pinnedClients`, `notificationPreferences`, `lastSeenAt`. No bridge
collection is needed. `role`, `status`, `linkedClients` and `pinnedClients` are also declared to
Better Auth as `additionalFields` with `input: false`, so they always exist on a freshly created
account and can never be set from a sign-up body.

Session lifetimes are per role — seven days for admin and staff, thirty for clients — which
Better Auth cannot express declaratively, because `session.expiresIn` is a single global value.
Creation is narrowed by role in `databaseHooks.session.create.before`; the sliding refresh is
switched off in the library and performed in `middleware/requireAuth.ts`, which is the only place
the role is known on a refresh. A MongoDB TTL index on `session.expiresAt` reaps expired rows.

Passwords are hashed by Better Auth with scrypt. Application code never sees one.

## Files and the API process

Files are stored in MongoDB GridFS through 60-second signed transfer URLs. Upload requests stream
into the same Atlas database connection used by the application, and downloads stream back with
`Content-Disposition: attachment`. The signed URLs preserve the three-call upload handshake while
keeping the transfer endpoints inaccessible after their short expiry.

## Aadhaar

Encrypted with AES-256-GCM from `node:crypto`, `select: false` on the schema, absent from every
Staff serialiser, readable by an Admin only through the audited reveal endpoint and by the client
it belongs to. It never appears in a diff, a log line, an export or an email. Rotating
`FIELD_ENCRYPTION_KEY` means setting `FIELD_ENCRYPTION_KEY_PREVIOUS` to the retiring key and
running `npm run reencrypt`.

## Deployment

A long-running Node process — `node-cron` runs in-process, so this cannot go on a serverless
platform. It needs outbound access to Atlas, SMTP and Google. `GET /api/v1/health`
answers liveness only.

Cookie and CORS shape are driven entirely by env. On a shared parent domain use
`SESSION_COOKIE_SAMESITE=lax` and set `SESSION_COOKIE_DOMAIN`; across sites use
`SESSION_COOKIE_SAMESITE=none` over HTTPS and name the frontend origin exactly in `CORS_ORIGINS`.
A wildcard origin is refused at startup in every environment.

Set `autoIndex` is off in production; run `npm run indexes` after deploying.
