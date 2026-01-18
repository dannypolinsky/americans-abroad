import './LeagueFilter.css'

function LeagueFilter({ leagues, selectedLeague, setSelectedLeague, playerCounts }) {
  return (
    <div className="league-filter">
      <button
        className={`league-btn ${selectedLeague === 'all' ? 'active' : ''}`}
        onClick={() => setSelectedLeague('all')}
      >
        All Leagues
        <span className="count">{Object.values(playerCounts).reduce((a, b) => a + b, 0)}</span>
      </button>
      {leagues.map(league => (
        <button
          key={league.id}
          className={`league-btn ${selectedLeague === league.id ? 'active' : ''}`}
          onClick={() => setSelectedLeague(league.id)}
        >
          {league.name}
          <span className="count">{playerCounts[league.name] || 0}</span>
        </button>
      ))}
    </div>
  )
}

export default LeagueFilter
