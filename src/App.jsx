import { useState, useMemo, useEffect, useCallback } from 'react'
import Header from './components/Header'
import PlayerCard from './components/PlayerCard'
import LeagueFilter from './components/LeagueFilter'
import playersData from './data/players.json'
import './App.css'

// Helper to generate dates for demo data
const daysAgo = (days) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

// Demo match data (used when no backend available)
const DEMO_MATCH_DATA = {
  1: { // Christian Pulisic - live match
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
  2: { // Weston McKennie - live match
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
  6: { // Antonee Robinson - live match
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
  5: { // Giovanni Reyna - finished match
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
  16: { // Ricardo Pepi - upcoming match
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
  12: { // Folarin Balogun - upcoming match
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
  7: { // Tyler Adams
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
  3: { // Yunus Musah
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
  4: { // Timothy Weah - didn't play last game
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

const API_BASE = import.meta.env.VITE_API_URL || null
const RETRY_DELAY = 5000 // 5 seconds between retries

function App() {
  const [filter, setFilter] = useState(() => {
    const saved = localStorage.getItem('americansAbroad_filter')
    return saved || 'today'
  })
  const [selectedLeague, setSelectedLeague] = useState(() => {
    const saved = localStorage.getItem('americansAbroad_league')
    return saved || 'all'
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [matchData, setMatchData] = useState({})
  const [apiMode, setApiMode] = useState(API_BASE ? 'loading' : 'demo')
  const [apiStatus, setApiStatus] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isApiLoading, setIsApiLoading] = useState(!!API_BASE)

  // Try to fetch from API if configured, with retry on failure
  const loadMatchData = useCallback(async (isRetry = false) => {
    if (!API_BASE) {
      // No API configured, use demo data
      setMatchData(DEMO_MATCH_DATA)
      setApiMode('demo')
      setLastUpdate(new Date())
      setIsApiLoading(false)
      return
    }

    try {
      const response = await fetch(`${API_BASE}/matches`)
      if (!response.ok) throw new Error('API error')
      const data = await response.json()
      setMatchData(data.data || {})
      setApiMode(data.mode || 'live')
      setApiStatus(data.apiStatus || null)
      setLastUpdate(new Date())
      setIsApiLoading(false)
    } catch (err) {
      console.log('API unavailable, retrying in', RETRY_DELAY / 1000, 'seconds...')
      // Keep the loading state and retry after delay
      setTimeout(() => loadMatchData(true), RETRY_DELAY)
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadMatchData()
  }, [loadMatchData])

  // Persist filter to localStorage
  useEffect(() => {
    localStorage.setItem('americansAbroad_filter', filter)
  }, [filter])

  // Persist selected league to localStorage
  useEffect(() => {
    localStorage.setItem('americansAbroad_league', selectedLeague)
  }, [selectedLeague])

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

  // Get most recent game date for a player (either today's match or last game)
  const getMostRecentGameDate = (playerId) => {
    const data = matchData[playerId]
    if (!data) return null

    // If player has a match today, use kickoff time if available
    if (data.status && data.status !== 'no_match_today') {
      // For upcoming games, use the kickoff time for proper sorting
      if (data.kickoff) {
        return data.kickoff
      }
      return new Date().toISOString()
    }

    // Otherwise use last game date
    if (data.lastGame?.date) {
      return data.lastGame.date
    }

    return null
  }

  // Check if player participated in today's game or game hasn't started yet
  const hasPlayedOrUpcoming = (playerId) => {
    const data = matchData[playerId]
    if (!data || data.status === 'no_match_today') return false
    // Upcoming games count as "has played or upcoming"
    if (data.status === 'upcoming') return true
    // For live/finished games, check if they participated
    return data.participated === true || (data.events && data.events.length > 0)
  }

  // Check if a date is within the last N days
  const isWithinDays = (dateStr, days) => {
    if (!dateStr) return false
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    return diffDays >= 0 && diffDays <= days
  }

  // Check if player has a recent game (within last 3 days)
  const hasRecentGame = (playerId) => {
    const data = matchData[playerId]
    if (!data) return false
    // Check if lastGame is within last 3 days
    if (data.lastGame?.date && isWithinDays(data.lastGame.date, 3)) return true
    // Also check finished games from today
    if (data.status === 'finished') return true
    return false
  }

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
      players = players.filter(p => matchData[p.id] && matchData[p.id].status !== 'no_match_today')
    } else if (filter === 'recent') {
      players = players.filter(p => hasRecentGame(p.id))
    }

    // Sort players: 1) Completed today, 2) Upcoming, 3) Past games
    players = [...players].sort((a, b) => {
      const dataA = matchData[a.id]
      const dataB = matchData[b.id]

      // Get sort priority: 0 = live, 1 = finished today, 2 = upcoming, 3 = past/no match
      const getSortPriority = (data) => {
        if (!data) return 4
        if (data.status === 'live') return 0
        if (data.status === 'finished') return 1
        if (data.status === 'upcoming') return 2
        return 3 // no_match_today
      }

      const priorityA = getSortPriority(dataA)
      const priorityB = getSortPriority(dataB)

      // Sort by priority first
      if (priorityA !== priorityB) return priorityA - priorityB

      // Within same priority, sort by date
      const dateA = getMostRecentGameDate(a.id)
      const dateB = getMostRecentGameDate(b.id)

      if (!dateA && !dateB) return 0
      if (!dateA) return 1
      if (!dateB) return -1

      // For upcoming, sort by earliest first
      if (priorityA === 2) return new Date(dateA) - new Date(dateB)

      // For others, sort by most recent first
      return new Date(dateB) - new Date(dateA)
    })

    return players
  }, [uniquePlayers, filter, selectedLeague, searchTerm, matchData])

  // Group players by category for section headers (only for "all" filter)
  const groupedPlayers = useMemo(() => {
    if (filter !== 'all') return null

    const groups = {
      live: [],
      finished: [],
      upcoming: [],
      recent: [],
      older: []
    }

    for (const player of filteredPlayers) {
      const data = matchData[player.id]
      if (!data) {
        groups.older.push(player)
      } else if (data.status === 'live') {
        groups.live.push(player)
      } else if (data.status === 'finished') {
        groups.finished.push(player)
      } else if (data.status === 'upcoming') {
        groups.upcoming.push(player)
      } else if (data.status === 'no_match_today') {
        // Check if last game is within last 3 days
        if (data.lastGame?.date && isWithinDays(data.lastGame.date, 3)) {
          groups.recent.push(player)
        } else {
          groups.older.push(player)
        }
      } else {
        groups.older.push(player)
      }
    }

    // Sort upcoming group by kickoff time (soonest first)
    groups.upcoming.sort((a, b) => {
      const dataA = matchData[a.id]
      const dataB = matchData[b.id]
      const kickoffA = dataA?.kickoff ? new Date(dataA.kickoff) : new Date()
      const kickoffB = dataB?.kickoff ? new Date(dataB.kickoff) : new Date()
      return kickoffA - kickoffB
    })

    // Sort recent group: players who participated first, then those who didn't play
    groups.recent.sort((a, b) => {
      const dataA = matchData[a.id]
      const dataB = matchData[b.id]
      const participatedA = dataA?.lastGame?.participated === true
      const participatedB = dataB?.lastGame?.participated === true

      if (participatedA && !participatedB) return -1
      if (!participatedA && participatedB) return 1
      return 0
    })

    return groups
  }, [filteredPlayers, matchData, filter])

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
      {isApiLoading && (
        <div className="api-loading-overlay">
          <div className="api-loading-content">
            <div className="loading-spinner"></div>
            <p>Loading the live game API; wait a few moments.</p>
          </div>
        </div>
      )}

      <Header filter={filter} setFilter={setFilter} liveCount={liveCount} />

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
          {apiStatus === 'unavailable' && (
            <span className="api-unavailable">
              (Showing sample data - live API temporarily unavailable)
            </span>
          )}
          {lastUpdate && apiStatus !== 'unavailable' && (
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
        ) : filter === 'all' && groupedPlayers ? (
          <div className="players-sections">
            {groupedPlayers.live.length > 0 && (
              <>
                <h2 className="section-header live-header">Live Now</h2>
                <div className="players-grid">
                  {groupedPlayers.live.map(player => (
                    <PlayerCard key={player.id} player={player} matchData={matchData[player.id] || null} showLastGame={true} />
                  ))}
                </div>
              </>
            )}
            {groupedPlayers.finished.length > 0 && (
              <>
                <h2 className="section-header finished-header">Finished Today</h2>
                <div className="players-grid">
                  {groupedPlayers.finished.map(player => (
                    <PlayerCard key={player.id} player={player} matchData={matchData[player.id] || null} showLastGame={true} />
                  ))}
                </div>
              </>
            )}
            {groupedPlayers.upcoming.length > 0 && (
              <>
                <h2 className="section-header upcoming-header">Upcoming Games</h2>
                <div className="players-grid">
                  {groupedPlayers.upcoming.map(player => (
                    <PlayerCard key={player.id} player={player} matchData={matchData[player.id] || null} showLastGame={true} />
                  ))}
                </div>
              </>
            )}
            {groupedPlayers.recent.length > 0 && (
              <>
                <h2 className="section-header recent-header">Recently Played</h2>
                <div className="players-grid">
                  {groupedPlayers.recent.map(player => (
                    <PlayerCard key={player.id} player={player} matchData={matchData[player.id] || null} showLastGame={true} />
                  ))}
                </div>
              </>
            )}
            {groupedPlayers.older.length > 0 && (
              <>
                <h2 className="section-header older-header">Older Than API Supports</h2>
                <div className="players-grid">
                  {groupedPlayers.older.map(player => (
                    <PlayerCard key={player.id} player={player} matchData={matchData[player.id] || null} showLastGame={true} />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="players-grid">
            {filteredPlayers.map(player => (
              <PlayerCard
                key={player.id}
                player={player}
                matchData={matchData[player.id] || null}
                showLastGame={filter === 'all' || filter === 'recent'}
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
          Data updates every 5 minutes during live matches
        </p>
      </footer>
    </div>
  )
}

export default App
