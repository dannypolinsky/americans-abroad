# Americans Abroad — Session Handover

> **How to use**: Read this first at the start of every session. Update it at the end.
> Static architecture and deployment docs live in `CLAUDE.md`.

---

## Current State (as of 2026-03-01)

**All three targets are in sync and healthy.**
- NAS (primary backend): ✅ up to date
- Render (fallback backend): ✅ up to date
- Ionos (frontend): ✅ up to date

---

## Recent Changes

### 2026-03-01
- **Docker volume fix**: Cache files (`nextGamesCache.json`, `fotmobCache.json`) moved to `data/cache/` subdirectory; volume now mounts only `/app/data/cache`. Previously the entire `/app/data` volume shadowed `players.json` on every deploy, requiring a manual `docker cp` workaround — future player data changes will take effect on normal deploy
- **Cache-Control header**: Added `Cache-Control: no-store` middleware to all API responses in `server.js` — prevents Cloudflare or any proxy from caching live match data
- **Stale live/finished status fix**: On initial cache load in `App.jsx`, `live`/`finished` entries whose kickoff date is not today are immediately reset to `no_match_today` — fixes games from previous days persisting as live when the API was temporarily unreachable

### 2026-02-28
- **Josh Sargent**: Updated team from Norwich City → Toronto FC in both `players.json` files
- **Unused sub display fix**: Players with `minutesPlayed === 0`, `started === false`, and no `sub_in` event now show "Unused sub" badge instead of NR/0/SUB — applies to both Finished Today and Recently Played sections (`PlayerCard.jsx`)
- **Stale missed-game fix for transferred players**: `getPlayerRecentMatchFromFotMob` now verifies player's current team is in the match before creating a `missedGame` entry — fixes Mihailovic and Sargent showing old-team (Colorado/Norwich) games as missed after transfer to Toronto FC
- **Added Adri Mehmeti**: New York Red Bulls, MLS, Midfielder, age 16, fotmobId 1715268
- **Added Niko Tsakiris**: San Jose Earthquakes, MLS, Midfielder, age 20, fotmobId 1339609
- **Removed Kaedren Spivey and Christopher Cupps**: Both removed from both `players.json` files

### 2026-02-27 (session 2)
- **Sullivan surname collision fix**: `fotmobService.playerNameMatches()` and `matchTrackerFD.lineupNameMatches()` now check first initial when two players share a last name — Quinn Sullivan (ID 1171007) and Cavan Sullivan (ID 1630736) now correctly show separate stats
- **Removed Render cold-start code**: Frontend no longer retries the API on failure (that was for Render cold starts). Loading overlay message simplified to "Loading match data..." — NAS is always-on, no cold starts.

### 2026-02-27 (session 1)
- **Djordje Mihailovic**: Updated team from Colorado Rapids → Toronto FC in both `src/data/players.json` and `backend/data/players.json`
- **Stale "Finished Today" bug**: Three-part fix:
  1. `CACHE_VERSION` bump in `src/App.jsx` forces localStorage clear on all clients (currently `'3'`)
  2. After API merge, clear stale `finished`/`live` status for players not in fresh response
  3. `groupedPlayers` now validates kickoff date before placing a game in "Finished Today" (`isKickoffToday()`)
- **Auto-refresh near kickoff**: Frontend now polls every 60s when any upcoming match is within 5 min of kickoff (previously only polled when already live)
- **Lineup status for FD-tracked games**: `updateMatchDataFromFotMob` now augments Football-Data.org upcoming matches with FotMob lineup data when within 45-min pre-kickoff window

---

## Known Issues

- **Mihailovic/Sargent lastGame may still show old-team game**: After Toronto's first game, FotMob's player API should return Toronto matches and the `currentTeamInMatch` guard will prevent the stale missedGame. Expected to self-resolve. Monitor after their next Toronto FC match.
- **NAS security — Fios router**: Port 8080 is still externally reachable (likely via DMZ rule on the Fios router, not the UDM). User needs to log into the Fios router directly (plug into it) to investigate. Long-term recommendation: set up Cloudflare Tunnel to eliminate all port forwarding.

---

## Key Facts About Player Name Matching

- `fotmobService.playerNameMatches()` — disambiguates FotMob player names vs our player names (checks first initial on last-name collisions)
- `matchTrackerFD.lineupNameMatches()` — same logic for FD lineup/bench arrays
- `parsePlayerEvents()` in `matchTrackerFD.js` still uses last-name-only matching for goal/sub/card events (FD event data rarely has two players with the same last name on the same team)

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
