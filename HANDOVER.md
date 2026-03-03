# Americans Abroad — Session Handover

> **How to use**: Read this first at the start of every session. Update it at the end.
> Static architecture and deployment docs live in `CLAUDE.md`.

---

## Current State (as of 2026-03-03)

**All targets deployed and healthy.**
- NAS (primary backend): ✅ up to date
- Render (fallback backend): ⏳ not deployed (low priority — NAS is primary)
- Ionos (frontend): ✅ up to date

---

## Recent Changes

### 2026-03-03
- **Badge overhaul**:
  - `Full 90` badge (blue) replaces `▶ START` + `90'` for completed full-game starters
  - Arrow removed from START badge for upcoming and live games (`STARTING` / `START`)
  - Minute badge suppressed when an Out badge is present (redundant info)
  - Minute badge suppressed for sub players in completed games (`↑ SUB 60'` is sufficient)
  - Goal/assist badges now transparent pill (no colored background) — reads `⚽ 34'` / `🅰️ 67'` inline
  - All badge types (goal, assist, card) now uniform height via consistent base `.badge` padding
  - New `.badge-full90` CSS class (blue, with dark mode override)
- **Goal/assist/sub minutes for recently played**: `fotmobService.getPlayerRecentMatches` now extracts sub_in, sub_out, goal, assist, and card events with real minute timestamps from match detail events (previously all had `minute: null`)
- **`subInMinute` fixed for lastGame source**: `renderStatsStrip` previously hardcoded `subInMinute = null` for lastGame; now reads from event data for all sources
- **Local backend `.env` fixed**: renamed `API_FOOTBALL_KEY` → `FOOTBALL_DATA_KEY` so local dev runs in live mode
- **Luca de la Torre**: Updated team from San Diego FC → Charlotte FC in both `players.json` files

### 2026-03-02 (session 3)
- **Player photos**: Added Wikipedia/Wikimedia Commons headshots for all players that were missing them (20 found automatically, remainder added manually by user). Every player now has a photo.
- **Badge styling**: `.badge-bench` (Unused sub) and `.badge-dnp` (Not in squad / Did not play) now render as proper filled pill badges matching the rest of the stats strip — no more italic/transparent text.
- **Unified badge CSS system**: Added `.stats-strip`, `.badge`, and all `.badge-*` variant classes (`badge-start`, `badge-sub-in`, `badge-sub-out`, `badge-mins`, `badge-goal`, `badge-assist`, `badge-card`, `badge-bench`, `badge-dnp`) with dark mode overrides.

### 2026-03-02 (session 2)
- **Expandable stats drawer**: Tap the ▼ button on any played game card (Recently Played, Finished Today, Live) to see detailed FotMob stats — groups: Summary (xG, chances, pass%), Attacking, Passing, Defending, Duels. Stats are fetched on demand via new `GET /api/player/:id/match-stats?fixtureId=XXXX` endpoint. Result cached for the session (no re-fetch on re-open).
- **Color shading for playing status**: Replaced START/SUB text badges with 4px left border + faint background tint on game boxes — green = started, amber = sub on, gray = bench/unused. Status classes: `.status-started`, `.status-sub`, `.status-bench` on `.match-info` and `.last-game-info`.
- **Dark mode**: CSS custom properties throughout all stylesheets (`index.css`, `App.css`, `PlayerCard.css`, `LeagueFilter.css`). Responds automatically to `prefers-color-scheme: dark` (macOS system appearance).
- **Average rating badge**: Players in Recently Played section show a secondary lighter-blue badge with their 5-game average FotMob rating, e.g. `7.2 (4)` — only shown when 2+ games have ratings.

### 2026-03-02
- **Added Aiden Hezarkhani**: Real Salt Lake, MLS, Midfielder, age 18, fotmobId 1643328
- **Added Luca Moisa**: Real Salt Lake, MLS, Midfielder, age 17, fotmobId 1663013
- **Activity-based sorting**: Upcoming and recently played sections now sort by activity score (starters > sub appearances > token minutes > unused subs/DNPs). Players under 18 with low activity get an extra penalty, sinking to the bottom of each section. Score: 3=started, 2=meaningful sub, 1=<15 min, 0=unused sub or DNP; youth (<18) with score ≤1 get score−1.

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
