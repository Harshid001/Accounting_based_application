#!/usr/bin/env node
/**
 * FirmDesk Desktop Companion Agent — the Tally bridge.
 *
 * Runs on the accountant's Windows machine (the one with Tally ERP 9 /
 * TallyPrime installed). Zero npm dependencies: Node's built-in fetch (Node
 * 22+) talks to both the FirmDesk API and Tally's XML server.
 *
 * Loop:
 *   1. Sign in with the user's FirmDesk email + password (session cookie kept
 *      in memory only; this script never writes credentials to disk).
 *   2. Register this workstation + probe Tally (localhost:9000) once a
 *      minute via heartbeat ping.
 *   3. Poll the command queue every 10 seconds; for each command POST the
 *      ready-made XML envelope to Tally and report the parsed result back.
 *
 * Security posture: outbound-only HTTPS. Tally's port is never exposed; only
 * this process talks to localhost:9000. The API URL and credentials come
 * from environment variables or interactive prompts:
 *
 *   FIRMDESK_API_URL   e.g. https://firmdesk.example.com/api/v1
 *   FIRMDESK_EMAIL     account email (falls back to a prompt)
 *   FIRMDESK_PASSWORD  account password (falls back to a hidden prompt)
 *   TALLY_PORT         optional, default 9000
 *   POLL_MS            optional, default 10000
 *
 * Usage:  node desktop-agent.mjs
 */

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_URL = (process.env.FIRMDESK_API_URL ?? '').replace(/\/$/, '');
const TALLY_PORT = Number(process.env.TALLY_PORT ?? 9000);
const TALLY_URL = `http://localhost:${TALLY_PORT}`;
const POLL_MS = Number(process.env.POLL_MS ?? 10_000);
const HEARTBEAT_MS = 60_000;
const FRESHNESS_MS = 120_000;

const log = (event, detail = '') => {
  const stamp = new Date().toISOString();
  const suffix = detail === '' ? '' : ` ${detail}`;
  console.log(`[${stamp}] ${event}${suffix}`);
};

const die = (message) => {
  console.error(message);
  process.exit(1);
};

if (API_URL.length === 0) {
  die('Set FIRMDESK_API_URL, for example:\n  set FIRMDESK_API_URL=https://your-firmdesk.example.com/api/v1');
}
if (typeof fetch !== 'function') {
  die('Node 22 or newer is required (global fetch).');
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const ask = async (question) => {
  const rl = createInterface({ input, output });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
};

const signIn = async () => {
  const email = process.env.FIRMDESK_EMAIL ?? (await ask('FirmDesk email: '));
  const password = process.env.FIRMDESK_PASSWORD ?? (await ask('FirmDesk password: '));
  const response = await fetch(`${API_URL}/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    die(`Sign-in failed (${response.status}). ${body.slice(0, 300)}`);
  }
  // better-auth sets the session cookie on the response; keep it for all calls.
  const cookie = (response.headers.getSetCookie?.() ?? [])
    .map((entry) => entry.split(';')[0])
    .join('; ');
  if (cookie.length === 0) {
    die('Sign-in succeeded but no session cookie was returned.');
  }
  log('Signed in', email);
  return cookie;
};

const api = async (cookie, path, options = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      cookie,
      ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  return { status: response.status, ok: response.ok, body };
};

// ---------------------------------------------------------------------------
// Tally XML transport (localhost only)
// ---------------------------------------------------------------------------

const talkToTally = async (requestXml) => {
  const response = await fetch(TALLY_URL, {
    method: 'POST',
    headers: { 'content-type': 'text/xml;charset=utf-8' },
    body: requestXml,
  });
  if (!response.ok) {
    throw new Error(`Tally HTTP ${response.status}`);
  }
  return response.text();
};

const PROBE_XML =
  '<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER><BODY><EXPORTDATA>' +
  '<REQUESTDESC><REPORTNAME>My Company</REPORTNAME><STATICVARIABLES>' +
  '<SVEXPORTFORMAT>$$SrvXML</SVEXPORTFORMAT></STATICVARIABLES></REQUESTDESC>' +
  '</EXPORTDATA></BODY></ENVELOPE>';

/** Mirrors backend/src/lib/tally.ts parsers (kept intentionally tiny). */
const parseProbe = (body) => {
  const name = /<NAME>([\s\S]*?)<\/NAME>/i.exec(body)?.[1]
    ?? /<COMPANYNAME>([\s\S]*?)<\/COMPANYNAME>/i.exec(body)?.[1]
    ?? null;
  return {
    reachable: name !== null && name.length > 0,
    companyName: name,
    educationMode: /EDUCATION/i.test(body),
  };
};

// ---------------------------------------------------------------------------
// Bridge loop
// ---------------------------------------------------------------------------

const deviceId = `WS-${randomUUID().slice(0, 12).toUpperCase()}`;
const deviceName = `${process.env.USERNAME ?? process.env.USER ?? 'Accountant'}-PC`;
let lastProbe = { reachable: false, companyName: null, educationMode: false };
let lastProbeAt = 0;

const heartbeat = async (cookie, withProbe) => {
  const body = { deviceId, deviceName };
  if (withProbe || Date.now() - lastProbeAt > HEARTBEAT_MS) {
    try {
      const reply = await talkToTally(PROBE_XML);
      lastProbe = parseProbe(reply);
      lastProbeAt = Date.now();
    } catch {
      lastProbe = { reachable: false, companyName: null, educationMode: false };
      lastProbeAt = Date.now();
    }
  }
  body.tally = { ...lastProbe };
  const response = await api(cookie, '/desktop/workstation/ping', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (response.status === 403) {
    log('Workstation revoked — re-registering.');
    await register(cookie);
    return;
  }
  if (response.status !== 200) {
    log(`Heartbeat failed (${response.status})`, JSON.stringify(response.body).slice(0, 200));
  }
};

const register = async (cookie) => {
  const response = await api(cookie, '/desktop/workstation/register', {
    method: 'POST',
    body: JSON.stringify({
      deviceId,
      deviceName,
      platform: process.platform,
      appVersion: '1.0.0',
    }),
  });
  if (!response.ok) {
    die(`Workstation registration failed (${response.status}): ${JSON.stringify(response.body).slice(0, 300)}`);
  }
  log('Workstation registered', `${deviceId} (${deviceName})`);
};

/** Interprets a Tally reply for the result endpoint. */
const interpret = (type, reply) => {
  const upper = reply.toUpperCase();
  const lineError = /<LINEERROR>([\s\S]*?)<\/LINEERROR>/i.exec(reply)?.[1] ?? null;
  const alreadyExists = /DUPLICATE|ALREADY EXIST/i.test(reply);

  if (type === 'tally_post') {
    if (lineError !== null && !alreadyExists) {
      return { ok: false, error: lineError.trim().slice(0, 2000), detail: { reply: reply.slice(0, 2000) } };
    }
    const created = /<CREATED>(\d+)<\/CREATED>/i.exec(reply)?.[1];
    return {
      ok: true,
      detail: { created: created !== undefined ? Number(created) : 1, alreadyExists, reply: reply.slice(0, 2000) },
    };
  }
  if (type === 'tally_import') {
    if (lineError !== null) {
      return { ok: false, error: lineError.trim().slice(0, 2000), detail: { reply: reply.slice(0, 2000) } };
    }
    // Pull ledger rows out of Tally's List of Accounts export.
    const ledgers = [];
    for (const block of reply.split(/<LEDGER[\s>]/i).slice(1)) {
      const name = /<NAME>([\s\S]*?)<\/NAME>/i.exec(block)?.[1];
      if (!name) continue;
      const parent = /<PARENT>([\s\S]*?)<\/PARENT>/i.exec(block)?.[1] ?? null;
      const openingRaw = /<OPENINGBALANCE>([\s\S]*?)<\/OPENINGBALANCE>/i.exec(block)?.[1]?.trim() ?? '';
      const cleaned = openingRaw.replace(/[, ]/g, '');
      let opening = 0;
      let isDebit = true;
      if (/^-?\d+(\.\d{1,2})?$/.test(cleaned)) {
        const negative = cleaned.startsWith('-');
        const [whole, fraction = ''] = cleaned.replace('-', '').split('.');
        opening = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
        isDebit = negative; // Tally: negative = debit
      }
      ledgers.push({
        name,
        parent,
        openingPaise: opening,
        openingIsDebit: isDebit,
        isBillWise: /<ISBILLWISEON>\s*Yes/i.test(block),
      });
    }
    return { ok: true, detail: { ledgers, count: ledgers.length } };
  }
  // tally_health
  const probe = parseProbe(reply);
  return {
    ok: probe.reachable,
    ...(probe.reachable ? {} : { error: 'Tally did not report an open company.' }),
    detail: probe,
  };
};

const drainQueue = async (cookie) => {
  const poll = await api(cookie, `/desktop/workstation/commands?deviceId=${encodeURIComponent(deviceId)}&page=1&limit=10`);
  if (!poll.ok || !Array.isArray(poll.body.data)) {
    if (poll.status !== 200) log(`Poll failed (${poll.status})`);
    return;
  }
  for (const command of poll.body.data) {
    log(`Command ${command.id} (${command.type}) — relaying to Tally`);
    let result;
    try {
      const reply = await talkToTally(command.payload.requestXml);
      result = interpret(command.type, reply);
    } catch (error) {
      result = { ok: false, error: `Could not reach Tally on ${TALLY_URL}: ${error.message}`, detail: {} };
    }
    const report = await api(cookie, '/desktop/workstation/results', {
      method: 'POST',
      body: JSON.stringify({
        deviceId,
        commandId: command.id,
        ok: result.ok,
        ...(result.error === undefined ? {} : { error: result.error }),
        detail: result.detail,
      }),
    });
    log(
      `Command ${command.id} ${report.ok ? 'reported' : 'report failed'} — ${result.ok ? 'OK' : (result.error ?? 'error')}`,
    );
  }
};

const main = async () => {
  console.log('FirmDesk Desktop Companion — Tally bridge');
  console.log(`API:      ${API_URL}`);
  console.log(`Tally:    ${TALLY_URL}`);
  console.log(`Device:   ${deviceId} (${deviceName})`);
  console.log('');

  const cookie = await signIn();
  await register(cookie);
  await heartbeat(cookie, true);

  let running = true;
  process.on('SIGINT', () => {
    running = false;
    log('Shutting down.');
  });

  let lastBeat = 0;
  while (running) {
    const now = Date.now();
    if (now - lastBeat >= HEARTBEAT_MS || lastProbeAt === 0 || now - lastProbeAt > FRESHNESS_MS) {
      await heartbeat(cookie, false).catch((error) => log('Heartbeat error', error.message));
      lastBeat = now;
    }
    await drainQueue(cookie).catch((error) => log('Poll error', error.message));
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
};

main().catch((error) => {
  die(`Fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
});
