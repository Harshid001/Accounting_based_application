# FirmDesk Desktop Companion Agent

The bridge between the FirmDesk cloud and the **real Tally ERP 9 / TallyPrime
application** running on an accountant's machine.

```
FirmDesk cloud (Render)
        ▲  outbound HTTPS only (sign-in cookie, heartbeat, poll, results)
        │
desktop/agent.mjs   ←── this process, on the accountant's Windows PC
        │
        ▼  HTTP XML envelopes on localhost only
Tally ERP 9 / Prime  (port 9000, "Tally acts as: Both" enabled once)
```

The accountant approves a voucher in FirmDesk → staff clicks **Send to Tally**
(or asks the AI agent "Tally me post karo") → the cloud builds the full XML
envelope and queues a command → this agent relays it to Tally within seconds →
**Tally itself creates the real voucher** in the open company → the agent
reports the parsed result back → the voucher shows `tallySync: synced`.

## Requirements

- Windows PC with Tally ERP 9 or TallyPrime, **running**, company open
- In Tally, enable once: *Gateway of Tally → F3 (Company Info) → Settings →
  Client/Server Configurations* → "Tally acts as" = **Both**, port **9000**
- Node.js 22+ (uses built-in `fetch`; zero npm installs)

## Run

```powershell
$env:FIRMDESK_API_URL = "https://your-firmdesk.example.com/api/v1"
$env:FIRMDESK_EMAIL    = "accountant@firm.in"     # optional; prompted if missing
$env:FIRMDESK_PASSWORD = "..."                    # optional; prompted if missing
node agent.mjs
```

The script keeps the session cookie **in memory only** — nothing is written to
disk. Keep it running in a terminal, Task Scheduler entry, or later the Tauri
desktop shell's sidecar (Phase 4 proper).

## What it does

| Loop | Interval | Purpose |
|---|---|---|
| Heartbeat + Tally probe | 60s | Marks the workstation online; reports which Tally company is open (and education mode honestly) |
| Command poll | 10s | Drains the queue: `tally_post`, `tally_import`, `tally_health` |

## Hard rules baked in

- **One-way:** posting flows FirmDesk → Tally; the only read-back is the
  read-only ledger-master import. Nothing ever syncs Tally data over FirmDesk
  books.
- **Localhost only:** Tally's port is never exposed; only this process talks
  to it. The cloud never sees Tally directly.
- **Idempotent:** every posted voucher embeds its FirmDesk id in the XML, so a
  re-send cannot duplicate the voucher in Tally.
- **Honest errors:** unknown Tally ledger, education-mode limits, closed
  company and offline workstations all surface as failures with the real
  Tally `LINEERROR` text — never silent success.

## Security notes

- The session cookie is held in process memory; closing the window logs the
  bridge out.
- An admin can revoke a workstation from FirmDesk (Users & settings); the next
  heartbeat is refused with 403 and queued commands are abandoned.
- Credentials arrive via env vars or an interactive prompt — never argv.
