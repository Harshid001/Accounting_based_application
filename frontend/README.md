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
| `VITE_APP_SHELL` | `web` (default: clients only) or `desktop` (admin/staff Tauri shell). |
| `VITE_DESKTOP_DOWNLOAD_URL` | Where staff download the desktop app (web interstitial). |
| `VITE_DESKTOP_UPDATE_URL` | Update manifest URL for the desktop shell's updater. |

Every `VITE_`-prefixed value is compiled into the bundle and is public. No secret may carry that
prefix; the frontend holds no keys of any kind.

The dev server proxies `/api` to the origin of `VITE_API_BASE_URL`, so setting
`VITE_API_BASE_URL=/api/v1` routes every call through the proxy and makes session cookies same-site
in development.

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server (web shell) with HMR on port 5173 |
| `npm run desktop:dev` | Vite dev server in desktop-shell mode (Tauri attaches) |
| `npm run build:web` | Web bundle to static `dist/` — clients only, PWA enabled |
| `npm run build:desktop` | Desktop bundle — staff workspace only, no PWA |
| `npm run preview` | Serves the built output on port 4173 |
| `npm run typecheck` | `tsc --noEmit` over `src`, `tests` and the build configs |
| `npm run lint` | ESLint, zero warnings tolerated |
| `npm run test:web` / `test:desktop` | Vitest in the matching shell mode |
| `npm run verify` | typecheck → lint → both test shells → both builds. The CI contract. |

## Two shells, one codebase (split-surface)

The route tables live in `src/app/routes.web.tsx` (landing, auth client tab,
`/portal/*`) and `src/app/routes.desktop.tsx` (the admin/staff workspace).
`vite.config.ts` aliases `@/app/routes.shell` and `@/app/appshell` to the
right module per `VITE_APP_SHELL` at config time, so the bundler never
traces the other surface: the web bundle contains zero staff route code
and the desktop bundle zero portal route code (CI checks this). Staff who
sign in on the web hit the `/desktop-required` interstitial; clients in
the desktop app are pointed back to the browser.

The Tauri desktop shell lives in `src-tauri/` (Windows-first, WebView2):
Tally bridge to `localhost:9000` only, OS keychain, tray, single-instance
lock, and the workstation agent loop (`src/hooks/useWorkstationAgent.ts`)
that replaced the retired `desktop/agent.mjs` script. See
`docs/DESKTOP_AGENT_RUNBOOK.md` for the release smoke checklist.

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
