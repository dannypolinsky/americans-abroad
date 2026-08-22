import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import MatchTrackerFD from './services/matchTrackerFD.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001
const SERVER_VERSION = '2.8.0' // Live roster over /api/players, drift-sweep coverage, review-gated transfers

// Middleware
app.use(cors())
app.use(express.json())
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next() })

// Loaded once at boot. Only `leagues` is served from here — it is static config.
// The player roster is NOT served from this snapshot: matchTracker rewrites clubs in
// memory when it confirms a transfer, and a boot-time copy never sees those updates.
const playersData = JSON.parse(
  readFileSync(join(__dirname, 'data/players.json'), 'utf-8')
)

// Initialize services - FotMob only
const matchTracker = new MatchTrackerFD()


// Routes

// Get all players — from the live roster so confirmed transfers appear without a restart
app.get('/api/players', (req, res) => {
  res.json(matchTracker.getPlayers())
})

// Get all leagues
app.get('/api/leagues', (req, res) => {
  res.json(playersData.leagues)
})

// Get match data for all players
app.get('/api/matches', (req, res) => {
  res.json({ mode: 'live', data: matchTracker.getAllMatchData() })
})

// Get match data for a specific player
app.get('/api/matches/:playerId', (req, res) => {
  const playerId = parseInt(req.params.playerId)
  res.json({ mode: 'live', data: matchTracker.getPlayerMatchData(playerId) })
})

// Force refresh match data
app.post('/api/matches/refresh', async (req, res) => {
  try {
    await matchTracker.updateMatchDataFromFotMob(true)
    await matchTracker.updateLastGameData()
    await matchTracker.updateNextGameData()
    res.json({ mode: 'live', success: true, message: 'Match data refreshed' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// On-demand expanded stats for a player's specific match (powers the stats drawer)
app.get('/api/player/:id/match-stats', async (req, res) => {
  const playerId = parseInt(req.params.id, 10)
  const fixtureId = req.query.fixtureId

  if (!fixtureId) {
    return res.status(400).json({ error: 'fixtureId query param required' })
  }

  const player = playersData.players.find(p => p.id === playerId)
  if (!player) {
    return res.status(404).json({ error: 'Player not found' })
  }
  if (!player.fotmobId) {
    return res.status(404).json({ error: 'Player has no fotmobId' })
  }

  try {
    const stats = await matchTracker.fotmob.getPlayerExpandedStats(fixtureId, player.fotmobId)
    res.json({ stats: stats || null })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Reload manual player stats from file
app.post('/api/stats/reload', async (req, res) => {
  try {
    matchTracker.loadManualStats()
    res.json({
      success: true,
      message: 'Manual player stats reloaded',
      count: matchTracker.manualStats.size
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Health check — includes FotMob scrape freshness and any pending/applied roster drift
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: SERVER_VERSION,
    mode: 'live',
    timestamp: new Date().toISOString(),
    ...matchTracker.getHealth()
  })
})

// API status
app.get('/api/status', (req, res) => {
  res.json({
    mode: 'live',
    apiProvider: 'fotmob',
    playersCount: playersData.players.length,
    leaguesCount: playersData.leagues.length,
    polling: matchTracker.isPolling,
    hasLiveMatches: matchTracker.hasLiveMatches()
  })
})


// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║        Americans Abroad - Backend Server              ║
╠═══════════════════════════════════════════════════════╣
║  Server running on http://localhost:${PORT}              ║
║  Mode: LIVE (FotMob)                                  ║
║  Players tracked: ${playersData.players.length}                              ║
╚═══════════════════════════════════════════════════════╝
  `)

  // Start polling for live matches (every 5 minutes)
  matchTracker.startPolling(5 * 60 * 1000)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...')
  matchTracker.stopPolling()
  process.exit(0)
})
