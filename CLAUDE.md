# Americans Abroad - Project Guide

## Architecture

### Backend
- **Location**: `/backend`
- **Platform**: Node.js + Express, runs in Docker
- **Hosted on**: QNAP NAS (primary) — always-on, no cold starts
- **Entry point**: `server.js`

### Frontend
- **Location**: `/` (root)
- **Platform**: React + Vite
- **Hosted on**: Ionos
- **Build output**: `dist/`

---

## Deployment

### Backend → QNAP NAS (primary)

Fill in `.env` at the project root:
```
QNAP_SSH_HOST=192.168.1.xxx    # your NAS local IP
QNAP_SSH_USER=admin
QNAP_SSH_PASS=your-password
QNAP_REMOTE_PATH=/share/Container/americans-abroad
```

Then deploy:
```bash
./deploy.sh nas
```

This rsyncs the backend code to the NAS and rebuilds/restarts the Docker container.

---

### First-Time NAS Setup

#### Step 1 — Copy the backend `.env` to the NAS
The deploy script syncs code but not `.env` (it's gitignored). SSH into the NAS and create it manually:

```bash
ssh admin@192.168.1.xxx
mkdir -p /share/Container/americans-abroad
nano /share/Container/americans-abroad/.env
```

Paste this content (same API key as local dev):
```
FOOTBALL_DATA_KEY=5ab892d85c385306440c7a6395947c86
PORT=3001
CLOUDFLARE_TUNNEL_TOKEN=   # fill in after Step 2
```

#### Step 2 — Set up Cloudflare Tunnel

The tunnel gives the NAS a public HTTPS URL so the Ionos-hosted frontend can reach it.

1. Go to [https://one.dash.cloudflare.com](https://one.dash.cloudflare.com) → **Networks → Tunnels → Create a tunnel**
2. Name it `americans-abroad`
3. Choose **Docker** as the connector — Cloudflare will show you a `TUNNEL_TOKEN` value
4. Copy that token into `/share/Container/americans-abroad/.env` as `CLOUDFLARE_TUNNEL_TOKEN=...`
5. Under **Public Hostnames**, add:
   - Subdomain: `api` (or `americans-abroad-api`)
   - Domain: `midnightllamas.com`
   - Service: `http://backend:3001`
6. Save — your backend will be live at `https://api.midnightllamas.com`

#### Step 3 — Point the frontend at the NAS

In `.env` at the project root, update `VITE_API_URL`:
```
VITE_API_URL=https://api.midnightllamas.com/api
```

Redeploy the frontend:
```bash
./deploy.sh frontend
```

#### Step 4 — Verify everything works

From your local machine:
```bash
curl https://api.midnightllamas.com/api/health
```

---

### Frontend → Ionos
```bash
./deploy.sh frontend
```

### Backend → Render (fallback only, has cold starts)
```bash
./deploy.sh backend   # pushes to GitHub, Render auto-deploys
```

---

## Key Files

### Backend
- `backend/server.js` - Express API server
- `backend/services/matchTrackerFD.js` - Main match tracking and polling logic
- `backend/services/footballData.js` - Football-Data.org API integration
- `backend/services/fotmobService.js` - FotMob API integration
- `backend/Dockerfile` - Docker image definition
- `backend/docker-compose.yml` - Backend + Cloudflare Tunnel services

### Frontend
- `src/App.jsx` - Main React application
- `src/services/api.js` - API client (reads `VITE_API_URL`)
- `vite.config.js` - Vite configuration
