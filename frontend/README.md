# FirmDesk — web application

The frontend half of FirmDesk: a React 19 single-page application for a single Indian accounting
practice. It is independently installable, runnable and deployable — copy this folder into an empty
repository and it works with no edits. It never imports from `backend/`; its only connection to the
API is HTTP over an env-configured origin.

## Requirements

- Node 22.12 or newer
- A running FirmDesk API (see `../backend`)

## Getting started

```bash
npm ci
cp .env.example .env
npm run dev
```

`src/lib/env.ts` validates `import.meta.env` once at boot and throws a readable error naming every
missing variable. Nothing else in the codebase reads `import.meta.env`. If the app cannot start,
`src/app/bootError.ts` paints that message into the page rather than leaving a blank screen.

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Absolute origin of the API, including `/api/v1`. |
| `VITE_APP_NAME` | Display name in the document title and the PWA manifest. |

Every `VITE_`-prefixed value is compiled into the bundle and is public. No secret may carry that
prefix; the frontend holds no keys of any kind.

The dev server proxies `/api` to the origin of `VITE_API_BASE_URL`, so setting
`VITE_API_BASE_URL=/api/v1` routes every call through the proxy and makes session cookies same-site
in development.

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR on port 5173 |
| `npm run build` | `vite build` to static `dist/` |
| `npm run preview` | Serves the built output on port 4173 |
| `npm run typecheck` | `tsc --noEmit` over `src`, `tests` and the build configs |
| `npm run lint` | ESLint, zero warnings tolerated |
| `npm test` | Vitest with React Testing Library and jsdom |
| `npm run verify` | typecheck → lint → test → build. The CI contract. |

## Shape

```
src/app         router, providers, route guards, error boundary, boot failure
src/layouts     the three shells: auth, staff workspace, client portal
src/routes      one directory per screen from PRD.md §5
src/components  ui/ design-system primitives, domain/ FirmDesk-aware shared parts
src/api         the only fetch call site, the Better Auth client, one module per resource
src/hooks       URL-backed list state, debounce, hotkeys, unread poll, upload handshake
src/context     theme, session, active portal client, toasts
src/lib         env, dates in IST, formatting, render-time permissions, error normalisation
src/schemas     Zod form schemas — UX validation only; the server is the authority
src/styles      Tailwind v4 entry, design tokens for both themes, print stylesheet
src/types       response types written by hand from the backend serialisers
```

## Things worth knowing before you change anything

**The frontend is never an authority.** `src/lib/permissions.ts` decides what to *render*. The
server re-checks role and scope on every route, and `/me`'s `permissions` object is a rendering
convenience, never a grant. A hidden button is a courtesy, not a control.

**Dark is the default theme.** A stored preference wins; with none, the app paints dark.
`prefers-color-scheme` is deliberately never consulted. The inline script in `index.html` sets
`data-theme` before first paint, so there is no flash of the wrong theme.

**URL state, not local state.** `useListParams` keeps search, filters, sort and page in the query
string. A refresh restores the view, a pasted link reproduces it, and list components hold no filter
state of their own.

**Signed file transfers.** Uploads use the three-call handshake in `useDocumentUpload`: request a
short-lived transfer URL, `PUT` to the API's GridFS transfer endpoint with no credentials and only
the content type, then finalise. Size and type are checked client-side first so the user is told
early.

**No real-time transport.** Unread counts poll `/notifications/unread-count` every 50 seconds.
Nothing else polls, and there is no WebSocket or SSE anywhere.

**Dates.** Date-only values cross the wire as `YYYY-MM-DD`. Everything renders as `29 Jul 2026`
through `Intl.DateTimeFormat` with `Asia/Kolkata` forced — never the ambiguous numeric form.

## Deployment

`npm run build` produces static assets in `dist/`. Serve them from any static host with SPA fallback
rewriting unknown paths to `index.html`.

**The Content-Security-Policy must be set on the static host.** `helmet` runs on the API and cannot
protect a document it does not serve. The policy from `../SECURITY.md` §8 is:

```
default-src 'self';
script-src 'self' 'sha256-<hash of the inline theme script>';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self' <api-origin>;
frame-ancestors 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
```

`index.html` carries one inline script — the pre-paint theme setter. A static host cannot mint a
per-request nonce for a cached document, so allow it by hash instead. Recompute the hash whenever
that script changes:

```bash
node -e "const {createHash}=require('node:crypto');const fs=require('node:fs');const html=fs.readFileSync('dist/index.html','utf8');const m=html.match(/<script>([\s\S]*?)<\/script>/);console.log(\"'sha256-\"+createHash('sha256').update(m[1]).digest('base64')+\"'\")"
```

`style-src 'unsafe-inline'` is required because Radix writes inline positioning styles onto floating
elements. `script-src` has no such allowance.

## The service worker

`vite-plugin-pwa` runs in `registerType: 'prompt'`: a new build never takes over silently. The app
shows an update prompt and reloads only when you accept.

The service worker precaches the application shell and nothing else. It caches no API response, and
`/api` is in the navigation-fallback denylist, so an offline shell never serves stale client data.
There is no offline mutation queue by design.

## Testing

```bash
npm test
```

Vitest with jsdom and React Testing Library. `tests/a11y/smoke.test.tsx` renders every top-level
route through `axe-core` and asserts zero violations. The `color-contrast` rule is switched off
there because jsdom loads no stylesheets and cannot compute contrast; contrast is a design-token
decision, checked against the pairs in `../DESIGN.md` §1.2 rather than at runtime.
