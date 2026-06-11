// Pure stats badge strip — goals, assists, cards, sub events
// source: 'today' (events have sub_in/sub_out + minutes) | 'lastGame' (goals/assists/cards only)
function StatsStrip({ data, source, isLive = false }) {
  const events = data.events || []
  const subOutEvent = events.find(e => e.type === 'sub_out')
  const subInEvent  = events.find(e => e.type === 'sub_in')

  // For lastGame starters without an explicit sub_out event, infer minute from minutesPlayed
  const subOutMinute = subOutEvent?.minute ??
    (source !== 'today' && data.started && data.minutesPlayed != null && data.minutesPlayed < 90
      ? data.minutesPlayed : null)
  const subInMinute = subInEvent?.minute ?? null

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

export default StatsStrip
