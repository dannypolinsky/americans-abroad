import './PlayerCard.css'

function PlayerCard({ player, matchData }) {
  const isLive = matchData?.status === 'live'
  const hasMatch = matchData !== null

  return (
    <div className={`player-card ${isLive ? 'live' : ''} ${hasMatch ? 'has-match' : ''}`}>
      {isLive && <div className="live-indicator">LIVE</div>}

      <div className="player-info">
        <div className="player-avatar">
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

      {hasMatch && (
        <div className="match-info">
          <div className="match-teams">
            <span className={matchData.isHome ? 'highlight' : ''}>{matchData.homeTeam}</span>
            <span className="score">{matchData.homeScore} - {matchData.awayScore}</span>
            <span className={!matchData.isHome ? 'highlight' : ''}>{matchData.awayTeam}</span>
          </div>

          <div className="match-time">
            {isLive ? `${matchData.minute}'` : matchData.status}
          </div>

          {matchData.events && matchData.events.length > 0 && (
            <div className="player-events">
              {matchData.events.map((event, idx) => (
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
          )}
        </div>
      )}

      {!hasMatch && (
        <div className="no-match">
          <p>No match today</p>
        </div>
      )}
    </div>
  )
}

export default PlayerCard
