// Pure helper functions for player/match display and filtering logic

// ── Display / formatting ───────────────────────────────────────────────────

// FotMob publishes a uniform 192x192 head-and-shoulders cutout for every player it
// tracks, keyed by the same fotmobId the rest of the app already matches on. Deriving
// the URL means a newly added player gets a headshot with no roster edit — and it
// replaces the old per-player `image` field, which mixed wide Wikimedia action shots
// (unusable once cropped to a 54px circle) with hand-saved files in public/images.
export const headshotUrl = (player) =>
  player?.fotmobId
    ? `https://images.fotmob.com/image_resources/playerimages/${player.fotmobId}.png`
    : null

export const abbrevPosition = (pos) => {
  const map = {
    'Goalkeeper': 'GK', 'Defender': 'DF', 'Center Back': 'CB', 'Centre Back': 'CB',
    'Left Back': 'LB', 'Right Back': 'RB', 'Wing Back': 'WB',
    'Midfielder': 'MF', 'Central Midfielder': 'CM', 'Defensive Midfielder': 'DM',
    'Attacking Midfielder': 'AM', 'Left Midfielder': 'LM', 'Right Midfielder': 'RM',
    'Forward': 'FW', 'Left Wing': 'LW', 'Right Wing': 'RW',
    'Striker': 'ST', 'Centre Forward': 'CF', 'Center Forward': 'CF', 'Winger': 'W',
  }
  return map[pos] || pos
}

export const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return 'Today'
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const formatTimeOnly = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export const formatKickoff = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (date.toDateString() === now.toDateString()) return `Today ${time}`
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`
  return `${formatDate(dateStr)} ${time}`
}

export const getRatingClass = (rating) => {
  const r = parseFloat(rating)
  if (isNaN(r)) return ''
  if (r >= 8) return 'rating-dark-green'
  if (r >= 7) return 'rating-light-green'
  if (r >= 6) return 'rating-yellow'
  return 'rating-red'
}

export const getResult = (isHome, homeScore, awayScore) => {
  if (homeScore == null || awayScore == null) return null
  const playerScore = isHome ? homeScore : awayScore
  const oppScore    = isHome ? awayScore : homeScore
  if (playerScore > oppScore) return 'W'
  if (playerScore < oppScore) return 'L'
  return 'D'
}

export const getStatusClass = (started, participated, onBench, minutesPlayed) => {
  if (!participated && onBench) return 'status-bench'
  if (!participated) return ''
  if (!started && !minutesPlayed && onBench) return 'status-bench'
  return started ? 'status-started' : 'status-sub'
}

export const getUpcomingStatusClass = (lineupStatus) => {
  if (lineupStatus === 'starting') return 'status-started'
  if (lineupStatus === 'bench') return 'status-bench'
  return ''
}

// ── App-level match data helpers (take matchData as a param) ───────────────

export const isWithinDays = (dateStr, days) => {
  if (!dateStr) return false
  const diffMs = new Date() - new Date(dateStr)
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= days
}

// Uses Eastern time so European games played after midnight UTC (still "today" in ET) are handled correctly
export const isKickoffToday = (kickoff) => {
  if (!kickoff) return false
  const today   = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const gameDay = new Date(kickoff).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  return gameDay === today
}

export const getMostRecentGameDate = (playerId, matchData) => {
  const data = matchData[playerId]
  if (!data) return null
  if (data.status && data.status !== 'no_match_today') {
    return data.kickoff ?? new Date().toISOString()
  }
  if (data.lastGame?.missedGame?.date) return data.lastGame.missedGame.date
  return data.lastGame?.date ?? null
}

export const hasPlayedOrUpcoming = (playerId, matchData) => {
  const data = matchData[playerId]
  if (!data || data.status === 'no_match_today') return false
  if (data.status === 'upcoming') return true
  return data.participated === true || (data.events && data.events.length > 0)
}

export const hasRecentGame = (playerId, matchData) => {
  const data = matchData[playerId]
  if (!data) return false
  if (data.lastGame?.date && isWithinDays(data.lastGame.date, 3)) return true
  return data.status === 'finished'
}
