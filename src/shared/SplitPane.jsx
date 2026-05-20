import React, { useState, useRef, useCallback } from 'react'

export default function SplitPane({ left, right, defaultSplit = 50, style }) {
  const [splitPct, setSplitPct] = useState(defaultSplit)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef(null)
  const dragging = useRef(false)

  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    dragging.current = true
    setIsDragging(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    function onMouseMove(ev) {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      setSplitPct(Math.min(85, Math.max(15, pct)))
    }

    function onMouseUp() {
      dragging.current = false
      setIsDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  const paneStyle = isDragging ? { pointerEvents: 'none' } : undefined

  return (
    <div ref={containerRef} style={{ display: 'flex', minHeight: 0, overflow: 'hidden', ...style }}>
      <div style={{ width: `${splitPct}%`, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', ...paneStyle }}>
        {left}
      </div>
      <div
        onMouseDown={onMouseDown}
        onMouseEnter={e => { e.currentTarget.style.background = '#c4b5fd' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#e5e7eb' }}
        style={{
          width: 5,
          cursor: 'col-resize',
          background: '#e5e7eb',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
      />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', ...paneStyle }}>
        {right}
      </div>
    </div>
  )
}
