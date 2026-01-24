import './PlayerCard.css'

function PlayerCard({ player, matchData, showLastGame = false }) {
  const isLive = matchData?.status === 'live'
  const hasTodayMatch = matchData !== null && matchData.status !== 'no_match_today'
  const lastGame = matchData?.lastGame
  const nextGame = matchData?.nextGame

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Format kickoff time for upcoming matches
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

  // Render events with icons
  const renderEvents = (events) => {
    if (!events || events.length === 0) return null
    return (
      <div className="player-events">
        {events.map((event, idx) => (
          <span key={idx} className={`event ${event.type}`}>
            {event.type === 'goal' && '⚽'}
            {event.type === 'assist' && '🅰️'}
            {event.type === 'sub_in' && '🔼'}
            {event.type === 'sub_out' && '🔽'}
            {event.type === 'yellow' && '🟨'}
            {event.type === 'red' && '🟥'}
            {event.minute}'
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className={`player-card ${isLive ? 'live' : ''} ${hasTodayMatch ? 'has-match' : ''}`}>
      {isLive && <div className="live-indicator">LIVE</div>}

      <div className="player-info">
        {player.image ? (
          <img
            src={player.image}
            alt={player.name}
            className="player-headshot"
            onError={(e) => {
              e.target.style.display = 'none'
              e.target.nextSibling.style.display = 'flex'
            }}
          />
        ) : null}
        <div className="player-avatar" style={player.image ? {display: 'none'} : {}}>
          {player.name.split(' ').map(n => n[0]).join('')}
        </div>
        <div className="player-details">
          <h3 className="player-name">{player.name}</h3>
          <p className="player-team">{player.team}</p>
          <p className="player-meta">
            <span className="position">{player.position}</span>
            <span className="league">{player.league}</span>
          </p>
        </div>
      </div>

      {hasTodayMatch && (
        <div className="match-info">
          <div className="match-teams">
            <span className={matchData.isHome ? 'highlight' : ''}>{matchData.homeTeam}</span>
            <span className="score-container">
              {isLive && <span className="live-minute">{matchData.minute}'</span>}
              <span className="score">
                {matchData.status === 'upcoming' ? 'vs' : (
                  <><span className="score-num">{matchData.homeScore}</span><span className="score-colon">:</span><span className="score-num">{matchData.awayScore}</span></>
                )}
              </span>
            </span>
            <span className={!matchData.isHome ? 'highlight' : ''}>{matchData.awayTeam}</span>
          </div>

          <div className="match-time">
            {matchData.status === 'upcoming' && formatKickoff(matchData.kickoff)}
            {matchData.status === 'finished' && 'FT'}
          </div>

          {renderEvents(matchData.events)}

          {matchData.status === 'finished' && (
            <div className="player-participation">
              {matchData.participated ? (
                <>
                  {matchData.rating && <span className="rating-badge">{matchData.rating}</span>}
                  <span className="minutes-badge">{matchData.minutesPlayed}'</span>
                  {matchData.started === true && <span className="start-badge">START</span>}
                  {matchData.started === false && <span className="sub-badge">SUB</span>}
                  {matchData.events?.filter(e => e.type === 'goal').map((e, i) => (
                    <span key={`goal-${i}`} className="stat-badge goal">⚽ {e.minute}'</span>
                  ))}
                  {matchData.events?.filter(e => e.type === 'assist').map((e, i) => (
                    <span key={`assist-${i}`} className="stat-badge assist">🅰️ {e.minute}'</span>
                  ))}
                </>
              ) : (
                <span className="did-not-play">Did not play</span>
              )}
            </div>
          )}
        </div>
      )}

      {!hasTodayMatch && showLastGame && (lastGame || nextGame) && (
        <div className="game-info-section">
          {nextGame && (
            <div className="next-game-info">
              <div className="next-game-header">
                Next Game: {formatKickoff(nextGame.kickoff)}
              </div>
              <div className="match-teams">
                <span className={nextGame.isHome ? 'highlight' : ''}>{nextGame.homeTeam}</span>
                <span className="score">vs</span>
                <span className={!nextGame.isHome ? 'highlight' : ''}>{nextGame.awayTeam}</span>
              </div>
            </div>
          )}

          {lastGame && (
            <div className="last-game-info">
              <div className="last-game-header">
                Last Game: {formatDate(lastGame.date)}
              </div>
              <div className="match-teams">
                <span className={lastGame.isHome ? 'highlight' : ''}>{lastGame.homeTeam}</span>
                <span className="score"><span className="score-num">{lastGame.homeScore}</span><span className="score-colon">:</span><span className="score-num">{lastGame.awayScore}</span></span>
                <span className={!lastGame.isHome ? 'highlight' : ''}>{lastGame.awayTeam}</span>
              </div>

              {lastGame.participated ? (
                <div className="last-game-stats">
                  {lastGame.rating && <span className="rating-badge">{lastGame.rating}</span>}
                  {lastGame.minutesPlayed !== null && (
                    <span className="minutes-badge">{lastGame.minutesPlayed}'</span>
                  )}
                  {lastGame.started === true && <span className="start-badge">START</span>}
                  {lastGame.started === false && <span className="sub-badge">SUB</span>}
                  {lastGame.events?.filter(e => e.type === 'goal').map((e, i) => (
                    <span key={`goal-${i}`} className="stat-badge goal">⚽ {e.minute}'</span>
                  ))}
                  {lastGame.events?.filter(e => e.type === 'assist').map((e, i) => (
                    <span key={`assist-${i}`} className="stat-badge assist">🅰️ {e.minute}'</span>
                  ))}
                </div>
              ) : (
                <div className="last-game-stats">
                  <span className="did-not-play">Did not play</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!hasTodayMatch && !showLastGame && (
        <div className="no-match">
          <p>No match today</p>
        </div>
      )}

      {!hasTodayMatch && showLastGame && !lastGame && !nextGame && (
        <div className="no-match">
          <p>No recent match data</p>
        </div>
      )}
    </div>
  )
}

export default PlayerCard
