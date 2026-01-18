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

// Sample match data for demo mode
const sampleMatchData = {
  1: {
    fixtureId: 12345,
    status: 'live',
    homeTeam: 'AC Milan',
    awayTeam: 'Inter',
    homeScore: 2,
    awayScore: 1,
    minute: 67,
    isHome: true,
    events: [
      { type: 'goal', minute: 23 },
      { type: 'assist', minute: 55 }
    ]
  },
  6: {
    fixtureId: 12346,
    status: 'live',
    homeTeam: 'Fulham',
    awayTeam: 'Chelsea',
    homeScore: 1,
    awayScore: 1,
    minute: 82,
    isHome: true,
    events: [
      { type: 'sub_in', minute: 0 }
    ]
  },
  5: {
    fixtureId: 12347,
    status: 'finished',
    homeTeam: 'Borussia Dortmund',
    awayTeam: 'Bayern Munich',
    homeScore: 0,
    awayScore: 2,
    minute: 90,
    isHome: true,
    events: [
      { type: 'sub_in', minute: 60 },
      { type: 'sub_out', minute: 85 }
    ]
  },
  16: {
    fixtureId: 12348,
    status: 'upcoming',
    homeTeam: 'PSV',
    awayTeam: 'Ajax',
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    isHome: true,
    events: [],
    kickoff: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  },
  2: {
    fixtureId: 12349,
    status: 'live',
    homeTeam: 'Juventus',
    awayTeam: 'Napoli',
    homeScore: 1,
    awayScore: 0,
    minute: 34,
    isHome: true,
    events: [
      { type: 'sub_in', minute: 0 },
      { type: 'yellow', minute: 28 }
    ]
  },
  12: {
    fixtureId: 12350,
    status: 'upcoming',
    homeTeam: 'AS Monaco',
    awayTeam: 'PSG',
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    isHome: true,
    events: [],
    kickoff: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
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
    res.json({
      mode: 'live',
      data: matchTracker.getAllMatchData()
    })
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
      res.json({
        mode: 'live',
        success: true,
        message: 'Match data refreshed'
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

// Start server
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
