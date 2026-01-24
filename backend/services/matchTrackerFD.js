// Match Tracker Service for Football-Data.org API
// Handles tracking matches for American players
// Integrates with FotMob for player-level statistics

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { LEAGUE_CODES, EUROPEAN_COMPETITIONS } from './footballData.js'
import FotMobService, { TEAM_IDS } from './fotmobService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

class MatchTrackerFD {
  constructor(apiService) {
    this.api = apiService
    this.fotmob = new FotMobService()
    this.players = this.loadPlayers()
    this.matchData = new Map() // playerId -> today's match data
    this.lastGameData = new Map() // playerId -> last game data
    this.nextGameData = new Map() // playerId -> next upcoming game (cached)
    this.fotmobData = new Map() // playerId -> FotMob match data (cached)
    this.manualStats = new Map() // playerId -> manually entered stats
    this.isPolling = false
    this.pollInterval = null
    this.cacheFile = join(__dirname, '../data/nextGamesCache.json')
    this.fotmobCacheFile = join(__dirname, '../data/fotmobCache.json')
    this.manualStatsFile = join(__dirname, '../data/playerStats.json')
    this.loadNextGamesCache()
    this.loadFotMobCache()
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

  // Load FotMob cache from file
  loadFotMobCache() {
    try {
      if (existsSync(this.fotmobCacheFile)) {
        const data = JSON.parse(readFileSync(this.fotmobCacheFile, 'utf-8'))
        const now = new Date()
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

        for (const [playerId, cacheEntry] of Object.entries(data)) {
          // Only load cache entries that are less than 1 hour old
          if (new Date(cacheEntry.timestamp) > oneHourAgo) {
            this.fotmobData.set(parseInt(playerId), cacheEntry)
          }
        }
        console.log(`Loaded ${this.fotmobData.size} cached FotMob entries`)
      }
    } catch (error) {
      console.error('Error loading FotMob cache:', error)
    }
  }

  // Save FotMob cache to file
  saveFotMobCache() {
    try {
      const data = Object.fromEntries(this.fotmobData)
      writeFileSync(this.fotmobCacheFile, JSON.stringify(data, null, 2))
    } catch (error) {
      console.error('Error saving FotMob cache:', error)
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

  // Get today's date in YYYY-MM-DD format
  getTodayDate() {
    return new Date().toISOString().split('T')[0]
  }

  // Get date N days ago/ahead in YYYY-MM-DD format
  getDateOffset(daysOffset) {
    const date = new Date()
    date.setDate(date.getDate() + daysOffset)
    return date.toISOString().split('T')[0]
  }

  // Check if a team name matches (fuzzy matching)
  teamMatches(apiTeamName, ourTeamName) {
    if (!apiTeamName || !ourTeamName) return false

    const normalize = (name) => name.toLowerCase()
      // Remove common suffixes/prefixes - use word boundaries to avoid matching inside names
      .replace(/\b(fc|cf|ac|as|afc|sc|sv|bv|ssc)\b/gi, '')
      .replace(/1\./g, '')  // For German clubs like 1. FC Köln
      .replace(/[^a-z]/g, '')
      .trim()

    const api = normalize(apiTeamName)
    const our = normalize(ourTeamName)

    return api.includes(our) || our.includes(api) || api === our
  }

  // Parse player events from match details
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

  // Get match status from Football-Data.org status
  getMatchStatus(match) {
    const status = match.status
    switch (status) {
      case 'SCHEDULED':
      case 'TIMED':
        return 'upcoming'
      case 'IN_PLAY':
      case 'PAUSED':
      case 'LIVE':
        return 'live'
      case 'FINISHED':
        return 'finished'
      case 'SUSPENDED':
        return 'suspended'
      case 'POSTPONED':
        return 'postponed'
      case 'CANCELLED':
        return 'cancelled'
      default:
        return status
    }
  }

  // Get supported league codes as comma-separated string
  // Includes domestic leagues and European competitions (Champions League, Europa League)
  getSupportedLeagueCodes() {
    const codes = new Set()

    // Add domestic league codes for players
    for (const player of this.players) {
      const code = LEAGUE_CODES[player.league]
      if (code) codes.add(code)
    }

    // Add European competitions (Champions League, Europa League)
    // These apply to players in top European leagues
    for (const [, code] of Object.entries(EUROPEAN_COMPETITIONS)) {
      codes.add(code)
    }

    return Array.from(codes).join(',')
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

  // Fetch and process matches for a date range
  async fetchMatches(dateFrom, dateTo) {
    const leagueCodes = this.getSupportedLeagueCodes()
    console.log(`Fetching matches from ${dateFrom} to ${dateTo} for leagues: ${leagueCodes}`)

    try {
      const response = await this.api.getMatchesByDateRange(dateFrom, dateTo, leagueCodes)
      return response.matches || []
    } catch (error) {
      console.error('Error fetching matches:', error.message)
      return []
    }
  }

  // Update match data for today
  async updateMatchData() {
    try {
      const today = this.getTodayDate()
      const matches = await this.fetchMatches(today, today)
      console.log(`Found ${matches.length} matches today`)

      const playersByTeam = this.getPlayersByTeam()

      for (const match of matches) {
        const homeTeam = match.homeTeam?.name || match.homeTeam?.shortName
        const awayTeam = match.awayTeam?.name || match.awayTeam?.shortName
        const status = this.getMatchStatus(match)

        // Check if any of our players' teams are playing
        for (const [teamName, players] of Object.entries(playersByTeam)) {
          let isHome = null

          if (this.teamMatches(homeTeam, teamName)) {
            isHome = true
          } else if (this.teamMatches(awayTeam, teamName)) {
            isHome = false
          }

          if (isHome !== null) {
            for (const player of players) {
              this.matchData.set(player.id, {
                fixtureId: match.id,
                status,
                homeTeam: homeTeam,
                awayTeam: awayTeam,
                homeScore: match.score?.fullTime?.home ?? match.score?.halfTime?.home ?? 0,
                awayScore: match.score?.fullTime?.away ?? match.score?.halfTime?.away ?? 0,
                minute: match.minute || 0,
                isHome,
                events: [], // Football-Data.org doesn't provide detailed events in match list
                kickoff: match.utcDate,
                venue: match.venue || '',
                participated: null, // Unknown without lineup data
                minutesPlayed: null, // Unknown without lineup data
                started: null, // Unknown without lineup data
                competition: match.competition?.name
              })
            }
          }
        }
      }

      console.log(`Updated match data for ${this.matchData.size} players from Football-Data.org`)
      return true
    } catch (error) {
      console.error('Error updating match data:', error)
      return false
    }
  }

  // Update match data from FotMob for players without Football-Data.org coverage
  async updateMatchDataFromFotMob() {
    try {
      const playersByTeam = this.getPlayersByTeam()
      const today = this.getTodayDate()
      const processedTeams = new Set()
      let addedCount = 0

      for (const [teamName, players] of Object.entries(playersByTeam)) {
        // Skip if we already processed this team
        if (processedTeams.has(teamName)) continue
        processedTeams.add(teamName)

        // Check if any player from this team already has match data for today
        const hasMatchData = players.some(p => {
          const data = this.matchData.get(p.id)
          return data && data.status !== 'no_match_today'
        })

        if (hasMatchData) continue // Skip - Football-Data.org already has this team's match

        // Query FotMob for this team's data
        try {
          const teamData = await this.fotmob.getTeamData(teamName)
          if (!teamData?.overview?.nextMatch) continue

          const nextMatch = teamData.overview.nextMatch
          const matchDate = new Date(nextMatch.status?.utcTime)
          const matchDateStr = matchDate.toISOString().split('T')[0]

          // Check if the match is today
          if (matchDateStr !== today) continue

          // Determine match status
          let status = 'upcoming'
          let minute = 0
          if (nextMatch.status?.finished) {
            status = 'finished'
            minute = 90
          } else if (nextMatch.status?.started || nextMatch.status?.ongoing) {
            status = 'live'
            // Parse live time - it's at the top level liveTime, not in status.liveTime
            // The string has hidden Unicode chars, so strip everything non-numeric
            const liveTimeStr = nextMatch.liveTime?.short || nextMatch.liveTime?.long
            if (liveTimeStr) {
              // Extract just the numbers (handles "50‎'‎" -> 50 or "49:18" -> 49)
              const match = liveTimeStr.match(/(\d+)/)
              if (match) {
                minute = parseInt(match[1], 10)
              }
            }
            // Fallback: check status.liveTime if top-level didn't work
            if (minute === 0 && nextMatch.status?.liveTime?.short) {
              const match = nextMatch.status.liveTime.short.match(/(\d+)/)
              if (match) {
                minute = parseInt(match[1], 10)
              }
            }
          }

          // Determine if player's team is home or away
          const teamId = TEAM_IDS[teamName] || this.getTeamIdFromFotMob(teamName, teamData)
          const isHome = nextMatch.home?.id === teamId

          const homeTeam = nextMatch.home?.name || 'Unknown'
          const awayTeam = nextMatch.away?.name || 'Unknown'
          const homeScore = nextMatch.home?.score ?? 0
          const awayScore = nextMatch.away?.score ?? 0

          // Add match data for all players on this team
          for (const player of players) {
            this.matchData.set(player.id, {
              fixtureId: nextMatch.id,
              status,
              homeTeam,
              awayTeam,
              homeScore,
              awayScore,
              minute,
              isHome,
              events: [],
              kickoff: nextMatch.status?.utcTime,
              venue: '',
              participated: null,
              minutesPlayed: null,
              started: null,
              competition: nextMatch.tournament?.name || 'Unknown',
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
      const today = this.getTodayDate()
      const tenDaysAgo = this.getDateOffset(-10)
      const matches = await this.fetchMatches(tenDaysAgo, today)

      // Sort by date descending (most recent first)
      matches.sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))

      const playersByTeam = this.getPlayersByTeam()
      const matchDetailsCache = new Map() // Cache match details to avoid duplicate fetches

      for (const match of matches) {
        const status = this.getMatchStatus(match)
        if (status !== 'finished') continue

        const homeTeam = match.homeTeam?.name || match.homeTeam?.shortName
        const awayTeam = match.awayTeam?.name || match.awayTeam?.shortName

        // Check if game was within last 24 hours - if so, fetch detailed events
        const gameTime = new Date(match.utcDate)
        const now = new Date()
        const hoursSinceGame = (now - gameTime) / (1000 * 60 * 60)
        const isRecent = hoursSinceGame < 48 // Fetch details for games in last 48 hours

        for (const [teamName, players] of Object.entries(playersByTeam)) {
          let isHome = null

          if (this.teamMatches(homeTeam, teamName)) {
            isHome = true
          } else if (this.teamMatches(awayTeam, teamName)) {
            isHome = false
          }

          if (isHome !== null) {
            // Fetch match details if recent and not already cached
            let matchDetails = null
            if (isRecent) {
              if (matchDetailsCache.has(match.id)) {
                matchDetails = matchDetailsCache.get(match.id)
              } else {
                try {
                  console.log(`Fetching details for match ${match.id}`)
                  matchDetails = await this.api.getMatchDetails(match.id)
                  matchDetailsCache.set(match.id, matchDetails)
                } catch (error) {
                  console.error(`Error fetching match details for ${match.id}:`, error.message)
                }
              }
            }

            for (const player of players) {
              // Skip if we already have data for this player
              if (this.lastGameData.has(player.id)) continue

              // Parse player events if we have match details
              let playerEvents = []
              let minutesPlayed = null // Unknown without detailed data
              let started = null // Unknown without detailed data
              let participated = null // Unknown without detailed data

              if (matchDetails) {
                playerEvents = this.parsePlayerEvents(matchDetails, player.name, isHome)
                if (playerEvents.length > 0) {
                  const hasSubIn = playerEvents.some(e => e.type === 'sub_in')
                  const hasSubOut = playerEvents.some(e => e.type === 'sub_out')
                  started = !hasSubIn
                  minutesPlayed = this.calculateMinutesPlayed(playerEvents, 90)
                  participated = true
                }
                // If no events found for player, leave as null (unknown)
              }

              // Try to get additional data from FotMob or manual stats
              let statsSource = 'api'
              let goals = 0
              let assists = 0
              let rating = null
              const fotmobMatch = this.findFotMobMatchForDate(player.id, match.utcDate)
              const manualMatch = this.findManualMatchForDate(player.id, match.utcDate)

              if (fotmobMatch) {
                // Use FotMob data for player stats
                playerEvents = fotmobMatch.events || []
                minutesPlayed = fotmobMatch.minutesPlayed || 0
                started = fotmobMatch.started
                participated = fotmobMatch.participated
                goals = fotmobMatch.goals || 0
                assists = fotmobMatch.assists || 0
                rating = fotmobMatch.rating
                statsSource = 'fotmob'
                console.log(`Using FotMob data for ${player.name}: ${minutesPlayed}min, ${goals}g, ${assists}a, rating: ${rating}`)
              } else if (manualMatch) {
                // Use manual stats as fallback
                playerEvents = manualMatch.events || []
                minutesPlayed = manualMatch.minutesPlayed || 0
                started = manualMatch.started
                participated = manualMatch.participated
                statsSource = 'manual'
                console.log(`Using manual stats for ${player.name}: ${minutesPlayed}min, ${playerEvents.filter(e => e.type === 'goal').length} goals`)
              }

              this.lastGameData.set(player.id, {
                fixtureId: match.id,
                date: match.utcDate,
                homeTeam: homeTeam,
                awayTeam: awayTeam,
                homeScore: match.score?.fullTime?.home ?? 0,
                awayScore: match.score?.fullTime?.away ?? 0,
                isHome,
                events: playerEvents,
                participated,
                minutesPlayed,
                started,
                goals,
                assists,
                rating,
                competition: match.competition?.name,
                source: statsSource
              })
            }
          }
        }
      }

      console.log(`Updated last game data for ${this.lastGameData.size} players`)
      return true
    } catch (error) {
      console.error('Error updating last game data:', error)
      return false
    }
  }

  // Update FotMob player statistics
  async updateFotMobData() {
    try {
      console.log(`Fetching FotMob data for ${this.players.length} players`)

      let updated = 0
      let failed = 0
      const processedTeams = new Set()

      for (const player of this.players) {
        // Check if we need to refresh this player's data
        const cached = this.fotmobData.get(player.id)
        const now = new Date()
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

        if (cached && new Date(cached.timestamp) > oneHourAgo) {
          continue // Skip if cached data is fresh
        }

        try {
          const stats = await this.fotmob.getPlayerLastMatchStats(player.name, player.team)

          if (stats && stats.participated) {
            this.fotmobData.set(player.id, {
              timestamp: now.toISOString(),
              lastMatch: {
                date: stats.date,
                opponent: stats.homeTeam === player.team ? stats.awayTeam : stats.homeTeam,
                isHome: stats.homeTeam === player.team,
                homeScore: stats.homeScore,
                awayScore: stats.awayScore,
                minutesPlayed: stats.minutesPlayed,
                started: stats.started,
                participated: stats.participated,
                goals: stats.goals,
                assists: stats.assists,
                rating: stats.rating,
                competition: stats.competition,
                events: stats.events || []
              }
            })
            updated++
            console.log(`FotMob: Updated ${player.name} - ${stats.minutesPlayed}min, ${stats.goals}g, ${stats.assists}a`)
          } else if (stats) {
            // Player didn't participate but we have match data
            this.fotmobData.set(player.id, {
              timestamp: now.toISOString(),
              lastMatch: {
                date: stats.date,
                participated: false
              }
            })
          }
        } catch (error) {
          failed++
          if (failed <= 3) {
            console.log(`FotMob: Error for ${player.name}: ${error.message}`)
          }
        }

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      if (updated > 0) {
        this.saveFotMobCache()
        console.log(`FotMob: Updated data for ${updated} players`)
      }

      return true
    } catch (error) {
      console.error('Error in FotMob update:', error.message)
      return true // Don't fail the whole process
    }
  }

  // Get FotMob match data for a specific date and player
  findFotMobMatchForDate(playerId, matchDate) {
    const cached = this.fotmobData.get(playerId)
    if (!cached || !cached.lastMatch) return null

    const fotmobDate = new Date(cached.lastMatch.date)
    const targetDate = new Date(matchDate)

    // Check if dates match (same day)
    if (fotmobDate.toISOString().split('T')[0] === targetDate.toISOString().split('T')[0]) {
      return cached.lastMatch
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

      const today = this.getTodayDate()
      const twoWeeksAhead = this.getDateOffset(14)
      const matches = await this.fetchMatches(today, twoWeeksAhead)

      // Sort by date ascending (earliest first)
      matches.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))

      for (const teamName of teamsNeedingRefresh) {
        const players = playersByTeam[teamName]

        for (const match of matches) {
          const homeTeam = match.homeTeam?.name || match.homeTeam?.shortName
          const awayTeam = match.awayTeam?.name || match.awayTeam?.shortName
          let isHome = null

          if (this.teamMatches(homeTeam, teamName)) {
            isHome = true
          } else if (this.teamMatches(awayTeam, teamName)) {
            isHome = false
          }

          if (isHome !== null) {
            for (const player of players) {
              this.nextGameData.set(player.id, {
                fixtureId: match.id,
                kickoff: match.utcDate,
                homeTeam: homeTeam,
                awayTeam: awayTeam,
                isHome,
                venue: match.venue || '',
                competition: match.competition?.name
              })
            }
            break
          }
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
    for (const player of this.players) {
      const todayMatch = this.matchData.get(player.id)
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

    // Initial update from Football-Data.org
    await this.updateMatchData()

    // Fill in gaps with FotMob (for leagues not covered by Football-Data.org)
    await this.updateMatchDataFromFotMob()

    // Update FotMob data for player stats
    await this.updateFotMobData()

    await this.updateLastGameData()
    await this.updateNextGameData()

    // Set up interval
    this.pollInterval = setInterval(async () => {
      if (this.hasLiveMatches()) {
        console.log('Live matches detected, updating...')
        await this.updateMatchData()
        await this.updateMatchDataFromFotMob()
      } else {
        console.log('No live matches, skipping update')
      }
    }, intervalMs)
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
