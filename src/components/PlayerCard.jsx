import { useState, useEffect } from 'react'
import { fetchPlayerMatchStats } from '../services/api'
import { abbrevPosition, getRatingClass, headshotUrl } from '../utils/playerUtils'
import TodayMatchSection from './TodayMatchSection'
import LastGameSection from './LastGameSection'
import './PlayerCard.css'

function PlayerCard({ player, matchData, showLastGame = false }) {
  const [expanded, setExpanded] = useState(false)
  const [detailedStats, setDetailedStats] = useState(null)

  const headshot     = headshotUrl(player)
  const isLive       = matchData?.status === 'live'
  const hasTodayMatch = matchData !== null && matchData.status !== 'no_match_today'
  const lastGame     = matchData?.lastGame
  const nextGame     = matchData?.nextGame

  // Only fetch expanded stats when a fixture the player participated in is available
  const fixtureId = hasTodayMatch
    ? (matchData?.participated && matchData?.fixtureId) || null
    : (lastGame?.participated && lastGame?.fixtureId) || null

  useEffect(() => {
    if (!fixtureId) return
    fetchPlayerMatchStats(player.id, fixtureId)
      .then(r => setDetailedStats(r.stats || null))
      .catch(() => {})
  }, [fixtureId, player.id])

  const rating = hasTodayMatch
    ? (matchData?.participated && matchData?.rating)
    : (lastGame?.participated && lastGame?.rating)

  return (
    <div className={`player-card ${isLive ? 'live' : ''} ${hasTodayMatch ? 'has-match' : ''}`}>
      {isLive && <div className="live-indicator">LIVE</div>}

      {/* Player identity row */}
      <div className="player-info">
        <div className="photo-wrapper">
          {headshot ? (
            <img src={headshot} alt={player.name} className="player-headshot"
              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
            />
          ) : null}
          <div className="player-avatar" style={headshot ? {display: 'none'} : {}}>
            {player.name.split(' ').map(n => n[0]).join('')}
          </div>
          {rating && <div className={`photo-rating ${getRatingClass(rating)}`}>{rating}</div>}
        </div>
        <div className="player-details">
          <h3 className="player-name">{player.name}</h3>
          <p className="player-meta">
            <span className="team-inline">{player.team}</span>
            <span className="meta-sep">·</span>
            <span className="position">{abbrevPosition(player.position)}</span>
            <span className="meta-sep">·</span>
            <span className="league">{player.league}</span>
          </p>
        </div>
      </div>

      {hasTodayMatch && (
        <TodayMatchSection
          matchData={matchData}
          expanded={expanded}
          setExpanded={setExpanded}
          detailedStats={detailedStats}
        />
      )}

      {!hasTodayMatch && showLastGame && (lastGame || nextGame) && (
        <LastGameSection
          lastGame={lastGame}
          nextGame={nextGame}
          expanded={expanded}
          setExpanded={setExpanded}
          detailedStats={detailedStats}
        />
      )}

      {!hasTodayMatch && !showLastGame && (
        <div className="no-match"><p>No match today</p></div>
      )}

      {!hasTodayMatch && showLastGame && !lastGame && !nextGame && (
        <div className="no-match"><p>No recent match data</p></div>
      )}
    </div>
  )
}

export default PlayerCard
