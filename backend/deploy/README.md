# FirmDesk — Oracle Cloud Always Free Deployment

> **Target:** VM.Standard.A1.Flex · 2 OCPU · 12 GB RAM · Ubuntu 24.04 ARM64 · 50 GB boot volume
>
> **Cost:** $0/month (Oracle Always Free tier)

## Architecture

```
Internet
   │
   ▼
┌─────────────────────────────────────────┐
│  Nginx (:443)                           │
│  ├── /           → frontend/dist (SPA)  │
│  └── /api/*      → Node.js :4000       │
│                                         │
│  PM2 → firmdesk (Express + Mongoose)    │
│                                         │
│  UFW: 22, 80, 443 only                 │
│  HTTPS: Let's Encrypt (auto-renew)      │
└─────────────────────────────────────────┘
         │
         ▼
   MongoDB Atlas M0
   (free, 512 MB)
```

## Prerequisites

- Oracle Cloud account with Always Free A1 instance:
  - Shape: **VM.Standard.A1.Flex**
  - OCPUs: **2** · Memory: **12 GB**
  - Region: **India West (Mumbai)** `ap-mumbai-1`
    > A1 capacity can be constrained by region. If you get an "Out of host
    > capacity" error, retry later or try another region (e.g., Hyderabad
    > `ap-hyderabad-1`). The deploy scripts work in any region.
  - Image: **Ubuntu 24.04 (aarch64)**
  - Boot volume: **50 GB**
  - Public IPv4: **Yes**
  - Security List: TCP 22, 80, 443 ingress
- Domain DNS A record pointing to the VM's public IP
- MongoDB Atlas M0 cluster (or self-hosted MongoDB on the VM)
- `.env` file with production values (see `backend/.env.example`)

> ⚠️ **ARM architecture**: every npm package with native addons must support
> `linux/arm64`. FirmDesk's production dependencies are pure JavaScript — no
> issues. `@playwright/test` (devDependency) is skipped by `npm ci --omit=dev`.

## Quick Deploy

### 1. Build locally

```bash
# Frontend (web client portal build)
cd frontend
npm run build:web        # → dist-website/

# Backend
cd ../backend
npm run build            # → dist/
```

### 2. Transfer files to VM

```bash
# Create directory structure
ssh ubuntu@<VM_IP> "sudo mkdir -p /opt/firmdesk/frontend && sudo chown -R ubuntu:ubuntu /opt/firmdesk"

# Backend files
scp -r dist package.json package-lock.json deploy/ ubuntu@<VM_IP>:/opt/firmdesk/

# Frontend build
scp -r ../frontend/dist-website/ ubuntu@<VM_IP>:/opt/firmdesk/frontend/dist/
```

> The setup script runs from `/opt/firmdesk` and reads `deploy/nginx/firmdesk.conf`,
> `deploy/ecosystem.config.cjs`, and `frontend/dist/`, so all three must be present.

### 3. Copy .env to VM

```bash
scp .env.production ubuntu@<VM_IP>:/opt/firmdesk/.env
```

> The app validates its environment at boot and exits with a clear list of any
> missing variables, so the `.env` must be in place before setup runs.


**Verify these values are internally consistent with how the app is publicly exposed:**

| Env Variable | Value | Relationship |
|--------------|-------|--------------|
| `APP_BASE_URL` | `https://jvaccounting.in` | The externally reachable app URL; backend redirects browsers here |
| `BETTER_AUTH_URL` | `https://jvaccounting.in` | Auth callback origin; Google OAuth redirect URI is `<this>/api/auth/callback/google` |
| `CORS_ORIGINS` | `https://jvaccounting.in` | Browser origins permitted to call the API (must match what users actually visit) |
| `SESSION_COOKIE_SAMESITE` | `lax` | Appropriate for same-origin (frontend + API share one domain) |
| `SESSION_COOKIE_DOMAIN` | _(empty or omit)_ | Not needed when frontend and API are on the same domain |
| `MONGODB_URI` | `mongodb+srv://...` | Atlas M0 connection string; use `127.0.0.1` only if self-hosting |
| `NODE_ENV` | `production` | PM2 also sets this, but `.env` should be explicit |
| `PORT` | `4000` | Internal Node listener; must match Nginx's `proxy_pass http://127.0.0.1:4000` |


### 4. Run setup script

```bash
ssh ubuntu@<VM_IP>
cd /opt/firmdesk
chmod +x deploy/setup.sh
./deploy/setup.sh jvaccounting.in you@your-email.com
```

The setup script performs:
1. System update + swap file creation (prevents OOM on 12 GB)
2. Node.js 22 + Nginx + Certbot + PM2 installation
3. `npm ci --omit=dev` for production dependencies
4. Two-phase SSL: temporary HTTP config → certbot → full HTTPS config
5. PM2 startup with auto-restart on reboot
6. UFW + Oracle iptables firewall rules
7. Unattended security upgrades
8. Optional liveness health-check cron (does not guarantee reclaim prevention)
9. SSH hardening (password auth disabled, root login disabled)

### 5. OCI Security List (manual)

In OCI Console → Networking → Virtual Cloud Networks → Security Lists:

| Direction | Protocol | Port | Source |
|-----------|----------|------|--------|
| Ingress | TCP | 22 | 0.0.0.0/0 (or your IP) |
| Ingress | TCP | 80 | 0.0.0.0/0 |
| Ingress | TCP | 443 | 0.0.0.0/0 |

### 6. DNS

Point your domain to the VM:

| Record | Name | Value |
|--------|------|-------|
| A | `jvaccounting.in` | `<VM_PUBLIC_IP>` |
| A | `www` | `<VM_PUBLIC_IP>` |

### 7. Verify

```bash
# On the VM
pm2 status                    # firmdesk → online
curl -s http://localhost:4000/api/v1/health  # {"db":"up"}
sudo ufw status               # 22, 80, 443 only
sudo nginx -t                  # syntax ok

# From your browser
# https://jvaccounting.in           → FirmDesk client portal
# https://jvaccounting.in/api/v1/health → {"db":"up"}
```

## Updating the Application

### Quick redeploy (convenience script)

```bash
cd backend
./deploy/scripts/deploy-update.sh <VM_IP> [~/.ssh/oracle-key]
```

This builds both frontend and backend, transfers files, runs `npm ci --omit=dev`,
and restarts PM2 in one command.

### Manual redeploy

```bash
# Build
cd frontend && npm run build:web
cd ../backend && npm run build

# Transfer
scp -r dist ubuntu@<VM_IP>:/opt/firmdesk/dist
scp -r ../frontend/dist-website/ ubuntu@<VM_IP>:/opt/firmdesk/frontend/dist/
scp package.json package-lock.json ubuntu@<VM_IP>:/opt/firmdesk/

# Restart
ssh ubuntu@<VM_IP> "cd /opt/firmdesk && npm ci --omit=dev && pm2 restart firmdesk"
```

## Manual Management

```bash
pm2 status                    # Check status
pm2 logs firmdesk             # View logs (live)
pm2 restart firmdesk          # Restart app
pm2 stop firmdesk             # Stop app
sudo systemctl reload nginx   # Reload nginx after config changes
sudo certbot renew            # Renew SSL certificate (auto via cron)
```

### Monitoring

```bash
htop                          # CPU / RAM (interactive)
free -h                       # Memory summary
df -h                         # Disk usage
pm2 monit                     # PM2 dashboard
```

## Alternative: Systemd (without PM2)

```bash
sudo cp deploy/firmdesk.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now firmdesk
sudo journalctl -u firmdesk -f   # View logs
```

## Expected Capacity on Always Free A1 (2 OCPU / 12 GB)

| Metric | Value |
|--------|-------|
| Initial target concurrent users | 30–50 (subject to load testing) |
| Max burst users | 100+ (dependent on workload complexity) |
| Sustainable RPS | 30–50 (dependent on query/upload patterns) |
| RAM available | 12 GB |
| CPU cores | 2 ARM |
| Cold starts | None (always on) |
| Monthly cost | $0 |

## Always Free Compliance Checklist

Before your trial period expires, verify:

- [ ] A1 total OCPUs across tenancy ≤ 2
- [ ] A1 total RAM across tenancy ≤ 12 GB
- [ ] Boot volume ≤ 200 GB total (you're using 50 GB)
- [ ] Only 1 public IP reserved
- [ ] No other A1 instances running

> ⚠️ Oracle may reclaim idle Always Free instances based on its own utilization
> criteria. There is no supported way to guarantee an Always Free instance will
> never be reclaimed. The optional health-check cron generates some activity
> but should not be relied upon as a reclaim-prevention mechanism.

## File Layout on VM

```
/opt/firmdesk/
├── .env                     # Production environment (secrets)
├── package.json
├── package-lock.json
├── node_modules/            # Production deps only
├── dist/                    # Backend build
│   └── src/
│       └── server.js
├── frontend/
│   └── dist/                # Frontend Vite build (static)
│       ├── index.html
│       └── assets/
├── deploy/
│   ├── setup.sh
│   ├── ecosystem.config.cjs
│   ├── firmdesk.service
│   ├── nginx/
│   │   └── firmdesk.conf
│   └── scripts/
│       └── deploy-update.sh
└── /var/log/firmdesk/       # PM2 logs
    ├── out.log
    └── error.log
```

---

# Render Deployment (Free Plan)

This section is for deploying the backend to Render instead of Oracle Cloud.
The repo root contains `render.yaml`, a Render Blueprint that defines:

- **`firmdesk-api`** (web service): builds with `npm ci && npm run build`,
  starts with `npm run start`, health-checked at `/api/v1/health`
- **`firmdesk-indexes`** (job): runs `npm run indexes` against the production
  database so the index step is never forgotten (Mongoose's `autoIndex` is
  disabled in production by design — `src/config/db.ts`)

## First Deploy

1. Push `render.yaml` at the repository root to `main`.
2. In Render: **New > Blueprint**, select the repo. Render reads `render.yaml`.
3. When prompted, link/enter the environment variables (full list in
   `backend/.env.example`). At minimum you will need:
   - `MONGODB_URI` (MongoDB Atlas free cluster works)
   - `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_BASE_URL`
   - `CORS_ORIGINS` (no wildcards accepted, the app refuses to boot with one)
   - `FIELD_ENCRYPTION_KEY` (32 bytes, base64) — generate with:
     `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   - `R2_*` Cloudflare R2 credentials, `SMTP_*` + `MAIL_FROM`
4. Deploy the web service, then run the `firmdesk-indexes` job once.
5. Verify: `GET <api-url>/` returns `{"status":"ok"}` and
   `GET <api-url>/api/v1/health` returns `"db":"up"`.

> **Post-deploy, every time:** after each API deploy, run the
> `firmdesk-indexes` job (Render dashboard > firmdesk-indexes > Trigger Job).
> It is idempotent and keeps query performance as models evolve.

## Frontend on Render

The frontend is a static Vite build — host it as a Render **Static Site**:

- Build command: `npm ci && npm run build`
- Publish directory: `frontend/dist`
- Environment variable: `VITE_API_BASE_URL` = your deployed API URL + `/api/v1`
  (baked in at build time, so set it before the first build)
- `VITE_APP_NAME` = your app display name

## Free-Plan Behaviour (expected, not bugs)

- **Spin-down**: the API sleeps after ~15 min without traffic. The first
  request after wake-up takes several seconds and hits the DB cold — the
  in-memory LRU cache and rate-limit counters live in process memory and are
  cleared on every wake. Under sustained traffic the cache works normally.
- **Single instance only**: the app deliberately assumes one instance
  (in-memory rate limits and cache). Do not scale to multiple instances on
  Render without first moving rate limiting/caching to Redis.
- **CORS**: set `CORS_ORIGINS` to your exact frontend origin(s)
  (e.g. `https://your-site.onrender.com`). The API rejects every other origin
  and refuses to boot with wildcard origins.

## Deploying Changes

Auto-deploy is on: every push to `main` redeploys the API (Blueprint builds
only when `backend/**` changes, set in the dashboard if needed). After each
deploy completes, trigger the `firmdesk-indexes` job.
