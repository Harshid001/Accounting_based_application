# Implementation Plan: JV Accounting Module ("FirmDesk Books") + Tally Mix + Split-Surface (Desktop/Web) Strategy

Companion to `PORTAL_AUTOMATION_AGENT_PLAN.md` (browser automation — built) and `AI_AGENT_INTELLIGENCE_PLAN.md` (agent layer — built). This plan covers the next three layers:

1. **Books** — a double-entry JV accounting engine inside FirmDesk (agent-native bookkeeping)
2. **Tally mix** — the same JV engine posts to clients' existing Tally ERP 9 / Prime companies via the desktop app
3. **Split-surface architecture** — admin/staff get a native desktop application; clients stay browser-only

---

## 0. The Architectural Change (locked in for this plan)

| Surface | Platform | Rationale |
|---|---|---|
| **Client portal** | **Browser only** (current web app — unchanged) | Clients never install anything: upload docs, chat, see filing status, read-only ledger views |
| **Admin / staff** | **Desktop application** (Windows exe — Tauri) | Native powers the web cannot offer: direct Tally XML access (`localhost:9000`), DSC USB-token signing, bulk local file imports, machine-level automation control |

Strategic consequences of this split:

- The master plan's open item — *"local companion app required for DSC (USB-token) signatures"* — is **solved by the desktop app itself**. No second companion tool to maintain.
- The Tally bridge problem (*"Tally runs on the accountant's machine, our backend runs on Render"*) is **solved by the same desktop app** — it talks to Tally directly over `localhost:9000`. No tunnels, no port-forwarding, no exposure of Tally's unauthenticated port to the network.
- The web app remains the **single shared React codebase** compiled into two shells (browser + desktop). Nothing is thrown away; admin/staff web routes stay available during and after transition (same code, near-zero cost) for remote work scenarios.
- The cloud backend stays the **single source of truth** (books, filings, automation runs, audit). The desktop app is a rich client over the same API — not a new backend.

---

## 1. Goal

The accountant's full working day inside one agent-driven product:

```
Client docs upload → agent drafts JVs from invoices/bills → human approves
        → post to FirmDesk Books (native) and/or the client's Tally (bridge)
        → ledgers update → GSTR-1/3B computed directly from the books
        → browser automation files on the portal → ARN write-back → period lock
```

Today `filingPreparation` computes returns from *uploaded documents* (approximate). With real double-entry books, return computation becomes *exact* and fully auditable — the books become the data layer the agent already knows how to operate.

---

## 2. Current State (reuse, don't rebuild)

| Capability | Location | Status |
|---|---|---|
| Mongoose models + zod validators + client-scope middleware + role gates + rate limits + audit logging | `backend/src/models/*`, `middleware/*`, `lib/*` | Done — extend for Books |
| Return preparation pipeline (`computed`, `missingInputs`, `portalPayload`, guide steps) | `backend/src/services/filingPreparation.service.ts` | Done — gains a `source: 'books'` path |
| Tool-calling AI agent (55 tools, decision ladder, monitoring intents, human-only gates) | `backend/src/services/aiAgent.service.ts` | Done — gains ~12 bookkeeping tools |
| Supervised browser automation (recipes, handoffs, sessions, evidence) | `backend/src/services/portalAutomation/*` | Done — untouched by this plan |
| Job infrastructure (cron, locks, run records) | `backend/src/jobs/`, `jobRun` model | Done — period-lock reminders, TB snapshots |
| Frontend route-folder pattern (React + Vite) | `frontend/src/routes/*` | Done — new `books/` folder + shell mode |
| Desktop shell, Books engine, Tally XML engine | — | **NEW — this plan** |

---

## 3. Core Design Principles

1. **The JV engine is the brain; Tally is one posting target.** Every client has a `booksMode`:
   - `native` — books live in FirmDesk (cloud)
   - `tally` — client keeps Tally as the legal books; FirmDesk holds drafts/returns data, posts approved vouchers into Tally
   - `hybrid` — native books + mirrored posting to Tally during migration
   Filing computation always runs on FirmDesk's normalized voucher data — whichever mode.
2. **Agent drafts, human approves, posting is explicit.** The agent freely drafts vouchers from documents; posting (making a voucher immutable) requires the user's explicit instruction; period locks and account deletion are typed-confirm, admin-only.
3. **One-way Tally rule (forever).** FirmDesk → Tally: voucher posting. Tally → FirmDesk: read-only import (accounts, opening balances). **No two-way sync** — bidirectional sync is a conflict-resolution nightmare we never sign up for.
4. **Money is integer paise.** No floats. `debit`/`credit`/`taxableValue` stored as integer paise; every balance check is exact.
5. **Posted vouchers are immutable.** Corrections happen via reversal vouchers (storno), never edits — audit-clean and agent-explainable ("yeh voucher galat tha, iska reversal bana diya").
6. **Everything through the existing spine.** Every new route: requireAuth + client scope + role gates + zod + rate limit + audit. Every new agent tool joins the existing `TOOLS` registry and inherits scope/audit. Human-only gates (OTP/CAPTCHA/password/typed FILE) remain absolute and untouched.
7. **Desktop is a shell, not a fork.** Same React codebase, `VITE_APP_SHELL=web|desktop` build flag. Desktop adds a Rust sidecar (Tally/DSC/updates) — UI logic is shared 100%.

---

## 4. Target Architecture

```
┌────────────────────────── Cloud (Render — unchanged) ──────────────────────────┐
│  Backend API (Express)                                                           │
│  ├─ Auth (better-auth), client scope, audit, jobs (cron)                        │
│  ├─ Books engine: accounts, vouchers, invariants, period locks, ledgers, TB     │
│  ├─ Filing preparation: source = 'books' (new) | 'documents' (existing)          │
│  ├─ Portal automation worker (cloud Playwright — unchanged for now)             │
│  └─ Desktop coordination: workstation registry, command queue, results          │
│  MongoDB (books are the source of truth; daily snapshots + lock exports)        │
└──────────────────────────────────────────────────────────────────────────────────┘
        ▲ HTTPS (REST + SSE)                    ▲ HTTPS (browser)
        │ outbound-only                         │
┌───────┴───────────────────────────┐   ┌───────┴─────────────────────┐
│  FirmDesk Desktop (admin/staff)   │   │  Client Portal (web-only)   │
│  Tauri 2 + shared React UI        │   │  Same web app as today      │
│  ├─ Auth token in OS keychain     │   │  ├─ document upload          │
│  ├─ Tally XML engine → :9000      │   │  ├─ messages / status        │
│  ├─ Command poller (10s)          │   │  └─ read-only ledger view    │
│  ├─ (P7) DSC PKCS#11 signing      │   │     (new, phase 6)           │
│  └─ (P7) local automation runner  │   └─────────────────────────────┘
└───────────────────────────────────┘
```

**Workstation command flow (outbound-only — no inbound ports on the accountant's machine):**

```
Desktop boots → login → POST /desktop/workstation/register {userId, deviceName}
  → heartbeat ping every 60s (freshness window 120s)
  → polls GET /desktop/workstation/commands every 10s
Backend enqueues command (agent tool or scheduled job):
  {type: 'tally_post' | 'tally_import' | 'tally_health', clientId, payload}
  → desktop executes against localhost:9000 → POST /desktop/workstation/results
  → backend records tallySync on the vouchers + audit
```

---

## 5. Books Module Detail

### 5.1 Data models (new)

```ts
Account {
  clientId, code, name,            // "1001", "Cash in Hand"
  type: 'asset'|'liability'|'equity'|'income'|'expense',
  subType?: 'bank'|'cash'|'debtor'|'creditor'|'gst_output'|'gst_input'|
            'tds_payable'|'tds_receivable'|'rounding'|'retained_earnings',
  parentId?,                        // grouping
  party?: { gstin?, pan? },        // for debtor/creditor accounts
  openingBalance: { paise: number, asOf: Date, isDebit: boolean },
  isActive, isSystem,              // system duty accounts are auto-created
}

JournalVoucher {
  clientId, voucherNo,             // "JV/2026-27/00042" — per client, per FY sequence
  date, type: 'journal'|'sales'|'purchase'|'payment'|'receipt'|'contra'|
              'debit_note'|'credit_note',
  narration?, reference?,
  status: 'draft'|'posted'|'reversed'|'locked',
  source: 'manual'|'agent'|'bank_import'|'reversal',
  lines: [{
    accountId,
    debitPaise?, creditPaise?,     // exactly one non-zero (enforced)
    description?,
    tax?: {                         // present on base lines of sales/purchase/dn/cn
      gstRatePct, hsnSac?, taxablePaise,
      placeOfSupply?,               // state code
      tdsSection?, tdsRatePct?,     // for expense/JV lines
    },
    isDerived?: boolean,            // engine-materialised duty/rounding lines
  }],
  derived?: { outputTaxPaise?, inputTaxPaise?, tdsPaise? },   // computed at post
  tallySync?: { status, voucherRef?, syncedAt?, error? },      // booksMode: tally
  postedBy?, postedAt?, approvedBy?, reversalOf?, lockedAt?,
}

PeriodLock { clientId, period: 'YYYY-MM'|'2026-27',            // month or FY close
             lockedAt, lockedBy, kind: 'monthly'|'fy' }
```

`Client` model gains: `booksMode: 'native'|'tally'|'hybrid'` (default `native`), `tallyConfig?: { companyName, erp: 'erp9'|'prime', workstationHint? }`, `financialYearStart` (default `04-01`).

### 5.2 Double-entry invariants (service-enforced, unit-tested)

1. `Σ debitPaise === Σ creditPaise` per voucher — exact integer equality.
2. Every line: `debit XOR credit` (exactly one non-zero).
3. `voucherNo` strict sequence per client per FY; gaps impossible.
4. No posting into a locked period (service layer, not just UI).
5. Posted vouchers immutable — API rejects edits; corrections via reversal voucher only.
6. Amounts ≥ 0 per side (sign lives in debit/credit choice, never in magnitude).

### 5.3 Voucher lifecycle

```
draft ──(explicit "post" instruction)──→ posted ──(reversal voucher)──→ reversed
   │                                          ──(period lock)──→ locked
   └─ editable, deletable (admin), agent drafts land here
```

### 5.4 Tax metadata + derived duty lines (the agent-friendliness win)

Unlike Tally (where the accountant must manually add output-tax ledger lines), our base line carries `tax{}` and the **engine materialises derived lines at post time** into system duty accounts (`gst_output`, `gst_input`, `tds_payable`, `rounding`), marked `isDerived`. Result: a sales voucher needs *one* line from the agent, yet the trial balance and GST computes see the full double-entry truth. (Alternative considered: Tally-style explicit duty lines — rejected for phase 1; see Decisions #3.)

### 5.5 Reports (phase 1: core three; P&L/B/S in phase 6)

- **Day Book** — vouchers by date
- **Ledger** (account statement with running balance) — index `(clientId, lines.accountId, date)`
- **Trial Balance** as-of date — group totals by account type
- Phase 6: P&L + Balance Sheet (account-type mapping), CSV/Excel export per period (the lock artifact — accountants keep these as legal records)

### 5.6 Period locks

- Monthly lock after the corresponding return is filed (automation write-back can offer "lock period?" on success)
- FY close lock (Apr 1 next FY) — blocks all posting into the FY
- Locking is admin-only, typed-confirm (`LOCK 2026-09`), audited

---

## 6. Filing Compute from Books

`filingPreparation.service` gains `source: 'books' | 'documents'` resolution:

- `booksMode: native|hybrid` **and** vouchers exist in the period → `source: 'books'`
  - **GSTR-1**: sales/debit-note lines → B2B by party GSTIN + rate-wise tables; credit notes → CDNR; export/nil-rated lines flagged for the right tables
  - **GSTR-3B**: 3.1(a-d) from outward summaries; 4(A) ITC from purchase-line derived input tax; 5 purchases from unregistered; payable = output − ITC (matches ledgers exactly — books ARE the proof)
- otherwise → existing document-based path (unchanged fallback)

Public contract (`computed`, `missingInputs`, `portalPayload`) is unchanged → **portal-automation recipes, runner UI, and agent ladder need zero changes.** `missingInputs` now says things like "no purchase vouchers recorded for September — record purchases or upload bills".

---

## 7. AI Agent Integration (new tools)

Join the `TOOLS` registry in `aiAgent.service.ts`; inherit scope/audit/zod. ~12 tools:

| Tool | Args | Behavior | Gate |
|---|---|---|---|
| `list_accounts` | clientId, q?, type? | chart of accounts search | — |
| `create_account` | clientId, code, name, type, subType?, gstin? | master create (auto in native mode) | — |
| `draft_journal_voucher` | clientId, lines[], narration, date?, type? | creates **draft** | none — drafts are free |
| `post_journal_voucher` | voucherId | draft → posted (immutable) | **explicit user instruction**; period locks enforced; audit |
| `reverse_voucher` | voucherId, reason | creates reversal **draft** | explicit instruction |
| `search_vouchers` / `get_voucher` | filters / id | day-book style queries | — |
| `get_ledger` | clientId, accountId, from, to | entries + running balance | — |
| `get_trial_balance` | clientId, asOf | TB with group totals | — |
| `get_books_status` | clientId | booksMode, voucher counts, locks, tally target health | — |
| `check_tally_connection` | clientId | workstation freshness (<120s) + Tally reachable | — |
| `post_to_tally` | clientId, voucherIds[] (cap 20) | enqueue `tally_post` command → desktop → `:9000` | explicit instruction **and** workstation online |
| `import_tally_accounts` | clientId | read-only import of Tally ledgers/opening balances | explicit instruction (creates accounts) |

**Prompt ladder addition (books requests):**

```
BOOKKEEPING LADDER:
1. Resolve client (existing rules).
2. Ambiguity in account/party/amount/date → ask ONE question; never guess a rupee figure.
3. Create drafts freely (draft_journal_voucher); summarise lines as a table in chat.
4. Post ONLY on explicit instruction ("post karo"); before posting, restate voucher no,
   date, total, and effect in one line. Refuse to post into locked periods — say so.
5. Books-mode honesty: booksMode 'tally' → offer post_to_tally, never claim native
   ledgers; 'native' → never claim Tally sync.
6. Filing requests with native books → note that compute now uses the books.
```

Human-only gates unchanged: the agent still never supplies OTP/CAPTCHA/password/typed-FILE, and posting stays instruction-gated (reversible via reversal, hence no typed confirm — see Decisions #6).

---

## 8. Tally Integration (the "mix")

### 8.1 Posting targets per client

| booksMode | Draft lives in | Posting target | Filing compute |
|---|---|---|---|
| `native` | FirmDesk Books | FirmDesk Books (MongoDB) | from books |
| `tally` | FirmDesk (drafts) | **Tally company** via desktop XML post | from normalized draft data |
| `hybrid` | FirmDesk Books | Books + mirror post to Tally | from books |

### 8.2 XML protocol (Tally's sanctioned integration channel — no UI automation, ever)

Tally ERP 9 / Prime run an HTTP XML server on `localhost:9000` (Gateway → Settings). Requests are `<ENVELOPE>` documents:

```xml
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY><IMPORTDATA>
    <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME>
      <STATICVARIABLES><SVCURRENTCOMPANY>Sharma Traders</SVCURRENTCOMPANY></STATICVARIABLES>
    </REQUESTDESC>
    <REQUESTDATA><TALLYMESSAGE>
      <VOUCHER VTYPE="Journal" ACTION="Create">
        <DATE>20260909</DATE>            <!-- YYYYMMDD -->
        <NARRATION>…</NARRATION>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Sales</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-100000.00</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        <!-- …credit entries… -->
      </VOUCHER>
    </TALLYMESSAGE></REQUESTDATA>
  </IMPORTDATA></BODY>
</ENVELOPE>
```

- **Post voucher**: Import Data / Vouchers (ERP 9 and Prime share the core envelope; Prime adds `REMOTEID` etc. — the `erp: 'erp9'|'prime'` adapter flag handles both; exact envelopes verified against the installed version in the phase-5 spike)
- **Import accounts/opening**: Export Data / "List of Accounts" + "Trial Balance" report XML → parse → `import_tally_accounts`
- **Health**: a lightweight Export Data ping → "company open? education-mode restrictions?"
- Education mode (1st/2nd-of-month date limits) is detected and reported honestly by `check_tally_connection`

### 8.3 Hard rules

- **One-way**: FirmDesk → Tally (post); Tally → FirmDesk (read-only import). Never both for the same field.
- `tallySync.status` recorded per voucher with Tally's voucher reference — idempotent re-post protection.
- The desktop app binds to `localhost` only; Tally's port is never proxied to the network.
- Party-name matching on import maps to our `Account`s by exact-then-fuzzy name with human confirmation of ambiguous mappings (never auto-guess a ledger mapping).

---

## 9. Desktop App (admin/staff surface)

### 9.1 Tauri 2 (recommended over Electron)

| | Tauri 2 | Electron |
|---|---|---|
| Installer size | ~10–15 MB | ~150 MB |
| Webview | system WebView2 (Windows) | bundles Chromium |
| Sidecar model | native (Rust) | Node process |
| Auto-update | signed manifests, built-in | electron-updater |

Caveat noted honestly: if phase 7 bundles local Playwright browsers (~150 MB), the size gap narrows — Tauri still wins. Windows is the primary target (Tally/DSC are Windows realities); macOS/Linux shells compile later from the same source if ever needed.

### 9.2 Shell strategy (shared code, two builds)

- `frontend/` gains `VITE_APP_SHELL=web|desktop`; desktop build **hides client-portal routes**, adds a Tally status tray indicator (workstation online, Tally reachable, company open), device info, and update UI
- The automation **runner UI (SSE live feed + handoff modals) works unchanged inside the Tauri webview** — cloud Playwright keeps doing the filing for now
- Desktop-only affordances appear only in the desktop shell (Tally pages, later DSC)

### 9.3 Auth & security on desktop

- Login through the same better-auth API; **token stored in OS keychain** (never localStorage — a real security upgrade over the browser shell)
- Device registration + admin-visible device list (revoke a stolen laptop's session)
- Outbound-only communication (REST + SSE + command polling) — nothing to firewall
- Auto-logout on OS lock; audit events for shell login

### 9.4 Packaging & updates

- CI (GitHub Actions): Windows build → NSIS installer + portable exe; Tauri updater with **signed manifests** (update key ceremony documented; updates are mandatory before sensitive operations past a grace window)
- Version pinning: backend advertises a minimum shell version; outdated shells get a hard "update required" gate (books posting included) — avoids old-client invariant drift

### 9.5 Phase 7 (later, same shell): DSC + local automation

- **DSC signing**: PKCS#11 against USB tokens (eMudhra/SafeEx/etc.) — enables DSC filing flows the master plan deferred; also enables e-invoice IRN signing later
- **Local automation runner**: move portal automation from cloud Playwright to the desktop shell (DSC + CAPTCHA locality). Cloud worker stays as fallback until desktop runner is proven; interface already worker-swappable per master plan §4

---

## 10. Client Portal (web-only — unchanged, plus one addition)

- Everything as today: uploads, messages, filing status, OTP-less read-mostly UX
- **New (phase 6): read-only ledger statement + invoice/voucher PDF views** per period (client sees their own books/accounts-receivable status) — generated from Books, watermarked "unaudited"
- Clients never need the desktop app — explicit non-goal to require any install from clients

---

## 11. API Surface (all `/api/v1`, existing middleware spine)

```
Books:
GET/POST    /books/accounts            PATCH /books/accounts/:id
GET/POST    /books/vouchers            GET  /books/vouchers/:id
POST        /books/vouchers/:id/post        (role: admin|staff; explicit)
POST        /books/vouchers/:id/reverse    (creates reversal draft)
GET         /books/ledger | /books/trial-balance | /books/day-book
POST        /books/periods/:period/lock     (admin, typed confirm)
GET         /books/export?period=…          (csv/zip lock artifact)

Tally (desktop-routed):
GET         /books/tally/status          POST /books/tally/post
POST        /books/tally/import-accounts

Desktop coordination:
POST /desktop/workstation/register | ping | results
GET  /desktop/workstation/commands        (auth'd poll)
```

Zod validators (`books.validators.ts`), rate limits, client scope (staff→assigned clients; 404 outsiders), audit on post/reverse/lock/tally-post — mirroring `governmentGateway`/`automation` test patterns exactly.

---

## 12. Security & Compliance Checklist

- [ ] Tally port 9000: localhost-bound in the desktop app; never proxied; CSP blocks external calls
- [ ] Desktop↔cloud: outbound HTTPS only; no inbound ports on accountant machines
- [ ] Auth token in OS keychain; device registry + revocation UI; audit on shell login
- [ ] Posted-voucher immutability + reversal-only corrections (service-enforced)
- [ ] Period locks enforced server-side; lock/export artifact retained per firm policy
- [ ] Money as integer paise; all invariants unit-tested to be un-bypassable via API
- [ ] Agent: drafts free, posting instruction-gated, never guesses amounts, books-mode honesty in prompt; existing human-only gates (OTP/CAPTCHA/FILE) untouched
- [ ] Tally one-way rule enforced in the service layer (no sync-back path exists)
- [ ] Client ledger views read-only + scoped (client sees own clientId only)
- [ ] Books are legal records: daily Mongo snapshots + per-period exports; deletion of posted data impossible by design

---

## 13. Testing Strategy

1. **Unit (invariants)**: unbalanced voucher rejected; debit-XOR-credit; paise math; voucherNo sequence under concurrent posts; period-lock enforcement; reversal nets to zero.
2. **Integration**: agent tools with scope enforcement (staff/outside-client → 404); draft→post→reverse flows; filing compute `source: 'books'` resolves correctly per booksMode.
3. **Golden GST fixtures**: seeded books (given invoice set) → `portalPayload` must equal golden GSTR-1/3B numbers exactly — the books-vs-returns consistency proof (extend `filingPreparation.test.ts` patterns).
4. **Tally**: in-repo **mock Tally XML fixture server** (Express route speaking the envelope protocol, incl. error/education-mode responses) → desktop bridge integration tests deterministic in CI; real-Tally smoke manual on a dev machine during the spike.
5. **Desktop**: Tauri smoke (launch, login via keychain, Tally tray indicator, updater signature check skipped in CI — manual); command-queue integration tests backend-side (enqueue → poll → result → tallySync recorded).
6. **E2E**: books → prepare → fixture-portal file → lock — one flow test in the existing automation harness.

---

## 14. Phased Delivery

| Phase | Scope | Duration | Exit criteria |
|---|---|---|---|
| **1. Books core** | Models, invariant engine, period locks, routes+validators, admin UI (accounts, day book, voucher entry, ledger, TB) for `native` mode | 3 wks | A month of vouchers entered in UI; TB balances; lock blocks posting |
| **2. Agent bookkeeping** | 12 tools + prompt BOOKKEEPING LADDER + chat flows ("invoiced se JV banao") | 2 wks | Agent drafts from an uploaded invoice, posts on instruction, answers ledger/TB questions from tools only |
| **3. Books-driven filing compute** | `source: 'books'` for GSTR-1/3B; golden fixtures; `missingInputs` books-aware | 2 wks | GSTR-3B for a seeded client files via existing runner with zero recipe changes |
| **4. Desktop shell** | Tauri wrapper (shared React), keychain auth, workstation presence + command queue, updater, Tally tray | 3 wks | Admin logs into exe, full app works incl. automation live feed; workstation online in admin UI |
| **5. Tally mix** | Spike vs real Tally (ERP 9 first, Prime adapter flag), XML engine in sidecar, `post_to_tally`/import tools, posting-target routing, mock-Tally CI tests | 3 wks | Approved JV posts into a real Tally company; ledgers import back; one-way rules hold |
| **6. Client portal books views + polish** | Read-only client ledger/invoice views, bank-statement import (drafts with matching), P&L/Balance sheet, CSV/Excel exports | 3 wks | Client sees own ledger in browser; P&L ties to TB |
| **7. Desktop-native powers (optional, later)** | DSC PKCS#11 signing, local automation runner (browser moves to desktop), e-invoice IRN | 2–4 wks | A DSC filing completes via desktop runner |

Core (1–6): ~16 weeks. Phase 7 is triggered by real DSC-client demand, not built speculatively.

---

## 15. Deployment Notes

- Render backend: unchanged (no new runtime deps — Tally/XML work happens in the desktop shell, not on the server)
- MongoDB indexes: `(clientId, date)`, `(clientId, status)`, `(clientId, 'lines.accountId', date)` on vouchers; `(clientId, code)` unique on accounts; PeriodLock `(clientId, period)` unique
- Desktop CI: GitHub Actions Windows runner → NSIS installer + signed updater manifest published to a static host; release channel `stable|beta`
- Backups: daily Mongo snapshot (already ops practice to confirm) + immutable per-period export artifacts at lock time
- Version gating: shell minimum-version check at login (books schema evolution safety)

---

## 16. Decisions Needed

1. **Tauri vs Electron** → recommend **Tauri 2** (size, WebView2, native sidecar, signed updater). Revisit only if WebView2-specific rendering bugs block us.
2. **Money representation** → recommend **integer paise** everywhere (floats are disqualifying for books).
3. **Duty lines** → recommend **engine-derived lines from line tax metadata** (agent-friendly, one-line sales entry). Alternative: Tally-style explicit duty lines — rejected for phase 1; derived lines already give the exact same trial balance.
4. **Voucher numbering** → per-client per-FY (`JV/2026-27/00001`), gaps impossible. Confirm.
5. **Tally version order** → ERP 9 first (the ask), Prime behind the same adapter flag in the same phase — envelope differences verified in the spike.
6. **Posting gate strength** → posting needs explicit instruction but NOT typed confirmation (reversible via reversal; destructive ops — period lock, account delete — stay typed-confirm admin-only). Confirm this calibration.
7. **Cloud vs desktop automation runner** → keep cloud Playwright through phase 6; move to desktop in phase 7 only when DSC demand arrives (interface is already swappable per master plan §4).
8. **Retire admin web routes after desktop ships?** → recommend **no** — keep both shells (same code; helps remote staff / phone browsers).
