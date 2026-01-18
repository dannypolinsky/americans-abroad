import './Header.css'

function Header({ filter, setFilter, liveCount }) {
  return (
    <header className="header">
      <div className="header-content">
        <h1 className="header-title">
          <span className="flag">🇺🇸</span> Americans Abroad
        </h1>
        <p className="header-subtitle">Tracking US players around the world</p>
      </div>

      <nav className="header-nav">
        <button
          className={`nav-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Players
        </button>
        <button
          className={`nav-btn live ${filter === 'live' ? 'active' : ''}`}
          onClick={() => setFilter('live')}
        >
          Live Now {liveCount > 0 && <span className="live-badge">{liveCount}</span>}
        </button>
        <button
          className={`nav-btn ${filter === 'today' ? 'active' : ''}`}
          onClick={() => setFilter('today')}
        >
          Playing Today
        </button>
      </nav>
    </header>
  )
}

export default Header
