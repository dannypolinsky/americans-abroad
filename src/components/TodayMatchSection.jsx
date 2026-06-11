import StatsStrip from './StatsStrip'
import StatsModal from './StatsModal'
import { formatTimeOnly, formatKickoff, getResult, getStatusClass, getUpcomingStatusClass } from '../utils/playerUtils'

// Inline score renderer — links to FotMob match page when a fixtureId is available
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

function TodayMatchSection({ matchData, expanded, setExpanded, detailedStats }) {
  const nextGame = matchData?.nextGame
  const isLive = matchData?.status === 'live'

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
            ? getStatusClass(matchData.started, matchData.participated, matchData.onBench, matchData.minutesPlayed) : '',
          matchData.status === 'upcoming' ? getUpcomingStatusClass(matchData.lineupStatus) : '',
          canExpand ? 'expandable' : ''
        ].filter(Boolean).join(' ')}
        onClick={canExpand ? () => setExpanded(e => !e) : undefined}
      >
        <div className="match-body">
          <div className="match-teams">
            <div className="match-teams-names">
              <span className="player-team">
                {matchData.isHome ? matchData.homeTeam : matchData.awayTeam}
              </span>
              <span className="opponent-team">
                {matchData.isHome ? 'vs ' : 'at '}{matchData.isHome ? matchData.awayTeam : matchData.homeTeam}
              </span>
            </div>
          </div>

          <div className="match-time">
            {matchData.status === 'upcoming' && matchData.competition}
            {matchData.status === 'finished' && (matchData.legInfo ? `FT · ${matchData.legInfo}` : 'FT')}
            {matchData.status !== 'upcoming' && matchData.competition && (
              <span className="time-comp-sep">
                {matchData.status === 'live' ? matchData.competition : ` · ${matchData.competition}`}
              </span>
            )}
          </div>

          {matchData.aggregateScore && (
            <div className="aggregate-score">
              Agg: {matchData.aggregateScore}{matchData.aggregateWinner && ` (${matchData.aggregateWinner} advance)`}
            </div>
          )}

          {matchData.status === 'upcoming' && matchData.lineupStatus && (
            <div className="stats-strip">
              {matchData.lineupStatus === 'starting'    && <span className="badge badge-start">STARTING</span>}
              {matchData.lineupStatus === 'bench'       && <span className="badge badge-bench">BENCH</span>}
              {matchData.lineupStatus === 'not_in_squad' && <span className="badge badge-dnp">Not in squad</span>}
            </div>
          )}

          {matchData.status === 'live' && (
            (matchData.participated === false || (!matchData.started && !matchData.minutesPlayed))
              ? <div className="stats-strip">
                  <span className={`badge ${matchData.onBench ? 'badge-bench' : 'badge-dnp'}`}>
                    {matchData.onBench ? 'On bench' : 'Not in squad'}
                  </span>
                </div>
              : <StatsStrip data={matchData} source="today" isLive={true} />
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
                : <StatsStrip data={matchData} source="today" />
          )}
        </div>

        <StatsModal
          expanded={expanded}
          setExpanded={setExpanded}
          detailedStats={detailedStats}
          title={`${matchData.homeTeam} vs ${matchData.awayTeam}`}
        />

        <div className="match-score-col">
          {isLive && <span className="live-minute">{matchData.minute === 'HT' ? 'HT' : `${matchData.minute}'`}</span>}
          {matchData.status === 'upcoming' ? (
            <div className="kickoff-display">
              <span className="kickoff-label">KO</span>
              <span className="kickoff-time">{formatTimeOnly(matchData.kickoff)}</span>
            </div>
          ) : (
            <span className="score">
              <ScoreDisplay homeScore={matchData.homeScore} awayScore={matchData.awayScore} fixtureId={matchData.fixtureId} />
            </span>
          )}
          {matchData.status === 'finished' && (() => {
            const result = getResult(matchData.isHome, matchData.homeScore, matchData.awayScore)
            return result ? <span className={`result-badge result-${result.toLowerCase()}`}>{result}</span> : null
          })()}
        </div>
      </div>

      {nextGame && new Date(nextGame.kickoff) > new Date() && (matchData.status === 'finished' || matchData.status === 'live') && (
        <div className="next-game-line">
          <span className="next-game-label">Next:</span>{' '}
          {nextGame.isHome ? 'vs' : 'at'} {nextGame.isHome ? nextGame.awayTeam : nextGame.homeTeam}
          {nextGame.competition ? ` · ${nextGame.competition}` : ''} · {formatKickoff(nextGame.kickoff)}
        </div>
      )}
    </>
  )
}

export default TodayMatchSection
