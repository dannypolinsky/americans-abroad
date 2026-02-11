import './PlayerCard.css'

function PlayerCard({ player, matchData, showLastGame = false }) {
  const isLive = matchData?.status === 'live'
  const hasTodayMatch = matchData !== null && matchData.status !== 'no_match_today'
  const lastGame = matchData?.lastGame
  const nextGame = matchData?.nextGame

  // Format date for display - shows "Today" if date is today
  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    if (date.toDateString() === now.toDateString()) {
      return 'Today'
    }
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

  // Render score with optional FotMob link
  const renderScore = (homeScore, awayScore, fixtureId) => {
    const scoreContent = <><span className="score-num">{homeScore}</span><span className="score-colon">:</span><span className="score-num">{awayScore}</span></>
    if (fixtureId) {
      return <a href={`https://www.fotmob.com/match/${fixtureId}`} target="_blank" rel="noopener noreferrer" className="score-link">{scoreContent}</a>
    }
    return scoreContent
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
        <div className={`match-info${(matchData.status === 'finished' || matchData.status === 'live') && !matchData.participated && !matchData.onBench ? ' not-in-squad-highlight' : ''}${(matchData.status === 'finished' || matchData.status === 'live') && !matchData.participated && matchData.onBench ? ' unused-sub-highlight' : ''}`}>
          <div className="match-teams">
            <span className={matchData.isHome ? 'highlight' : ''}>{matchData.homeTeam}</span>
            <span className="score-container">
              {isLive && <span className="live-minute">{matchData.minute === 'HT' ? 'HT' : `${matchData.minute}'`}</span>}
              <span className="score">
                {matchData.status === 'upcoming' ? 'vs' : renderScore(matchData.homeScore, matchData.awayScore, matchData.fixtureId)}
              </span>
            </span>
            <span className={!matchData.isHome ? 'highlight' : ''}>{matchData.awayTeam}</span>
          </div>

          <div className="match-time">
            {matchData.status === 'upcoming' && formatKickoff(matchData.kickoff)}
            {matchData.status === 'finished' && (matchData.legInfo ? `FT - ${matchData.legInfo}` : 'FT')}
          </div>

          {matchData.aggregateScore && (
            <div className="aggregate-score">
              Agg: {matchData.aggregateScore} {matchData.aggregateWinner && `(${matchData.aggregateWinner} advance)`}
            </div>
          )}

          {matchData.competition && (
            <div className="competition-name">{matchData.competition}</div>
          )}

          {matchData.status === 'upcoming' && matchData.lineupStatus && (
            <div className="player-participation">
              {matchData.lineupStatus === 'starting' && (
                <span className="start-badge">STARTING</span>
              )}
              {matchData.lineupStatus === 'bench' && (
                <span className="bench-badge">ON BENCH</span>
              )}
              {matchData.lineupStatus === 'not_in_squad' && (
                <span className="did-not-play">Not in squad</span>
              )}
            </div>
          )}

          {matchData.status === 'live' && (
            <div className="player-participation">
              {matchData.participated !== false ? (
                <>
                  {matchData.rating && <span className="rating-badge">{matchData.rating}</span>}
                  {matchData.started === true && <span className="start-badge">START</span>}
                  {matchData.started === false && matchData.events?.some(e => e.type === 'sub_in') && (
                    <span className="sub-badge">SUB {matchData.events.find(e => e.type === 'sub_in')?.minute}'</span>
                  )}
                  {matchData.started === false && !matchData.events?.some(e => e.type === 'sub_in') && (
                    <span className="bench-badge">BENCH</span>
                  )}
                  {matchData.events?.filter(e => e.type === 'goal').map((e, i) => (
                    <span key={`goal-${i}`} className="stat-badge goal">⚽ {e.minute}'</span>
                  ))}
                  {matchData.events?.filter(e => e.type === 'assist').map((e, i) => (
                    <span key={`assist-${i}`} className="stat-badge assist">🅰️ {e.minute}'</span>
                  ))}
                </>
              ) : (
                <span className={matchData.onBench ? 'unused-sub' : 'did-not-play'}>{matchData.onBench ? 'Unused sub' : 'Not in squad'}</span>
              )}
            </div>
          )}

          {matchData.status === 'finished' && (
            <div className="player-participation">
              {matchData.participated ? (
                <>
                  {matchData.rating && <span className="rating-badge">{matchData.rating}</span>}
                  <span className={matchData.started === false ? 'sub-minutes-badge' : 'minutes-badge'}>{matchData.minutesPlayed}'</span>
                  {matchData.started === true && <span className="start-badge">START</span>}
                  {matchData.started === false && <span className="sub-badge">SUB</span>}
                  {matchData.events?.filter(e => e.type === 'goal').map((e, i) => (
                    <span key={`goal-${i}`} className="stat-badge goal">⚽{e.minute ? ` ${e.minute}'` : ''}</span>
                  ))}
                  {matchData.events?.filter(e => e.type === 'assist').map((e, i) => (
                    <span key={`assist-${i}`} className="stat-badge assist">🅰️{e.minute ? ` ${e.minute}'` : ''}</span>
                  ))}
                </>
              ) : (
                <span className={matchData.onBench ? 'unused-sub' : 'did-not-play'}>{matchData.onBench ? 'Unused sub' : 'Not in squad'}</span>
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

          {lastGame?.missedGame && (
            <div className={lastGame.missedGame.onBench ? 'bench-game-info' : 'missed-game-info'}>
              <div className={lastGame.missedGame.onBench ? 'bench-game-header' : 'missed-game-header'}>
                {lastGame.missedGame.onBench ? 'Unused Sub' : 'Missed'}: {formatDate(lastGame.missedGame.date)}
              </div>
              {lastGame.missedGame.competition && (
                <div className="competition-name">{lastGame.missedGame.competition}</div>
              )}
              <div className="match-teams">
                <span className={lastGame.missedGame.isHome ? 'highlight' : ''}>{lastGame.missedGame.homeTeam}</span>
                <span className="score">{renderScore(lastGame.missedGame.homeScore, lastGame.missedGame.awayScore, lastGame.missedGame.fixtureId)}</span>
                <span className={!lastGame.missedGame.isHome ? 'highlight' : ''}>{lastGame.missedGame.awayTeam}</span>
              </div>
              <div className="last-game-stats">
                <span className={lastGame.missedGame.onBench ? 'unused-sub' : 'did-not-play'}>{lastGame.missedGame.onBench ? 'Unused sub' : 'Not in squad'}</span>
              </div>
            </div>
          )}

          {lastGame && (
            <div className="last-game-info">
              <div className="last-game-header">
                {lastGame.missedGame ? 'Last Played' : 'Last Game'}: {formatDate(lastGame.date)}
              </div>
              {lastGame.competition && (
                <div className="competition-name">{lastGame.competition}</div>
              )}
              <div className="match-teams">
                <span className={lastGame.isHome ? 'highlight' : ''}>{lastGame.homeTeam}</span>
                <span className="score">{renderScore(lastGame.homeScore, lastGame.awayScore, lastGame.fixtureId)}</span>
                <span className={!lastGame.isHome ? 'highlight' : ''}>{lastGame.awayTeam}</span>
              </div>

              {lastGame.participated ? (
                <div className="last-game-stats">
                  {lastGame.rating && <span className="rating-badge">{lastGame.rating}</span>}
                  {lastGame.minutesPlayed !== null && (
                    <span className={lastGame.started === false ? 'sub-minutes-badge' : 'minutes-badge'}>{lastGame.minutesPlayed}'</span>
                  )}
                  {lastGame.started === true && <span className="start-badge">START</span>}
                  {lastGame.started === false && <span className="sub-badge">SUB</span>}
                  {lastGame.events?.filter(e => e.type === 'goal').map((e, i) => (
                    <span key={`goal-${i}`} className="stat-badge goal">⚽{e.minute ? ` ${e.minute}'` : ''}</span>
                  ))}
                  {lastGame.events?.filter(e => e.type === 'assist').map((e, i) => (
                    <span key={`assist-${i}`} className="stat-badge assist">🅰️{e.minute ? ` ${e.minute}'` : ''}</span>
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
