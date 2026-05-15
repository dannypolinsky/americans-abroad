// Match Tracker Service for Football-Data.org API
// Handles tracking matches for American players
// Integrates with FotMob for player-level statistics

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import FotMobService, { TEAM_IDS } from './fotmobService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

class MatchTrackerFD {
  constructor() {
    this.fotmob = new FotMobService()
    this.players = this.loadPlayers()
    this.matchData = new Map() // playerId -> today's match data
    this.lastGameData = new Map() // playerId -> last game data
    this.nextGameData = new Map() // playerId -> next upcoming game (cached)
    this.manualStats = new Map() // playerId -> manually entered stats
    this.isPolling = false
    this.pollInterval = null
    const cacheDir = join(__dirname, '../data/cache')
    mkdirSync(cacheDir, { recursive: true })
    this.cacheFile = join(cacheDir, 'nextGamesCache.json')
    this.lastGameCacheFile = join(cacheDir, 'lastGameCache.json')
    this.manualStatsFile = join(__dirname, '../data/playerStats.json')
    this.loadNextGamesCache()
    this.loadLastGameCache()
    this.loadManualStats()
  }

  loadPlayers() {
    try {
      const data = readFileSync(join(__dirname, '../data/players.json'), 'utf-8')
      const parsed = JSON.parse(data)
      return parsed.players
    } catch (error) {
      console.error('Error loading players:', error)
      return []
    }
  }

  // Load cached next games from file
  loadNextGamesCache() {
    try {
      if (existsSync(this.cacheFile)) {
        const data = JSON.parse(readFileSync(this.cacheFile, 'utf-8'))
        const now = new Date()
        for (const [playerId, gameData] of Object.entries(data)) {
          if (new Date(gameData.kickoff) > now) {
            this.nextGameData.set(parseInt(playerId), gameData)
          }
        }
        console.log(`Loaded ${this.nextGameData.size} cached next games`)
      }
    } catch (error) {
      console.error('Error loading next games cache:', error)
    }
  }

  // Save next games cache to file
  saveNextGamesCache() {
    try {
      const data = Object.fromEntries(this.nextGameData)
      writeFileSync(this.cacheFile, JSON.stringify(data, null, 2))
    } catch (error) {
      console.error('Error saving next games cache:', error)
    }
  }

  // Load last game data from file (populated by updateLastGameData)
  loadLastGameCache() {
    try {
      if (existsSync(this.lastGameCacheFile)) {
        const data = JSON.parse(readFileSync(this.lastGameCacheFile, 'utf-8'))
        for (const [playerId, entry] of Object.entries(data)) {
          this.lastGameData.set(parseInt(playerId), entry)
        }
        console.log(`Loaded ${this.lastGameData.size} cached last games`)
      }
    } catch (error) {
      console.error('Error loading last game cache:', error)
    }
  }

  // Save last game data to file
  saveLastGameCache() {
    try {
      const data = Object.fromEntries(this.lastGameData)
      writeFileSync(this.lastGameCacheFile, JSON.stringify(data, null, 2))
    } catch (error) {
      console.error('Error saving last game cache:', error)
    }
  }

  // Load manual player stats from file
  loadManualStats() {
    try {
      if (existsSync(this.manualStatsFile)) {
        const data = JSON.parse(readFileSync(this.manualStatsFile, 'utf-8'))
        if (data.players) {
          for (const [playerId, playerData] of Object.entries(data.players)) {
            this.manualStats.set(parseInt(playerId), playerData)
          }
          console.log(`Loaded manual stats for ${this.manualStats.size} players`)
        }
      }
    } catch (error) {
      console.error('Error loading manual stats:', error)
    }
  }

  // Get manual stats for a specific date and player
  findManualMatchForDate(playerId, matchDate) {
    const playerStats = this.manualStats.get(playerId)
    if (!playerStats || !playerStats.recentMatches) return null

    const targetDate = new Date(matchDate).toISOString().split('T')[0]

    for (const match of playerStats.recentMatches) {
      if (match.date === targetDate) {
        return {
          opponent: match.opponent,
          isHome: match.isHome,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          result: match.result,
          minutesPlayed: match.minutesPlayed,
          started: match.started,
          participated: match.minutesPlayed > 0,
          events: match.events || []
        }
      }
    }

    return null
  }

  // Get all players grouped by team
  getPlayersByTeam() {
    const byTeam = {}
    for (const player of this.players) {
      if (!byTeam[player.team]) {
        byTeam[player.team] = []
      }
      byTeam[player.team].push(player)
    }
    return byTeam
  }

  // Get today's date in YYYY-MM-DD format (Eastern time)
  // Using Eastern time so that European games played on the same calendar day
  // don't disappear after midnight UTC (which is only ~7pm Eastern)
  getTodayDate() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  }

  // Get date N days ago/ahead in YYYY-MM-DD format (Eastern time)
  getDateOffset(daysOffset) {
    const date = new Date()
    date.setDate(date.getDate() + daysOffset)
    return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  }

  // Check if a lineup player name matches our player's full name.
  // Uses last name as primary key but validates first initial to avoid
  // collisions between teammates with the same surname (e.g. Quinn vs Cavan Sullivan).
  lineupNameMatches(lineupName, ourPlayerName) {
    if (!lineupName || !ourPlayerName) return false
    const normalize = s => s.toLowerCase().replace(/[^a-z\s]/g, '').trim()
    const ln = normalize(lineupName)
    const our = normalize(ourPlayerName)
    if (ln === our || ln.includes(our) || our.includes(ln)) return true
    const lnParts = ln.split(' ')
    const ourParts = our.split(' ')
    const lnLast = lnParts.pop()
    const ourLast = ourParts.pop()
    if (lnLast !== ourLast || lnLast.length <= 3) return false
    const lnFirst = lnParts[0]
    const ourFirst = ourParts[0]
    if (lnFirst && ourFirst && lnFirst[0] !== ourFirst[0]) return false
    return true
  }

  // Check if a team name matches (fuzzy matching)
  teamMatches(apiTeamName, ourTeamName) {
    if (!apiTeamName || !ourTeamName) return false

    // Generic words that shouldn't be used for matching alone
    const genericWords = new Set([
      'united', 'city', 'town', 'athletic', 'sporting', 'club', 'real',
      'rovers', 'wanderers', 'albion', 'hotspur', 'villa', 'forest',
      'county', 'palace', 'ham', 'dynamo', 'olympic', 'olympique'
    ])

    // Normalize but keep spaces for word boundary checking
    const normalizeWithSpaces = (name) => name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents/umlauts
      .replace(/\b(fc|cf|ac|as|afc|sc|sv|bv|ssc)\b/gi, '')
      .replace(/1\./g, '')
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    // Fully normalize (no spaces) for exact comparisons
    const normalize = (name) => normalizeWithSpaces(name).replace(/\s/g, '')

    const apiWithSpaces = normalizeWithSpaces(apiTeamName)
    const ourWithSpaces = normalizeWithSpaces(ourTeamName)
    const api = normalize(apiTeamName)
    const our = normalize(ourTeamName)

    // Exact match (normalized)
    if (api === our) return true

    // Get significant words (length > 3, excluding generic words)
    const apiWords = apiWithSpaces.split(' ').filter(w => w.length > 3 && !genericWords.has(w))
    const ourWords = ourWithSpaces.split(' ').filter(w => w.length > 3 && !genericWords.has(w))

    // If no significant non-generic words, fall back to full normalized match
    if (ourWords.length === 0 || apiWords.length === 0) {
      return api === our
    }

    // For single-word team names like "Milan", "Juventus", "Arsenal"
    // Require exact word match in the other name's words
    if (ourWords.length === 1) {
      const ourWord = ourWords[0]
      // Check for exact word match only (not substring)
      return apiWords.some(apiWord => apiWord === ourWord)
    }

    // For multi-word team names, require ALL significant words to match
    // This prevents false matches like West Brom matching West Ham,
    // or Borussia Dortmund matching Borussia Monchengladbach
    return ourWords.every(ourWord =>
      apiWords.some(apiWord => apiWord === ourWord || apiWord.startsWith(ourWord) || ourWord.startsWith(apiWord))
    )
  }

  // Parse player events from match details
  // Check if match details have any event data (goals, subs, bookings)
  hasEventData(matchDetails) {
    return (matchDetails.goals && matchDetails.goals.length > 0) ||
           (matchDetails.substitutions && matchDetails.substitutions.length > 0) ||
           (matchDetails.bookings && matchDetails.bookings.length > 0)
  }

  parsePlayerEvents(matchDetails, playerName, isHome) {
    const events = []
    const teamSide = isHome ? 'HOME_TEAM' : 'AWAY_TEAM'
    const playerLastName = playerName.split(' ').pop().toLowerCase()

    // Parse goals
    if (matchDetails.goals) {
      for (const goal of matchDetails.goals) {
        const scorerName = goal.scorer?.name?.toLowerCase() || ''
        const assistName = goal.assist?.name?.toLowerCase() || ''

        if (scorerName.includes(playerLastName)) {
          events.push({ type: 'goal', minute: goal.minute })
        }
        if (assistName.includes(playerLastName)) {
          events.push({ type: 'assist', minute: goal.minute })
        }
      }
    }

    // Parse substitutions
    if (matchDetails.substitutions) {
      for (const sub of matchDetails.substitutions) {
        const playerOutName = sub.playerOut?.name?.toLowerCase() || ''
        const playerInName = sub.playerIn?.name?.toLowerCase() || ''

        if (playerOutName.includes(playerLastName)) {
          events.push({ type: 'sub_out', minute: sub.minute })
        }
        if (playerInName.includes(playerLastName)) {
          events.push({ type: 'sub_in', minute: sub.minute })
        }
      }
    }

    // Parse bookings (cards)
    if (matchDetails.bookings) {
      for (const booking of matchDetails.bookings) {
        const bookedPlayerName = booking.player?.name?.toLowerCase() || ''
        if (bookedPlayerName.includes(playerLastName)) {
          const cardType = booking.card === 'YELLOW_CARD' ? 'yellow' : 'red'
          events.push({ type: cardType, minute: booking.minute })
        }
      }
    }

    return events
  }

  // Calculate minutes played from events
  calculateMinutesPlayed(events, matchMinute = 90) {
    const subIn = events.find(e => e.type === 'sub_in')
    const subOut = events.find(e => e.type === 'sub_out')

    if (subIn && subOut) {
      return subOut.minute - subIn.minute
    } else if (subIn) {
      return matchMinute - subIn.minute
    } else if (subOut) {
      return subOut.minute
    }
    // No sub events - either played full match or didn't play
    // If they have other events, assume they played
    if (events.length > 0) {
      return matchMinute
    }
    return matchMinute // Default to full match
  }

  // Check if we need to refresh next game for a team
  needsNextGameRefresh(teamName) {
    const players = this.players.filter(p => p.team === teamName)
    for (const player of players) {
      const cached = this.nextGameData.get(player.id)
      if (!cached) return true
      if (new Date(cached.kickoff) <= new Date()) return true
    }
    return false
  }

  // Update match data from FotMob for all players
  async updateMatchDataFromFotMob(forLiveData = false) {
    try {
      const playersByTeam = this.getPlayersByTeam()
      const today = this.getTodayDate()
      const processedTeams = new Set()
      let addedCount = 0

      for (const [teamName, players] of Object.entries(playersByTeam)) {
        // Skip if we already processed this team
        if (processedTeams.has(teamName)) continue
        processedTeams.add(teamName)

        // Query FotMob for this team's data
        // Bypass the 1-hour cache if we already have an "upcoming" FotMob match for this team
        // whose kickoff time has already passed — the game may have gone live or finished while
        // the cached team data still shows it as upcoming.
        let teamCacheBypass = forLiveData
        if (!teamCacheBypass) {
          for (const player of players) {
            const existing = this.matchData.get(player.id)
            if (existing?.source === 'fotmob' && existing?.status === 'upcoming' && existing?.kickoff) {
              if (new Date(existing.kickoff) <= new Date()) {
                teamCacheBypass = true
                console.log(`FotMob: Bypassing cache for ${teamName} — upcoming match kickoff has passed`)
                break
              }
            }
          }
        }
        try {
          const teamData = await this.fotmob.getTeamData(teamName, teamCacheBypass)
          if (!teamData?.overview) continue

          // CRITICAL: Verify FotMob returned data for the correct team
          // This catches wrong team ID mappings in TEAM_IDS
          const fotmobTeamName = teamData.details?.name || teamData.details?.shortName
          if (fotmobTeamName && !this.teamMatches(fotmobTeamName, teamName)) {
            console.log(`FotMob: Team ID mismatch for ${teamName} - FotMob returned "${fotmobTeamName}"`)
            continue
          }

          // Check both nextMatch (live/upcoming) and lastMatch (recently finished)
          // When a match finishes, FotMob moves it from nextMatch to lastMatch
          let matchToUse = null
          const nextMatch = teamData.overview.nextMatch
          const lastMatch = teamData.overview.lastMatch

          // First check if nextMatch is today (live or upcoming)
          if (nextMatch?.status?.utcTime) {
            const nextMatchDate = new Date(nextMatch.status.utcTime).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
            if (nextMatchDate === today) {
              matchToUse = nextMatch
            }
          }

          // If no nextMatch today, check if lastMatch is today (just finished)
          if (!matchToUse && lastMatch?.status?.utcTime) {
            const lastMatchDate = new Date(lastMatch.status.utcTime).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
            if (lastMatchDate === today && lastMatch.status?.finished) {
              matchToUse = lastMatch
            }
          }

          if (!matchToUse) continue

          // Determine match status
          let status = 'upcoming'
          let minute = 0
          if (matchToUse.status?.finished) {
            status = 'finished'
            minute = 90
          } else if (matchToUse.status?.started || matchToUse.status?.ongoing) {
            status = 'live'
            // Try multiple locations for live time (FotMob API structure varies)
            const liveTimeSources = [
              matchToUse.liveTime?.short,
              matchToUse.liveTime?.long,
              matchToUse.status?.liveTime?.short,
              matchToUse.status?.liveTime?.long,
              matchToUse.timeStr,
              matchToUse.status?.reason?.short, // Sometimes shows "45+2" etc
            ]

            for (const liveTimeStr of liveTimeSources) {
              if (liveTimeStr && minute === 0) {
                // Handle halftime indicator
                if (liveTimeStr.toUpperCase() === 'HT') {
                  minute = 'HT'
                  break
                }
                // Extract just the numbers (handles "50‎'‎" -> 50 or "49:18" -> 49)
                const timeMatch = liveTimeStr.match(/(\d+)/)
                if (timeMatch) {
                  minute = parseInt(timeMatch[1], 10)
                }
              }
            }

            // Log for debugging
            if (minute === 0) {
              console.log(`FotMob: Could not parse minute for ${teamName} match. matchToUse keys:`, Object.keys(matchToUse || {}))
            }
          }

          // Determine if player's team is home or away
          const teamId = TEAM_IDS[teamName] || this.getTeamIdFromFotMob(teamName, teamData)

          const homeTeam = matchToUse.home?.name || 'Unknown'
          const awayTeam = matchToUse.away?.name || 'Unknown'
          const homeScore = matchToUse.home?.score ?? 0
          const awayScore = matchToUse.away?.score ?? 0

          // VALIDATION: Verify that the player's team is actually in this match
          // Check by both team ID and team name matching to catch API errors or ID mismatches
          const teamIdMatches = teamId && (matchToUse.home?.id === teamId || matchToUse.away?.id === teamId)
          const teamNameMatches = this.teamMatches(homeTeam, teamName) || this.teamMatches(awayTeam, teamName)

          if (!teamIdMatches && !teamNameMatches) {
            console.log(`FotMob: Skipping match for ${teamName} - team not found in match (${homeTeam} vs ${awayTeam})`)
            continue
          }

          // Determine if home based on ID match first, fallback to name match
          const isHome = teamId && matchToUse.home?.id === teamId
            ? true
            : teamId && matchToUse.away?.id === teamId
              ? false
              : this.teamMatches(homeTeam, teamName)

          // Check if upcoming game is within 45 minutes of kickoff (lineups usually available)
          const kickoffTime = matchToUse.status?.utcTime ? new Date(matchToUse.status.utcTime) : null
          const now = new Date()
          const minutesUntilKickoff = kickoffTime ? (kickoffTime - now) / (1000 * 60) : null
          const isLineupWindow = status === 'upcoming' && minutesUntilKickoff !== null && minutesUntilKickoff <= 45 && minutesUntilKickoff > -15

          // Add match data for all players on this team
          for (const player of players) {
            let playerStats = {
              participated: null,
              minutesPlayed: null,
              started: null,
              rating: null,
              events: [],
              lineupStatus: null // 'starting', 'bench', 'not_in_squad', or null if unknown
            }

            // For live or finished games, fetch detailed player stats
            if (status === 'live' || status === 'finished') {
              try {
                const stats = await this.fotmob.getPlayerStatsFromMatch(matchToUse.id, player.name, isHome, forLiveData, player.fotmobId)
                if (stats) {
                  playerStats = {
                    participated: stats.participated,
                    minutesPlayed: stats.minutesPlayed,
                    started: stats.started,
                    onBench: stats.onBench || false,
                    rating: stats.rating,
                    events: stats.events || [],
                    legInfo: stats.legInfo || null,
                    aggregateScore: stats.aggregateScore || null,
                    aggregateWinner: stats.aggregateWinner || null,
                    lineupStatus: null
                  }
                  // Update minute from match details if we didn't get it from team data
                  if (minute === 0 && stats.liveMinute > 0) {
                    minute = stats.liveMinute
                  }
                  if (stats.participated) {
                    console.log(`FotMob: ${player.name} - ${status}, ${minute}', started: ${stats.started}, rating: ${stats.rating}`)
                  }
                }
              } catch (err) {
                // Continue without player stats if fetch fails
              }

              // Fallback: if matchDetails was blocked (Turnstile), try team API's lastLineupStats
              // The method internally validates that the lineup data is fresh and consistent
              if (playerStats.participated === null) {
                try {
                  const teamLineupStats = await this.fotmob.getPlayerStatsFromTeamLineup(teamName, player.name, forLiveData, player.fotmobId)
                  if (teamLineupStats) {
                    playerStats.participated = teamLineupStats.participated
                    playerStats.started = teamLineupStats.started
                    playerStats.onBench = teamLineupStats.onBench || false
                    playerStats.rating = teamLineupStats.rating
                    playerStats.events = teamLineupStats.events || []
                    if (teamLineupStats.participated) {
                      console.log(`FotMob (team lineup fallback): ${player.name} - ${status}, started: ${teamLineupStats.started}, rating: ${teamLineupStats.rating}`)
                    }
                  }
                } catch (err) {
                  // Continue without fallback
                }
              }
            }

            // For upcoming games within 45 minutes, check lineup
            if (isLineupWindow) {
              try {
                const lineupInfo = await this.fotmob.getPlayerLineupStatus(matchToUse.id, player.name, isHome)
                if (lineupInfo) {
                  playerStats.lineupStatus = lineupInfo.status // 'starting', 'bench', or 'not_in_squad'
                  console.log(`FotMob: ${player.name} lineup status: ${lineupInfo.status} (${Math.round(minutesUntilKickoff)} min to kickoff)`)
                }
              } catch (err) {
                // Continue without lineup status if fetch fails
              }
            }

            this.matchData.set(player.id, {
              fixtureId: matchToUse.id,
              status,
              homeTeam,
              awayTeam,
              homeScore,
              awayScore,
              minute,
              isHome,
              events: playerStats.events,
              kickoff: matchToUse.status?.utcTime,
              venue: '',
              participated: playerStats.participated,
              minutesPlayed: playerStats.minutesPlayed,
              started: playerStats.started,
              onBench: playerStats.onBench || false,
              rating: playerStats.rating,
              lineupStatus: playerStats.lineupStatus,
              legInfo: playerStats.legInfo || null,
              aggregateScore: playerStats.aggregateScore || null,
              aggregateWinner: playerStats.aggregateWinner || null,
              competition: matchToUse.tournament?.name || 'Unknown',
              source: 'fotmob'
            })
            addedCount++
          }

          console.log(`FotMob: Added ${status} match for ${teamName}: ${homeTeam} vs ${awayTeam}`)
        } catch (error) {
          // Silently skip teams that fail - FotMob might not have them
          if (error.message !== 'FotMob API returned null') {
            console.log(`FotMob: Could not get match data for ${teamName}: ${error.message}`)
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      if (addedCount > 0) {
        console.log(`FotMob: Added match data for ${addedCount} players`)
      }
      return true
    } catch (error) {
      console.error('Error updating match data from FotMob:', error)
      return false
    }
  }

  // Helper to get team ID from FotMob data
  getTeamIdFromFotMob(teamName, teamData) {
    // Try to extract from team data
    if (teamData?.details?.id) return teamData.details.id
    // Fallback to TEAM_IDS mapping (imported at top of file)
    return TEAM_IDS[teamName] || null
  }

  // Update last game data
  async updateLastGameData() {
    try {
      // FIRST: Try to get data directly from FotMob Player API for players with fotmobId
      // This is the most reliable source for recent match data
      console.log('Fetching last game data from FotMob Player API...')
      let fotmobPlayerApiCount = 0

      for (const player of this.players) {
        // Fetch from FotMob if: no data yet, OR existing data has no rating (incomplete),
        // OR existing data is more than 24 hours old (may have played a new game since)
        const existingLastGame = this.lastGameData.get(player.id)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const isStale = existingLastGame?.date && new Date(existingLastGame.date) < oneDayAgo
        const needsFotMobData = !existingLastGame || isStale || (existingLastGame.rating === null && existingLastGame.source !== 'fotmob_player_api')
        if (player.fotmobId && needsFotMobData) {
          const fotmobMatch = await this.getPlayerRecentMatchFromFotMob(player)
          if (fotmobMatch && fotmobMatch.date) {
            const lastGameEntry = {
              fixtureId: fotmobMatch.fixtureId || null,
              date: fotmobMatch.date,
              homeTeam: fotmobMatch.homeTeam,
              awayTeam: fotmobMatch.awayTeam,
              homeScore: fotmobMatch.homeScore,
              awayScore: fotmobMatch.awayScore,
              isHome: fotmobMatch.isHome,
              events: fotmobMatch.events || [],
              participated: fotmobMatch.participated,
              minutesPlayed: fotmobMatch.minutesPlayed,
              started: fotmobMatch.started,
              goals: fotmobMatch.goals || 0,
              assists: fotmobMatch.assists || 0,
              rating: fotmobMatch.rating,
              avgRating: fotmobMatch.avgRating || null,
              avgRatingGames: fotmobMatch.avgRatingGames || null,
              competition: fotmobMatch.competition,
              source: 'fotmob_player_api'
            }

            // Include missed game if player's team played more recently without them
            if (fotmobMatch.missedGame) {
              lastGameEntry.missedGame = fotmobMatch.missedGame
              console.log(`FotMob Player API: ${player.name} - missed game on ${new Date(fotmobMatch.missedGame.date).toLocaleDateString()}`)
            }

            this.lastGameData.set(player.id, lastGameEntry)
            fotmobPlayerApiCount++
            console.log(`FotMob Player API: ${player.name} - last played ${new Date(fotmobMatch.date).toLocaleDateString()}`)
          }
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }

      if (fotmobPlayerApiCount > 0) {
        console.log(`FotMob Player API: Got last game data for ${fotmobPlayerApiCount} players`)
      }

      // FALLBACK: Use team API's lastLineupStats for players still missing data
      // This works even when player API and match details are blocked by Turnstile
      const playersByTeamForLineup = this.getPlayersByTeam()
      const processedTeamsForLineup = new Set()
      let teamLineupFallbackCount = 0

      for (const [teamName, players] of Object.entries(playersByTeamForLineup)) {
        // Process teams where players have no data OR have stale data (>24h old)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const playersNeedingData = players.filter(p => {
          const existing = this.lastGameData.get(p.id)
          if (!existing) return true
          if (!existing.date) return true
          return new Date(existing.date) < oneDayAgo
        })
        if (playersNeedingData.length === 0) continue
        if (processedTeamsForLineup.has(teamName)) continue
        processedTeamsForLineup.add(teamName)

        try {
          const teamData = await this.fotmob.getTeamData(teamName)
          if (!teamData?.overview?.lastLineupStats) continue

          const lineup = teamData.overview.lastLineupStats
          const lastMatch = teamData.overview.lastMatch
          if (!lastMatch) continue

          const teamId = TEAM_IDS[teamName]
          const isHome = lastMatch.home?.id === teamId
          const matchDate = lastMatch.status?.utcTime || null

          const matchBase = {
            fixtureId: lastMatch.id || null,
            date: matchDate,
            homeTeam: lastMatch.home?.name || 'Unknown',
            awayTeam: lastMatch.away?.name || 'Unknown',
            homeScore: lastMatch.home?.score ?? 0,
            awayScore: lastMatch.away?.score ?? 0,
            isHome,
            competition: lastMatch.tournament?.name || 'Unknown',
          }

          for (const player of playersNeedingData) {
            const stats = await this.fotmob.getPlayerStatsFromTeamLineup(teamName, player.name, false, player.fotmobId)
            if (stats) {
              this.lastGameData.set(player.id, {
                ...matchBase,
                events: stats.events || [],
                participated: stats.participated,
                minutesPlayed: null, // Not available from team lineup
                started: stats.started,
                goals: stats.goals || 0,
                assists: stats.assists || 0,
                rating: stats.rating,
                source: 'fotmob_team_lineup'
              })
              teamLineupFallbackCount++
              if (stats.participated) {
                console.log(`FotMob Team Lineup: ${player.name} - started: ${stats.started}, rating: ${stats.rating}`)
              }
            } else if (matchDate) {
              // Player not in squad — record the team's game so the UI can show "not in squad"
              this.lastGameData.set(player.id, {
                ...matchBase,
                events: [],
                participated: false,
                minutesPlayed: 0,
                started: false,
                goals: 0,
                assists: 0,
                rating: null,
                notInSquad: true,
                source: 'fotmob_team_lineup'
              })
              teamLineupFallbackCount++
              console.log(`FotMob Team Lineup: ${player.name} - not in squad for ${matchBase.homeTeam} vs ${matchBase.awayTeam}`)
            }
          }

          await new Promise(resolve => setTimeout(resolve, 50))
        } catch (err) {
          // Continue to next team
        }
      }

      if (teamLineupFallbackCount > 0) {
        console.log(`FotMob Team Lineup: Got last game data for ${teamLineupFallbackCount} players`)
      }

      console.log(`Updated last game data for ${this.lastGameData.size} players`)
      this.saveLastGameCache()
      return true
    } catch (error) {
      console.error('Error updating last game data:', error)
      return false
    }
  }

  // Get most recent FotMob data for a player (using direct player API if fotmobId exists)
  // Returns both the last game they played in and any more recent games they missed
  async getPlayerRecentMatchFromFotMob(player) {
    if (!player.fotmobId) return null

    try {
      const recentMatches = await this.fotmob.getPlayerRecentMatches(player.fotmobId, player.team)

      // Helper to determine isHome - use consistent teamMatches function
      const getIsHome = (match) => {
        return this.teamMatches(match.homeTeam, player.team)
      }

      const result = {
        source: 'fotmob_player_api'
      }

      if (recentMatches && recentMatches.length > 0) {
        // Find the most recent match where the player actually participated
        const participatedMatch = recentMatches.find(m => m.participated)
        // Get the most recent match overall from player API (whether they played or not)
        const mostRecentMatch = recentMatches[0]

        // If most recent match from player API is one they didn't play in, include it as missedGame
        // Only if player's current team is actually in that match (guards against transferred players
        // showing old-team games as missed)
        const currentTeamInMatch = mostRecentMatch &&
          (this.teamMatches(mostRecentMatch.homeTeam, player.team) || this.teamMatches(mostRecentMatch.awayTeam, player.team))
        const matchIsFinished = mostRecentMatch && (
          mostRecentMatch.homeScore != null || (mostRecentMatch.date && new Date(mostRecentMatch.date) < new Date())
        )
        if (mostRecentMatch && !mostRecentMatch.participated && participatedMatch && currentTeamInMatch && matchIsFinished) {
          result.missedGame = {
            fixtureId: mostRecentMatch.matchId || null,
            date: mostRecentMatch.date,
            homeTeam: mostRecentMatch.homeTeam,
            awayTeam: mostRecentMatch.awayTeam,
            homeScore: mostRecentMatch.homeScore,
            awayScore: mostRecentMatch.awayScore,
            isHome: getIsHome(mostRecentMatch),
            competition: mostRecentMatch.competition,
            onBench: mostRecentMatch.onBench || false
          }
        }

        // Include the last game they actually played in
        if (participatedMatch) {
          result.fixtureId = participatedMatch.matchId || null
          result.date = participatedMatch.date
          result.homeTeam = participatedMatch.homeTeam
          result.awayTeam = participatedMatch.awayTeam
          result.homeScore = participatedMatch.homeScore
          result.awayScore = participatedMatch.awayScore
          result.isHome = getIsHome(participatedMatch)
          result.minutesPlayed = participatedMatch.minutesPlayed
          result.started = participatedMatch.started
          result.participated = participatedMatch.participated
          result.goals = participatedMatch.goals || 0
          result.assists = participatedMatch.assists || 0
          result.rating = participatedMatch.rating
          result.competition = participatedMatch.competition
          result.events = participatedMatch.events || []
        } else if (mostRecentMatch) {
          // If they haven't played in any recent matches, still include the most recent
          result.date = mostRecentMatch.date
          result.homeTeam = mostRecentMatch.homeTeam
          result.awayTeam = mostRecentMatch.awayTeam
          result.homeScore = mostRecentMatch.homeScore
          result.awayScore = mostRecentMatch.awayScore
          result.isHome = getIsHome(mostRecentMatch)
          result.minutesPlayed = 0
          result.started = false
          result.participated = false
          result.goals = 0
          result.assists = 0
          result.rating = null
          result.competition = mostRecentMatch.competition
          result.events = []
        }

        // Compute average rating from participated matches that have a rating
        const ratedMatches = recentMatches.filter(m => m.participated && m.rating !== null)
        if (ratedMatches.length > 0) {
          const avg = ratedMatches.reduce((sum, m) => sum + m.rating, 0) / ratedMatches.length
          result.avgRating = Math.round(avg * 10) / 10
          result.avgRatingGames = ratedMatches.length
        }

        // Check if team's last match is more recent than what's in player API
        // This catches cases where player is injured/not in squad (game won't appear in their recentMatches)
        if (!result.missedGame && participatedMatch) {
          try {
            const teamLastMatch = await this.fotmob.getTeamLastMatch(player.team)
            if (teamLastMatch && teamLastMatch.date) {
              const teamMatchDate = new Date(teamLastMatch.date)
              const participatedDate = new Date(participatedMatch.date)

              // If team's last match is more recent than player's last participation (and is finished)
              if (teamMatchDate > participatedDate && teamMatchDate < new Date()) {
                // Verify whether the player actually played in this match before marking as missed.
                // FotMob's player API can lag by several minutes after a game ends, so the match may
                // not appear in recentMatches yet even for players who started and scored.
                let matchStats = null
                try {
                  matchStats = await this.fotmob.getPlayerStatsFromMatch(
                    teamLastMatch.id, player.name, teamLastMatch.isHome, true, player.fotmobId
                  )
                } catch (matchErr) {
                  // Couldn't get match details — fall through to missedGame
                }

                if (matchStats && matchStats.participated) {
                  // Player was in the lineup and played — use this as the last game
                  result.fixtureId = teamLastMatch.id || null
                  result.date = teamLastMatch.date
                  result.homeTeam = teamLastMatch.homeTeam
                  result.awayTeam = teamLastMatch.awayTeam
                  result.homeScore = teamLastMatch.homeScore
                  result.awayScore = teamLastMatch.awayScore
                  result.isHome = teamLastMatch.isHome
                  result.competition = teamLastMatch.competition
                  result.minutesPlayed = matchStats.minutesPlayed
                  result.started = matchStats.started
                  result.participated = matchStats.participated
                  result.goals = matchStats.goals || 0
                  result.assists = matchStats.assists || 0
                  result.rating = matchStats.rating
                  result.events = matchStats.events || []
                  console.log(`FotMob: ${player.name} played in team's latest match (player API lagged) — using match lineup data`)
                } else {
                  result.missedGame = {
                    fixtureId: teamLastMatch.id || null,
                    date: teamLastMatch.date,
                    homeTeam: teamLastMatch.homeTeam,
                    awayTeam: teamLastMatch.awayTeam,
                    homeScore: teamLastMatch.homeScore,
                    awayScore: teamLastMatch.awayScore,
                    isHome: teamLastMatch.isHome,
                    competition: teamLastMatch.competition,
                    onBench: !!(matchStats?.onBench)
                  }
                }
              }
            }
          } catch (teamError) {
            console.log(`FotMob Team API error for ${player.team}: ${teamError.message}`)
          }
        }

        return result
      }

      // No recent matches from player API - check team's last match as fallback
      try {
        const teamLastMatch = await this.fotmob.getTeamLastMatch(player.team)
        if (teamLastMatch && teamLastMatch.date) {
          result.missedGame = {
            fixtureId: teamLastMatch.id || null,
            date: teamLastMatch.date,
            homeTeam: teamLastMatch.homeTeam,
            awayTeam: teamLastMatch.awayTeam,
            homeScore: teamLastMatch.homeScore,
            awayScore: teamLastMatch.awayScore,
            isHome: teamLastMatch.isHome,
            competition: teamLastMatch.competition
          }
          return result
        }
      } catch (teamError) {
        console.log(`FotMob Team API fallback error for ${player.team}: ${teamError.message}`)
      }
    } catch (error) {
      console.log(`FotMob Player API error for ${player.name}: ${error.message}`)
    }
    return null
  }

  // Update next game data
  async updateNextGameData() {
    try {
      const playersByTeam = this.getPlayersByTeam()
      const teamsNeedingRefresh = Object.keys(playersByTeam).filter(team =>
        this.needsNextGameRefresh(team)
      )

      if (teamsNeedingRefresh.length === 0) {
        console.log('All next game data is cached and valid')
        return true
      }

      console.log(`Fetching next games for ${teamsNeedingRefresh.length} teams`)

      // Clear stale entries before refreshing so fallbacks work correctly
      for (const teamName of teamsNeedingRefresh) {
        for (const player of playersByTeam[teamName]) {
          const cached = this.nextGameData.get(player.id)
          if (!cached || new Date(cached.kickoff) <= new Date()) {
            this.nextGameData.delete(player.id)
          }
        }
      }

      // Use FotMob as primary source (team-ID-based, reliable)
      for (const teamName of teamsNeedingRefresh) {
        try {
          const teamData = await this.fotmob.getTeamData(teamName)
          const nextMatch = teamData?.overview?.nextMatch
          if (nextMatch?.status?.utcTime) {
            const kickoff = nextMatch.status.utcTime
            if (new Date(kickoff) > new Date()) {
              const homeTeam = nextMatch.home?.name || 'TBD'
              const awayTeam = nextMatch.away?.name || 'TBD'
              const teamId = TEAM_IDS[teamName]
              const isHome = nextMatch.home?.id === teamId
              const players = playersByTeam[teamName]
              for (const player of players) {
                this.nextGameData.set(player.id, {
                  fixtureId: nextMatch.id || null,
                  kickoff,
                  homeTeam,
                  awayTeam,
                  isHome,
                  venue: '',
                  competition: nextMatch.tournament?.name || ''
                })
              }
            }
          }
        } catch (err) {
          // FotMob returned no data for this team's next game
        }
      }

      this.saveNextGamesCache()
      console.log(`Updated next game data for ${this.nextGameData.size} players`)
      return true
    } catch (error) {
      console.error('Error updating next game data:', error)
      return false
    }
  }

  // Get match data for a specific player
  getPlayerMatchData(playerId) {
    return this.matchData.get(playerId) || null
  }

  // Get all match data
  getAllMatchData() {
    const data = {}
    const today = this.getTodayDate()
    for (const player of this.players) {
      let todayMatch = this.matchData.get(player.id)
      // Discard stale entries from previous days — kickoff must be today
      if (todayMatch?.kickoff) {
        const matchDay = new Date(todayMatch.kickoff).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
        if (matchDay !== today) todayMatch = null
      }
      const lastGame = this.lastGameData.get(player.id)
      const nextGame = this.nextGameData.get(player.id)

      if (todayMatch) {
        data[player.id] = {
          ...todayMatch,
          lastGame: lastGame || null,
          nextGame: nextGame || null
        }
      } else if (lastGame || nextGame) {
        data[player.id] = {
          status: 'no_match_today',
          lastGame: lastGame || null,
          nextGame: nextGame || null
        }
      }
    }
    return data
  }

  // Check if any matches are currently live
  hasLiveMatches() {
    for (const matchData of this.matchData.values()) {
      if (matchData.status === 'live') {
        return true
      }
    }
    return false
  }

  // Start polling for live match updates
  async startPolling(intervalMs = 5 * 60 * 1000) {
    if (this.isPolling) {
      console.log('Already polling')
      return
    }

    this.isPolling = true
    console.log(`Starting match polling every ${intervalMs / 1000} seconds`)

    // Initial update from FotMob
    await this.updateMatchDataFromFotMob()
    await this.updateLastGameData()
    await this.updateNextGameData()

    // Polling intervals
    const liveIntervalMs = 60 * 1000 // 60 seconds when live matches
    const normalIntervalMs = intervalMs // 5 minutes otherwise
    let currentInterval = normalIntervalMs
    let isLive = this.hasLiveMatches()

    // Polling function that adjusts interval based on live status
    let pollCount = 0
    const pollForUpdates = async () => {
      pollCount++
      // Always update with fresh data to detect status changes
      isLive = this.hasLiveMatches()
      await this.updateMatchDataFromFotMob(isLive)

      // Every 6 polls (~30 min at normal interval), refresh last game and next game data
      if (pollCount % 6 === 0) {
        await this.updateLastGameData()
        await this.updateNextGameData()
      }

      if (isLive) {
        console.log('Live matches detected - using fresh FotMob data')
      } else {
        console.log('No live matches')
      }

      // Adjust polling interval if live status changed
      const newInterval = isLive ? liveIntervalMs : normalIntervalMs
      if (newInterval !== currentInterval) {
        currentInterval = newInterval
        clearInterval(this.pollInterval)
        this.pollInterval = setInterval(pollForUpdates, currentInterval)
        console.log(`Polling interval changed to ${currentInterval / 1000} seconds`)
      }
    }

    // Set up initial interval
    currentInterval = isLive ? liveIntervalMs : normalIntervalMs
    console.log(`Initial polling interval: ${currentInterval / 1000} seconds`)
    this.pollInterval = setInterval(pollForUpdates, currentInterval)
  }

  // Stop polling
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
    this.isPolling = false
    console.log('Stopped match polling')
  }
}

export default MatchTrackerFD
