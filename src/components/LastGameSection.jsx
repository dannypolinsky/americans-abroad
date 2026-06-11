import StatsStrip from './StatsStrip'
import StatsModal from './StatsModal'
import { formatDate, formatKickoff, getResult, getStatusClass } from '../utils/playerUtils'

function ScoreDisplay({ homeScore, awayScore, fixtureId }) {
  const nums = (
    <>
      <span className="score-num">{homeScore}</span>
      <span className="score-colon">·</span>
      <span className="score-num">{awayScore}</span>
    </>
  )
  if (fixtureId) {
    return (
      <a href={`https://www.fotmob.com/match/${fixtureId}`} target="_blank" rel="noopener noreferrer"
        className="score-link" onClick={e => e.stopPropagation()}>
        {nums}
      </a>
    )
  }
  return nums
}

function LastGameSection({ lastGame, nextGame, expanded, setExpanded, detailedStats }) {
  return (
    <div className="game-info-section">
      {lastGame && (() => {
        const mg = lastGame.missedGame

        if (mg) {
          // Main box: team's most recent game (player didn't participate)
          return (
            <div className={['last-game-info', getStatusClass(false, false, mg.onBench, 0)].filter(Boolean).join(' ')}>
              <div className="match-body">
                <div className="last-game-header">
                  Last Game: {formatDate(mg.date)}
                  {mg.competition && ` · ${mg.competition}`}
                </div>
                <div className="match-teams">
                  <div className="match-teams-names">
                    <span className="player-team">
                      {mg.isHome ? mg.homeTeam : mg.awayTeam}
                    </span>
                    <span className="opponent-team">
                      {mg.isHome ? 'vs ' : 'at '}{mg.isHome ? mg.awayTeam : mg.homeTeam}
                    </span>
                  </div>
                </div>
                <div className="stats-strip">
                  <span className={`badge ${mg.onBench ? 'badge-bench' : 'badge-dnp'}`}>
                    {mg.onBench ? 'Not in squad' : 'Did not play'}
                  </span>
                </div>
              </div>
              <div className="match-score-col">
                <span className="score">
                  <ScoreDisplay homeScore={mg.homeScore} awayScore={mg.awayScore} fixtureId={null} />
                </span>
                {(() => {
                  const result = getResult(mg.isHome, mg.homeScore, mg.awayScore)
                  return result ? <span className={`result-badge result-${result.toLowerCase()}`}>{result}</span> : null
                })()}
              </div>
            </div>
          )
        }

        // No missedGame — show lastGame as usual
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
            <div className="match-body">
              <div className="last-game-header">
                Last Game: {formatDate(lastGame.date)}
                {lastGame.competition && ` · ${lastGame.competition}`}
              </div>
              <div className="match-teams">
                <div className="match-teams-names">
                  <span className="player-team">
                    {lastGame.isHome ? lastGame.homeTeam : lastGame.awayTeam}
                  </span>
                  <span className="opponent-team">
                    {lastGame.isHome ? 'vs ' : 'at '}{lastGame.isHome ? lastGame.awayTeam : lastGame.homeTeam}
                  </span>
                </div>
              </div>
              {lastGame.participated
                ? lastGame.minutesPlayed === 0 && lastGame.started === false && !lastGame.events?.some(e => e.type === 'sub_in')
                  ? <div className="stats-strip"><span className="badge badge-bench">Unused sub</span></div>
                  : <StatsStrip data={lastGame} source="lastGame" />
                : <div className="stats-strip"><span className="badge badge-dnp">Did not play</span></div>
              }
            </div>

            <StatsModal
              expanded={expanded}
              setExpanded={setExpanded}
              detailedStats={detailedStats}
              title={`${lastGame.homeTeam} vs ${lastGame.awayTeam}`}
            />

            <div className="match-score-col">
              <span className="score">
                <ScoreDisplay homeScore={lastGame.homeScore} awayScore={lastGame.awayScore} fixtureId={lastGame.fixtureId} />
              </span>
              {(() => {
                const result = getResult(lastGame.isHome, lastGame.homeScore, lastGame.awayScore)
                return result ? <span className={`result-badge result-${result.toLowerCase()}`}>{result}</span> : null
              })()}
            </div>
          </div>
        )
      })()}

      {/* Compact line: last game player actually played (shown below missed-game box) */}
      {lastGame?.missedGame && (
        <div className="missed-game-line">
          <span className="missed-label">Last played:</span>
          {' '}{formatDate(lastGame.date)}
          {lastGame.competition && ` · ${lastGame.competition}`}
          {(lastGame.homeScore != null && lastGame.awayScore != null) && ` · ${lastGame.homeTeam} ${lastGame.homeScore}·${lastGame.awayScore} ${lastGame.awayTeam}`}
        </div>
      )}

      {nextGame && new Date(nextGame.kickoff) > new Date() && (
        <div className="next-game-line">
          <span className="next-game-label">Next:</span>{' '}
          {nextGame.isHome ? 'vs' : 'at'} {nextGame.isHome ? nextGame.awayTeam : nextGame.homeTeam}
          {nextGame.competition ? ` · ${nextGame.competition}` : ''} · {formatKickoff(nextGame.kickoff)}
        </div>
      )}
    </div>
  )
}

export default LastGameSection
