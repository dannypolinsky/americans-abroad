# Americans Abroad - Project Guide

## Deployment

### Backend (Render)
The backend auto-deploys from GitHub. To deploy:
```bash
git push origin main
```
Or use the deploy script:
```bash
./deploy.sh backend
```

### Frontend (Ionos)
The frontend deploys via SSH to Ionos hosting. To deploy:
```bash
./deploy.sh frontend
```

### Deploy Both
```bash
./deploy.sh
# or
./deploy.sh both
```

### Credentials
SSH credentials are stored in `.env` (gitignored):
- `IONOS_SSH_HOST` - Ionos SSH hostname
- `IONOS_SSH_USER` - SSH username
- `IONOS_SSH_PASS` - SSH password
- `IONOS_REMOTE_PATH` - Remote directory path

### Requirements
Frontend deployment uses `expect` (built into macOS) for SSH password authentication. No additional dependencies required.

## Architecture

### Backend
- **Location**: `/backend`
- **Platform**: Node.js + Express
- **Hosted on**: Render (https://americans-abroad-api.onrender.com)
- **Entry point**: `server.js`

### Frontend
- **Location**: `/` (root)
- **Platform**: React + Vite
- **Hosted on**: Ionos
- **Build output**: `dist/`

## Key Files

### Backend Services
- `backend/services/matchTrackerFD.js` - Main match tracking and polling logic
- `backend/services/footballData.js` - Football-Data.org API integration
- `backend/services/fotmobService.js` - FotMob API integration
- `backend/server.js` - Express API server

### Frontend
- `src/App.jsx` - Main React application
- `vite.config.js` - Vite configuration
