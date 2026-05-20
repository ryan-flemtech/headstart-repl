import React, { useState } from 'react'
import { MarkdownRenderer } from '../../shared/markdown'

export default function ExplainerPanel({ content }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={s.panel} className="card">
      <button
        style={s.toggle}
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
      >
        <span style={s.toggleLabel}>Task</span>
        <span style={s.toggleIcon}>{collapsed ? '▼' : '▲'}</span>
      </button>

      {!collapsed && (
        <div style={s.content}>
          <MarkdownRenderer content={content} />
        </div>
      )}
    </div>
  )
}

const s = {
  panel: {
    flexShrink: 0,
    overflow: 'hidden',
  },
  toggle: {
    width: '100%',
    background: 'var(--colour-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 0,
    padding: '10px 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.85rem',
    letterSpacing: '0.04em',
  },
  toggleLabel: {},
  toggleIcon: { fontSize: '0.75rem', opacity: 0.8 },
  content: {
    padding: '14px 16px',
    maxHeight: 280,
    overflowY: 'auto',
  },
}
