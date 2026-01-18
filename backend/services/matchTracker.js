// Match Tracker Service
// Handles tracking matches for American players

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

class MatchTracker {
  constructor(apiService) {
    this.api = apiService
    this.players = this.loadPlayers()
    this.matchData = new Map() // playerId -> match data
    this.isPolling = false
    this.pollInterval = null
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
    const allFixtures = []

    console.log(`Fetching matches for ${today}...`)

    for (const league of leagues) {
      if (league.apiId) {
        try {
          const response = await this.api.getFixturesByLeague(league.apiId, today)
          if (response.response) {
            allFixtures.push(...response.response)
          }
        } catch (error) {
          console.error(`Error fetching ${league.name} fixtures:`, error.message)
        }
      }
    }

    return allFixtures
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
              venue: fixture.fixture.venue?.name || ''
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

  // Get all match data
  getAllMatchData() {
    const data = {}
    for (const [playerId, matchData] of this.matchData) {
      data[playerId] = matchData
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
  startPolling(intervalMs = 5 * 60 * 1000) {
    if (this.isPolling) {
      console.log('Already polling')
      return
    }

    this.isPolling = true
    console.log(`Starting match polling every ${intervalMs / 1000} seconds`)

    // Initial update
    this.updateMatchData()

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
