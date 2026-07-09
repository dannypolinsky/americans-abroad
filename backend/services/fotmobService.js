// FotMob API Service for player statistics
// Fetches detailed player performance data from FotMob

const FOTMOB_API_BASE = 'https://www.fotmob.com/api'

// Node's default fetch sends no User-Agent, which is an easy bot-flag for Cloudflare.
// Send a browser-like UA on every request to look less like an automated scraper.
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

// A single hung FotMob connection would otherwise stall the whole poll cycle
// indefinitely (there is no default timeout on fetch). Abort any request that
// takes longer than this.
const FETCH_TIMEOUT_MS = 15000

// Team name to FotMob ID mapping
const TEAM_IDS = {
  // Serie A
  'AC Milan': 8564,
  'Milan': 8564,
  'Juventus': 9885,
  'Atalanta': 8524,
  'Venezia': 7881,
  'Roma': 8686,
  'Napoli': 9875,
  'Inter': 8636,
  'Inter Milan': 8636,
  'Lazio': 8543,
  'Fiorentina': 8535,
  'Bologna': 9857,
  'Torino': 9804,
  'Udinese': 8600,
  'Genoa': 10233,
  'Cagliari': 8529,
  'Lecce': 9888,
  'Parma': 10167,
  // Premier League
  'Fulham': 9879,
  'Bournemouth': 8678,
  'AFC Bournemouth': 8678,
  'Crystal Palace': 9826,
  'Chelsea': 8455,
  'Arsenal': 9825,
  'Liverpool': 8650,
  'Manchester City': 8456,
  'Manchester United': 10260,
  'Tottenham': 8586,
  'Tottenham Hotspur': 8586,
  'Newcastle United': 10261,
  'Aston Villa': 10252,
  'Brighton': 9817,
  'West Ham': 8654,
  'Everton': 8668,
  'Nottingham Forest': 10203,
  'Brentford': 9937,
  'Wolves': 8602,
  'Wolverhampton': 8602,
  'Leicester City': 8197,
  // Bundesliga
  'Borussia Monchengladbach': 9788,
  'Borussia Mönchengladbach': 9788,
  'Wolfsburg': 8721,
  'Bayer Leverkusen': 8178,
  'Union Berlin': 8149,
  'Hoffenheim': 8226,
  'Augsburg': 8406,
  'FC Koln': 8722,
  '1. FC Köln': 8722,
  'Bayern Munich': 9823,
  'Bayern München': 9823,
  'Borussia Dortmund': 9789,
  'Eintracht Frankfurt': 9810,
  'RB Leipzig': 178475,
  'Freiburg': 8358,
  'Mainz': 8369,
  // Ligue 1
  'AS Monaco': 9829,
  'Monaco': 9829,
  'Toulouse': 9941,
  'Lyon': 9748,
  'Paris Saint-Germain': 9847,
  'PSG': 9847,
  'Marseille': 8592,
  'Lille': 8639,
  'Nice': 9830,
  'Lens': 8588,
  'Strasbourg': 9848,
  // La Liga
  'Celta Vigo': 9910,
  'Real Betis': 8603,
  'Real Madrid': 8633,
  'Barcelona': 8634,
  'Atletico Madrid': 9906,
  'Villarreal': 10205,
  'Real Sociedad': 8560,
  'Athletic Bilbao': 8315,
  'Sevilla': 8302,
  'Valencia': 10267,
  'Getafe': 9866,
  'Osasuna': 8371,
  // Eredivisie
  'PSV Eindhoven': 8640,
  'PSV': 8640,
  'FC Utrecht': 9908,
  'Feyenoord': 10235,
  'Ajax': 8718,
  'AZ Alkmaar': 8703,
  'FC Twente': 8611,
  'FC Groningen': 8674,
  'Vitesse': 10239,
  // Championship
  'Leeds United': 8463,
  'Norwich City': 9850,
  'Coventry City': 8669,
  'Cardiff City': 8344,
  'Stoke City': 10194,
  'Preston North End': 8411,
  'Sheffield United': 8657,
  'West Bromwich Albion': 8659,
  'Middlesbrough': 8549,
  'Barnsley': 8283,
  'Derby County': 10170,
  'Derby': 10170,
  // Scottish Premiership
  'Celtic': 9925,
  'Rangers': 8548,
  // Belgian Pro League
  'Club Brugge': 8342,
  'Royal Antwerp': 8291,
  'Anderlecht': 8316,
  'Westerlo': 10001,
  'Standard Liege': 8364,
  'Cercle Brugge': 8298,
  'St. Truiden': 8378,
  // MLS - IDs from fotmob.com/teams/{ID}/overview/{team-name}
  'Atlanta United': 773958,
  'Austin FC': 1218886,
  'Charlotte FC': 1323940,
  'Colorado Rapids': 8314,
  'FC Cincinnati': 722265,
  'Houston Dynamo': 8259,
  'New England Revolution': 6580,
  'Philadelphia Union': 191716,
  'San Diego FC': 1701119,
  // Liga MX
  'Club America': 6576,
  'CF América': 6576,
  'Club América': 6576,
  'CF America': 6576,
  'Monterrey': 6904,
  // 2. Bundesliga
  'SV Darmstadt': 8262,
  'Darmstadt': 8262,
  // 3. Liga
  'Waldhof Mannheim': 9743,
  // MLS NEXT Pro
  'Crown Legacy FC': 1451868,
  'Chicago Fire FC II': 1348118,
  // Additional MLS
  'Real Salt Lake': 6606,
  'Columbus Crew': 6001,
  'New York Red Bulls': 6514,
  'San Jose Earthquakes': 6603,
  'Toronto FC': 56453,
  // Youth Teams
  'Borussia Dortmund U19': 394130,
  'FC København U19': 2049,
  // Croatian First League
  'Hajduk Split': 10154
}

class FotMobService {
  constructor() {
    this.cache = new Map()
    this.cacheExpiry = 60 * 60 * 1000 // 1 hour for general data
    this.liveCacheExpiry = 45 * 1000 // 45 seconds for live match data
    this.teamDataCache = new Map()

    // Runtime team name -> FotMob ID overrides, registered from players.json
    // (each player carries a teamFotmobId). This lets us resolve a club by ID even
    // when it isn't in the hand-maintained TEAM_IDS map above — important after an
    // auto-applied transfer moves a player to a club we've never scraped before.
    this.teamIdOverrides = new Map()

    // Scrape-health tracking. lastSuccessAt records when we last extracted usable
    // data from FotMob; consecutiveFailures counts genuine connectivity/block/shape
    // failures (not per-team "no data" quirks). Surfaced via /api/health so a silent
    // FotMob block (site keeps serving yesterday's data) becomes visible.
    this.lastSuccessAt = null
    this.lastFailureAt = null
    this.lastFailureReason = null
    this.consecutiveFailures = 0
  }

  // Register team name -> FotMob ID mappings sourced from the roster (players.json).
  registerTeamIds(nameToId) {
    for (const [name, id] of Object.entries(nameToId)) {
      if (name && id) this.teamIdOverrides.set(name, id)
    }
  }

  // Resolve a team name to its FotMob ID, preferring roster-sourced overrides
  // over the static TEAM_IDS map.
  resolveTeamId(teamName) {
    return this.teamIdOverrides.get(teamName) || TEAM_IDS[teamName] || null
  }

  recordScrapeSuccess() {
    this.lastSuccessAt = Date.now()
    this.consecutiveFailures = 0
  }

  recordScrapeFailure(reason) {
    this.consecutiveFailures++
    this.lastFailureAt = Date.now()
    this.lastFailureReason = reason
  }

  getScrapeHealth() {
    return {
      lastSuccessAt: this.lastSuccessAt ? new Date(this.lastSuccessAt).toISOString() : null,
      lastFailureAt: this.lastFailureAt ? new Date(this.lastFailureAt).toISOString() : null,
      lastFailureReason: this.lastFailureReason,
      consecutiveFailures: this.consecutiveFailures
    }
  }

  // fetch() with a hard timeout and a browser-like User-Agent. Used for every
  // outbound FotMob request so one hung connection can't stall the poll cycle.
  async fetchWithTimeout(url) {
    return fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': BROWSER_UA }
    })
  }

  // Fetch a FotMob page and extract its __NEXT_DATA__ JSON blob (server-side rendered
  // data that bypasses the Turnstile API block). Centralizes timeout handling and
  // scrape-health recording for all three HTML scrape paths (team/match/player).
  // Throws on failure; records the failure reason for health reporting first.
  async fetchNextData(url, label) {
    let response
    try {
      response = await this.fetchWithTimeout(url)
    } catch (err) {
      // Network error, DNS failure, or timeout (AbortError) — a real connectivity problem.
      this.recordScrapeFailure(`network:${label}:${err.name === 'TimeoutError' ? 'timeout' : err.message}`)
      throw err
    }

    if (!response.ok) {
      // A 403 challenge page is FotMob/Cloudflare actively blocking us — count it.
      // Other non-OK statuses (e.g. 404 for a team with no page) are per-request
      // quirks, not systemic failures, so they don't touch scrape health.
      if (response.status === 403) {
        this.recordScrapeFailure(`blocked:${label}:403`)
      }
      throw new Error(`FotMob ${label} page returned ${response.status}`)
    }

    const html = await response.text()
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s)
    if (!match) {
      // 200 OK but no __NEXT_DATA__ — the most likely cause is FotMob migrating away
      // from Next.js pages-router, which would break every scrape path at once.
      // Emit a distinct, greppable signal.
      this.recordScrapeFailure(`FOTMOB_PAYLOAD_SHAPE_CHANGED:${label}`)
      console.error(`FotMob: FOTMOB_PAYLOAD_SHAPE_CHANGED — no __NEXT_DATA__ in ${label} page (${url})`)
      throw new Error(`Could not find __NEXT_DATA__ in ${label} page`)
    }

    const nextData = JSON.parse(match[1])
    this.recordScrapeSuccess()
    return nextData
  }

  async fetchFromApi(endpoint, bypassCache = false) {
    const cached = this.cache.get(endpoint)
    const cacheExpiry = bypassCache ? this.liveCacheExpiry : this.cacheExpiry
    if (!bypassCache && cached && Date.now() - cached.timestamp < cacheExpiry) {
      return cached.data
    }

    try {
      const response = await this.fetchWithTimeout(`${FOTMOB_API_BASE}${endpoint}`)

      if (!response.ok) {
        // Detect Cloudflare Turnstile / challenge responses
        if (response.status === 403) {
          const body = await response.text()
          if (body.includes('turnstile') || body.includes('TURNSTILE') || body.includes('Verification required') || body.includes('challenge') || body.includes('cf-') || body.includes('Cloudflare')) {
            console.error(`FotMob API BLOCKED by Cloudflare Turnstile for ${endpoint} - server-side requests are not supported`)
            throw new Error('FotMob API blocked by Cloudflare Turnstile verification')
          }
        }
        throw new Error(`FotMob API error ${response.status}`)
      }

      // Check if response is HTML (Turnstile challenge page) instead of JSON
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        const body = await response.text()
        if (body.includes('turnstile') || body.includes('challenge') || body.includes('<html')) {
          console.error(`FotMob API returned Turnstile challenge page for ${endpoint} (content-type: ${contentType})`)
          throw new Error('FotMob API blocked by Cloudflare Turnstile verification')
        }
        // Try to parse as JSON anyway in case content-type header is wrong
        try {
          const data = JSON.parse(body)
          if (data === null) throw new Error('FotMob API returned null')
          this.cache.set(endpoint, { data, timestamp: Date.now() })
          return data
        } catch {
          throw new Error(`FotMob API returned non-JSON response (content-type: ${contentType})`)
        }
      }

      const data = await response.json()

      if (data === null) {
        throw new Error('FotMob API returned null')
      }

      // Detect Turnstile block returned as JSON (200 OK with error body)
      if (data.code === 'TURNSTILE_REQUIRED' || data.error === 'Verification required') {
        console.error(`FotMob API BLOCKED by Turnstile for ${endpoint} (returned as JSON)`)
        throw new Error('FotMob API blocked by Cloudflare Turnstile verification')
      }

      this.cache.set(endpoint, {
        data,
        timestamp: Date.now()
      })

      this.recordScrapeSuccess()
      return data
    } catch (error) {
      if (error.message.includes('Turnstile')) {
        console.error(`FotMob BLOCKED: ${endpoint} - Cloudflare Turnstile is blocking server-side API access`)
      } else {
        console.error(`FotMob API error for ${endpoint}:`, error.message)
      }
      throw error
    }
  }

  // Get team data including squad and recent matches
  // FotMob removed their /api/teams endpoint — now scrapes __NEXT_DATA__ from the team overview page
  async getTeamData(teamName, forLiveData = false) {
    const teamId = this.resolveTeamId(teamName)
    if (!teamId) {
      console.log(`FotMob: No team ID mapping for ${teamName}`)
      return null
    }

    const cacheKey = `team_html_${teamId}`
    const cached = this.cache.get(cacheKey)
    const cacheExpiry = forLiveData ? this.liveCacheExpiry : this.cacheExpiry
    if (!forLiveData && cached && Date.now() - cached.timestamp < cacheExpiry) {
      return cached.data
    }

    try {
      const nextData = await this.fetchNextData(`https://www.fotmob.com/teams/${teamId}/overview`, 'team')
      const fallback = nextData?.props?.pageProps?.fallback
      if (!fallback) {
        throw new Error('No fallback data in team __NEXT_DATA__')
      }
      const teamKey = Object.keys(fallback).find(k => k.startsWith('team-'))
      if (!teamKey) {
        throw new Error('No team key found in fallback data')
      }
      const teamData = fallback[teamKey]
      this.cache.set(cacheKey, { data: teamData, timestamp: Date.now() })
      return teamData
    } catch (error) {
      console.error(`FotMob: Error fetching team ${teamName}:`, error.message)
      return null
    }
  }

  // Get match details including player stats
  // Falls back to scraping the match page HTML if the API is blocked by Turnstile
  async getMatchDetails(matchId, forLiveData = false) {
    try {
      return await this.fetchFromApi(`/matchDetails?matchId=${matchId}`, forLiveData)
    } catch (error) {
      // Fall back to HTML scraping for any API failure (404, Turnstile, etc.)
      console.log(`FotMob: matchDetails API failed for ${matchId} (${error.message}), trying HTML scrape...`)
      return await this.getMatchDetailsFromHtml(matchId)
    }
  }

  // Scrape match details from the FotMob match page HTML (__NEXT_DATA__)
  // This bypasses Turnstile because the data is server-side rendered
  async getMatchDetailsFromHtml(matchId) {
    const cacheKey = `html_match_${matchId}`
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.liveCacheExpiry) {
      return cached.data
    }

    try {
      const nextData = await this.fetchNextData(`https://www.fotmob.com/match/${matchId}`, 'match')
      const pageProps = nextData.props?.pageProps
      if (!pageProps) {
        throw new Error('No pageProps in __NEXT_DATA__')
      }

      // Reconstruct the matchDetails-like structure from pageProps
      const data = {
        general: pageProps.general || {},
        header: pageProps.header || {},
        content: pageProps.content || {},
        nav: pageProps.nav || {}
      }

      this.cache.set(cacheKey, { data, timestamp: Date.now() })
      console.log(`FotMob: Got match ${matchId} data from HTML scrape`)
      return data
    } catch (error) {
      console.error(`FotMob: HTML scrape failed for match ${matchId}:`, error.message)
      return null
    }
  }

  // Get player data directly by FotMob player ID
  // Falls back to scraping the player page HTML if the API is blocked by Turnstile
  async getPlayerData(fotmobPlayerId) {
    if (!fotmobPlayerId) return null

    try {
      return await this.fetchFromApi(`/playerData?id=${fotmobPlayerId}`)
    } catch (error) {
      console.log(`FotMob: playerData API failed for ${fotmobPlayerId} (${error.message}), trying HTML scrape...`)
      return await this.getPlayerDataFromHtml(fotmobPlayerId)
    }
  }

  // Scrape player data from the FotMob player page HTML (__NEXT_DATA__)
  async getPlayerDataFromHtml(fotmobPlayerId) {
    const cacheKey = `html_player_${fotmobPlayerId}`
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data
    }

    try {
      const nextData = await this.fetchNextData(`https://www.fotmob.com/players/${fotmobPlayerId}`, 'player')
      const pageProps = nextData.props?.pageProps
      if (!pageProps) {
        throw new Error('No pageProps in player __NEXT_DATA__')
      }

      // Player data lives under pageProps.fallback['player:{id}']
      const fallback = pageProps.fallback || {}
      const playerKey = `player:${fotmobPlayerId}`
      const playerData = fallback[playerKey] || pageProps.data || null
      if (!playerData) {
        throw new Error(`No player data found for key ${playerKey}`)
      }
      this.cache.set(cacheKey, { data: playerData, timestamp: Date.now() })
      console.log(`FotMob: Got player ${fotmobPlayerId} data from HTML scrape`)
      return playerData
    } catch (error) {
      console.error(`FotMob: Player HTML scrape failed for ${fotmobPlayerId}:`, error.message)
      return null
    }
  }

  // Get a player's current club straight from their FotMob profile.
  // Used for transfer-drift detection: primaryTeam reflects where the player plays
  // right now, independent of whatever team string is stored in players.json.
  // Returns { teamId, teamName, onLoan, leagueId, leagueName } or null.
  async getPlayerPrimaryTeam(fotmobPlayerId) {
    const playerData = await this.getPlayerData(fotmobPlayerId)
    const primary = playerData?.primaryTeam
    if (!primary?.teamId) return null
    return {
      teamId: primary.teamId,
      teamName: primary.teamName || null,
      onLoan: !!primary.onLoan,
      leagueId: playerData.mainLeague?.leagueId ?? null,
      leagueName: playerData.mainLeague?.leagueName ?? null
    }
  }

  // Check if two team names refer to the same team
  teamNamesMatch(name1, name2) {
    if (!name1 || !name2) return false
    const normalize = (s) => s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip accent marks (é→e, etc.)
      .replace(/[^a-z0-9]/g, '')
    const n1 = normalize(name1)
    const n2 = normalize(name2)
    // Check if one contains the other or they're equal
    return n1 === n2 || n1.includes(n2) || n2.includes(n1)
  }

  // Get player's recent matches from their FotMob profile
  // If currentTeam is provided, only returns matches for that team
  async getPlayerRecentMatches(fotmobPlayerId, currentTeam = null) {
    const playerData = await this.getPlayerData(fotmobPlayerId)
    if (!playerData) return null

    const recentMatches = []
    const playerName = playerData.name

    // Get matches from recentMatches array
    let matches = playerData.recentMatches || []

    // Filter to only include matches for the current team if specified
    if (currentTeam) {
      matches = matches.filter(m => this.teamNamesMatch(m.teamName, currentTeam))
    }

    for (const match of matches.slice(0, 5)) { // Last 5 matches
      // Determine home/away teams based on isHomeTeam flag
      const playerTeam = match.teamName
      const opponentTeam = match.opponentTeamName
      const isHome = match.isHomeTeam
      const minutesPlayed = match.minutesPlayed || 0

      // Default values - will be updated from match details if available
      let started = null
      let actualMinutesPlayed = minutesPlayed
      let savedMatchEvents = []

      // Fetch match details to get accurate starter status and minutes
      // Only do this for matches where player participated
      if (minutesPlayed > 0 || !match.onBench) {
        try {
          const matchDetails = await this.getMatchDetails(match.id)
          savedMatchEvents = matchDetails?.content?.matchFacts?.events?.events || []
          if (matchDetails?.content?.lineup) {
            const teamLineup = isHome ? matchDetails.content.lineup.homeTeam : matchDetails.content.lineup.awayTeam
            if (teamLineup) {
              // ID-first matching handles players whose FotMob name differs from our
              // display name (e.g. Julian Hall = "Julian Zakrzewski" on FotMob).
              const matchesPlayer = (id, name) => fotmobPlayerId
                ? (id === fotmobPlayerId || id === Number(fotmobPlayerId) || String(id) === String(fotmobPlayerId) || this.playerNameMatches(name, playerName))
                : this.playerNameMatches(name, playerName)

              // Check if player is in starters
              const inStarters = teamLineup.starters?.some(p => matchesPlayer(p.id, p.name))
              // Check if player is in subs
              const inSubs = teamLineup.subs?.some(p => matchesPlayer(p.id, p.name))

              if (inStarters) {
                started = true
              } else if (inSubs) {
                started = false
              }

              // Get accurate minutes from match events
              const events = savedMatchEvents
              if (started === true) {
                // Starter - check if subbed out (swap[1] = player going off)
                const subOut = events.find(e =>
                  e.type === 'Substitution' &&
                  matchesPlayer(e.swap?.[1]?.id, e.swap?.[1]?.name)
                )
                if (subOut) {
                  actualMinutesPlayed = subOut.time || minutesPlayed
                } else if (matchDetails.header?.status?.finished) {
                  actualMinutesPlayed = 90
                }
              } else if (started === false) {
                // Sub - check when they came on (swap[0] = player coming on)
                const subIn = events.find(e =>
                  e.type === 'Substitution' &&
                  matchesPlayer(e.swap?.[0]?.id, e.swap?.[0]?.name)
                )
                if (subIn) {
                  actualMinutesPlayed = 90 - (subIn.time || 0)
                }
              }
            }
          }
        } catch (err) {
          // Fall back to heuristic if match details fetch fails
          started = minutesPlayed >= 60
        }
      }

      // Fall back to heuristic if we couldn't determine from match details
      if (started === null) {
        started = minutesPlayed >= 60
      }

      const matchInfo = {
        matchId: match.id,
        date: match.matchDate?.utcTime,
        homeTeam: isHome ? playerTeam : opponentTeam,
        awayTeam: isHome ? opponentTeam : playerTeam,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        competition: match.leagueName,
        minutesPlayed: actualMinutesPlayed,
        rating: match.ratingProps?.rating ? parseFloat(match.ratingProps.rating) : null,
        started,
        participated: actualMinutesPlayed > 0,
        onBench: !!(match.onBench && actualMinutesPlayed === 0),
        goals: match.goals || 0,
        assists: match.assists || 0,
        yellowCards: match.yellowCards || 0,
        redCards: match.redCards || 0,
        events: []
      }

      // Add all player events with minutes when match detail events are available
      if (savedMatchEvents.length > 0) {
        // ID-first matching so a name mismatch (e.g. Julian Hall) doesn't drop sub events
        const matchesPlayer = (id, name) => fotmobPlayerId
          ? (id === fotmobPlayerId || id === Number(fotmobPlayerId) || String(id) === String(fotmobPlayerId) || this.playerNameMatches(name, playerName))
          : this.playerNameMatches(name, playerName)
        for (const event of savedMatchEvents) {
          if (event.type !== 'Substitution') continue
          if (matchesPlayer(event.swap?.[0]?.id, event.swap?.[0]?.name))
            matchInfo.events.push({ type: 'sub_in', minute: event.time })
          if (matchesPlayer(event.swap?.[1]?.id, event.swap?.[1]?.name))
            matchInfo.events.push({ type: 'sub_out', minute: event.time })
        }
        matchInfo.events.push(...this.parseGoalAssistCardEvents(savedMatchEvents, playerName, fotmobPlayerId))
      } else {
        // Fallback: no match detail events available, use counts without minutes
        for (let i = 0; i < matchInfo.goals; i++) {
          matchInfo.events.push({ type: 'goal', minute: null })
        }
        for (let i = 0; i < matchInfo.assists; i++) {
          matchInfo.events.push({ type: 'assist', minute: null })
        }
        if (matchInfo.yellowCards > 0) matchInfo.events.push({ type: 'yellow', minute: null })
        if (matchInfo.redCards > 0) matchInfo.events.push({ type: 'red', minute: null })
      }

      recentMatches.push(matchInfo)

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    return recentMatches
  }

  // Check if player names match (fuzzy matching)
  playerNameMatches(fotmobName, ourName) {
    if (!fotmobName || !ourName) return false

    const normalize = (name) => name.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .trim()

    const fotmob = normalize(fotmobName)
    const our = normalize(ourName)

    // Exact match
    if (fotmob === our) return true

    // Contains match
    if (fotmob.includes(our) || our.includes(fotmob)) return true

    // Last name match — also check first initial to avoid collisions
    // between teammates with the same surname (e.g. Quinn vs Cavan Sullivan)
    const fotmobParts = fotmob.split(' ')
    const ourParts = our.split(' ')
    const fotmobLast = fotmobParts.pop()
    const ourLast = ourParts.pop()

    if (fotmobLast === ourLast && fotmobLast.length > 3) {
      const fotmobFirst = fotmobParts[0]
      const ourFirst = ourParts[0]
      // If both names have a first name/initial, first letters must match
      if (fotmobFirst && ourFirst && fotmobFirst[0] !== ourFirst[0]) return false
      return true
    }

    return false
  }

  // Get the team's last match with full details (for checking missed games)
  async getTeamLastMatch(teamName) {
    const teamData = await this.getTeamData(teamName)
    if (!teamData?.overview?.lastMatch) return null

    const lastMatch = teamData.overview.lastMatch
    const teamId = this.resolveTeamId(teamName)
    const isHome = lastMatch.home?.id === teamId

    // Get full match details to get the date and competition
    const matchDetails = await this.getMatchDetails(lastMatch.id)

    return {
      id: lastMatch.id,
      homeTeam: lastMatch.home?.name,
      awayTeam: lastMatch.away?.name,
      homeScore: lastMatch.home?.score,
      awayScore: lastMatch.away?.score,
      isHome,
      date: matchDetails?.general?.matchTimeUTCDate || null,
      competition: matchDetails?.general?.leagueName || matchDetails?.header?.tournament?.name || null
    }
  }

  // Get player stats from a match
  async getPlayerStatsFromMatch(matchId, playerName, isHome, forLiveData = false, fotmobPlayerId = null) {
    const match = await this.getMatchDetails(matchId, forLiveData)
    if (!match) return null

    // Parse live minute from various possible locations in the response
    let liveMinute = 0
    const liveTimeStr = match.header?.status?.liveTime?.short ||
                        match.header?.status?.liveTime?.long ||
                        match.general?.matchStatus?.liveTime?.short ||
                        match.general?.matchStatus?.liveTime?.long
    if (liveTimeStr) {
      if (liveTimeStr.toUpperCase() === 'HT') {
        liveMinute = 'HT'
      } else {
        const minuteMatch = liveTimeStr.match(/(\d+)/)
        if (minuteMatch) {
          liveMinute = parseInt(minuteMatch[1], 10)
        }
      }
    }

    // Extract leg/aggregate info for two-legged ties
    const legInfoData = match.content?.matchFacts?.infoBox?.legInfo
    let legInfo = null
    let aggregateScore = null
    let aggregateWinner = null
    if (legInfoData) {
      legInfo = legInfoData.localizedString?.fallback || `Leg ${legInfoData.bestOfNum}`
      // Aggregate data is available on second legs
      const aggStr = match.header?.status?.aggregatedStr
      if (aggStr) {
        aggregateScore = aggStr
        const whoLost = match.header?.status?.whoLostOnAggregated
        if (whoLost) {
          // The winner is the other team
          const homeTeam = match.header?.teams?.[0]?.name
          const awayTeam = match.header?.teams?.[1]?.name
          aggregateWinner = whoLost === homeTeam ? awayTeam : homeTeam
        }
      }
    }

    // Get basic match info
    const result = {
      matchId,
      homeTeam: match.header?.teams?.[0]?.name || match.general?.homeTeam?.name,
      awayTeam: match.header?.teams?.[1]?.name || match.general?.awayTeam?.name,
      homeScore: match.header?.teams?.[0]?.score ?? match.general?.homeTeam?.score,
      awayScore: match.header?.teams?.[1]?.score ?? match.general?.awayTeam?.score,
      competition: match.general?.leagueName || match.header?.tournament?.name,
      date: match.general?.matchTimeUTCDate,
      liveMinute, // Include the current minute for live matches
      legInfo,
      aggregateScore,
      aggregateWinner,
      participated: false,
      started: false,
      onBench: false,
      minutesPlayed: 0,
      rating: null,
      goals: 0,
      assists: 0,
      events: []
    }

    // Search lineup for player
    const lineup = match.content?.lineup
    if (!lineup) return result

    const teamLineup = isHome ? lineup.homeTeam : lineup.awayTeam
    if (!teamLineup) return result

    // Search starters — prefer ID match (handles players whose FotMob name differs from our display name)
    let playerData = null
    if (teamLineup.starters) {
      playerData = fotmobPlayerId
        ? (teamLineup.starters.find(p => p.id === fotmobPlayerId || p.id === Number(fotmobPlayerId)) ||
           teamLineup.starters.find(p => this.playerNameMatches(p.name, playerName)))
        : teamLineup.starters.find(p => this.playerNameMatches(p.name, playerName))
      if (playerData) {
        result.started = true
        result.participated = true
      }
    }

    // Search subs if not in starters
    if (!playerData && teamLineup.subs) {
      playerData = fotmobPlayerId
        ? (teamLineup.subs.find(p => p.id === fotmobPlayerId || p.id === Number(fotmobPlayerId)) ||
           teamLineup.subs.find(p => this.playerNameMatches(p.name, playerName)))
        : teamLineup.subs.find(p => this.playerNameMatches(p.name, playerName))
      if (playerData) {
        result.started = false
        result.onBench = true
        // Check if they actually came on
        result.participated = false // Will be updated below if they have events
      }
    }

    if (!playerData) return result

    // Get player performance data
    if (playerData.performance) {
      result.rating = playerData.performance.rating
      result.participated = true
      // Note: Don't extract events here - we'll get them from match events with proper minutes
    }

    // Get detailed stats from match facts POTM section
    const potm = match.content?.matchFacts?.playerOfTheMatch
    if (potm && this.playerNameMatches(potm.name?.fullName || potm.name, playerName)) {
      result.minutesPlayed = potm.minutesPlayed || 90
      result.rating = potm.rating?.num || result.rating
      result.isPotm = true

      // Get detailed stats
      if (potm.stats) {
        const topStats = potm.stats.find(s => s.key === 'top_stats')
        if (topStats?.stats) {
          if (topStats.stats['Goals']?.stat?.value) {
            result.goals = topStats.stats['Goals'].stat.value
          }
          if (topStats.stats['Assists']?.stat?.value) {
            result.assists = topStats.stats['Assists'].stat.value
          }
          if (topStats.stats['Minutes played']?.stat?.value) {
            result.minutesPlayed = topStats.stats['Minutes played'].stat.value
          }
        }
      }
    }

    // Try to get stats from playerStats section using player's FotMob ID
    if (playerData.id && match.content?.playerStats) {
      const playerStats = match.content.playerStats[playerData.id]
      if (playerStats) {
        result.participated = true
        // Extract additional stats if available
      }
    }

    // Helper: check if a match event belongs to this player (ID first, then name)
    // Substitution swap IDs are stored as strings in FotMob data; goal/card IDs are numbers.
    const eventMatchesPlayer = (id, name) => fotmobPlayerId
      ? (id === fotmobPlayerId || id === Number(fotmobPlayerId) || String(id) === String(fotmobPlayerId) || this.playerNameMatches(name, playerName))
      : this.playerNameMatches(name, playerName)

    // Get minutes from match events if not already set
    if (result.participated && result.minutesPlayed === 0) {
      // Default to 90 for starters, check events for subs
      const events = match.content?.matchFacts?.events?.events || []

      // FotMob swap array: swap[0] = player coming IN, swap[1] = player going OUT
      if (result.started) {
        // Look for sub out - starter is in swap[1] when being replaced
        const subOut = events.find(e =>
          e.type === 'Substitution' &&
          eventMatchesPlayer(e.swap?.[1]?.id, e.swap?.[1]?.name)
        )
        if (subOut) {
          result.minutesPlayed = subOut.time || 90
          result.events.push({ type: 'sub_out', minute: subOut.time })
        } else {
          result.minutesPlayed = 90
        }
      } else {
        // Look for sub in - sub is in swap[0] when coming on
        const subIn = events.find(e =>
          e.type === 'Substitution' &&
          eventMatchesPlayer(e.swap?.[0]?.id, e.swap?.[0]?.name)
        )
        if (subIn) {
          result.participated = true
          result.minutesPlayed = 90 - (subIn.time || 0)
          result.events.push({ type: 'sub_in', minute: subIn.time })
        }
      }
    }

    // Goals, assists, and cards from match events (with proper minutes)
    const matchEvents = match.content?.matchFacts?.events?.events || []
    const goalAssistCards = this.parseGoalAssistCardEvents(matchEvents, playerName, fotmobPlayerId)
    result.events.push(...goalAssistCards)
    result.goals   = goalAssistCards.filter(e => e.type === 'goal').length
    result.assists = goalAssistCards.filter(e => e.type === 'assist').length

    return result
  }

  // Get player stats from team API's lastLineupStats (fallback when matchDetails is blocked)
  // Returns player stats similar to getPlayerStatsFromMatch but from team-level data
  // Note: lastLineupStats is for the team's most recently COMPLETED match, not an ongoing one.
  // IMPORTANT: lastMatch and lastLineupStats can update at different rates in FotMob's API,
  // so we validate consistency by checking that the goal count in lineup events matches the team's score.
  async getPlayerStatsFromTeamLineup(teamName, playerName, forLiveData = false, fotmobPlayerId = null) {
    try {
      const teamData = await this.getTeamData(teamName, forLiveData)
      if (!teamData?.overview?.lastLineupStats) return null

      const lineup = teamData.overview.lastLineupStats
      const lastMatch = teamData.overview.lastMatch
      const starters = lineup.starters || []
      const subs = lineup.subs || []

      // Validate that lastLineupStats is consistent with lastMatch
      // by checking if the total goals in lineup events roughly match the team's score
      if (lastMatch) {
        const teamId = lineup.id
        const isHome = lastMatch.home?.id === teamId
        const teamScore = isHome ? lastMatch.home?.score : lastMatch.away?.score

        if (teamScore != null) {
          let lineupGoals = 0
          let lineupOwnGoals = 0
          for (const p of [...starters, ...subs]) {
            for (const e of p.performance?.events || []) {
              if (e.type === 'goal') lineupGoals++
              if (e.type === 'ownGoal') lineupOwnGoals++
            }
          }
          // teamScore = lineupGoals - lineupOwnGoals + opponentOwnGoals
          // opponentOwnGoals is invisible to us, so teamScore >= netLineupGoals always holds for fresh data.
          // Data is only stale if lineup goals exceed team score (mathematically impossible for fresh data).
          const netLineupGoals = lineupGoals - lineupOwnGoals
          if (netLineupGoals > teamScore) {
            console.log(`FotMob: lastLineupStats appears stale for ${teamName} (lineup goals: ${lineupGoals}, own goals: ${lineupOwnGoals}, team score: ${teamScore})`)
            return null
          }
        }
      }

      // Search starters — prefer ID match (handles name mismatches)
      const findById = (arr) => fotmobPlayerId
        ? arr.find(p => p.id === fotmobPlayerId || p.id === Number(fotmobPlayerId))
        : null
      const findByName = (arr) => arr.find(p => this.playerNameMatches(p.name, playerName))

      let playerData = findById(starters) || findByName(starters)
      let started = null
      let participated = null
      let onBench = false

      if (playerData) {
        started = true
        participated = true
      } else {
        // Search subs
        playerData = findById(subs) || findByName(subs)
        if (playerData) {
          started = false
          onBench = true
          // If sub has a rating, they came on
          if (playerData.performance?.rating) {
            participated = true
            onBench = false
          } else {
            participated = false
          }
        }
      }

      if (!playerData) return null

      const perf = playerData.performance || {}
      const events = []

      // Try to get goal/assist/card events with real minutes from match detail events
      let matchDetailEvents = []
      if (lastMatch?.id) {
        try {
          const matchDetails = await this.getMatchDetails(lastMatch.id)
          matchDetailEvents = matchDetails?.content?.matchFacts?.events?.events || []
        } catch (err) {
          // Blocked or failed — fall back to perf.events below
        }
      }

      if (matchDetailEvents.length > 0) {
        events.push(...this.parseGoalAssistCardEvents(matchDetailEvents, playerName))
      } else if (perf.events) {
        // Fallback: parse from performance events without minutes
        for (const evt of perf.events) {
          if (evt.type === 'goal') events.push({ type: 'goal', minute: null })
          if (evt.type === 'assist') events.push({ type: 'assist', minute: null })
          if (evt.type === 'yellowCard') events.push({ type: 'yellow', minute: null })
          if (evt.type === 'redCard' || evt.type === 'secondYellow') events.push({ type: 'red', minute: null })
          if (evt.type === 'ownGoal') events.push({ type: 'goal', minute: null }) // still counts
        }
      }

      return {
        participated,
        started,
        onBench,
        rating: perf.rating || null,
        events,
        goals: events.filter(e => e.type === 'goal').length,
        assists: events.filter(e => e.type === 'assist').length,
        matchId: lastMatch?.id || null, // Which match this data is from
        source: 'fotmob_team_lineup'
      }
    } catch (error) {
      console.error(`FotMob: Error getting team lineup stats for ${playerName}:`, error.message)
      return null
    }
  }

  // Get player's lineup status for an upcoming match (within ~45 min of kickoff)
  // Returns { status: 'starting' | 'bench' | 'not_in_squad' } or null if lineup not available
  async getPlayerLineupStatus(matchId, playerName, isHome, fotmobPlayerId = null) {
    try {
      const match = await this.getMatchDetails(matchId, true) // Always fetch fresh for lineup
      if (!match) return null

      const lineup = match.content?.lineup
      if (!lineup) {
        // Lineup not yet available
        return null
      }

      const teamLineup = isHome ? lineup.homeTeam : lineup.awayTeam
      if (!teamLineup) return null

      // ID-first matching handles players whose FotMob name differs from our display
      // name (e.g. Julian Hall = "Julian Zakrzewski"), which would otherwise show
      // not_in_squad in the pre-kickoff lineup window even when starting.
      const matchesPlayer = (p) => fotmobPlayerId
        ? (p.id === fotmobPlayerId || p.id === Number(fotmobPlayerId) || String(p.id) === String(fotmobPlayerId) || this.playerNameMatches(p.name, playerName))
        : this.playerNameMatches(p.name, playerName)

      // Check if player is in starters
      if (teamLineup.starters) {
        const inStarters = teamLineup.starters.some(matchesPlayer)
        if (inStarters) {
          return { status: 'starting' }
        }
      }

      // Check if player is on bench
      if (teamLineup.subs) {
        const onBench = teamLineup.subs.some(matchesPlayer)
        if (onBench) {
          return { status: 'bench' }
        }
      }

      // Player not found in lineup - not in squad
      return { status: 'not_in_squad' }
    } catch (error) {
      console.error(`FotMob: Error getting lineup status for ${playerName}:`, error.message)
      return null
    }
  }

  // Get expanded player stats for a specific match (used by on-demand stats drawer)
  async getPlayerExpandedStats(matchId, fotmobPlayerId) {
    try {
      const match = await this.getMatchDetails(matchId)
      if (!match) return null

      const playerStats = match.content?.playerStats?.[fotmobPlayerId] ||
                          match.content?.playerStats?.[String(fotmobPlayerId)] ||
                          match.content?.playerStats?.[Number(fotmobPlayerId)]
      if (!playerStats?.stats) return null

      // Stat keys to extract per group, in display order
      const GROUPS = [
        {
          key: 'summary',
          label: 'Summary',
          keys: ['Goals', 'Assists', 'Expected goals (xG)', 'Chances created', 'Pass accuracy', 'Minutes played']
        },
        {
          key: 'attacking',
          label: 'Attacking',
          keys: ['Touches', 'Touches in opp. box', 'Shot attempts', 'Shots on target', 'Non-penalty xG', 'Offsides']
        },
        {
          key: 'passing',
          label: 'Passing',
          keys: ['Accurate passes', 'Key passes', 'Final third passes', 'Long ball accuracy']
        },
        {
          key: 'defending',
          label: 'Defending',
          keys: ['Tackles', 'Interceptions', 'Clearances', 'Blocked shots', 'Recoveries', 'Dribbled past']
        },
        {
          key: 'duels',
          label: 'Duels',
          keys: ['Ground duels won', 'Aerial duels won', 'Fouls committed', 'Fouls drawn']
        }
      ]

      // Flatten all stats from all FotMob groups into a single lookup map
      const allStats = {}
      for (const group of playerStats.stats) {
        if (group.stats) {
          for (const [statKey, statData] of Object.entries(group.stats)) {
            const value = statData?.stat?.value
            if (value !== null && value !== undefined && value !== '') {
              allStats[statKey] = String(value)
            }
          }
        }
      }

      // Build output groups, only including stats that have values
      const result = []
      for (const group of GROUPS) {
        const stats = []
        for (const key of group.keys) {
          if (allStats[key] !== undefined) {
            stats.push({ key, label: key, value: allStats[key] })
          }
        }
        if (stats.length > 0) {
          result.push({ key: group.key, label: group.label, stats })
        }
      }

      return result.length > 0 ? result : null
    } catch (error) {
      console.error(`FotMob: Error getting expanded stats for match ${matchId}:`, error.message)
      return null
    }
  }

  // Parse goal, assist, and card events for a player from a FotMob match events array.
  // Extracted to avoid repeating the same loop in getPlayerStatsFromMatch,
  // getPlayerStatsFromTeamLineup, and getPlayerRecentMatches.
  // Uses fotmobPlayerId for ID-first matching when available; falls back to name matching.
  parseGoalAssistCardEvents(events, playerName, fotmobPlayerId = null) {
    const matches = (id, name) => fotmobPlayerId
      ? (id === fotmobPlayerId || id === Number(fotmobPlayerId) || String(id) === String(fotmobPlayerId) || this.playerNameMatches(name, playerName))
      : this.playerNameMatches(name, playerName)

    const result = []
    for (const event of events) {
      if (event.type === 'Goal') {
        if (matches(event.player?.id ?? event.playerId, event.player?.name || event.nameStr))
          result.push({ type: 'goal', minute: event.time })
        if (matches(event.assistPlayerId, event.assistInput))
          result.push({ type: 'assist', minute: event.time })
      } else if (event.type === 'Card' || event.type === 'Yellow' || event.type === 'Red') {
        if (matches(event.player?.id ?? event.playerId, event.player?.name || event.nameStr)) {
          const cardType = event.card === 'Red' || event.type === 'Red' ? 'red' : 'yellow'
          result.push({ type: cardType, minute: event.time })
        }
      }
    }
    return result
  }

  // Clear caches
  clearCache() {
    this.cache.clear()
    this.teamDataCache.clear()
  }
}

export { FotMobService, TEAM_IDS }
export default FotMobService
