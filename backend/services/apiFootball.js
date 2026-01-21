// API-Football Service
// Documentation: https://www.api-football.com/documentation-v3

const API_BASE = 'https://v3.football.api-sports.io'

class ApiFootballService {
  constructor(apiKey) {
    this.apiKey = apiKey
    this.cache = new Map()
    this.cacheExpiry = 5 * 60 * 1000 // 5 minutes
  }

  async fetchFromApi(endpoint) {
    // Check cache first
    const cached = this.cache.get(endpoint)
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'x-apisports-key': this.apiKey,
        }
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()

      // Log API response info (errors, remaining requests, etc.)
      if (data.errors && Object.keys(data.errors).length > 0) {
        console.error('API errors:', data.errors)
      }
      if (data.response && data.results !== undefined) {
        console.log(`API response: ${data.results} results for ${endpoint.split('?')[0]}`)
      }

      // Cache the response
      this.cache.set(endpoint, {
        data,
        timestamp: Date.now()
      })

      return data
    } catch (error) {
      console.error(`API fetch error for ${endpoint}:`, error.message)
      throw error
    }
  }

  // Get today's fixtures for a specific league
  async getFixturesByLeague(leagueId, date) {
    const season = this.getCurrentSeason()
    const endpoint = `/fixtures?league=${leagueId}&date=${date}&season=${season}`
    return this.fetchFromApi(endpoint)
  }

  // Get all fixtures for a specific date (no league filter)
  async getFixturesByDate(date) {
    const endpoint = `/fixtures?date=${date}`
    return this.fetchFromApi(endpoint)
  }

  // Calculate the current football season (e.g., 2025 for 2025-2026 season)
  getCurrentSeason() {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1 // 0-indexed
    // Football seasons typically start in August, so if we're before August, use previous year
    return month < 8 ? year - 1 : year
  }

  // Get live fixtures for a specific league
  async getLiveFixturesByLeague(leagueId) {
    const endpoint = `/fixtures?league=${leagueId}&live=all`
    return this.fetchFromApi(endpoint)
  }

  // Get fixture details including events
  async getFixtureDetails(fixtureId) {
    const endpoint = `/fixtures?id=${fixtureId}`
    return this.fetchFromApi(endpoint)
  }

  // Get fixture events (goals, cards, subs)
  async getFixtureEvents(fixtureId) {
    const endpoint = `/fixtures/events?fixture=${fixtureId}`
    return this.fetchFromApi(endpoint)
  }

  // Get lineup for a fixture (to check if player is starting/benched)
  async getFixtureLineups(fixtureId) {
    const endpoint = `/fixtures/lineups?fixture=${fixtureId}`
    return this.fetchFromApi(endpoint)
  }

  // Get player statistics for a fixture
  async getPlayerStats(fixtureId) {
    const endpoint = `/fixtures/players?fixture=${fixtureId}`
    return this.fetchFromApi(endpoint)
  }

  // Search for a player by name
  async searchPlayer(name) {
    const endpoint = `/players?search=${encodeURIComponent(name)}`
    return this.fetchFromApi(endpoint)
  }

  // Get player info by ID
  async getPlayerById(playerId, season) {
    const endpoint = `/players?id=${playerId}&season=${season}`
    return this.fetchFromApi(endpoint)
  }

  // Get team info by name (to find team ID)
  async searchTeam(name) {
    const endpoint = `/teams?search=${encodeURIComponent(name)}`
    return this.fetchFromApi(endpoint)
  }

  // Clear cache (useful when forcing refresh)
  clearCache() {
    this.cache.clear()
  }

  // Check API subscription status and remaining requests
  async getApiStatus() {
    const endpoint = '/status'
    return this.fetchFromApi(endpoint)
  }
}

export default ApiFootballService
