# SPLIT-SURFACE ARCHITECTURE PROMPT — Web-Only Client Portal + Tauri Desktop for Admin/Staff

> This document is a build prompt. Hand it to an implementing agent (or engineer) as the
> authoritative spec for converting FirmDesk from a single web SPA into a split-surface
> product: **clients stay in the browser**, **admin/staff move to a native desktop
> application**, and **both surfaces remain fully connected to-and-fro through the same
> cloud backend**. It extends — and where it conflicts, overrides — §9 of
> `JV_ACCOUNTING_MODULE_PLAN.md`. All file paths reference the real codebase.

---

## 1. Context — verified current state (do not re-discover, verify only)

| Thing | Where | Notes |
|---|---|---|
| Single React 19 + Vite SPA | `frontend/` | NOT Next.js. Tailwind v4, react-query 5, PWA via `vite-plugin-pwa` |
| Route table | `frontend/src/app/router.tsx` | `RoleGate roles={['admin','staff']}` wraps staff workspace; `RoleGate roles={['client']}` + `PortalLayout` wraps `/portal/*`; landing at `/`, `/team` |
| Layouts | `frontend/src/layouts/{AuthLayout,StaffLayout,PortalLayout}.tsx` | StaffLayout serves BOTH admin and staff |
| Auth client | `frontend/src/api/authClient.ts` | better-auth 1.6.25 React client, httpOnly **cookie** sessions, `credentials: 'include'` |
| API fetch wrapper | `frontend/src/api/client.ts` | cookie-based, `credentials: 'include'` |
| Sign-in portal switcher | `frontend/src/routes/auth/SignIn.tsx` | `?portal=client|admin` tab param; legacy aliases `/admin/sign-in`, `/staff/sign-in`, `/portal/sign-in` redirect here |
| Backend | `backend/` | Express 5 + Mongoose + better-auth; API at `/api/v1`, auth at `/api/auth`; helmet strict CSP; CORS allowlist (`CORS_ORIGINS`, no wildcards); SSE for automation live feed |
| Capability table | `backend/src/middleware/permissions.ts` | server authority incl. `desktop:workstation`, `portal:read/write` (client-only) |
| Desktop coordination (ALREADY BUILT) | `backend/src/routes/desktop.routes.ts`, `services/workstation.service.ts`, `models/workstation.model.ts`, `models/desktopCommand.model.ts` | `POST /desktop/workstation/register|ping|results`, `GET /desktop/workstation/commands` (auth'd 10s poll), workstation list/revoke (admin) |
| Tally bridge script (LEGACY, to absorb) | `desktop/agent.mjs` | zero-dep Node 22 script: sign-in → register → heartbeat 60s → poll 10s → XML to Tally `localhost:9000` → post results |
| Env config | `frontend/src/lib/env.ts`, `frontend/.env.example`, `backend/.env.example` | `VITE_API_BASE_URL`, `VITE_APP_NAME`, `CORS_ORIGINS`, `SESSION_COOKIE_*`, `MONGODB_URI` |
| CI | `.github/workflows/ci.yml`, `verify` scripts | typecheck + lint + test + build, Node 22 |

**What does NOT exist yet:** `src-tauri/` (no Tauri/Electron anywhere), `VITE_APP_SHELL`
build flag, shell-aware routing, desktop packaging CI, updater, tray, keychain.

---

## 2. Goal and non-goals

**Goal.** One React codebase, two compiled shells:

1. **FirmDesk Web** (`VITE_APP_SHELL=web`) — deployed as today (static host,
   `jvaccounting.in`, PWA) but serving **clients only**: landing, auth, `/portal/*`.
   Admin/staff sign-in on web gets a "use the desktop app" interstitial with a
   download link.
2. **FirmDesk Desktop** (`VITE_APP_SHELL=desktop`) — **Tauri 2** Windows application
   for admin + staff: the full staff workspace (dashboard, clients, books, tasks,
   compliance, automation monitor, AI copilot, settings) **plus** desktop-only powers:
   Tally bridge, workstation presence, tray, auto-update, OS keychain, auto-lock.

**Both shells hit the SAME cloud backend** (Render, unchanged). The desktop app is a
rich client over the same API — not a new backend, not a fork of the UI.

**Non-goals.**

- Clients never install anything. Client portal remains browser-only (explicit).
- No peer-to-peer channel between desktop and web. All "to-and-fro" flows through
  the backend (see §6).
- No new backend runtime (no WebSockets server, no new service) — reuse REST + SSE.
- No client-portal routes inside the desktop app; no staff routes in the web build.

**Decision override.** Plan doc §16.8 recommended keeping admin/staff web routes. Per
this prompt the split is strict: web = clients. Keep the staff-route code in the
codebase (shared), but the **web build must not serve it**. If remote staff access is
ever needed, ship it behind an off-by-default flag `VITE_WEB_STAFF_ACCESS` — never
enabled in production web builds without an explicit decision.

---

## 3. Hard rules (inviolable)

1. **One codebase, two builds.** UI logic is shared 100%. Shell differences live in
   `src/lib/shell.ts`, route gating, and `src-tauri/`. No forked components.
2. **Backend stays the single source of truth.** Every mutation from either shell goes
   through the existing spine: `requireAuth` → capability/role gates → client scope →
   zod → rate limit → audit. No shell gets a privileged path.
3. **Outbound-only desktop.** The desktop app initiates every connection (REST, SSE,
   command polling). No inbound ports on accountant machines. Tally's `localhost:9000`
   is never proxied to the network.
4. **One-way Tally rule.** FirmDesk → Tally: posting. Tally → FirmDesk: read-only
   import. No sync-back (inherited from the master plan).
5. **Sessions are server-authoritative.** Cookie sessions via better-auth; per-role
   lifetimes, sliding refresh, session revocation apply equally to both shells.
   Desktop adds device registration so a stolen laptop is revocable from admin UI.
6. **Role gating is server-enforced.** The desktop shell hiding client routes is UX
   polish; the server's `portal:*` capabilities remain client-only, `desktop:workstation`
   remains admin/staff-only. A client hitting staff endpoints from any shell → 403.
7. **Version pinning.** Backend advertises a minimum shell version; outdated desktops
   get a hard update gate before sensitive operations (books posting included).
8. **PWA only on web.** Desktop build disables the service worker and manifest
   (asset poisoning + stale caches in a webview are not acceptable).

---

## 4. Target architecture

```
                 ┌──────────────────────── Cloud (Render — unchanged) ────────────────────────┐
                 │  FirmDesk API (Express 5)                       MongoDB (Atlas)             │
                 │  ├─ better-auth (cookie sessions, role lifetimes, device/session revoke)  │
                 │  ├─ Capability middleware + client scope + audit (unchanged)              │
                 │  ├─ Domain: books, compliance, tasks, documents (R2), messages, AI agent   │
                 │  ├─ Portal automation worker (cloud Playwright — unchanged)  + SSE feed   │
                 │  └─ Desktop coordination: workstation registry, command queue, results    │
                 └────────▲───────────────────────────────────────────────▲───────────────────┘
                          │ HTTPS REST + SSE (cookies, cross-origin,       │ HTTPS REST + SSE
                          │  CORS-allowlisted)                            │  (cookies, as today)
        ┌─────────────────┴───────────────────────┐   ┌───────────────────┴─────────────────────┐
        │  FirmDesk DESKTOP — admin + staff      │   │  FirmDesk WEB — clients only            │
        │  Tauri 2 (WebView2), Windows-first     │   │  Static host + PWA (as today)           │
        │  ├─ same React bundle (APP_SHELL=      │   │  ├─ landing `/`, `/team`                │
        │  │  desktop) — staff routes only       │   │  ├─ auth (client tab only)              │
        │  ├─ workstation agent: register →     │   │  ├─ `/portal/*` client workspace        │
        │  │  heartbeat 60s → poll 10s → execute │   │  └─ staff/admin sign-in → interstitial: │
        │  ├─ Tally XML bridge → localhost:9000 │   │     "use the desktop app" + download    │
        │  ├─ tray (online · Tally · company)   │   └─────────────────────────────────────────┘
        │  ├─ OS keychain, auto-lock, updater   │
        │  └─ absorb desktop/agent.mjs duties    │
        └────────────────────────────────────────┘
```

**Command flow (outbound-only, already specced by the backend):**

```
Desktop boots → better-auth sign-in → POST /api/v1/desktop/workstation/register {deviceName}
  → heartbeat ping 60s (freshness 120s) → poll GET /desktop/workstation/commands 10s
Backend/agent/scheduler enqueues {type: tally_post|tally_import|tally_health, clientId, payload}
  → desktop executes XML against localhost:9000 → POST /desktop/workstation/results
  → backend records tallySync + audit → visible on BOTH surfaces
```

---

## 5. Work items

### 5.1 Shell flag + route gating (frontend)

- Add `VITE_APP_SHELL=web|desktop` (default `web`). Extend `frontend/src/lib/env.ts`
  and create `frontend/src/lib/shell.ts`:
  `export const SHELL = env.appShell; export const isDesktop = SHELL === 'desktop';`
- **`router.tsx` gating** (do not duplicate route defs — gate the existing table):
  - desktop build: drop landing (`/`, `/team`) and `/portal/*` + client-only auth
    flows (SignUp, Unlinked); desktop boots to `/sign-in` (admin tab only)
  - web build: keep landing/auth/portal; replace staff/admin routes
    (`/dashboard`, `/clients/*`, `/tasks/*`, `/compliance/*`, `/books/*`, `/settings/*`,
    `/automation`, `/documents`, `/requests`, `/messages`, `/reports/*`) with a single
    `<StaffDesktopRequired />` interstitial route; legacy `/admin/sign-in` +
    `/staff/sign-in` aliases land there too
- `SignIn.tsx`: render only the client portal tab in web; only admin/staff tab in
  desktop. Same for `?portal=` handling.
- Post-auth redirect logic (`SessionContext` / `ProtectedRoute`): in web shell, an
  `admin|staff` session → `/desktop-required`; in desktop shell, a `client` session →
  "clients use the web portal" screen + sign-out. Server still rejects the wrong
  capabilities regardless of shell (rule 6).
- `vite.config.ts`: make `VitePWA` conditional — enabled only when `VITE_APP_SHELL=web`
  (rule 8). Desktop build: plain SPA bundle.
- `.env.example`: `VITE_APP_SHELL=web`, `VITE_DESKTOP_UPDATE_URL=` (desktop only).
- `package.json`: `build:web` (default) and `build:desktop`
  (`cross-env VITE_APP_SHELL=desktop vite build`), plus `desktop:dev` (Vite dev server
  with `VITE_APP_SHELL=desktop` while Tauri attaches).

### 5.2 Tauri 2 scaffold (new `frontend/src-tauri/`)

- Tauri 2, Windows-first (WebView2). `tauri.conf.json` v2: `devUrl` → Vite dev server,
  `frontendDist` → `../dist`, app identifier e.g. `in.jvaccounting.firmdesk`.
- Capabilities/permissions (`src-tauri/capabilities/`): core defaults + updater +
  tray + http (ONLY to the API origin and `http://localhost:9000` — enumerate both in
  the allowlist; deny everything else).
- Rust commands (`src-tauri/src/`), exposed via `invoke` from a new
  `frontend/src/lib/desktopBridge.ts` (typed, single module — the ONLY place allowed
  to call `window.__TAURI__`):
  - `tally_post(xml) -> TallyResult` / `tally_probe() -> TallyHealth`
    (port the request/response logic from `desktop/agent.mjs`; the Node script is
    retired once the Tauri side is proven)
  - `keychain_set(key, value)` / `keychain_get(key)` / `keychain_delete(key)`
    (Windows Credential Manager)
  - `lock_now()` / OS-lock event → auto-logout (rule: auto-logout on OS lock)
  - `app_info()` → version, device info for the workstation registration payload
- Tray (menu bar): FirmDesk logo + three indicators — workstation online, Tally
  reachable, company open — fed by heartbeat results; click → show/restore window.
- Single-instance lock (second launch focuses the running app).
- **Absorb `desktop/agent.mjs`**: the Tauri app IS the workstation agent. The poller
  runs in the webview (TypeScript, using the existing `api/client.ts` fetch wrapper —
  cookies attach automatically) and executes Tally commands via the Rust bridge.
  Delete `desktop/` after parity is verified (keep the README's runbook content in
  `docs/`).

### 5.3 Auth & session wiring (both shells, one backend)

- **Desktop phase 1 (parity):** keep cookie sessions — the WebView2 cookie jar works
  cross-origin once the backend allowlists the Tauri origin. Add to backend env:
  `CORS_ORIGINS=http://tauri.localhost,https://jvaccounting.in,...` (Windows Tauri 2
  serves the app from `http://tauri.localhost`; verify on the target and add the
  macOS variant `tauri://localhost` only if/when a macOS build exists).
- better-auth `trustedOrigins` (in `backend/src/config/auth.ts`) must include the same
  Tauri origin (auth cookies + CSRF origin checks).
- Ensure session cookies are `SameSite=None; Secure` in production (they must already
  be, since the web build is cross-origin today — verify, don't assume) and that the
  desktop webview is NOT blocked from third-party cookies (WebView2 default allows;
  document the flag for managed environments).
- **Desktop phase 2 (hardening):** persist an encrypted session snapshot via
  `keychain_set` on graceful exit; on boot, restore → silent re-auth or fresh
  sign-in. Never store the raw password. Investigate better-auth's bearer-token
  option in the phase spike; if it cleanly replaces cookie-jar snapshot, prefer it.
- SSE (automation live feed): `EventSource` from the Tauri origin must send cookies —
  if the browser API won't, stream via the credentialed `fetch` wrapper instead
  (readable stream) — one module, `src/api/sse.ts`, shared by both shells.
- Device registration on every desktop sign-in (workstation `register` already
  exists); admin Users/Settings screen gains the workstation list + revoke
  (backend already exposes list/delete — wire the UI).

### 5.4 Backend wiring (small, additive)

- `GET /api/v1/health` (or a new `GET /api/v1/desktop/manifest`) returns
  `minShellVersion` + `latestShellVersion` + update URL. Enforce at desktop login:
  below `minShellVersion` → hard "update required" gate (rule 7). Env:
  `DESKTOP_MIN_SHELL_VERSION` in backend config.
- No other backend changes are required for coordination — the workstation/command
  endpoints, capability gating, and audit already exist. New work is: the version
  manifest, CORS/trustedOrigins entries, and tests.
- Rate limits: give the 10s command poll a dedicated bucket (it's a steady 2 req/
  window per workstation per user — ensure the global limiter doesn't 429 it).

### 5.5 Packaging, updates, CI

- GitHub Actions job `desktop` (windows-latest, Node 22 + Rust + Tauri action):
  `npm run build:desktop` → `tauri build` → **NSIS installer + portable exe**,
  published to GitHub Releases (or the existing static host) with **Tauri updater
  signed manifests** (key ceremony documented in the repo wiki; key never in CI
  secrets as plaintext — use GitHub encrypted secrets).
- Auto-update: Tauri updater plugin, channel `stable` (optional `beta`), check on
  launch + daily. Updates mandatory past a grace window before sensitive ops
  (rule 7).
- Existing `verify` must gain a shell matrix: `VITE_APP_SHELL=web` AND `desktop`
  typecheck/lint/test/build both.
- Web deploy pipeline unchanged (client-only bundle is smaller — landing + portal).

### 5.6 Desktop-only UI affordances (inside StaffLayout, shell-gated)

- **Tally status card** (tray + in-app): workstation online/offline, Tally reachable,
  company open, education-mode warnings — data from heartbeat results via react-query.
- **Workstations admin page** (admin-only): device list, last-seen, revoke session.
- **Update banner** when `latestShellVersion > current`.
- These render `null` in the web build (they're inside admin/staff routes anyway).

---

## 6. To-and-fro connectivity matrix (every cross-surface flow)

All flows are backend-mediated — one database, one audit trail. "Web" = client user in
browser; "Desktop" = admin/staff in the Tauri app.

| # | Flow | Path through the backend |
|---|---|---|
| 1 | Client uploads document (web) → staff sees it (desktop) | `POST /documents` (R2 presigned) → documents queue on desktop via react-query + notification |
| 2 | Staff creates task/request (desktop) → client sees it (web) | `POST /tasks` / `document-requests` → `/portal/*` reads (client capability + `X-Active-Client` scope) |
| 3 | Messages both ways | `messages` routes (existing); both surfaces poll/invalidate via react-query |
| 4 | Staff posts voucher (desktop) → client read-only ledger (web, phase 6) | books routes → portal ledger view (client-scoped, read-only) |
| 5 | Admin/staff triggers Tally post (desktop) → executes locally → synced state visible everywhere | command queue: enqueue server-side → desktop polls → `localhost:9000` → `POST results` → `tallySync` + audit → books UI on desktop, ledger on web |
| 6 | Automation run live feed (desktop) + status (web) | SSE from automation worker (same endpoint both shells; client portal shows outcome/status only) |
| 7 | Notifications fan-out | existing `notifications` routes + jobs; both surfaces subscribe |
| 8 | Admin revokes a workstation (desktop/web admin UI) → that desktop's session dies | existing workstation delete + better-auth session revoke |

**Negative rule:** no flow may be added that lets one shell write directly into the
other. Every feature = API route first, then both shells read/write it.

---

## 7. API surface (existing — nothing new except the manifest)

```
Auth:              /api/auth/*          (better-auth, cookies)
Portal (client):   /api/v1/portal/*      (capability 'portal:*' — client only)
Staff workspace:   /api/v1/{clients,tasks,compliance,books,documents,messages,...}
Desktop coord:     POST /api/v1/desktop/workstation/register | ping | results
                   GET  /api/v1/desktop/workstation/commands   (auth'd poll, 10s)
                   GET/DELETE /api/v1/desktop/workstations     (admin: list/revoke)
NEW:              GET  /api/v1/desktop/manifest                (min/latest shell version)
Tally:            GET /api/v1/books/tally/status, POST /books/tally/post,
                   POST /books/tally/import-accounts            (enqueue desktop commands)
```

---

## 8. Security & compliance checklist

- [ ] Tauri http capability allowlist: API origin + `http://localhost:9000` ONLY; no wildcards
- [ ] `CORS_ORIGINS` + better-auth `trustedOrigins` include the Tauri origin; cookies `SameSite=None; Secure` in prod
- [ ] No credential/password persistence anywhere; keychain stores session snapshot only (phase 2), encrypted
- [ ] Auto-logout on OS lock; audit event on shell login (which shell, which workstation)
- [ ] Device registry + revocation wired into admin UI; revoking kills the session server-side
- [ ] Command poll rate-limit bucket sized for 1 workstation × 10s; commands remain scoped to the workstation's user capabilities
- [ ] Version gate: `minShellVersion` enforced at desktop login; sensitive ops blocked on outdated shells
- [ ] Web build contains zero staff/admin route code (verify via bundle inspection in CI)
- [ ] PWA/service worker absent from the desktop build
- [ ] Existing human-only gates (OTP/CAPTCHA/password/typed FILE) untouched by both shells
- [ ] Tally port never proxied; one-way Tally rule enforced in services (no new sync-back path)
- [ ] Signed updater manifests; update keys documented; CI never logs them

---

## 9. Testing strategy

1. **Route gating unit tests** (vitest, both shells): desktop render hides `/portal/*`
   and landing; web render replaces staff routes with the interstitial; wrong-role
   sign-ins route to the correct guidance screen. Extend `tests/routes/portalIsolation.test.tsx` patterns.
2. **Backend integration** (mongodb-memory-server, existing harness):
   - command queue round trip: enqueue → poll (as workstation user) → result → `tallySync` recorded + audit (spec §13.5 of the plan)
   - capability isolation: client token → `desktop/*` = 403; staff → `portal/*` = 403 (mirror existing patterns)
   - version manifest: below-min shell version → 426/upgrade-required at login
3. **Tally mock**: in-repo mock Tally XML fixture server (envelope protocol + error +
   education-mode responses) → deterministic desktop-bridge tests in CI (no real Tally).
4. **Tauri smoke** (manual checklist per release): launch → sign-in → tray indicators →
   Tally post against mock → updater signature check → OS-lock auto-logout → revoke
   workstation from a second admin login kills the app session.
5. **E2E (web)**: client uploads → (desktop stub acts as staff) → task visible to client.
6. **`npm run verify`** must pass in `web` AND `desktop` shell modes in CI.

---

## 10. Phased delivery

| Phase | Scope | Exit criteria |
|---|---|---|
| **D1. Shell flag + route gating** | `VITE_APP_SHELL`, `shell.ts`, router gating, SignIn tabs, interstitials, PWA conditional, build scripts, verify matrix | Web build has zero staff routes in the bundle; desktop build has zero portal routes; all tests green in both modes |
| **D2. Tauri scaffold** | `src-tauri/`, `desktopBridge.ts`, dev flow, single instance, tray skeleton, http allowlist, CORS/trustedOrigins on backend | Admin signs into the exe; full staff workspace works; SSE live feed plays inside the webview |
| **D3. Workstation agent absorbs `agent.mjs`** | register/heartbeat/poller in-app, Tally Rust commands, mock-Tally CI tests, presence UI, admin workstation list + revoke, rate-limit bucket | Command round-trip green in CI against mock Tally; workstation online in admin UI; revoke kills the session |
| **D4. Hardening + packaging** | keychain session snapshot, OS-lock auto-logout, version manifest + login gate, NSIS + portable exe, signed updater, `desktop` CI job, release channel | Signed installer auto-updates a test machine; outdated shell gets the update gate; `desktop/` folder deleted |
| **D5. (later, per demand)** | DSC PKCS#11 signing, local automation runner — per plan §9.5 | A DSC filing completes via the desktop runner |

---

## 11. Verification commands (run all, both shells)

```
frontend: npm run verify            # with VITE_APP_SHELL=web
frontend: VITE_APP_SHELL=desktop npm run verify
backend:  npm run verify            # + new desktop tests
CI:      verify (web+desktop matrix), desktop build job (windows-latest)
Manual:  Tauri smoke checklist (§9.4), real-Tally smoke on a dev machine
```

---

## 12. What success looks like

A client opens `jvaccounting.in` in any browser and gets the full client portal —
unchanged. An accountant opens the FirmDesk exe on Windows, signs in once, and gets
the entire admin/staff workspace plus the Tally bridge, with the tray showing that
Tally is alive. A document the client uploads in the browser appears in the desktop
app; a voucher the accountant posts from the desktop appears in the client's web
ledger. Both see the same truth, because both speak to the same API, and every action
is scoped, rate-limited, and audited exactly as it is today.
