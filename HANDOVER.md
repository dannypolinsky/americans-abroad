# Americans Abroad — Session Handover

> **How to use**: Read this first at the start of every session. Update it at the end.
> Static architecture and deployment docs live in `CLAUDE.md`.

---

## Current State (as of 2026-05-14)

**All targets deployed and healthy. Refactor + performance improvements made — not yet deployed.**
- NAS (primary backend): ✅ up, 49 players
- Ionos (frontend): ✅ deployed and live
- Render (fallback backend): ⏳ not deployed (low priority)

---

## Recent Changes

### 2026-05-14 — Refactor + startup performance (NOT YET DEPLOYED)

**Backend changes (`backend/services/matchTrackerFD.js`, `backend/server.js`):**

- **Removed dead `updateFotMobData()` pipeline** (~160 lines deleted): This method ran 49 sequential FotMob player API calls at startup and every 6 polls, but its output (`this.fotmobData`) was read only by `findFotMobMatchForDate()`, which was never called. `getAllMatchData()` (the API response) only reads `this.lastGameData`. Startup is now 1 pass shorter. Also removed: `this.fotmobData` map, `fotmobCacheFile`, `saveFotMobCache()`, `loadFotMobCache()`, `findFotMobMatchForDate()`, `/api/fotmob/refresh` endpoint.

- **Added `lastGameData` disk persistence** (`lastGameCache.json`): `this.lastGameData` was built at runtime but never saved. On container restart it was empty until `updateLastGameData()` finished (~1-2 min for 49 players). Now written to `data/cache/lastGameCache.json` at the end of every `updateLastGameData()` run and loaded on startup — backend serves `lastGame` data immediately after any restart.

- **Server version bumped to `2.6.0`**.

**Frontend changes (`src/App.jsx`):**

- **Added unconditional 5-minute refresh interval**: The documented known gap — the 60-second auto-refresh only fired if `hasLiveMatches || hasMatchNearKickoff` was already in `matchData`. Tabs opened before a game entered matchData went stale indefinitely. New `fallbackInterval` fires every 5 minutes regardless. Worst-case staleness is now 5 min instead of indefinite.

---

### 2026-04-26 — Proxy wipe (no code changes)

`/api/` proxy rule was missing from `/etc/app_proxy.conf` — wiped by a QNAP system event between 06:17 and 11:44. This is the 3rd occurrence. Re-added rule and graceful-restarted both Apache proxy instances.

**Tsakiris "stuck" non-issue**: San Jose vs St. Louis kicked off `00:40 UTC = 8:40 PM ET April 25`. Backend correctly excluded it from "today". He shows as `no_match_today` with populated `lastGame` → appears in Recently Played. Frontend showed stale localStorage state due to proxy outage, resolved on refresh.

### 2026-04-22 — Name-mismatch bug fix + player roster update

- **ID-based lineup matching**: All lineup/event searches now match by `fotmobId` first, falling back to name. Fixes Julian Hall = "Julian Zakrzewski" on FotMob.
- **`participated` used raw API value**: Changed to `actualMinutesPlayed > 0`.
- **Team last-match check**: Now calls `getPlayerStatsFromMatch` before marking `missedGame`.
- **Roster**: Removed 6 players. Now 49 players.

---

## Known Issues / Gotchas

- **Proxy rule wipes (recurring)**: The `/api/` proxy rule in `/etc/app_proxy.conf` has been wiped 3 times by QNAP system events. If the backend goes unreachable, SSH to NAS and check that rule first:
  ```
  ProxyPass /api/ http://127.0.0.1:3001/api/ retry=0
  ProxyPassReverse /api/ http://127.0.0.1:3001/api/
  ```
  Then hard-restart Apache (see `CLAUDE.md` for the kill command).

- **`lastGameCache.json` doesn't exist yet on NAS**: The new cache file will be created automatically on first `updateLastGameData()` run after deploy. No manual action needed.

---

## Next Steps

1. **Deploy the refactor** — `./deploy.sh nas` then `./deploy.sh frontend`
2. **Run QA** — `/qa-americans-abroad` after deploy to confirm backend is healthy
3. Nothing else explicitly queued — ask the user what they want to work on

---

## Key Reminders

- **NAS deploy requires home network** (192.168.4.61) — `./deploy.sh nas`
- **Force client cache clear**: bump `CACHE_VERSION` in `src/App.jsx` (currently `'4'`)
- **Do NOT use the global deploy skill** — it syncs project root and corrupts the container; always use project-local `./deploy.sh nas`
- Lineup status only shows for upcoming games within 45 min of kickoff
- Julian Hall's FotMob name is "Julian Zakrzewski" — ID-based matching handles this automatically
