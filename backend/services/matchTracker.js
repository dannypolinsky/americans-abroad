// Match Tracker Service
// Handles tracking matches for American players

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

class MatchTracker {
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
        // Only load entries where the game date hasn't passed
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

  // Check if we need to refresh next game for a team
  needsNextGameRefresh(teamName) {
    const players = this.players.filter(p => p.team === teamName)
    for (const player of players) {
      const cached = this.nextGameData.get(player.id)
      if (!cached) return true
      // If cached game date has passed, need refresh
      if (new Date(cached.kickoff) <= new Date()) return true
    }
    return false
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

  // Get date N days ago in YYYY-MM-DD format
  getDateDaysAgo(daysAgo) {
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    return date.toISOString().split('T')[0]
  }

  // Check if a team name matches (fuzzy matching)
  teamMatches(apiTeamName, ourTeamName) {
    const normalize = (name) => name.toLowerCase()
      .replace(/fc|cf|ac|as|afc|sc|sv|bv/gi, '')
      .replace(/[^a-z]/g, '')
      .trim()

    const api = normalize(apiTeamName)
    const our = normalize(ourTeamName)

    return api.includes(our) || our.includes(api) || api === our
  }

  // Find fixture for a player's team
  findTeamFixture(fixtures, teamName) {
    for (const fixture of fixtures) {
      const homeTeam = fixture.teams.home.name
      const awayTeam = fixture.teams.away.name

      if (this.teamMatches(homeTeam, teamName)) {
        return { fixture, isHome: true }
      }
      if (this.teamMatches(awayTeam, teamName)) {
        return { fixture, isHome: false }
      }
    }
    return null
  }

  // Parse events for a specific player
  parsePlayerEvents(events, playerName, teamId) {
    const playerEvents = []

    for (const event of events) {
      // Check if this event involves our player
      const playerMatch = event.player?.name?.toLowerCase().includes(playerName.split(' ').pop().toLowerCase())
      const assistMatch = event.assist?.name?.toLowerCase().includes(playerName.split(' ').pop().toLowerCase())

      if (playerMatch || assistMatch) {
        if (event.type === 'Goal') {
          if (playerMatch) {
            playerEvents.push({ type: 'goal', minute: event.time.elapsed })
          }
          if (assistMatch) {
            playerEvents.push({ type: 'assist', minute: event.time.elapsed })
          }
        } else if (event.type === 'subst') {
          if (playerMatch) {
            // Player was subbed out
            playerEvents.push({ type: 'sub_out', minute: event.time.elapsed })
          }
          if (assistMatch) {
            // Player was subbed in (assist field holds the player coming in)
            playerEvents.push({ type: 'sub_in', minute: event.time.elapsed })
          }
        } else if (event.type === 'Card') {
          if (playerMatch) {
            playerEvents.push({
              type: event.detail === 'Yellow Card' ? 'yellow' : 'red',
              minute: event.time.elapsed
            })
          }
        }
      }
    }

    return playerEvents
  }

  // Calculate minutes played from events
  calculateMinutesPlayed(events, matchMinute, status) {
    const subIn = events.find(e => e.type === 'sub_in')
    const subOut = events.find(e => e.type === 'sub_out')
    const fullTime = status === 'finished' ? 90 : matchMinute

    if (subIn && subOut) {
      // Came on and went off
      return subOut.minute - subIn.minute
    } else if (subIn) {
      // Came on as sub, played until end
      return fullTime - subIn.minute
    } else if (subOut) {
      // Started, was subbed off
      return subOut.minute
    } else if (status === 'finished' || status === 'live') {
      // No sub events - check if they likely played
      // If they have any events (goals, assists, cards), they played
      if (events.length > 0) {
        return fullTime
      }
      // Otherwise assume they didn't play (were unused sub)
      return 0
    }
    return 0
  }

  // Check if player participated (started or came on as sub)
  didPlayerParticipate(events) {
    // Player participated if they have any events or were subbed in
    const hasSubIn = events.some(e => e.type === 'sub_in')
    const hasSubOut = events.some(e => e.type === 'sub_out')
    const hasOtherEvents = events.some(e => !['sub_in', 'sub_out'].includes(e.type))

    // If subbed out but not subbed in, they started
    // If subbed in, they came on
    // If they have goals/assists/cards, they played
    return hasSubIn || hasSubOut || hasOtherEvents
  }

  // Get match status string
  getMatchStatus(fixture) {
    const status = fixture.fixture.status.short

    switch (status) {
      case 'NS': return 'upcoming'
      case '1H':
      case '2H':
      case 'HT':
      case 'ET':
      case 'P':
      case 'LIVE':
        return 'live'
      case 'FT':
      case 'AET':
      case 'PEN':
        return 'finished'
      case 'SUSP':
      case 'INT':
        return 'suspended'
      case 'PST':
        return 'postponed'
      case 'CANC':
        return 'cancelled'
      default:
        return status
    }
  }

  // Fetch matches for all tracked leagues
  async fetchTodaysMatches() {
    const today = this.getTodayDate()
    const leagues = this.getUniqueLeagues()
    const trackedLeagueIds = new Set(leagues.map(l => l.apiId).filter(Boolean))

    console.log(`Fetching matches for ${today}...`)

    try {
      // Fetch all fixtures for today in a single API call
      const response = await this.api.getFixturesByDate(today)

      if (response.response) {
        // Filter to only include fixtures from our tracked leagues
        const filteredFixtures = response.response.filter(fixture =>
          trackedLeagueIds.has(fixture.league.id)
        )
        console.log(`Found ${response.response.length} total fixtures, ${filteredFixtures.length} in tracked leagues`)
        return filteredFixtures
      }
    } catch (error) {
      console.error('Error fetching today\'s fixtures:', error.message)
    }

    return []
  }

  // Fetch live matches only
  async fetchLiveMatches() {
    const leagues = this.getUniqueLeagues()
    const liveFixtures = []

    for (const league of leagues) {
      if (league.apiId) {
        try {
          const response = await this.api.getLiveFixturesByLeague(league.apiId)
          if (response.response) {
            liveFixtures.push(...response.response)
          }
        } catch (error) {
          console.error(`Error fetching live ${league.name} fixtures:`, error.message)
        }
      }
    }

    return liveFixtures
  }

  // Fetch matches from recent days to find last games
  // Note: Using 3 days to stay within API rate limits (free tier = 100 req/day)
  async fetchRecentMatches(daysBack = 3) {
    const leagues = this.getUniqueLeagues()
    const trackedLeagueIds = new Set(leagues.map(l => l.apiId).filter(Boolean))
    const allFixtures = []

    console.log(`Fetching matches from the past ${daysBack} days...`)

    for (let i = 1; i <= daysBack; i++) {
      const date = this.getDateDaysAgo(i)
      try {
        const response = await this.api.getFixturesByDate(date)
        if (response.response) {
          const filteredFixtures = response.response.filter(fixture =>
            trackedLeagueIds.has(fixture.league.id)
          )
          allFixtures.push(...filteredFixtures)
        }
      } catch (error) {
        console.error(`Error fetching fixtures for ${date}:`, error.message)
      }
    }

    console.log(`Found ${allFixtures.length} fixtures from recent days`)
    return allFixtures
  }

  // Update last game data for all players
  async updateLastGameData() {
    try {
      const recentFixtures = await this.fetchRecentMatches(3)
      const playersByTeam = this.getPlayersByTeam()

      // Sort fixtures by date (most recent first)
      recentFixtures.sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date))

      for (const [teamName, players] of Object.entries(playersByTeam)) {
        // Find the most recent fixture for this team
        for (const fixture of recentFixtures) {
          const homeTeam = fixture.teams.home.name
          const awayTeam = fixture.teams.away.name
          let isHome = null

          if (this.teamMatches(homeTeam, teamName)) {
            isHome = true
          } else if (this.teamMatches(awayTeam, teamName)) {
            isHome = false
          }

          if (isHome !== null) {
            const status = this.getMatchStatus(fixture)
            if (status !== 'finished') continue // Only count finished games

            // Note: Skipping event fetching for historical games to stay within API rate limits
            // Just record that the game happened - detailed player stats not available for past games
            for (const player of players) {
              // Skip if we already have a more recent last game for this player
              if (this.lastGameData.has(player.id)) continue

              this.lastGameData.set(player.id, {
                fixtureId: fixture.fixture.id,
                date: fixture.fixture.date,
                homeTeam: fixture.teams.home.name,
                awayTeam: fixture.teams.away.name,
                homeScore: fixture.goals.home || 0,
                awayScore: fixture.goals.away || 0,
                isHome,
                events: [],
                participated: true, // Assume participation - we don't have detailed lineup data
                minutesPlayed: null, // Unknown without event data
                started: null // Unknown without event data
              })
            }
            break // Found this team's most recent game, move to next team
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

  // Get date N days in future in YYYY-MM-DD format
  getDateDaysAhead(daysAhead) {
    const date = new Date()
    date.setDate(date.getDate() + daysAhead)
    return date.toISOString().split('T')[0]
  }

  // Update next game data for teams that need refresh
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

      // Fetch fixtures for next 14 days (single API call)
      const fromDate = this.getTodayDate()
      const toDate = this.getDateDaysAhead(14)
      const leagues = this.getUniqueLeagues()
      const trackedLeagueIds = new Set(leagues.map(l => l.apiId).filter(Boolean))

      const response = await this.api.getUpcomingFixtures(fromDate, toDate)

      if (!response.response) {
        console.log('No upcoming fixtures found')
        return false
      }

      // Filter to tracked leagues
      const fixtures = response.response.filter(f => trackedLeagueIds.has(f.league.id))
      console.log(`Found ${fixtures.length} upcoming fixtures in tracked leagues`)

      // Sort by date (earliest first)
      fixtures.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date))

      // Find next game for each team that needs refresh
      for (const teamName of teamsNeedingRefresh) {
        const players = playersByTeam[teamName]

        for (const fixture of fixtures) {
          const homeTeam = fixture.teams.home.name
          const awayTeam = fixture.teams.away.name
          let isHome = null

          if (this.teamMatches(homeTeam, teamName)) {
            isHome = true
          } else if (this.teamMatches(awayTeam, teamName)) {
            isHome = false
          }

          if (isHome !== null) {
            // Found the next game for this team
            for (const player of players) {
              this.nextGameData.set(player.id, {
                fixtureId: fixture.fixture.id,
                kickoff: fixture.fixture.date,
                homeTeam: fixture.teams.home.name,
                awayTeam: fixture.teams.away.name,
                isHome,
                venue: fixture.fixture.venue?.name || '',
                competition: fixture.league.name
              })
            }
            break // Found next game for this team, move to next team
          }
        }
      }

      // Save cache to file
      this.saveNextGamesCache()
      console.log(`Updated next game data for ${this.nextGameData.size} players`)
      return true
    } catch (error) {
      console.error('Error updating next game data:', error)
      return false
    }
  }

  // Get unique leagues from players
  getUniqueLeagues() {
    const data = JSON.parse(readFileSync(join(__dirname, '../data/players.json'), 'utf-8'))
    return data.leagues || []
  }

  // Update match data for all players
  async updateMatchData() {
    try {
      const fixtures = await this.fetchTodaysMatches()
      console.log(`Found ${fixtures.length} fixtures today`)

      const playersByTeam = this.getPlayersByTeam()

      for (const [teamName, players] of Object.entries(playersByTeam)) {
        const result = this.findTeamFixture(fixtures, teamName)

        if (result) {
          const { fixture, isHome } = result
          const status = this.getMatchStatus(fixture)

          // Fetch events if match is live or finished
          let events = []
          if (status === 'live' || status === 'finished') {
            try {
              const eventsResponse = await this.api.getFixtureEvents(fixture.fixture.id)
              events = eventsResponse.response || []
            } catch (error) {
              console.error(`Error fetching events for fixture ${fixture.fixture.id}:`, error.message)
            }
          }

          for (const player of players) {
            const playerEvents = this.parsePlayerEvents(events, player.name,
              isHome ? fixture.teams.home.id : fixture.teams.away.id)

            const participated = this.didPlayerParticipate(playerEvents)
            const minutesPlayed = this.calculateMinutesPlayed(playerEvents, fixture.fixture.status.elapsed || 90, status)

            this.matchData.set(player.id, {
              fixtureId: fixture.fixture.id,
              status,
              homeTeam: fixture.teams.home.name,
              awayTeam: fixture.teams.away.name,
              homeScore: fixture.goals.home || 0,
              awayScore: fixture.goals.away || 0,
              minute: fixture.fixture.status.elapsed || 0,
              isHome,
              events: playerEvents,
              kickoff: fixture.fixture.date,
              venue: fixture.fixture.venue?.name || '',
              participated,
              minutesPlayed,
              started: !playerEvents.some(e => e.type === 'sub_in') && participated
            })
          }
        }
      }

      console.log(`Updated match data for ${this.matchData.size} player/match combinations`)
      return true
    } catch (error) {
      console.error('Error updating match data:', error)
      return false
    }
  }

  // Get match data for a specific player
  getPlayerMatchData(playerId) {
    return this.matchData.get(playerId) || null
  }

  // Get all match data including last game data
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
        // No match today but we have last game or next game data
        data[player.id] = {
          status: 'no_match_today',
          lastGame: lastGame || null,
          nextGame: nextGame || null
        }
      }
    }
    return data
  }

  // Get last game data for a specific player
  getPlayerLastGame(playerId) {
    return this.lastGameData.get(playerId) || null
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

    // Initial update - fetch today's matches, recent history, and upcoming games
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

export default MatchTracker
