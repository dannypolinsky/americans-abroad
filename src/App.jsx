import { useState, useMemo, useEffect, useCallback } from 'react'
import Header from './components/Header'
import PlayerCard from './components/PlayerCard'
import LeagueFilter from './components/LeagueFilter'
import playersData from './data/players.json'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL || null
const CACHE_VERSION = '3'

// Clear stale match data cache if version changed
const storedCacheVersion = localStorage.getItem('americansAbroad_cacheVersion')
if (storedCacheVersion !== CACHE_VERSION) {
  localStorage.removeItem('americansAbroad_matchData')
  localStorage.removeItem('americansAbroad_lastUpdate')
  localStorage.setItem('americansAbroad_cacheVersion', CACHE_VERSION)
}

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
  const [matchData, setMatchData] = useState(() => {
    // Load cached match data from localStorage on initial render
    const cached = localStorage.getItem('americansAbroad_matchData')
    if (cached) {
      try {
        return JSON.parse(cached)
      } catch (e) {
        return {}
      }
    }
    return {}
  })
  const [apiMode, setApiMode] = useState('loading')
  const [apiStatus, setApiStatus] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(() => {
    // Load cached last update time
    const cached = localStorage.getItem('americansAbroad_lastUpdate')
    return cached ? new Date(cached) : null
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isApiLoading, setIsApiLoading] = useState(
    !localStorage.getItem('americansAbroad_matchData')
  )

  const loadMatchData = useCallback(async () => {
    if (!API_BASE) {
      setApiMode('cached')
      setIsApiLoading(false)
      return
    }

    try {
      const response = await fetch(`${API_BASE}/matches`)
      if (!response.ok) throw new Error('API error')
      const data = await response.json()
      const newMatchData = data.data || {}

      // Merge new data with cached data, preserving lastGame from cache
      const cachedStr = localStorage.getItem('americansAbroad_matchData')
      const cachedData = cachedStr ? JSON.parse(cachedStr) : {}
      const mergedData = { ...cachedData }
      for (const [playerId, playerData] of Object.entries(newMatchData)) {
        if (playerData) {
          mergedData[playerId] = {
            ...playerData,
            lastGame: playerData.lastGame || cachedData[playerId]?.lastGame
          }
        }
      }

      // Clear stale finished/live statuses for players not in fresh API data.
      // These come from a previous day's cache and would incorrectly appear
      // in "Finished Today" or "Live Now" sections.
      for (const playerId of Object.keys(mergedData)) {
        if (!newMatchData[playerId]) {
          const stale = mergedData[playerId]
          if (stale?.status === 'finished' || stale?.status === 'live') {
            mergedData[playerId] = { ...stale, status: 'no_match_today' }
          }
        }
      }

      const hasData = Object.keys(mergedData).length > 0
      if (hasData) {
        setMatchData(mergedData)
        // Cache merged data to localStorage
        localStorage.setItem('americansAbroad_matchData', JSON.stringify(mergedData))
        localStorage.setItem('americansAbroad_lastUpdate', new Date().toISOString())
      }

      setApiMode(data.mode || 'live')
      setApiStatus(data.apiStatus || null)
      setLastUpdate(new Date())
      setIsApiLoading(false)
    } catch (err) {
      console.error('API error:', err)
      setIsApiLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadMatchData()
  }, [loadMatchData])

  // Auto-refresh when there are live matches, or when an upcoming match is at/past kickoff
  useEffect(() => {
    const hasLiveMatches = Object.values(matchData).some(m => m?.status === 'live')
    const hasMatchNearKickoff = Object.values(matchData).some(m => {
      if (m?.status !== 'upcoming' || !m.kickoff) return false
      const minSinceKickoff = (Date.now() - new Date(m.kickoff)) / 60000
      return minSinceKickoff > -5 // within 5 min before kickoff or past it
    })

    if (!hasLiveMatches && !hasMatchNearKickoff) return

    const refreshInterval = setInterval(() => {
      loadMatchData()
    }, 60 * 1000) // 60 seconds

    return () => clearInterval(refreshInterval)
  }, [matchData, loadMatchData])

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

  // Get most recent game date for a player (either today's match, missed game, or last game)
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

    // Check for missed game first (more recent than last played game)
    if (data.lastGame?.missedGame?.date) {
      return data.lastGame.missedGame.date
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

  // Check if a kickoff timestamp is actually today (Eastern time)
  const isKickoffToday = (kickoff) => {
    if (!kickoff) return false
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const gameDay = new Date(kickoff).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    return gameDay === today
  }

  // Group players by category for section headers (only for "all" filter)
  const groupedPlayers = useMemo(() => {
    if (filter !== 'all') return null

    const groups = {
      live: [],
      finished: [],
      upcoming: [],
      recent: []
    }

    for (const player of filteredPlayers) {
      const data = matchData[player.id]
      if (!data) {
        // All players go to recent since we have FotMob data for everyone
        groups.recent.push(player)
      } else if (data.status === 'live') {
        groups.live.push(player)
      } else if (data.status === 'finished' && isKickoffToday(data.kickoff)) {
        // Only show in Finished Today if the match actually kicked off today
        groups.finished.push(player)
      } else if (data.status === 'upcoming') {
        groups.upcoming.push(player)
      } else {
        // All other players go to recent (no_match_today, stale finished, etc.)
        groups.recent.push(player)
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

  // Format last update time - include date if not today
  const formatLastUpdate = () => {
    if (!lastUpdate) return ''
    const now = new Date()
    if (lastUpdate.toDateString() === now.toDateString()) {
      return lastUpdate.toLocaleTimeString()
    }
    return lastUpdate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + lastUpdate.toLocaleTimeString()
  }

  return (
    <div className="app">
      {isApiLoading && (
        <div className="api-loading-overlay">
          <div className="api-loading-content">
            <div className="loading-spinner"></div>
            <p>Loading match data...</p>
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
