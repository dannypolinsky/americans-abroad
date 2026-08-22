# Americans Abroad - Project Guide

## Architecture

### Backend
- **Location**: `/backend`
- **Platform**: Node.js + Express, runs in Docker
- **Hosted on**: QNAP NAS (primary) — always-on, no cold starts
- **Public URL**: `https://PolinskyNAS.myqnapcloud.com/api`
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
QNAP_SSH_HOST=192.168.4.61
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

### NAS Setup (already done)

#### How HTTPS works
- Router forwards external port 443 → NAS IP 192.168.4.61:443
- QNAP's built-in Apache (port 443) uses `/etc/app_proxy.conf` to route `/api/` to the Docker container on port 3001
- The SSL cert (`*.myqnapcloud.com`) is provided by QNAP and covers `PolinskyNAS.myqnapcloud.com`
- Result: `https://PolinskyNAS.myqnapcloud.com/api/health` → Docker container

#### The proxy rule (already in place)
File: `/etc/app_proxy.conf` on the NAS:
```
ProxyPass /api/ http://127.0.0.1:3001/api/ retry=0
ProxyPassReverse /api/ http://127.0.0.1:3001/api/
```

#### CRITICAL: Apache restart on NAS
A normal `restart` leaves old worker processes running with the stale config.
Always use a hard kill + restart when changing Apache config:
```bash
sshpass -p 'PASSWORD' ssh admin@192.168.4.61 \
  "/etc/init.d/Qthttpd.sh stop && sleep 2 && killall -9 fcgi-pm apache_proxy apache_proxys 2>/dev/null; sleep 2 && /etc/init.d/Qthttpd.sh start"
```

#### Backend `.env` on the NAS
The deploy script doesn't sync `.env` (gitignored). It lives at:
`/share/Container/americans-abroad/.env`

Content:
```
PORT=3001
```

> The former `FOOTBALL_DATA_KEY` (football-data.org) is retired — the integration was
> removed (data is FotMob-only now). The old key was exposed in git history here and
> should be deactivated in the football-data.org account.

#### Verify
```bash
curl https://PolinskyNAS.myqnapcloud.com/api/health
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
- `backend/services/matchTrackerFD.js` - Match tracking, polling, and transfer-drift detection
- `backend/services/fotmobService.js` - FotMob scraping (the only data source)
- `backend/data/players.json` - Roster source of truth. `src/data/players.json` is a mirror
  the frontend bundles as an offline fallback; `persistRoster()` writes both. The site reads
  the roster from `/api/players` at runtime, so a confirmed transfer shows up without a
  frontend deploy.
- `backend/Dockerfile` - Docker image definition
- `backend/docker-compose.yml` - Backend service

### Frontend
- `src/App.jsx` - Main React application
- `src/services/api.js` - API client (reads `VITE_API_URL`)
- `vite.config.js` - Vite configuration
