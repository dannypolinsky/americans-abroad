# Americans Abroad

A mobile-responsive web app that tracks 100+ American soccer players playing across the world, showing real-time match data including scores, goals, assists, and substitutions.

**Live Site:** https://americansabroad.midnightllamas.com

## Features

- **100+ American Players** tracked across 11 leagues (Premier League, Serie A, Bundesliga, La Liga, Ligue 1, Eredivisie, Championship, Scottish Premiership, Liga MX, Belgian Pro League, MLS)
- **Live Match Tracking** with 5-minute updates during games
- **Mobile-Responsive Design** works on all screen sizes
- **Search & Filter** by player name, team, or league
- **Match Events** including goals, assists, substitutions, and cards

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Data Source:** API-Football
- **Hosting:** IONOS (frontend) + Render (backend)

## Project Structure

```
americans-abroad/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── data/               # Player database (JSON)
│   └── services/           # API client
├── backend/                # Node.js backend
│   ├── services/           # API-Football integration
│   └── data/               # Player database
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
cp .env.example .env
# Add your API_FOOTBALL_KEY to .env
npm run dev
```

## Deployment

### Frontend (Static Hosting)

Build with the backend API URL:
```bash
VITE_API_URL=https://your-backend-url.com/api npm run build
```

Upload the `dist/` folder to your static hosting provider.

### Backend (Node.js Hosting)

Deploy to Render, Railway, or any Node.js host:

1. Set root directory to `backend`
2. Build command: `npm install`
3. Start command: `npm start`
4. Environment variable: `API_FOOTBALL_KEY=your_api_key`

## API Endpoints

- `GET /api/players` - List all tracked players
- `GET /api/leagues` - List all tracked leagues
- `GET /api/matches` - Get current match data for all players
- `GET /api/matches/:playerId` - Get match data for specific player
- `GET /api/status` - API status and configuration
- `GET /api/health` - Health check

## Environment Variables

### Frontend
- `VITE_API_URL` - Backend API URL (optional, falls back to demo mode)

### Backend
- `API_FOOTBALL_KEY` - API-Football API key (get free key at https://api-football.com)
- `PORT` - Server port (default: 3001)

## License

MIT
