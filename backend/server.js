import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import ApiFootballService from './services/apiFootball.js'
import MatchTracker from './services/matchTracker.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Load players data
const playersData = JSON.parse(
  readFileSync(join(__dirname, 'data/players.json'), 'utf-8')
)

// Initialize services
const apiKey = process.env.API_FOOTBALL_KEY || ''
const apiService = new ApiFootballService(apiKey)
const matchTracker = new MatchTracker(apiService)

// Demo mode - use sample data when no API key
const isDemoMode = !apiKey

// Helper to generate dates
const daysAgo = (days) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

// Sample match data for demo mode
const sampleMatchData = {
  1: { // Pulisic - live match today
    fixtureId: 12345,
    status: 'live',
    homeTeam: 'AC Milan',
    awayTeam: 'Inter',
    homeScore: 2,
    awayScore: 1,
    minute: 67,
    isHome: true,
    participated: true,
    minutesPlayed: 67,
    started: true,
    events: [
      { type: 'goal', minute: 23 },
      { type: 'assist', minute: 55 }
    ],
    lastGame: {
      date: daysAgo(7),
      homeTeam: 'Roma',
      awayTeam: 'AC Milan',
      homeScore: 1,
      awayScore: 2,
      isHome: false,
      participated: true,
      minutesPlayed: 90,
      started: true,
      events: [{ type: 'goal', minute: 78 }]
    }
  },
  6: { // Antonee Robinson - live match
    fixtureId: 12346,
    status: 'live',
    homeTeam: 'Fulham',
    awayTeam: 'Chelsea',
    homeScore: 1,
    awayScore: 1,
    minute: 82,
    isHome: true,
    participated: true,
    minutesPlayed: 82,
    started: true,
    events: [],
    lastGame: {
      date: daysAgo(4),
      homeTeam: 'Fulham',
      awayTeam: 'Arsenal',
      homeScore: 0,
      awayScore: 3,
      isHome: true,
      participated: true,
      minutesPlayed: 90,
      started: true,
      events: []
    }
  },
  5: { // Giovanni Reyna - finished match today
    fixtureId: 12347,
    status: 'finished',
    homeTeam: 'Borussia Monchengladbach',
    awayTeam: 'Bayern Munich',
    homeScore: 0,
    awayScore: 2,
    minute: 90,
    isHome: true,
    participated: true,
    minutesPlayed: 25,
    started: false,
    events: [
      { type: 'sub_in', minute: 65 }
    ],
    lastGame: {
      date: daysAgo(6),
      homeTeam: 'Wolfsburg',
      awayTeam: 'Borussia Monchengladbach',
      homeScore: 1,
      awayScore: 1,
      isHome: false,
      participated: true,
      minutesPlayed: 70,
      started: true,
      events: [{ type: 'sub_out', minute: 70 }]
    }
  },
  16: { // Ricardo Pepi - upcoming match today
    fixtureId: 12348,
    status: 'upcoming',
    homeTeam: 'PSV',
    awayTeam: 'Ajax',
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    isHome: true,
    participated: false,
    minutesPlayed: 0,
    started: false,
    events: [],
    kickoff: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    lastGame: {
      date: daysAgo(3),
      homeTeam: 'PSV',
      awayTeam: 'Feyenoord',
      homeScore: 2,
      awayScore: 0,
      isHome: true,
      participated: true,
      minutesPlayed: 90,
      started: true,
      events: [{ type: 'goal', minute: 34 }, { type: 'goal', minute: 67 }]
    }
  },
  2: { // McKennie - live match
    fixtureId: 12349,
    status: 'live',
    homeTeam: 'Juventus',
    awayTeam: 'Napoli',
    homeScore: 1,
    awayScore: 0,
    minute: 34,
    isHome: true,
    participated: true,
    minutesPlayed: 34,
    started: true,
    events: [
      { type: 'yellow', minute: 28 }
    ],
    lastGame: {
      date: daysAgo(5),
      homeTeam: 'Juventus',
      awayTeam: 'Torino',
      homeScore: 2,
      awayScore: 0,
      isHome: true,
      participated: true,
      minutesPlayed: 85,
      started: true,
      events: [{ type: 'assist', minute: 44 }, { type: 'sub_out', minute: 85 }]
    }
  },
  12: { // Balogun - upcoming match
    fixtureId: 12350,
    status: 'upcoming',
    homeTeam: 'AS Monaco',
    awayTeam: 'PSG',
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    isHome: true,
    participated: false,
    minutesPlayed: 0,
    started: false,
    events: [],
    kickoff: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    lastGame: {
      date: daysAgo(8),
      homeTeam: 'Lyon',
      awayTeam: 'AS Monaco',
      homeScore: 1,
      awayScore: 3,
      isHome: false,
      participated: true,
      minutesPlayed: 72,
      started: true,
      events: [{ type: 'goal', minute: 23 }, { type: 'sub_out', minute: 72 }]
    }
  },
  // Players with no match today but have last game data
  7: { // Tyler Adams - no match today
    status: 'no_match_today',
    lastGame: {
      date: daysAgo(2),
      homeTeam: 'Bournemouth',
      awayTeam: 'Liverpool',
      homeScore: 0,
      awayScore: 4,
      isHome: true,
      participated: true,
      minutesPlayed: 90,
      started: true,
      events: [{ type: 'yellow', minute: 56 }]
    }
  },
  3: { // Yunus Musah - no match today
    status: 'no_match_today',
    lastGame: {
      date: daysAgo(10),
      homeTeam: 'Atalanta',
      awayTeam: 'Udinese',
      homeScore: 3,
      awayScore: 1,
      isHome: true,
      participated: true,
      minutesPlayed: 15,
      started: false,
      events: [{ type: 'sub_in', minute: 75 }]
    }
  },
  4: { // Timothy Weah - no match today, didn't play last game
    status: 'no_match_today',
    lastGame: {
      date: daysAgo(5),
      homeTeam: 'Juventus',
      awayTeam: 'Torino',
      homeScore: 2,
      awayScore: 0,
      isHome: true,
      participated: false,
      minutesPlayed: 0,
      started: false,
      events: []
    }
  }
}

// Routes

// Get all players
app.get('/api/players', (req, res) => {
  res.json(playersData.players)
})

// Get all leagues
app.get('/api/leagues', (req, res) => {
  res.json(playersData.leagues)
})

// Get match data for all players
app.get('/api/matches', (req, res) => {
  if (isDemoMode) {
    res.json({
      mode: 'demo',
      message: 'Running in demo mode with sample data. Set API_FOOTBALL_KEY to enable live data.',
      data: sampleMatchData
    })
  } else {
    const liveData = matchTracker.getAllMatchData()
    // If live API returns no data, fall back to sample data with indicator
    if (Object.keys(liveData).length === 0) {
      res.json({
        mode: 'live',
        apiStatus: 'unavailable',
        message: 'Live API temporarily unavailable - showing sample data',
        data: sampleMatchData
      })
    } else {
      res.json({
        mode: 'live',
        data: liveData
      })
    }
  }
})

// Get match data for a specific player
app.get('/api/matches/:playerId', (req, res) => {
  const playerId = parseInt(req.params.playerId)

  if (isDemoMode) {
    const matchData = sampleMatchData[playerId]
    res.json({
      mode: 'demo',
      data: matchData || null
    })
  } else {
    const matchData = matchTracker.getPlayerMatchData(playerId)
    res.json({
      mode: 'live',
      data: matchData
    })
  }
})

// Force refresh match data
app.post('/api/matches/refresh', async (req, res) => {
  if (isDemoMode) {
    res.json({
      mode: 'demo',
      message: 'Demo mode - no refresh needed'
    })
  } else {
    try {
      await matchTracker.updateMatchData()
      await matchTracker.updateLastGameData()
      await matchTracker.updateNextGameData()
      res.json({
        mode: 'live',
        success: true,
        message: 'Match data, last game data, and next game data refreshed'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: SERVER_VERSION,
    mode: isDemoMode ? 'demo' : 'live',
    timestamp: new Date().toISOString()
  })
})

// API status
app.get('/api/status', (req, res) => {
  res.json({
    mode: isDemoMode ? 'demo' : 'live',
    apiKeyConfigured: !!apiKey,
    playersCount: playersData.players.length,
    leaguesCount: playersData.leagues.length,
    polling: matchTracker.isPolling,
    hasLiveMatches: isDemoMode ?
      Object.values(sampleMatchData).some(m => m.status === 'live') :
      matchTracker.hasLiveMatches()
  })
})

// API-Football subscription status (for debugging rate limits)
app.get('/api/football-status', async (req, res) => {
  if (isDemoMode) {
    res.json({ mode: 'demo', message: 'API not configured' })
  } else {
    try {
      const status = await apiService.getApiStatus()
      res.json(status)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
})

// Start server
const SERVER_VERSION = '1.7.0' // Added cached next game data
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║        Americans Abroad - Backend Server              ║
╠═══════════════════════════════════════════════════════╣
║  Server running on http://localhost:${PORT}              ║
║  Mode: ${isDemoMode ? 'DEMO (sample data)' : 'LIVE (API-Football)'}                      ${isDemoMode ? ' ' : ''}║
║  Players tracked: ${playersData.players.length}                              ║
╚═══════════════════════════════════════════════════════╝
  `)

  if (isDemoMode) {
    console.log('⚠️  Running in DEMO mode with sample data.')
    console.log('   To enable live data, create a .env file with:')
    console.log('   API_FOOTBALL_KEY=your_api_key_here')
    console.log('')
    console.log('   Get a free API key at: https://www.api-football.com/')
    console.log('')
  } else {
    // Start polling for live matches (every 5 minutes)
    matchTracker.startPolling(5 * 60 * 1000)
  }
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...')
  matchTracker.stopPolling()
  process.exit(0)
})
