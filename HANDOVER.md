# Americans Abroad — Session Handover

> **How to use**: Read this first at the start of every session. Update it at the end.
> Static architecture and deployment docs live in `CLAUDE.md`.

---

## Current State (as of 2026-06-11)

**Refactor deployed and healthy. QA passed (5/5).**
- NAS (primary backend): ✅ up, 49 players, v2.6.0, FotMob scraping healthy
- Ionos (frontend): ✅ deployed and live
- Render (fallback backend): ⏳ not deployed (low priority)

---

## Recent Changes

### 2026-06-11 — Codebase refactor (deployed, QA passed)

**Deleted dead files:**
- Removed `backend/services/matchTracker.js`, `apiFootball.js`, `fbrefScraper.js` (~1,200 lines) — none were imported anywhere

**Backend (`backend/services/fotmobService.js`):**
- Extracted `parseGoalAssistCardEvents()` method — replaced three duplicated goal/assist/card parsing loops in `getPlayerStatsFromMatch`, `getPlayerStatsFromTeamLineup`, and `getPlayerRecentMatches`

**Frontend — new utility module:**
- Created `src/utils/playerUtils.js` — all pure helpers consolidated here: display formatters (`abbrevPosition`, `formatDate`, `formatKickoff`, etc.), status classifiers (`getRatingClass`, `getStatusClass`, etc.), and match-data filters (`getMostRecentGameDate`, `hasRecentGame`, `isKickoffToday`, etc.)

**Frontend — App.jsx:**
- Removed 5 inline helper functions that closed over state; they now live in `playerUtils.js` and take `matchData` as an explicit parameter

**Frontend — PlayerCard split (528 → 85 lines):**
- `src/components/StatsStrip.jsx` — pure badge strip (goals, assists, cards, sub events)
- `src/components/StatsModal.jsx` — owns all drag-to-dismiss refs and handlers
- `src/components/TodayMatchSection.jsx` — today's match block
- `src/components/LastGameSection.jsx` — last game + missed game + next game block
- `PlayerCard.jsx` now just orchestrates state and renders sub-components

---

### 2026-05-14 — Refactor + startup performance (deployed, QA passed)

- Removed dead `updateFotMobData()` pipeline (~160 lines)
- Added `lastGameData` disk persistence (`lastGameCache.json`) — backend serves `lastGame` data immediately after any restart
- Added unconditional 5-minute frontend refresh interval (worst-case staleness now 5 min, not indefinite)
- Server version bumped to `2.6.0`

---

## Known Issues / Gotchas

- **Proxy rule wipes (recurring)**: The `/api/` proxy rule in `/etc/app_proxy.conf` has been wiped 3 times by QNAP system events. If the backend goes unreachable, SSH to NAS and check that rule first:
  ```
  ProxyPass /api/ http://127.0.0.1:3001/api/ retry=0
  ProxyPassReverse /api/ http://127.0.0.1:3001/api/
  ```
  Then hard-restart Apache (see `CLAUDE.md` for the kill command).

---

## Next Steps

- Nothing explicitly queued — ask what's next
- Render fallback still not deployed (low priority, has cold starts)

---

## Key Reminders

- **NAS deploy requires home network** (192.168.4.61) — `./deploy.sh nas`
- **Force client cache clear**: bump `CACHE_VERSION` in `src/App.jsx` (currently `'4'`)
- **Do NOT use the global deploy skill** — it syncs project root and corrupts the container; always use project-local `./deploy.sh nas`
- Lineup status only shows for upcoming games within 45 min of kickoff
- Julian Hall's FotMob name is "Julian Zakrzewski" — ID-based matching handles this automatically
