import { useRef } from 'react'
import { createPortal } from 'react-dom'

// Bottom-sheet stats modal with touch/mouse drag-to-dismiss
function StatsModal({ expanded, setExpanded, detailedStats, title }) {
  const sheetRef   = useRef(null)
  const dragStartY = useRef(null)
  const currentDragY = useRef(0)

  const onDragStart = (clientY) => {
    dragStartY.current = clientY
    currentDragY.current = 0
    if (sheetRef.current) sheetRef.current.style.transition = 'none'
  }

  const onDragMove = (clientY) => {
    if (dragStartY.current === null) return
    const delta = Math.max(0, clientY - dragStartY.current)
    currentDragY.current = delta
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${delta}px)`
  }

  const onDragEnd = () => {
    if (dragStartY.current === null) return
    const y = currentDragY.current
    dragStartY.current = null
    currentDragY.current = 0
    if (y > 120) {
      setExpanded(false)
    } else if (sheetRef.current) {
      sheetRef.current.style.transition = ''
      sheetRef.current.style.transform = ''
    }
  }

  const onMouseDown = (e) => {
    onDragStart(e.clientY)
    const onMove = (e) => onDragMove(e.clientY)
    const onUp = () => {
      onDragEnd()
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  if (!expanded) return null

  return createPortal(
    <div className="stats-modal-backdrop" onClick={() => setExpanded(false)}>
      <div
        className="stats-modal-sheet"
        ref={sheetRef}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="stats-modal-handle"
          onTouchStart={e => onDragStart(e.touches[0].clientY)}
          onTouchMove={e => onDragMove(e.touches[0].clientY)}
          onTouchEnd={onDragEnd}
          onMouseDown={onMouseDown}
        />
        <div
          className="stats-modal-header"
          onTouchStart={e => onDragStart(e.touches[0].clientY)}
          onTouchMove={e => onDragMove(e.touches[0].clientY)}
          onTouchEnd={onDragEnd}
          onMouseDown={onMouseDown}
        >
          <span className="stats-modal-title">{title}</span>
          <button className="stats-modal-close" onClick={() => setExpanded(false)}>✕</button>
        </div>
        <div className="stats-modal-body">
          {!detailedStats
            ? <div className="stats-loading">Loading stats…</div>
            : detailedStats.map(group => (
                <div key={group.key} className="stats-group">
                  <div className="stats-group-header">{group.label}</div>
                  {group.stats.map(stat => (
                    <div key={stat.key} className="stat-row">
                      <span className="stat-label">{stat.label}</span>
                      <span className="stat-value">{stat.value}</span>
                    </div>
                  ))}
                </div>
              ))
          }
        </div>
      </div>
    </div>,
    document.body
  )
}

export default StatsModal
