# FirmDesk Desktop — Workstation Agent Runbook

The legacy `desktop/agent.mjs` Node script has been retired. The FirmDesk
desktop app (Tauri 2) **is** the workstation agent now: register →
heartbeat 60s → command poll 10s → Tally XML on `localhost:9000` → results.

```
FirmDesk cloud (Render)
        ▲  outbound HTTPS only (cookies, heartbeat, poll, results)
        │
FirmDesk Desktop (Tauri, src-tauri/)   ← admin/staff signs in once
        │
        ▼  HTTP XML envelopes on localhost only
Tally ERP 9 / Prime  (port 9000, "Tally acts as: Both" enabled once)
```

## One-time Tally setup (per workstation)

- Windows PC with Tally ERP 9 or TallyPrime, **running**, company open
- In Tally, enable once: *Gateway of Tally → F3 (Company Info) → Settings
  → Client/Server Configurations* → "Tally acts as" = **Both**, port **9000**

## Running the agent

Just sign in to the FirmDesk desktop app as admin/staff. The agent boots
automatically inside the staff workspace (`useWorkstationAgent`):

| Loop | Interval | Purpose |
|---|---|---|
| Heartbeat + Tally probe | 60s | Marks the workstation online; reports the open Tally company (and education mode honestly) |
| Command poll | 10s | Drains the queue: `tally_post`, `tally_import`, `tally_health` |
| Tray update | per beat | Workstation online · Tally reachable · open company |

### Development

```powershell
cd frontend
npm install          # once; includes @tauri-apps/cli
npx tauri dev        # runs `npm run desktop:dev` (desktop-shell Vite) and attaches
```

`npx tauri dev` starts Vite in desktop mode (`VITE_APP_SHELL=desktop`) and
opens the WebView2 shell against it. Rust changes rebuild automatically;
front-end changes hot-reload as usual.

## Hard rules baked in (unchanged from the script era)

- **One-way:** posting flows FirmDesk → Tally; the only read-back is the
  read-only ledger-master import. Nothing ever syncs Tally data over
  FirmDesk books.
- **Localhost only:** Tally's port is never exposed; only the desktop app
  talks to it. The cloud never sees Tally directly.
- **Idempotent:** every posted voucher embeds its FirmDesk id in the XML,
  so a re-send cannot duplicate the voucher in Tally.
- **Honest errors:** unknown Tally ledger, education-mode limits, closed
  company and revoked workstations all surface as failures with the real
  Tally `LINEERROR` text — never silent success.

## Security notes

- The session lives in the WebView2 cookie jar; no password is ever
  written to disk. Phase 2 stores an encrypted session snapshot in the
  OS keychain (Windows Credential Manager) for silent re-auth only.
- **Managed environments (WebView2 third-party cookies):** the session
  cookie is cross-origin (`tauri.localhost` → API origin), so it must be
  classified third-party in the WebView2 profile. Default WebView2
  allows this, but managed machines may set
  `--disable-features=CookiesWithoutSameSiteRequireSecure` style
  policies or block third-party cookies outright. If sign-in loops
  back to the form with no error, check the machine's Edge/WebView2
  cookie policy (`edge://settings/cookies` equivalent) and allow
  third-party cookies for the API origin.
- An admin can revoke a workstation from Settings → Workstations; the
  next heartbeat is refused with 403 and queued commands are abandoned.
- Outdated shells are gated at login via `GET /api/v1/desktop/manifest`
  (`minShellVersion`): below the floor, the app shows a hard update wall.
  The server enforces the same rule on every registration **and
  heartbeat** — a below-min shell gets HTTP 426 `UPGRADE_REQUIRED` and
  the agent stops its loops entirely (it never re-registers through
  the gate).

## Network posture (why no http plugin capability)

The Tauri capability file grants **no** URL scopes to the webview. Two
separate channels exist on purpose:

| Channel | Who | Scope |
|---|---|---|
| API (HTTPS) | The webview's fetch wrapper (`src/api/client.ts`) | The API origin only, with session cookies — same as the browser |
| Tally (XML) | The **Rust** relay commands (`tally_post`, `tally_probe`) | `http://localhost:9000` only, hard-coded in `main.rs` |

No wildcard URL scopes exist at the webview layer; Tally's port is
reachable only through the Rust relay and is never proxied to the
network.

## Updater key ceremony (first signed release)

1. Generate a keypair once (never repeat — new keys orphan old installs):
   `npx @tauri-apps/cli signer generate -w ~/.tauri/firmdesk.key`
2. Store the **private key password** and the private key in GitHub
   encrypted secrets: `TAURI_SIGNING_PRIVATE_KEY`,
   `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (the `desktop-build` CI job
   already wires them).
3. Paste the **public key** into `plugins.updater.pubkey` in
   `src-tauri/tauri.conf.json` and add the signed manifest endpoint
   (`plugins.updater.endpoints` there; `VITE_DESKTOP_UPDATE_URL` /
   `DESKTOP_UPDATE_URL` feed the download-link fallback). Tauri v2 has
   no `updater.active` flag — the plugin is enabled by adding
   `pubkey` + `endpoints`; with `pubkey` empty the in-app updater
   checks fail open (no-op) but builds bundle fine.
4. CI (tauri-action) then produces NSIS installers plus the signed
   `latest.json` update manifest attached to each release. Keys never
   appear in the repo, logs, or the app bundle.

**Until step 3 happens, release builds will FAIL at the bundling
step:** `bundle.createUpdaterArtifacts: true` requires
`TAURI_SIGNING_PRIVATE_KEY` when signing updater artifacts. The CI
`desktop-build` job only runs the full bundle on version tags — do the
key ceremony (steps 1–3) before tagging the first
`firmdesk-desktop-v*` release. Main pushes only compile-check Rust
(`cargo build --release --features custom-protocol`), which needs no
signing env. In the meantime version gating still works through the
backend manifest + 426 wall.

## Manual smoke checklist (per release, spec §9.4)

1. Launch exe → single-instance lock (second launch focuses the first)
2. Sign in (admin tab only) → tray icon visible (app icon) and shows
   "starting…" then heartbeat state
3. SSE automation live feed plays inside the webview
4. Post a voucher → Tally receives it; voucher shows `tallySync: synced`
5. Updater signature check passes on a signed manifest (after the key
   ceremony; before it, verify the update banner/download link instead)
6. Lock Windows (Win+L) → session dies (sign-in screen); unlock → the
   remembered email is pre-filled on the sign-in form
7. Revoke the workstation from a second admin login → this app's session
   dies on its next heartbeat
8. Portable exe (release asset `FirmDesk-<version>-portable-x64.exe`)
   launches without installation — no NSIS, same smoke steps 1–6
