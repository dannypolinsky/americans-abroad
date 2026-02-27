# Americans Abroad — Session Handover

> **How to use**: Read this first at the start of every session. Update it at the end.
> Static architecture and deployment docs live in `CLAUDE.md`.

---

## Current State (as of 2026-02-27)

**All three targets are in sync and healthy.**
- NAS (primary backend): ✅ up to date
- Render (fallback backend): ✅ up to date
- Ionos (frontend): ✅ up to date

---

## Recent Changes

### 2026-02-27
- **Djordje Mihailovic**: Updated team from Colorado Rapids → Toronto FC in both `src/data/players.json` and `backend/data/players.json`
- **Stale "Finished Today" bug**: Three-part fix:
  1. `CACHE_VERSION` bump in `src/App.jsx` forces localStorage clear on all clients (currently `'3'`)
  2. After API merge, clear stale `finished`/`live` status for players not in fresh response
  3. `groupedPlayers` now validates kickoff date before placing a game in "Finished Today" (`isKickoffToday()`)
- **Auto-refresh near kickoff**: Frontend now polls every 60s when any upcoming match is within 5 min of kickoff (previously only polled when already live)
- **Lineup status for FD-tracked games**: `updateMatchDataFromFotMob` now augments Football-Data.org upcoming matches with FotMob lineup data when within 45-min pre-kickoff window

---

## Known Issues

None currently.

---

## Next Steps / Backlog

- Nothing explicitly queued — ask the user what they want to work on.

---

## Key Reminders

- **NAS deploy requires home network** (192.168.1.245) — `./deploy.sh nas`
- **Force client cache clear**: bump `CACHE_VERSION` in `src/App.jsx`
- **Frontend cache version**: currently `'3'`
- Lineup status only shows for upcoming games within 45 min of kickoff
- FD free tier has no lineup data — FotMob is used as the lineup source
