# Handover — Americans Abroad
_Last updated: 2026-09-02 (evening)_

> **How to use**: Read this first at the start of every session. Update it at the end.
> Static architecture and deployment docs live in `CLAUDE.md`.
> Recurring gotchas (proxy wipes, cert lapses, SSH aliases, FotMob API retirement) live in
> **Known Issues / Gotchas** and **Key Reminders** in the archive below — check there before
> debugging anything infrastructural.

## Current state

- **Backend + frontend live and verified.** Working tree clean, `main` == `origin/main` ==
  `e147202`. Nothing committed-but-undeployed; nothing deployed-but-uncommitted.
- **Roster is 63 players** (was 60). Drift sweep baseline follows `/api/health` — still no
  hardcoded count anywhere.
- **Player photos derived from `fotmobId`**, not stored — the three new players get one free.
- **Game-time monitoring is live** (`monitor-live.sh`, cron `*/5`), and **cron-firing was
  verified**, not assumed. It self-heals a wiped proxy rule and a container that did not come
  back on its own. `/api/health` carries `matchWindow`.
- **Both "match stuck on upcoming" bugs are fixed** — separate faults with an identical
  symptom: FotMob's CDN serving hour-old pages (`0c4abd8`), and FotMob's team page
  contradicting its own match page (`9a31a96`).

## Recent changes

- **2026-09-02** — **Deployed the three players added from Danny's phone** (`e147202`, PR #1,
  authored 2026-09-01): Luca Bombino (Stoke City), Caleb Wiley (Preston North End, on loan
  from Chelsea), Jack McGlynn (Stoke City). All Championship. Roster 60 → 63.
  - Verified live: `/api/players` returns 63 with all three and their FotMob IDs; Ionos
    serving bundle `index-Cf45k0Q3.js`, matching the local build.
  - **CORRECTION to an earlier note in this entry**: `players.json` is *not* durable runtime
    state. Per `matchTrackerFD.js:77-80`, it is baked into the image and **reverts on every
    rebuild**; the durable record of an applied transfer is the volume-backed
    `data/cache/rosterDrift.json`, re-applied to the in-memory roster on startup. So the
    pre-deploy diff was a reasonable check but not the real safeguard — **the cache volume
    is**. Never rsync into `backend/data/cache/`.
  - `./deploy.sh nas` rebuilt the image; the `COPY data/ ./data/` layer was not cached,
    which is consistent with the roster being baked in rather than volume-mounted.
- **2026-09-02 eve** — **Fixed the global `/deploy` skill's silent no-op** (open item 1, now
  settled). `~/.claude/skills/deploy/deploy.sh` NAS excludes are now a `NAS_EXCLUDES` variable
  overridable per project, defaulting to the previous `node_modules .env dist data` so **all
  12 NAS projects keep their exact current behavior**. This project's `.env` overrides it to
  `node_modules .env dist backend/data/cache`.
  - **Anchoring to `--exclude=/data` was considered and rejected** — it would newly expose
    `job-search/backend/data` (untracked SQLite + WAL) to being clobbered by a stale laptop
    copy. Six other projects keep live DBs under `data/`; the exclude is load-bearing.
  - **Added a pre-sync guard**: the NAS deploy now warns when a git-tracked file matches an
    exclude, since tracked files are source by definition. It warns and continues, never
    blocks. It reproduces today's fault — it flags all three of
    `backend/data/players.json`, `backend/data/playerStats.json`, `src/data/players.json`.
  - Surfaced a third file I had missed: `backend/data/playerStats.json` (manual stat
    overrides, `manualStatsFile`) was never deploying either.
  - Verified end-to-end by running the patched global script: roster 63 live, and the
    Pukstas drift entry survived with its original `firstSeen`.
  - Backup of the pre-change script at `~/.claude/skills/deploy/deploy.sh.bak-2026-09-02`
    (`~/.claude` is not under version control). Delete once you are happy with it.
- **2026-09-02** — **Deployed via `./deploy.sh push`**: `4846873` is on `origin/main`.
- **2026-08-29 night** — **Match-page fallback for status** (`9a31a96`). Past
  `MATCH_PAGE_FALLBACK_MIN` (5) minutes after kickoff, a match the team page still calls
  "not started" is checked against its own match page and the status (and score) taken from
  there. Found by the monitor built minutes earlier. Verified live on América v Puebla.
- **2026-08-29 late** — **Game-time monitoring** (`ea32ed1`). `getMatchWindow()` on
  `/api/health` reports `{active, liveMatches, nextKickoffInMin, stuckUpcoming}`, computed
  from live state each call so postponed/delayed kickoffs need no special handling.
  `monitor-live.sh` runs every 5 min and exits in milliseconds unless a game is on.
  - **The window is computed in Node because the NAS cannot do it**: no `jq`, no `python`,
    and `date -d` rejects ISO timestamps. The monitor reads one boolean.
  - **Closes a real blind spot**: it makes an end-to-end request *through Apache*. Every other
    check, here and in `monitor.sh`, hits localhost — which is why the proxy-rule wipe that
    killed the public site three times left every check green.
  - **Alert-only, never auto-restart, for a stuck match.** Today that was stale upstream data;
    a restart fixes nothing, masks the cause, and costs a poll interval. Restart on
    *unresponsive*, alert on *wrong*.
  - Fails open twice over: unreachable health runs the checks anyway, and a payload with no
    `matchWindow` at all (older backend) also fails open instead of concluding "no game on".
  - A successful self-heal **always** alerts — silent healing is how a recurring fault stays
    invisible.
- **2026-08-29 eve** — **Dropped Dylan Vanney** (`60a9e16`), and hand-cleared the phantom drift
  entry it stranded. See open item 4.
- **2026-08-29 eve** — **Fixed live matches stuck on "upcoming"** (`0c4abd8`). FotMob's CDN was
  serving hour-old team pages. Full root-cause write-up in the archive.
- **2026-08-29** — **Headshots** from `headshotUrl(player)`; `PlayerCard.jsx` no longer reads
  the `image` field. FotMob headshots are transparent cutouts, hence the `--headshot-bg` token.
  The 36 Wikimedia URLs and 13 files in `public/images/` are now unreferenced but left in place.
- **2026-08-29** — **Roster sweep 49 → 61** across seven leagues, then −1 for Vanney.
  Chandler deliberately skipped; FotMob lists managers in the squad payload under a `coach`
  group; `positionIdsDesc` can disagree with the squad group. Detail in the archive.

## Open questions / Next steps

1. ~~Global `/deploy` cannot ship this roster~~ **SETTLED 2026-09-02 eve.** Fixed via
   `NAS_EXCLUDES` (see Recent changes). Both `./deploy.sh nas` and the global skill now
   deploy the roster correctly, and a tracked-file-excluded warning makes any future
   recurrence loud instead of silent. **Do not "simplify" this by anchoring the global
   exclude to `/data`** — that breaks `job-search`. One benign warning is expected in
   `abc-lottery` (`data/people.example.json`, correctly stays local).
2. **A fourth player may be missing.** The phone branch was named
   `claude/add-players-bombino-wiley-mcglynn-oifole`, but only three players are in the
   commit and "Oifole" appears nowhere in the roster or the diff. Either that player was
   dropped mid-session or the name was wrong. **Needs Danny to confirm who was intended.**
3. **Rotate the Gmail app password.** *(Carried over, still not done — oldest live risk here.)*
   A `curl -v` trace on 2026-08-22 printed the base64 AUTH line, which decodes to the password;
   it is in that session's scrollback. Rotate at <https://myaccount.google.com/apppasswords>,
   then update **both** `/share/Container/abc-lottery/.env` (`GMAIL_APP_PASSWORD`) and
   `/share/Container/americans-abroad/alert.conf` (`SMTP_PASS`, spaces stripped).
4. **Drift entries are never pruned for removed players.** Removing a player strands their
   `rosterDrift` entry permanently and it shows in `/api/health` as a pending transfer forever.
   Bit us with Vanney; cleared by hand. Fix: drop entries whose `playerId` is not in the
   roster. **Not done.**
5. **Pukstas drift pending as of 2026-09-02**: Hajduk Split → Middlesbrough, day 1 of the
   3-day `TRANSFER_APPLY_THRESHOLD_DAYS` threshold, `applied: false`. If it auto-applies it
   will interact with items 12 and 10 — his `league` moves off the Croatian First League, and
   `country` will **not** be updated. Watch it land rather than assuming it landed clean.
6. **The monitor scripts are not in this repo.** `monitor.sh` and `monitor-live.sh` live in
   `~/.claude/skills/qa-americans-abroad/` and on the NAS. Consistent with prior practice, but
   the scripts that keep the site alive have no version control and no review history.
7. **Deactivate the retired `FOOTBALL_DATA_KEY`** in the football-data.org account.
   *(Carried over, status unknown.)* Scrubbed from `CLAUDE.md`, but it is in already-public git
   history, so scrubbing the file did not revoke it.
8. **The cache-bust fix cannot help the first cycle after a restart.** The bypass needs prior
   state to fire. Self-heals on cycle 2, but a restart during live games costs one poll
   interval (5 min when nothing is live, 60s once it is). Accepted.
9. **The sweep finds *labelled* Americans, not *eligible* ones.** FotMob's `ccode` is a single
   primary nationality, so an uncapped dual national filed under another country — the next
   Musah — is invisible. Needs a hand-maintained watchlist. **Not built.**
10. **Drift auto-apply updates `team` / `league` / `teamFotmobId` but never `country`** — hence
    `Eredivisie/Germany`, `Ligue 1/Belgium`, `MLS/England` in the roster.
11. **`abbrevPosition` has no entry for `'Left Winger'` / `'Right Winger'`** (only
    `'Left Wing'` / `'Right Wing'`), so the meta line reads "Right Winger" instead of "RW".
    One-line fix in `src/utils/playerUtils.js`.
12. **Two players sit in leagues the site doesn't list** — Boyd (3. Liga), Pukstas (Croatian
    First League) — visible only under "all". Fixing means adding both to `leagues` in *both*
    players.json files. Left for Danny. **Note the three new players are all Championship,
    which the site does list.**
13. **Six orphan headshots in `public/images/`** for players not in the roster: Berchimas,
    DeJuan Jones, Luca Moisa, Quinn Sullivan, Liam West. Note `qa-check.sh` still probes
    **Quinn Sullivan's** profile for its FotMob player-scrape check though he is not rostered.
14. **Expect routine "Player ratings" warnings while Gozo features for the U21s.** FotMob
    publishes no ratings for Premier League 2 or 3. Liga. Still triage each one.
15. **Before Oct 24, 2026**: reinstall the 90-day myQNAPcloud SSL when `monitor.log` shows
    `cert=expiring<14d`. No renew button — you reinstall. Cert valid to
    **Oct 24 19:45:51 2026 GMT**.
16. ~~Render fallback~~ **SETTLED 2026-08-22 — there is no Render fallback.** The NAS is the
    only backend. Do not reintroduce "fallback backend" language.
17. **Optional hardening not built**: a weekly heartbeat email would prove the alert channel
    between incidents; `TRANSFER_APPLY_THRESHOLD_DAYS` is still 3.

---

# 📚 ARCHIVE

_Everything below is the historical record, newest first. Current status lives above._

## 2026-08-29 — FotMob contradicts its own endpoints (RESOLVED same night)

> **AMENDED 2026-08-29 (night):** fixed in `9a31a96` — the match-page fallback described
> under "Proposed fix" below was implemented and verified live on this exact fixture
> (`CF América — team page said upcoming, match page says LIVE (HT)`). The diagnosis
> below is kept because the two bugs share one symptom and a future session needs to
> be able to tell them apart.

Found minutes after the game-time monitor went live, which is what it was built to catch.

**Symptom**: América vs Puebla read "upcoming" on the site for 50+ minutes while the match was
1-0 in the second half.

**This is NOT the CDN staleness fixed in `0c4abd8`.** Both requests below were cache-busted and
returned `age: null`:

```
team overview (teams/6576/overview)  ->  "started": false        <- what matchTrackerFD reads
match page    (match/1000014549)     ->  "started": true, "ongoing": true,
                                         liveTime "40:51", score "1 - 0"
```

FotMob simply does not update `nextMatch.status` on the team page for this fixture.
`matchTrackerFD.updateMatchDataFromFotMob` classifies status **only** from the team page
(`matchToUse.status?.started || matchToUse.status?.ongoing`), so such a match can never reach
`live`, no matter how fresh the fetch is.

**Scope**: fixture id `1000014549` sits in the same `>1000000000` id space this archive already
records as unreliable for U21 games ("does not resolve at fotmob.com/matches/x/<id>"). Liga MX
and youth fixtures both land there, so treat this as a *class* of fixtures rather than one game.

**Proposed fix (not implemented)**: when a team-page match has a kickoff in the past but still
reports `started: false`, fetch that fixture's match page and take status from there. Cost is one
extra request per suspect fixture, only after kickoff, so it is naturally rate-limited. The
`matchWindow.stuckUpcoming` field already identifies exactly which fixtures qualify.

**Do not "fix" this by restarting anything** — the data is wrong at the source; a restart only
hides it and costs a poll interval.

## 2026-08-29 — Live matches stuck on "upcoming" for a whole half (RESOLVED)

**Symptom**: the site stopped updating the moment the 7:30pm ET games kicked off. Backend was
healthy throughout — scrape fresh, 0 failures, drift sweep 61/61 complete. Every localhost-style
check passed while the site showed nothing happening. (Third time this pattern has bitten: a
green monitor does not mean correct data.)

**Root cause**: FotMob serves its team pages through a CDN with
`cache-control: public, max-age=3600, s-maxage=3600`. The container was handed a copy cached
before kickoff — measured `age: 3102` on a response still reporting `started: false, ongoing`
absent, while the match page for the same fixture showed `Half-Time`.

**Why the existing safeguard did nothing.** `matchTrackerFD.js` already detects a passed kickoff
and bypasses its own cache — the logs show `Bypassing cache for Philadelphia Union` on every
cycle. It bought nothing, because the stale copy was *upstream*, not ours. Worse, it was
**self-reinforcing**: nothing ever reached `live`, so `hasLiveMatches()` stayed false and the 60s
live-polling interval never engaged — the app stayed on the 5-minute interval through the whole
first half.

**What was measured, so nobody re-litigates it:**

| Approach | Result |
|---|---|
| Plain fetch | `age=3102` — stale, `started:false` |
| `Cache-Control: no-cache` request header | `age=3103` — **ignored by the CDN** |
| Cache-busting query param | `age=null` — fresh, `ongoing:true`, real live minute |

**Fix** (`0c4abd8`): `fetchNextData` takes a `bustCdnCache` flag appending a throwaway `_cb`
query param — the only thing that reliably reaches the origin. Threaded through team overview
(when `forLiveData`), match details (when `forLiveData`), and **player pages always** — their CDN
copy was measured at `age: 3792`, over an hour old, which had been silently degrading recent-match
and ratings data all along. Our own 1h cache already throttles that path to roughly one origin
fetch per player per hour. Routine polling still rides the CDN.

**Confirmed live**: six matches flipped to `live` with correct minutes (47', 50', 7', 8') on the
first cycle after deploy, and polling dropped to the 60s interval.

**Known limit**: the bypass needs prior state to fire, so the first cycle after a restart cannot
bust and stores whatever the CDN returns. Self-heals on cycle 2.

### Same session — Vanney removal and the drift-pruning gap

Dropping a player leaves their `rosterDrift` entry orphaned forever: `checkRosterDrift` only
calls `clearDrift` for players it iterates, and it iterates the roster. `/api/health` reported a
pending `Dylan Vanney` transfer for a player who no longer existed. Cleared by hand from the
named volume `americans-abroad_backend-cache`
(`/app/data/cache/rosterDrift.json`, `.bak` written alongside); **the code gap is still open.**

> **NAS gotcha learned here**: the QNAP host has no `python`, and its `base64 -d` rejected
> piped input. To run a one-off script against the cache volume, `scp` the file over and mount
> it into a throwaway container:
> `docker run --rm -v americans-abroad_backend-cache:/app/data/cache -v /tmp/x.js:/tmp/x.js americans-abroad-backend node /tmp/x.js`
> Stop the container first — a running one rewrites the file from its in-memory Map — and make
> sure the restart runs unconditionally, or a failed edit leaves the backend down.

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
