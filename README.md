# Americans Abroad

A mobile-responsive web app that tracks American soccer players playing abroad, showing live match data including scores, goals, assists, substitutions, cards, and ratings — plus each player's last game and next fixture.

**Live Site:** https://americansabroad.midnightllamas.com

## Features

- **49 American players** tracked across 15 competitions (Premier League, Serie A, Bundesliga, La Liga, Ligue 1, Eredivisie, Championship, Scottish Premiership, Liga MX, Belgian Pro League, MLS, Serie B, 2. Bundesliga, UEFA Youth League, MLS Next Pro)
- **Live match tracking** — polls every 60 seconds during live matches, every 5 minutes otherwise
- **Last game & next fixture** for every player, with match events and ratings
- **Automatic transfer detection** — flags when a player's club changes and, after a few days' confirmation, updates the roster automatically
- **Mobile-responsive design**, plus search & filter by player, team, or league

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express (Dockerized)
- **Data source:** FotMob (unofficial — reads the server-rendered `__NEXT_DATA__` from FotMob pages; no API key)
- **Hosting:** IONOS (frontend static build) + QNAP NAS (backend container — the only backend).

## Project Structure

```
americans-abroad/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── data/               # Player roster (JSON, bundled)
│   └── services/           # API client
├── backend/                # Node.js backend
│   ├── services/           # FotMob integration + match tracker
│   └── data/               # Player roster + on-disk caches
└── dist/                   # Production build
```

## Local Development

### Frontend
```bash
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
npm run dev            # PORT defaults to 3001; no API key required
```

## Deployment

Deploys are scripted in `deploy.sh` (see `CLAUDE.md` for infrastructure details):

```bash
./deploy.sh nas         # backend -> QNAP NAS (Docker), home network or Tailscale
./deploy.sh frontend    # build + rsync dist/ -> IONOS
```

## API Endpoints

- `GET /api/players` — list all tracked players
- `GET /api/leagues` — list all tracked leagues
- `GET /api/matches` — current match data for all players (today's match, last game, next game)
- `GET /api/matches/:playerId` — match data for a specific player
- `GET /api/player/:id/match-stats?fixtureId=…` — expanded per-match stats for a player
- `POST /api/matches/refresh` — force a data refresh
- `GET /api/status` — API status and configuration
- `GET /api/health` — health check, including FotMob scrape freshness and pending/applied roster transfers

## Environment Variables

### Frontend
- `VITE_API_URL` — backend API base URL (e.g. `https://PolinskyNAS.myqnapcloud.com/api`)

### Backend
- `PORT` — server port (optional, default: 3001)

## License

MIT
