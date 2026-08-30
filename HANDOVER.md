# Handover — Americans Abroad
_Last updated: 2026-08-29_

> **How to use**: Read this first at the start of every session. Update it at the end.
> Static architecture and deployment docs live in `CLAUDE.md`.
> Recurring gotchas (proxy wipes, cert lapses, SSH aliases, FotMob API retirement) live in
> **Known Issues / Gotchas** and **Key Reminders** in the archive below — check there before
> debugging anything infrastructural.

## Current state

- **Backend v2.8.0 live on the NAS, frontend live on Ionos — both deployed and verified
  2026-08-29.** Deployed bundle hash matched the local build; `/api/players` and the served
  JS/CSS were both checked against the public URLs, not just localhost.
- **⚠ THE WORKING TREE IS DEPLOYED BUT NOT COMMITTED.** Six modified files are live on the NAS
  and Ionos with no commit behind them: `backend/data/players.json`, `src/data/players.json`,
  `src/components/PlayerCard.jsx`, `src/components/PlayerCard.css`, `src/index.css`,
  `src/utils/playerUtils.js`. This is the reverse of the usual risk — a NAS rebuild or a
  `git checkout` would silently revert what is currently serving. **Commit these first.**
- **The GitHub repo is PUBLIC** (`dannypolinsky/americans-abroad`). Assume anything committed
  is world-readable. `main` was last pushed 2026-08-22; this session's work is not yet on it.
- **`deploy.sh` semantics** (renamed 2026-08-22): `push` = GitHub only, deploys nothing;
  `nas` = backend; `frontend` = Ionos; **`both` (the default) = `nas` + `frontend`**.
  `./deploy.sh backend` now exits with a pointer instead of running.
- **Roster is 61 players, up from 49.** 12 USA-labelled players added from a full sweep of the
  Premier League, Ligue 1, La Liga, Bundesliga, Eredivisie, Belgian Pro League and Serie A.
  All 61 have match data and 55 have upcoming fixtures.
- **Player photos now come from FotMob, derived from `fotmobId`** — no `image` field needed,
  so any player added later gets a headshot with zero roster editing.
- **QA: 11 pass / 1 warning.** The warning is `Drift coverage: no drift sweep has run yet
  since startup` — an artifact of the restart, not a fault. It clears on the next daily sweep.
- **Drift sweep baseline moves 49 → 61.** `monitor.sh` and `qa-check.sh` both derive the count
  from `/api/health` (verified — no hardcoded 49), so expect `data=61players drift=ok(61/61)`
  with no script changes needed.

## Recent changes

- **2026-08-29** — **Headshots**: added `headshotUrl(player)` to `src/utils/playerUtils.js`,
  deriving `images.fotmob.com/image_resources/playerimages/{fotmobId}.png`. `PlayerCard.jsx`
  uses it instead of the per-player `image` field. **60 of 61 resolve**; Dylan Vanney is a
  persistent 403 (FotMob has no photo for him) and falls back to the initials avatar via the
  pre-existing `onError` handler.
  - These images are **palette PNGs with a `tRNS` chunk — transparent cutouts, not photos**.
    On the dark card (`--card-bg: #1a1f2b`) dark hair dissolved into the background, so a
    `--headshot-bg` token was added (`#eceff3` light / `#c3c9d4` dark). The dark value is
    deliberately light so the cutout reads, muted to avoid a glaring disc at 54px.
  - The 36 Wikimedia URLs and 13 files in `public/images/` are now **unreferenced but left in
    place** — nothing reads `image` any more (grep-verified: `PlayerCard.jsx` was the only
    reader).
- **2026-08-29** — **Roster 49 → 61.** Method: FotMob league page → team IDs → each team's
  squad page → filter `ccode == 'USA'`. Added Kayo, Pierre, Fossey (Belgian Pro); Campbell,
  Maloney, Castaneda (Bundesliga); Payne, Hawkings, Booth (Eredivisie); Vanney (La Liga);
  Slonina (Premier League); Cremaschi (Serie A). Ids 123–134.
  - **Timothy Chandler was found and deliberately skipped** (36, effectively done
    internationally). Danny's call — do not "re-add the missing player" on a later sweep.
  - **FotMob lists the manager inside the squad payload** in a group titled `coach`. Without a
    filter, Pellegrino Matarazzo (Real Sociedad, USA) surfaces as a signing. Any future sweep
    needs that filter.
  - Verified after merge: no duplicate `id`s, no duplicate `fotmobId`s, every entry has
    `teamFotmobId`, and both players.json files stayed byte-identical in format (pure
    additions, zero deletions in the diff).

## Open questions / Next steps

1. **COMMIT THE WORKING TREE.** See Current state — what is live is not in git. Nothing
   secret-shaped is in the diff (roster data + CSS), and the repo is public.
2. **Rotate the Gmail app password.** *(Carried over, still not done — oldest live risk here.)*
   A `curl -v` trace during setup on 2026-08-22 printed the base64 AUTH line, which decodes to
   the password; it is in that session's scrollback. Rotate at
   <https://myaccount.google.com/apppasswords>, then update **both**
   `/share/Container/abc-lottery/.env` (`GMAIL_APP_PASSWORD`) and
   `/share/Container/americans-abroad/alert.conf` (`SMTP_PASS`, spaces stripped).
   The Ionos SSH password was also printed in that session; both are local-only.
3. **Deactivate the retired `FOOTBALL_DATA_KEY`** in the football-data.org account.
   *(Carried over from 2026-08-22, status still unknown.)* It was scrubbed from `CLAUDE.md`,
   but it is in already-public git history, so scrubbing the file did not revoke it. The
   football-data.org integration itself is gone — data is FotMob-only — so revoking costs
   nothing.
4. **The sweep finds *labelled* Americans, not *eligible* ones.** FotMob's `ccode` is a single
   primary nationality, so an uncapped dual national filed under another country — precisely
   the next Musah — is invisible to this method. No automated source fixes that; it needs a
   hand-maintained watchlist. **Not built.**
5. **`abbrevPosition` has no entry for `'Left Winger'` / `'Right Winger'`** (only
   `'Left Wing'` / `'Right Wing'`), so those fall through to the full string and the meta line
   reads "Right Winger" instead of "RW". Pre-existing; now affects 3 more players. One-line fix
   in `src/utils/playerUtils.js`.
6. **Drift auto-apply updates `team` / `league` / `teamFotmobId` but never `country`.** That is
   why the roster contains `Eredivisie/Germany`, `Ligue 1/Belgium` and `MLS/England`. The 12
   new entries are correct; the pre-existing stale ones were left alone.
7. **Six orphan headshots in `public/images/`** belong to players not in the roster at all:
   Berchimas, DeJuan Jones, Luca Moisa, Quinn Sullivan, Liam West (Cole Campbell was re-added
   this session). Either they were dropped deliberately or they are missing — worth a look.
   Note `qa-check.sh` still probes **Quinn Sullivan's** profile for its FotMob player-scrape
   check even though he is not on the roster.
8. **Expect routine "Player ratings" warnings while Gozo features for the U21s.** FotMob
   publishes no player ratings for Premier League 2 or 3. Liga. Still triage each one —
   suspect-by-default stands, only the *reason* is known. Detail in the archive.
9. **Two players sit in leagues the site doesn't list** — Boyd (3. Liga), Pukstas (Croatian
   First League) — so they appear only under "all", never a league filter. Pre-existing and
   **unchanged this session**; all 12 additions landed in leagues already in `leagues[]`, so no
   new filter chips were introduced. Fixing means adding both to `leagues` in *both*
   players.json files. Left for Danny to decide.
10. **Before Oct 24, 2026**: reinstall the 90-day myQNAPcloud SSL when `monitor.log` shows
   `cert=expiring<14d`. There is no renew button — you reinstall. Auto-renewal has lapsed twice.
   Cert currently valid to **Oct 24 19:45:51 2026 GMT** (verified 2026-08-29).
11. ~~Render fallback~~ **SETTLED 2026-08-22 — there is no Render fallback.** The NAS is the
    only backend. Do not reintroduce "fallback backend" language — earlier handovers describe a
    Render fallback that never existed post-migration, and that stale claim cost a session.
12. **Optional hardening not built**: a weekly heartbeat email would prove the alert channel
    between incidents; and `TRANSFER_APPLY_THRESHOLD_DAYS` is still 3, so a deadline-day move
    applies three days later (automatically, and visible as pending in `/api/health` meanwhile).

---

# 📚 ARCHIVE

_Everything below is the historical record, newest first. Current status lives above._

## 2026-08-22 session (superseded by the top of the file)

> **AMENDED 2026-08-29:** roster is now 61 players, not 49, and photos no longer come from the
> `image` field. The status below was accurate on 2026-08-22 and is kept for its reasoning.

## Current State (as of 2026-08-22)

> **AMENDED 2026-08-22:** this is the 2026-08-22 session's detailed write-up, kept for the
> root-cause analysis below. **Live status lives in `## Current state` at the top of the file** —
> the QA figure here (10 pass / 2 warnings) was taken before email alerting was working.

**Backend v2.8.0 live on the NAS. Site healthy.** QA: 10 pass / 2 warnings (both known and
explained below). Drift sweep verifies **49/49** players daily. Cert valid to Oct 24, 2026.

### 2026-08-22 — Seven players were on the wrong clubs for six weeks (RESOLVED)

**Symptom**: Zavier Gozo still listed at Real Salt Lake after moving to Crystal Palace.
A full audit of all 49 players against FotMob found **7 wrong**: Musah (Atalanta→AC Milan),
Paredes (Wolfsburg→FC Utrecht), Reynolds (Westerlo→Rennes), Dike (West Brom→Orlando City),
Reyna (Gladbach→Strasbourg), Gozo (Real Salt Lake→Crystal Palace), Albert (BVB U19→BVB).

**Drift detection was working.** It caught these in July and wrote the corrections. Four
separate faults stopped them from reaching the screen:

1. `server.js` read `players.json` once at boot and served that snapshot from `/api/players`
   forever. Container had been up since Jul 9; the transfers applied Jul 11. **Fixed**: the
   route now serves `matchTracker.getPlayers()` (the live roster).
2. `App.jsx` imported the bundled `src/data/players.json` and never called the API, so clubs
   could only change on a frontend redeploy. **Fixed**: the app fetches `/api/players` on
   mount and hourly; the bundle is now only first-paint/offline fallback.
3. Applied transfers were dropped from `rosterDrift.json` on the next clean sweep, so the
   "re-apply after rebuild" safety net had nothing to replay, and every deploy silently
   reverted them. **Fixed**: applied entries are retained (`clearDrift`), plus a new
   `reconcileFromTransferLog()` replays the append-only log on startup (idempotent — verified
   it produces 0 net changes against a hand-corrected roster).
4. A sweep that could not read *any* profile reported `rosterDrift: []` — identical to a clean
   roster. **Fixed**: `getPlayerPrimaryTeam` now throws on fetch failure instead of returning
   null, and `/api/health` reports `driftCheck: {checked, skipped, total, complete}`.

### Two bug classes found in the transfer log while fixing the above

- **Call-ups were being applied as transfers.** Ream, Gozo and Hall were each "transferred"
  to *MLS All-Stars* (a club FotMob reports with **no league at all**) and back; Dettoni to
  Bayern München II (Regionalliga Bayern). **Fixed**: a destination whose league doesn't map
  to the roster's `leagues` list is **never auto-applied** — it is held and surfaced in
  `/api/health` → `rosterNeedsReview`.
- **The league written on a transfer was taken from the player's `mainLeague`, which lags a
  move by weeks** — that's how Paredes got recorded as "Bundesliga" at FC Utrecht. **Fixed**:
  the league now comes from the destination *club's* page (`getTeamLeagueById` →
  `details.primaryLeagueName`), which is correct immediately, then is mapped through
  `LEAGUE_ALIASES` (FotMob says "Major League Soccer", the roster says "MLS").
- **Senior↔U21 flapping**: FotMob moves `primaryTeam` to whichever side a player last featured
  for, so Gozo oscillated between Crystal Palace and Crystal Palace U21. **Fixed**:
  `isSameClub()` treats a reserve/academy suffix as the same club — no drift, no flapping.

### Monitoring: the log was PASS every 6 hours through all of it

`monitor.sh` now also checks the drift sweep (`drift=ok(49/49)`), the review queue
(`review=N`), and **its own alert channel** (`alert=ok|FAILED|unconfigured|untested`), and it
**emails** on any change in the problem set, plus one daily reminder while unresolved.
QA grew from 8 to 12 checks (added Drift coverage, Transfers to review, Alert channel,
Player ratings).

**Email path** (config: `/share/Container/americans-abroad/alert.conf`, chmod 600, not in git):
sends **to `danny@polinsky.com`** through Gmail SMTP using the same account and app password
the **abc-lottery** container uses (`/share/Container/abc-lottery/src/mailer.js`). Verified
end-to-end 2026-08-22 — Gmail returned `250 OK` and the mail arrived. It sends with `curl`
rather than reusing that Node mailer because `monitor.sh` is a **host cron** and must be able
to alert when the container is down. QNAP's `/usr/sbin/sendmail` is only a fallback and
currently fails (`Get AuthPass failed` — Notification Center has no SMTP account).
**Rotating the app password requires updating both projects.**

> **Fixed a QA bug in passing**: three checks used `echo "$JSON" | python3 - <<'PYEOF'`, where
> the heredoc consumes stdin and the piped JSON is discarded. Those checks had been silently
> passing on empty input (that's why "upcoming games" always printed `?`). Now passed by env
> var. The script's own comment at check 1b warns about exactly this.

## ⚠ Open items from this session

> **AMENDED 2026-08-22:** superseded by `## Open questions / Next steps` at the top of the
> file. Item 1 below (QNAP Notification Center SMTP) was **abandoned** — alerting now goes
> through the abc-lottery Gmail account instead. Kept for the reasoning.

1. **Rotate the Gmail app password.** During setup on 2026-08-22 a `curl -v` SMTP trace
   printed the base64 AUTH line, which decodes to the app password — it is in that session's
   scrollback. Rotate at <https://myaccount.google.com/apppasswords>, then update **both**
   `/share/Container/abc-lottery/.env` (`GMAIL_APP_PASSWORD`) and
   `/share/Container/americans-abroad/alert.conf` (`SMTP_PASS`, spaces stripped).
2. **Known unrated-match pattern: FotMob does not rate some competitions.** Two confirmed on
   2026-08-22, both genuine upstream gaps rather than broken player matching:
   - Terrence Boyd, 8' on 2026-08-21, 3. Liga (fixture 5750700) — FotMob rated **nobody** in
     that match.
   - Zavier Gozo, 72' on 2026-08-22, **Premier League 2** (Arsenal U21 v Crystal Palace U21,
     fixture 1000019092) — PL2 appears to carry no player ratings at all. Note this fixture
     id comes from the player-profile feed (`source: fotmob_player_api`) and does **not**
     resolve at `fotmob.com/matches/x/<id>`, so the usual "was anyone rated?" cross-check
     isn't available for U21 games.

   Expect the "Player ratings" QA check to warn routinely while Gozo features for the U21s.
   Still triage each one — the stance is suspect-by-default; only the *reason* is now known.
3. **Two players sit in leagues the site doesn't list**: Boyd (3. Liga) and Pukstas (Croatian
   First League). They are invisible under every league filter — only "all" shows them. This
   predates this session. Adding both to the `leagues` array in **both** players.json files
   would fix it (and let those leagues be valid transfer destinations); it adds two filter
   chips to the UI, so it was left for Danny to decide.
4. **Alerting is only proven when it fires.** A quiet channel stays `untested`. A weekly
   heartbeat email would prove it end-to-end; not built, since it means routine mail.

## Background — v2.7.0 pre-season hardening (2026-07-09)

**Pre-season hardening v2.7.0 DEPLOYED to NAS and healthy.** Confirmed live:
`/api/health` → v2.7.0, scrape fresh, 0 failures, drift check ran (5 detected, day 1/3).
- NAS (primary backend): ✅ v2.7.0 live, healthy
- Ionos (frontend): ✅ redeployed (fresh bundle, HTTP 200) — now ships the `teamFotmobId` roster
- Render (fallback backend): ⏳ not deployed (low priority)
  > **AMENDED 2026-08-22:** there is no Render fallback. Render hosted the backend before the
  > NAS migration and has not been used since; the NAS is the only backend.
- **5 real transfers detected on the live backend** (below). They auto-apply after 3 consecutive
  daily checks — **review in `/api/health` before then** if any are wrong.

### 2026-07-09 — Pre-season hardening (v2.7.0, built, verified, NOT deployed)

Fable 5 reviewed the project; Opus built the agreed items:

1. **Transfer drift detection + auto-apply** (`matchTrackerFD.js`). Each player now carries a
   `teamFotmobId` (seeded into both `players.json` files as the baseline). A daily
   `checkRosterDrift()` compares FotMob's `primaryTeam.teamId` to that baseline. Mismatches
   log `TRANSFER DETECTED`, are tracked per-day, and surface in `/api/health` → `rosterDrift`.
   After **3 consecutive daily** confirmations it auto-rewrites team/league/teamFotmobId in
   both roster files + appends `data/cache/transferLog.json`.
   - **Durability**: drift state + transfer log live in `data/cache/` (the only Docker volume
     that survives rebuilds). players.json is baked into the image and reverts on rebuild, so
     confirmed transfers are **re-applied to the in-memory roster on startup** from the
     volume-backed drift state. In-memory roster drives all match discovery, so it stays correct.
   - **Live check already flagged 5 real drifts**: Musah→Milan, Turner→Lyon, Paredes→Utrecht,
     Cavan Sullivan→Philadelphia Union II, Dettoni→Bayern München II. All at day 1/3 — they'll
     auto-apply on the deployed backend after 3 daily checks. **Review these in `/api/health`
     before they apply** if any are wrong (the two reserve-team ones are worth a look).
2. **Resilience**: all FotMob fetches now have a 15s `AbortSignal.timeout` + browser UA; polling
   switched from `setInterval` to a self-rescheduling `setTimeout` chain (+ `pollRunning` guard)
   so slow cycles can't overlap and double FotMob traffic.
3. **Scrape health**: `/api/health` now reports `scrape.lastSuccessAt / minutesSinceSuccess /
   consecutiveFailures / stale` (stale = no usable data in 45 min). A `__NEXT_DATA__`-missing
   200 logs `FOTMOB_PAYLOAD_SHAPE_CHANGED`. QA skill gained **Scrape freshness** + **Roster drift** checks.
4. **Julian Hall lineup fix**: `getPlayerLineupStatus` (and recent-match starter/sub detection)
   now match by `fotmobId` first, so name mismatches no longer show `not_in_squad` when starting.
5. **Upgrades**: removed 6 unused backend deps (puppeteer×3, cheerio, fotmob, node-cron),
   regenerated lockfile, `Dockerfile` node 20→22. Deleted `footballData.js` + ~8 dead methods.
6. **Security**: scrubbed the retired `FOOTBALL_DATA_KEY` from `CLAUDE.md` (still deactivate it in
   the football-data.org account — it's in git history).

**Deploy note**: `deploy.sh nas` always rebuilds (`compose up -d --build`), so the dep/Node
changes apply automatically — no `DOCKER_REBUILD` flag needed. Run `/qa-americans-abroad` after.

**Not done (out of agreed scope)**: full roster unification (frontend still bundles its own
players.json copy — auto-apply writes both, but the label only updates on the next frontend
deploy); retiring the `TEAM_IDS` map entirely; the `App.jsx:447` footer text ("updates every
5 minutes" is backwards — it's 60s live). Manual-stats pipeline (`loadManualStats`) is still
loaded-but-unused.

---

## Recent Changes

### 2026-06-11 — Polling loop error handling (deployed)

- Wrapped `pollForUpdates` in `matchTrackerFD.js` with try/catch — prevents unhandled promise rejections from crashing the server if a runtime bug occurs inside the interval callback

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

- **FotMob's JSON API is fully retired — everything runs on HTML scraping.** As of 2026-08-22
  `/api/playerData` and `/api/matchDetails` return **404 for every id**; the logs are full of
  `playerData API failed ... trying HTML scrape`, which is now the normal path, not a fallback.
  All player/match data depends on `__NEXT_DATA__` in the page HTML. If FotMob changes that
  page structure, everything stops at once — the QA "FotMob team/player scrape" checks and
  `monitor.sh` step 4 are the early warning.

- **A green monitor does not mean correct data.** Every localhost-based check passed for the
  six weeks seven players sat on wrong clubs, and again during the July cert expiry. When
  something looks wrong on the site, verify the *content* (`/api/players`, `driftCheck`
  coverage), not just that the service responds.

- **Public TLS cert lapses at expiry (recurring)**: QNAP's myQNAPcloud Let's Encrypt cert has
  expired twice now without auto-renewing. When it lapses, the site looks dead to users while
  the backend stays healthy (checks that hit localhost pass). Both `qa-check.sh` and NAS
  `monitor.sh` now flag it (`cert=expiring<14d | EXPIRED`). Fix: myQNAPcloud app → SSL
  Certificate → **Install 90-day SSL** (no renew button — reinstall). **Next expiry: Oct 24,
  2026.** A paid 3-year myQNAPcloud cert would end the cycle.

---

## Next Steps

> **AMENDED 2026-08-22:** superseded by `## Open questions / Next steps` at the top. Kept for
> the unrated-match triage procedure, which is still the right method.

- **Treat a played-but-unrated match as suspect, not "upstream is just late."** Danny's stance:
  if a player has `participated: true` but `rating: null`, assume something may be broken and
  investigate rather than shrugging it off. **Now automated** — QA's "Player ratings" check
  flags every such player by name (built 2026-08-22).
  - How to triage one: open the fixture on FotMob. If **nobody** in the match is rated it's a
    genuine upstream gap (common in lower divisions). If everyone else is rated, player
    matching is broken — check `fotmobId` matching in `getPlayerStatsFromMatch`.
  - Confirmed genuine gaps so far: Pukstas (2026-07-09, fixture 5786501, 0 of 44 rated) and
    Boyd (2026-08-21, fixture 5750700, 0 rated). Do not assume the next null is also upstream.
- Render fallback still not deployed (low priority, has cold starts)
  > **AMENDED 2026-08-22:** wrong — no Render fallback exists. See `## Open questions /
  > Next steps` item 5 at the top of the file.
- **Before Oct 24, 2026**: reinstall the 90-day SSL cert when `monitor.log` shows
  `cert=expiring<14d` (see Known Issues). Auto-renewal cannot be trusted.

### Done this session (2026-08-22)
- Corrected 7 players in both `players.json` files; deployed backend (v2.8.0) + frontend.
- `/api/players` serves the live roster; the frontend now reads it instead of its bundle.
- Transfers to an unrecognised league are held for review, never auto-applied.
- Drift-sweep coverage is reported and asserted (`driftCheck.complete`).
- `monitor.sh` gained drift/review/alert checks and **email alerting** (needs SMTP set up).
- QA: 8 → 12 checks; fixed 3 checks that were silently passing on discarded stdin.

### Done previously (2026-07-26)
- Added public-cert-expiry monitoring to `qa-check.sh` ("TLS cert" check) and NAS
  `monitor.sh` (step 5, logs `cert=`; old script backed up to `monitor.sh.bak`).

---

## Key Reminders

- **NAS deploy**: `./deploy.sh nas` — works on home network (192.168.4.61) *or* over Tailscale (auto-falls back to 100.84.253.80 when the local IP is unreachable; disconnect NordVPN first)
- **`ssh nas` alias points to Tailscale (100.84.253.80)** — unreachable on home network without Tailscale up. For ad-hoc NAS commands on home network, SSH directly: `ssh -i ~/.ssh/nas_deploy admin@192.168.4.61`
- **Force client cache clear**: bump `CACHE_VERSION` in `src/App.jsx` (currently `'4'`)
- **Do NOT use the global deploy skill** — it syncs project root and corrupts the container; always use project-local `./deploy.sh nas`
- Lineup status only shows for upcoming games within 45 min of kickoff
- Julian Hall's FotMob name is "Julian Zakrzewski" — ID-based matching handles this automatically
