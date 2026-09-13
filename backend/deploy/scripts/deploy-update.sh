#!/usr/bin/env bash
set -Eeuo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# FirmDesk — quick redeploy script (run from your LOCAL machine)
# ─────────────────────────────────────────────────────────────────────────────
# Usage:
#   ./deploy/scripts/deploy-update.sh <VM_IP> [SSH_KEY_PATH]
#
# Sequence:
#   1. Build frontend (web) + backend locally, verify output
#   2. Back up the current release on the VM
#   3. Transfer new build to the VM
#   4. Install production dependencies
#   5. Verify critical files BEFORE restarting
#   6. Restart PM2
#   7. Health-check — on failure, auto-rollback to the previous release
#
# Index sync (npm run indexes) must be run separately if model indexes changed,
# because tsx is a devDependency and is not available on the production VM.
# Run it locally against the production MONGODB_URI instead:
#   MONGODB_URI="mongodb+srv://..." npm run indexes
# ─────────────────────────────────────────────────────────────────────────────

VM_IP="${1:?Usage: deploy-update.sh <VM_IP> [SSH_KEY_PATH]}"
SSH_KEY="${2:-}"

# Use an array to avoid word-splitting issues with paths containing spaces
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
if [ -n "$SSH_KEY" ]; then
  SSH_OPTS+=(-i "$SSH_KEY")
fi

# Hardcoded deployment target — never construct this from variables to avoid
# accidental rm -rf of unintended paths.
REMOTE_APP_DIR="/opt/firmdesk"
REMOTE_FRONTEND_DIST="/opt/firmdesk/frontend/dist"
REMOTE_BACKUP="/opt/firmdesk/_rollback"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPO_DIR="$(cd "$BACKEND_DIR/.." && pwd)"
FRONTEND_DIR="$(cd "$REPO_DIR/frontend" && pwd)"

# ── Phase 1: Build locally ──────────────────────────────────────────────────

echo "==> Building frontend (web mode)"
cd "$FRONTEND_DIR"
npm run build:web

if [ ! -f "$FRONTEND_DIR/dist-website/index.html" ]; then
  echo "ERROR: Frontend build did not produce dist-website/index.html" >&2
  exit 1
fi

echo "==> Building backend"
cd "$BACKEND_DIR"
npm run build

if [ ! -f "$BACKEND_DIR/dist/src/server.js" ]; then
  echo "ERROR: Backend build did not produce dist/src/server.js" >&2
  exit 1
fi

# ── Phase 2: Back up current release on VM ───────────────────────────────────

echo "==> Backing up current release on VM"
ssh "${SSH_OPTS[@]}" "ubuntu@${VM_IP}" bash -s <<'BACKUP'
set -euo pipefail
BACKUP_DIR="/opt/firmdesk/_rollback"
rm -rf "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Back up only what we overwrite: dist, frontend/dist, package.json, package-lock.json
# node_modules is NOT backed up (too large); rollback restores package-lock.json
# and runs npm ci --omit=dev to recreate it deterministically.
if [ -d /opt/firmdesk/dist ]; then
  cp -a /opt/firmdesk/dist "$BACKUP_DIR/dist"
fi
if [ -d /opt/firmdesk/frontend/dist ]; then
  cp -a /opt/firmdesk/frontend/dist "$BACKUP_DIR/frontend-dist"
fi
for f in package.json package-lock.json; do
  if [ -f "/opt/firmdesk/$f" ]; then
    cp -a "/opt/firmdesk/$f" "$BACKUP_DIR/$f"
  fi
done
echo "  Backup created at $BACKUP_DIR ✓"
BACKUP

# ── Phase 3: Transfer new build ─────────────────────────────────────────────

echo "==> Cleaning stale frontend assets on VM"
ssh "${SSH_OPTS[@]}" "ubuntu@${VM_IP}" "rm -rf ${REMOTE_FRONTEND_DIST}/*"

echo "==> Transferring backend to VM"
scp "${SSH_OPTS[@]}" -r \
  dist \
  package.json \
  package-lock.json \
  deploy \
  "ubuntu@${VM_IP}:${REMOTE_APP_DIR}/"

echo "==> Transferring frontend to VM"
ssh "${SSH_OPTS[@]}" "ubuntu@${VM_IP}" "mkdir -p ${REMOTE_FRONTEND_DIST}"
scp "${SSH_OPTS[@]}" -r \
  "$FRONTEND_DIR/dist-website/." \
  "ubuntu@${VM_IP}:${REMOTE_FRONTEND_DIST}/"

# ── Phase 4: Install + verify BEFORE restarting ─────────────────────────────

echo "==> Installing production dependencies on VM"
ssh "${SSH_OPTS[@]}" "ubuntu@${VM_IP}" "cd ${REMOTE_APP_DIR} && npm ci --omit=dev"

echo "==> Verifying deployment files on VM before restart"
ssh "${SSH_OPTS[@]}" "ubuntu@${VM_IP}" bash -s <<'VERIFY'
set -euo pipefail
errors=0
for f in /opt/firmdesk/dist/src/server.js \
         /opt/firmdesk/package.json \
         /opt/firmdesk/frontend/dist/index.html \
         /opt/firmdesk/.env; do
  if [ ! -f "$f" ]; then
    echo "  MISSING: $f" >&2
    errors=$((errors + 1))
  fi
done
if [ "$errors" -gt 0 ]; then
  echo "ERROR: $errors critical file(s) missing — aborting before restart" >&2
  exit 1
fi
echo "  All critical files present ✓"
VERIFY

# ── Phase 5: Restart + health-check (with rollback on failure) ───────────────

echo "==> Restarting application"
ssh "${SSH_OPTS[@]}" "ubuntu@${VM_IP}" "cd ${REMOTE_APP_DIR} && pm2 restart firmdesk"

echo "==> Waiting for app to start..."
sleep 5

echo "==> Health check"
HEALTH_OK=false
# Retry health check 3 times with 3-second gaps (app may need a moment to
# connect to Atlas, seed data, etc.)
for attempt in 1 2 3; do
  if ssh "${SSH_OPTS[@]}" "ubuntu@${VM_IP}" "curl -sf http://localhost:4000/api/v1/health" 2>/dev/null; then
    HEALTH_OK=true
    break
  fi
  if [ "$attempt" -lt 3 ]; then
    echo "  Attempt $attempt failed, retrying in 3s..."
    sleep 3
  fi
done

if $HEALTH_OK; then
  echo ""
  echo "==> Deploy complete ✓"
  echo "    Backup preserved at ${REMOTE_BACKUP} (delete manually when confident)"
else
  echo ""
  echo "==> Health check FAILED after 3 attempts. Rolling back..." >&2

  ssh "${SSH_OPTS[@]}" "ubuntu@${VM_IP}" bash -s <<'ROLLBACK'
set -euo pipefail
BACKUP_DIR="/opt/firmdesk/_rollback"

if [ ! -d "$BACKUP_DIR/dist" ]; then
  echo "  ERROR: No backup found at $BACKUP_DIR — cannot rollback" >&2
  echo "  Check logs: pm2 logs firmdesk --lines 50" >&2
  exit 1
fi

echo "  Restoring backend dist..."
rm -rf /opt/firmdesk/dist
cp -a "$BACKUP_DIR/dist" /opt/firmdesk/dist

echo "  Restoring frontend dist..."
rm -rf /opt/firmdesk/frontend/dist
mkdir -p /opt/firmdesk/frontend
cp -a "$BACKUP_DIR/frontend-dist" /opt/firmdesk/frontend/dist

echo "  Restoring package files..."
cp -a "$BACKUP_DIR/package.json" /opt/firmdesk/package.json
cp -a "$BACKUP_DIR/package-lock.json" /opt/firmdesk/package-lock.json

echo "  Reinstalling dependencies from restored package-lock.json..."
echo "  (requires npm registry access — if this fails, manual intervention is needed)"
if ! (cd /opt/firmdesk && npm ci --omit=dev); then
  echo "  ERROR: npm ci failed during rollback — registry may be unreachable." >&2
  echo "  The previous source files have been restored but node_modules may be" >&2
  echo "  in an inconsistent state. Retry manually:" >&2
  echo "    cd /opt/firmdesk && npm ci --omit=dev && pm2 restart firmdesk" >&2
  exit 1
fi

echo "  Restarting PM2 with previous release..."
cd /opt/firmdesk && pm2 restart firmdesk

sleep 4
if curl -sf http://localhost:4000/api/v1/health > /dev/null 2>&1; then
  echo "  Rollback successful — previous release is running ✓"
else
  echo "  WARNING: Rollback health check also failed!" >&2
  echo "  Manual intervention required: pm2 logs firmdesk --lines 50" >&2
fi
ROLLBACK

  exit 1
fi

echo ""
echo "    NOTE: If you changed Mongoose model indexes, run the index sync"
echo "    locally against the production database:"
echo "      MONGODB_URI=\"mongodb+srv://...\" npm run indexes"

