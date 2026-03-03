import { useState, useEffect } from 'react'
import { fetchPlayerMatchStats } from '../services/api'
import './PlayerCard.css'

function PlayerCard({ player, matchData, showLastGame = false }) {
  const [expanded, setExpanded] = useState(false)
  const [detailedStats, setDetailedStats] = useState(null)

  const isLive = matchData?.status === 'live'
  const hasTodayMatch = matchData !== null && matchData.status !== 'no_match_today'
  const lastGame = matchData?.lastGame
  const nextGame = matchData?.nextGame

  const fixtureId = hasTodayMatch
    ? (matchData?.participated && matchData?.fixtureId) || null
    : (lastGame?.participated && lastGame?.fixtureId) || null

  useEffect(() => {
    if (!fixtureId) return
    fetchPlayerMatchStats(player.id, fixtureId)
      .then(r => setDetailedStats(r.stats || null))
      .catch(() => {})
  }, [fixtureId, player.id])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const abbrevPosition = (pos) => {
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

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    if (date.toDateString() === now.toDateString()) return 'Today'
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatKickoff = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const isTomorrow = date.toDateString() === tomorrow.toDateString()
    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    if (isToday) return `Today ${time}`
    if (isTomorrow) return `Tomorrow ${time}`
    return `${formatDate(dateStr)} ${time}`
  }

  const renderScore = (homeScore, awayScore, fId) => {
    const scoreContent = (
      <>
        <span className="score-num">{homeScore}</span>
        <span className="score-colon">:</span>
        <span className="score-num">{awayScore}</span>
      </>
    )
    if (fId) {
      return (
        <a href={`https://www.fotmob.com/match/${fId}`} target="_blank" rel="noopener noreferrer"
          className="score-link" onClick={e => e.stopPropagation()}>
          {scoreContent}
        </a>
      )
    }
    return scoreContent
  }

  const getRatingClass = (rating) => {
    const r = parseFloat(rating)
    if (isNaN(r)) return ''
    if (r >= 8) return 'rating-dark-green'
    if (r >= 7) return 'rating-light-green'
    if (r >= 6) return 'rating-yellow'
    return 'rating-red'
  }

  const getStatusClass = (started, participated, onBench) => {
    if (!participated && onBench) return 'status-bench'
    if (!participated) return ''
    return started ? 'status-started' : 'status-sub'
  }

  const getUpcomingStatusClass = (lineupStatus) => {
    if (lineupStatus === 'starting') return 'status-started'
    if (lineupStatus === 'bench') return 'status-bench'
    return ''
  }

  // Unified stats strip — same pill style for all badge types, left-aligned
  // source: 'today' (events have minutes + sub_in/sub_out) | 'lastGame' (only goals/assists/cards, no minutes)
  const renderStatsStrip = (data, source, isLive = false) => {
    const events = data.events || []
    const subOutEvent = events.find(e => e.type === 'sub_out')
    const subInEvent  = events.find(e => e.type === 'sub_in')

    // Prefer actual event minute; for lastGame starters without a sub_out event, infer from minutesPlayed
    const subOutMinute = subOutEvent?.minute ??
      (source !== 'today' && data.started && data.minutesPlayed != null && data.minutesPlayed < 90
        ? data.minutesPlayed : null)

    const subInMinute = subInEvent?.minute ?? null

    // Completed game where player started and played the full 90
    const isFullGame = !isLive && data.started === true && data.minutesPlayed >= 90

    return (
      <div className="stats-strip">
        {data.started === true && !isFullGame && (
          <span className="badge badge-start">{isLive ? 'START' : '▶ START'}</span>
        )}
        {isFullGame && <span className="badge badge-full90">Full 90</span>}
        {data.started === false && data.minutesPlayed > 0 && (
          <span className="badge badge-sub-in">
            ↑ SUB{subInMinute ? ` ${subInMinute}'` : ''}
          </span>
        )}
        {data.minutesPlayed != null && data.minutesPlayed > 0 && !isFullGame
          && (isLive || (!subOutMinute && data.started !== false)) && (
          <span className="badge badge-mins">{data.minutesPlayed}'</span>
        )}
        {data.started === true && subOutMinute && (
          <span className="badge badge-sub-out">↓ Out {subOutMinute}'</span>
        )}
        {events.filter(e => e.type === 'goal').map((e, i) => (
          <span key={`g${i}`} className="badge badge-goal">⚽{e.minute ? ` ${e.minute}'` : ''}</span>
        ))}
        {events.filter(e => e.type === 'assist').map((e, i) => (
          <span key={`a${i}`} className="badge badge-assist">🅰️{e.minute ? ` ${e.minute}'` : ''}</span>
        ))}
        {events.some(e => e.type === 'yellow') && <span className="badge badge-card">🟨</span>}
        {events.some(e => e.type === 'red')    && <span className="badge badge-card">🟥</span>}
      </div>
    )
  }

  const renderStatsDrawer = (canExpand) => {
    if (!canExpand || !detailedStats) return null
    return (
      <div className={`stats-drawer${expanded ? ' open' : ''}`}>
        {expanded && (
          <div className="stats-drawer-inner">
            {detailedStats.map(group => (
              <div key={group.key} className="stats-group">
                <div className="stats-group-header">{group.label}</div>
                {group.stats.map(stat => (
                  <div key={stat.key} className="stat-row">
                    <span className="stat-label">{stat.label}</span>
                    <span className="stat-value">{stat.value}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const rating = hasTodayMatch
    ? (matchData?.participated && matchData?.rating)
    : (lastGame?.participated && lastGame?.rating)

  return (
    <div className={`player-card ${isLive ? 'live' : ''} ${hasTodayMatch ? 'has-match' : ''}`}>
      {isLive && <div className="live-indicator">LIVE</div>}

      {/* Player identity row */}
      <div className="player-info">
        <div className="photo-wrapper">
          {player.image ? (
            <img src={player.image} alt={player.name} className="player-headshot"
              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
            />
          ) : null}
          <div className="player-avatar" style={player.image ? {display: 'none'} : {}}>
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

      {/* Today's match */}
      {hasTodayMatch && (() => {
        const canExpand = (matchData.status === 'finished' || matchData.status === 'live')
          && matchData.participated && matchData.fixtureId
        const isNotInSquad = (matchData.status === 'finished' || matchData.status === 'live')
          && matchData.participated === false && !matchData.onBench
        const isUnusedSub = (matchData.status === 'finished' || matchData.status === 'live')
          && matchData.participated === false && matchData.onBench

        return (
          <>
            <div
              className={[
                'match-info',
                isNotInSquad ? 'not-in-squad-highlight' : '',
                isUnusedSub  ? 'unused-sub-highlight'  : '',
                (matchData.status === 'live' || matchData.status === 'finished')
                  ? getStatusClass(matchData.started, matchData.participated, matchData.onBench) : '',
                matchData.status === 'upcoming' ? getUpcomingStatusClass(matchData.lineupStatus) : '',
                canExpand ? 'expandable' : ''
              ].filter(Boolean).join(' ')}
              onClick={canExpand ? () => setExpanded(e => !e) : undefined}
            >
              <div className="match-teams">
                <span className={matchData.isHome ? 'highlight' : ''}>{matchData.homeTeam}</span>
                <span className="score-container">
                  {isLive && <span className="live-minute">{matchData.minute === 'HT' ? 'HT' : `${matchData.minute}'`}</span>}
                  <span className="score">
                    {matchData.status === 'upcoming'
                      ? 'vs'
                      : renderScore(matchData.homeScore, matchData.awayScore, matchData.fixtureId)}
                  </span>
                </span>
                <span className={!matchData.isHome ? 'highlight' : ''}>{matchData.awayTeam}</span>
              </div>

              {/* Date/time · competition on one line */}
              <div className="match-time">
                {matchData.status === 'upcoming' && formatKickoff(matchData.kickoff)}
                {matchData.status === 'finished' && (matchData.legInfo ? `FT · ${matchData.legInfo}` : 'FT')}
                {matchData.competition && <span className="time-comp-sep"> · {matchData.competition}</span>}
              </div>

              {matchData.aggregateScore && (
                <div className="aggregate-score">
                  Agg: {matchData.aggregateScore}{matchData.aggregateWinner && ` (${matchData.aggregateWinner} advance)`}
                </div>
              )}

              {/* Participation */}
              {matchData.status === 'upcoming' && matchData.lineupStatus && (
                <div className="stats-strip">
                  {matchData.lineupStatus === 'starting' && <span className="badge badge-start">STARTING</span>}
                  {matchData.lineupStatus === 'bench'    && <span className="badge badge-bench">BENCH</span>}
                  {matchData.lineupStatus === 'not_in_squad' && <span className="badge badge-dnp">Not in squad</span>}
                </div>
              )}

              {matchData.status === 'live' && (
                matchData.participated === false
                  ? <div className="stats-strip">
                      <span className={`badge ${matchData.onBench ? 'badge-bench' : 'badge-dnp'}`}>
                        {matchData.onBench ? 'Unused sub' : 'Not in squad'}
                      </span>
                    </div>
                  : renderStatsStrip(matchData, 'today', true)
              )}

              {matchData.status === 'finished' && (
                matchData.participated === false
                  ? <div className="stats-strip">
                      <span className={`badge ${matchData.onBench ? 'badge-bench' : 'badge-dnp'}`}>
                        {matchData.onBench ? 'Unused sub' : 'Not in squad'}
                      </span>
                    </div>
                  : matchData.minutesPlayed === 0 && matchData.started === false && !matchData.events?.some(e => e.type === 'sub_in')
                    ? <div className="stats-strip"><span className="badge badge-bench">Unused sub</span></div>
                    : renderStatsStrip(matchData, 'today')
              )}

              {renderStatsDrawer(canExpand)}
            </div>

            {nextGame && (matchData.status === 'finished' || matchData.status === 'live') && (
              <div className="next-game-line">
                <span className="next-game-label">Next:</span>{' '}
                {nextGame.isHome ? 'vs' : 'at'} {nextGame.isHome ? nextGame.awayTeam : nextGame.homeTeam}
                {nextGame.competition ? ` · ${nextGame.competition}` : ''} · {formatKickoff(nextGame.kickoff)}
              </div>
            )}
          </>
        )
      })()}

      {/* Recently played */}
      {!hasTodayMatch && showLastGame && (lastGame || nextGame) && (
        <div className="game-info-section">

          {lastGame?.missedGame && (
            <div className={lastGame.missedGame.onBench ? 'bench-game-info' : 'missed-game-info'}>
              <div className={lastGame.missedGame.onBench ? 'bench-game-header' : 'missed-game-header'}>
                {lastGame.missedGame.onBench ? 'Unused Sub' : 'Missed'}:{' '}
                {formatDate(lastGame.missedGame.date)}
                {lastGame.missedGame.competition && ` · ${lastGame.missedGame.competition}`}
              </div>
              <div className="match-teams">
                <span className={lastGame.missedGame.isHome ? 'highlight' : ''}>{lastGame.missedGame.homeTeam}</span>
                <span className="score">{renderScore(lastGame.missedGame.homeScore, lastGame.missedGame.awayScore, lastGame.missedGame.fixtureId)}</span>
                <span className={!lastGame.missedGame.isHome ? 'highlight' : ''}>{lastGame.missedGame.awayTeam}</span>
              </div>
              <div className="stats-strip">
                <span className={`badge ${lastGame.missedGame.onBench ? 'badge-bench' : 'badge-dnp'}`}>
                  {lastGame.missedGame.onBench ? 'Unused sub' : 'Not in squad'}
                </span>
              </div>
            </div>
          )}

          {lastGame && (() => {
            const canExpand = lastGame.participated && lastGame.fixtureId
            return (
              <div
                className={[
                  'last-game-info',
                  lastGame.participated ? getStatusClass(lastGame.started, lastGame.participated, false) : '',
                  canExpand ? 'expandable' : ''
                ].filter(Boolean).join(' ')}
                onClick={canExpand ? () => setExpanded(e => !e) : undefined}
              >
                {/* Date · competition on one line */}
                <div className="last-game-header">
                  {lastGame.missedGame ? 'Last Played' : 'Last Game'}:{' '}
                  {formatDate(lastGame.date)}
                  {lastGame.competition && ` · ${lastGame.competition}`}
                </div>

                <div className="match-teams">
                  <span className={lastGame.isHome ? 'highlight' : ''}>{lastGame.homeTeam}</span>
                  <span className="score">{renderScore(lastGame.homeScore, lastGame.awayScore, lastGame.fixtureId)}</span>
                  <span className={!lastGame.isHome ? 'highlight' : ''}>{lastGame.awayTeam}</span>
                </div>

                {lastGame.participated
                  ? lastGame.minutesPlayed === 0 && lastGame.started === false && !lastGame.events?.some(e => e.type === 'sub_in')
                    ? <div className="stats-strip"><span className="badge badge-bench">Unused sub</span></div>
                    : renderStatsStrip(lastGame, 'lastGame')
                  : <div className="stats-strip"><span className="badge badge-dnp">Did not play</span></div>
                }

                {renderStatsDrawer(canExpand)}
              </div>
            )
          })()}

          {nextGame && (
            <div className="next-game-line">
              <span className="next-game-label">Next:</span>{' '}
              {nextGame.isHome ? 'vs' : 'at'} {nextGame.isHome ? nextGame.awayTeam : nextGame.homeTeam}
              {nextGame.competition ? ` · ${nextGame.competition}` : ''} · {formatKickoff(nextGame.kickoff)}
            </div>
          )}
        </div>
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
