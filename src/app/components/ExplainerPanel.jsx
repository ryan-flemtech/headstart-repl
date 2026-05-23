import React, { useState } from 'react'
import { MarkdownRenderer } from '../../shared/markdown'

export default function ExplainerPanel({ title, content, collapsible = true, fill = false }) {
  const [collapsed, setCollapsed] = useState(false)
  const isCollapsed = collapsible && collapsed

  return (
    <div style={{ ...s.panel, ...(fill ? s.panelFill : {}) }} className="card ui-collapsible">
      {collapsible && (
        <button
          className="ui-collapsible__header"
          style={s.toggle}
          onClick={() => setCollapsed(c => !c)}
          aria-expanded={!collapsed}
        >
          <span style={s.toggleLabel}>Task</span>
          <span style={s.toggleIcon}>{collapsed ? '▼' : '▲'}</span>
        </button>
      )}

      {!isCollapsed && (
        <div style={{ ...s.content, ...(fill ? s.contentFill : {}) }}>
          <MarkdownRenderer title={title} content={content} />
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
  panelFill: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
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
  contentFill: {
    flex: 1,
    maxHeight: 'none',
    padding: '24px 28px',
  },
}
