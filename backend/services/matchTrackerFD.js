// Match Tracker Service for Football-Data.org API
// Handles tracking matches for American players

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { LEAGUE_CODES } from './footballData.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

class MatchTrackerFD {
  constructor(apiService) {
    this.api = apiService
    this.players = this.loadPlayers()
    this.matchData = new Map() // playerId -> today's match data
    this.lastGameData = new Map() // playerId -> last game data
    this.nextGameData = new Map() // playerId -> next upcoming game (cached)
    this.isPolling = false
    this.pollInterval = null
    this.cacheFile = join(__dirname, '../data/nextGamesCache.json')
    this.loadNextGamesCache()
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
      .replace(/fc|cf|ac|as|afc|sc|sv|bv|ssc|1\./gi, '')
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
  getSupportedLeagueCodes() {
    const codes = new Set()
    for (const player of this.players) {
      const code = LEAGUE_CODES[player.league]
      if (code) codes.add(code)
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
                participated: true, // Assume participation
                minutesPlayed: status === 'finished' ? 90 : (match.minute || 0),
                started: true,
                competition: match.competition?.name
              })
            }
          }
        }
      }

      console.log(`Updated match data for ${this.matchData.size} players`)
      return true
    } catch (error) {
      console.error('Error updating match data:', error)
      return false
    }
  }

  // Update last game data
  async updateLastGameData() {
    try {
      const today = this.getTodayDate()
      const threeDaysAgo = this.getDateOffset(-3)
      const matches = await this.fetchMatches(threeDaysAgo, today)

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
              let minutesPlayed = 90
              let started = true
              let participated = true

              if (matchDetails) {
                playerEvents = this.parsePlayerEvents(matchDetails, player.name, isHome)
                const hasSubIn = playerEvents.some(e => e.type === 'sub_in')
                const hasSubOut = playerEvents.some(e => e.type === 'sub_out')
                started = !hasSubIn && (hasSubOut || playerEvents.length > 0)
                minutesPlayed = this.calculateMinutesPlayed(playerEvents, 90)
                // If no events, assume they played (we can't know for sure without lineup data)
                participated = true
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
                minutesPlayed: playerEvents.length > 0 ? minutesPlayed : null,
                started: playerEvents.length > 0 ? started : null,
                competition: match.competition?.name
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

    // Initial update
    await this.updateMatchData()
    await this.updateLastGameData()
    await this.updateNextGameData()

    // Set up interval
    this.pollInterval = setInterval(async () => {
      if (this.hasLiveMatches()) {
        console.log('Live matches detected, updating...')
        await this.updateMatchData()
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
