// Football-Data.org API Service
// Documentation: https://www.football-data.org/documentation/api

const API_BASE = 'https://api.football-data.org/v4'

class FootballDataService {
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
      const headers = {}
      if (this.apiKey) {
        headers['X-Auth-Token'] = this.apiKey
      }

      const response = await fetch(`${API_BASE}${endpoint}`, { headers })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API error ${response.status}: ${errorText}`)
      }

      const data = await response.json()

      // Cache the response
      this.cache.set(endpoint, {
        data,
        timestamp: Date.now()
      })

      console.log(`Football-Data API: ${endpoint.split('?')[0]} returned ${data.matches?.length || data.resultSet?.count || 'N/A'} results`)

      return data
    } catch (error) {
      console.error(`Football-Data API fetch error for ${endpoint}:`, error.message)
      throw error
    }
  }

  // Get matches for a specific date range
  async getMatchesByDateRange(dateFrom, dateTo, competitions = null) {
    let endpoint = `/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`
    if (competitions) {
      endpoint += `&competitions=${competitions}`
    }
    return this.fetchFromApi(endpoint)
  }

  // Get matches for today
  async getTodaysMatches(competitions = null) {
    const today = new Date().toISOString().split('T')[0]
    return this.getMatchesByDateRange(today, today, competitions)
  }

  // Get matches for a specific competition
  async getCompetitionMatches(competitionCode, dateFrom = null, dateTo = null) {
    let endpoint = `/competitions/${competitionCode}/matches`
    const params = []
    if (dateFrom) params.push(`dateFrom=${dateFrom}`)
    if (dateTo) params.push(`dateTo=${dateTo}`)
    if (params.length > 0) {
      endpoint += '?' + params.join('&')
    }
    return this.fetchFromApi(endpoint)
  }

  // Get a specific match by ID (includes goals, subs, bookings details)
  async getMatch(matchId) {
    return this.fetchFromApi(`/matches/${matchId}`)
  }

  // Get match with full details including player events
  async getMatchDetails(matchId) {
    const data = await this.fetchFromApi(`/matches/${matchId}`)
    return data
  }

  // Get all available competitions
  async getCompetitions() {
    return this.fetchFromApi('/competitions')
  }

  // Get teams in a competition
  async getCompetitionTeams(competitionCode) {
    return this.fetchFromApi(`/competitions/${competitionCode}/teams`)
  }

  // Get standings for a competition
  async getStandings(competitionCode) {
    return this.fetchFromApi(`/competitions/${competitionCode}/standings`)
  }

  // Check API status (by fetching competitions)
  async getApiStatus() {
    try {
      const data = await this.fetchFromApi('/competitions')
      return {
        status: 'ok',
        competitions: data.competitions?.length || 0
      }
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      }
    }
  }

  // Clear cache
  clearCache() {
    this.cache.clear()
  }
}

// League code mapping for Football-Data.org
const LEAGUE_CODES = {
  'Premier League': 'PL',
  'Bundesliga': 'BL1',
  'Serie A': 'SA',
  'La Liga': 'PD',
  'Ligue 1': 'FL1',
  'Eredivisie': 'DED',
  'Championship': 'ELC',
  'Scottish Premiership': 'SPL', // May not be in free tier
  'Liga MX': null, // Not available
  'Belgian Pro League': null, // Not available in free tier
  'MLS': null // Not available
}

export { FootballDataService, LEAGUE_CODES }
export default FootballDataService
