import { useState, useMemo, useEffect, useCallback } from 'react'
import Header from './components/Header'
import PlayerCard from './components/PlayerCard'
import LeagueFilter from './components/LeagueFilter'
import playersData from './data/players.json'
import './App.css'

// Demo match data (used when no backend available)
const DEMO_MATCH_DATA = {
  1: { // Christian Pulisic
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
  2: { // Weston McKennie
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
  6: { // Antonee Robinson
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
  5: { // Giovanni Reyna
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
  16: { // Ricardo Pepi
    status: 'upcoming',
    homeTeam: 'PSV',
    awayTeam: 'Ajax',
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    isHome: true,
    events: []
  },
  12: { // Folarin Balogun
    status: 'upcoming',
    homeTeam: 'AS Monaco',
    awayTeam: 'PSG',
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    isHome: true,
    events: []
  }
}

const API_BASE = import.meta.env.VITE_API_URL || null

function App() {
  const [filter, setFilter] = useState('today')
  const [selectedLeague, setSelectedLeague] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [matchData, setMatchData] = useState(DEMO_MATCH_DATA)
  const [apiMode, setApiMode] = useState('demo')
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [isLoading, setIsLoading] = useState(false)

  // Try to fetch from API if configured
  const loadMatchData = useCallback(async () => {
    if (!API_BASE) {
      // No API configured, use demo data
      setMatchData(DEMO_MATCH_DATA)
      setApiMode('demo')
      setLastUpdate(new Date())
      return
    }

    try {
      const response = await fetch(`${API_BASE}/matches`)
      if (!response.ok) throw new Error('API error')
      const data = await response.json()
      setMatchData(data.data || DEMO_MATCH_DATA)
      setApiMode(data.mode || 'live')
      setLastUpdate(new Date())
    } catch (err) {
      console.log('API unavailable, using demo data')
      setMatchData(DEMO_MATCH_DATA)
      setApiMode('demo')
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadMatchData()
  }, [loadMatchData])

  // Remove duplicates from players
  const uniquePlayers = useMemo(() => {
    const seen = new Set()
    return playersData.players.filter(player => {
      if (seen.has(player.name)) return false
      seen.add(player.name)
      return true
    })
  }, [])

  // Calculate player counts per league
  const playerCounts = useMemo(() => {
    return uniquePlayers.reduce((acc, player) => {
      acc[player.league] = (acc[player.league] || 0) + 1
      return acc
    }, {})
  }, [uniquePlayers])

  // Filter players based on current filters
  const filteredPlayers = useMemo(() => {
    let players = uniquePlayers

    // Filter by search term
    if (searchTerm) {
      players = players.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.team.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by league
    if (selectedLeague !== 'all') {
      const league = playersData.leagues.find(l => l.id === selectedLeague)
      if (league) {
        players = players.filter(p => p.league === league.name)
      }
    }

    // Filter by match status
    if (filter === 'live') {
      players = players.filter(p => matchData[p.id]?.status === 'live')
    } else if (filter === 'today') {
      players = players.filter(p => matchData[p.id])
    }

    return players
  }, [uniquePlayers, filter, selectedLeague, searchTerm, matchData])

  // Count live matches
  const liveCount = useMemo(() => {
    return uniquePlayers.filter(p => matchData[p.id]?.status === 'live').length
  }, [uniquePlayers, matchData])

  // Format last update time
  const formatLastUpdate = () => {
    if (!lastUpdate) return ''
    return lastUpdate.toLocaleTimeString()
  }

  return (
    <div className="app">
      <Header filter={filter} setFilter={setFilter} liveCount={liveCount} />

      {apiMode === 'demo' && (
        <div className="demo-banner">
          Demo mode - showing sample match data
        </div>
      )}

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search players or teams..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      <LeagueFilter
        leagues={playersData.leagues}
        selectedLeague={selectedLeague}
        setSelectedLeague={setSelectedLeague}
        playerCounts={playerCounts}
      />

      <main className="main-content">
        <div className="player-count">
          Showing {filteredPlayers.length} players
          {lastUpdate && (
            <span className="last-update">
              Last updated: {formatLastUpdate()}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>Loading match data...</p>
          </div>
        ) : (
          <div className="players-grid">
            {filteredPlayers.map(player => (
              <PlayerCard
                key={player.id}
                player={player}
                matchData={matchData[player.id] || null}
              />
            ))}
          </div>
        )}

        {!isLoading && filteredPlayers.length === 0 && (
          <div className="no-results">
            <p>No players found matching your criteria</p>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Americans Abroad - Tracking US Soccer Players Worldwide</p>
        <p className="footer-note">
          {apiMode === 'demo'
            ? 'Demo mode - sample data shown'
            : 'Data updates every 5 minutes during live matches'
          }
        </p>
      </footer>
    </div>
  )
}

export default App
