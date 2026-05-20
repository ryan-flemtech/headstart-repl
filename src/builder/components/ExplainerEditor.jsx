import React from 'react'
import { MarkdownRenderer } from '../../shared/markdown'

export default function ExplainerEditor({ value, onChange }) {
  return (
    <div style={s.wrap}>
      <div style={s.pane}>
        <div style={s.paneLabel}>Markdown</div>
        <textarea
          style={s.textarea}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Write the task explainer in Markdown…"
          spellCheck
        />
      </div>
      <div style={s.pane}>
        <div style={s.paneLabel}>Preview</div>
        <div style={s.preview}>
          {value
            ? <MarkdownRenderer content={value} />
            : <span style={{ color: '#9ca3af', fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>Preview will appear here…</span>}
        </div>
      </div>
    </div>
  )
}

const s = {
  wrap: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    height: 240,
    minHeight: 180,
  },
  pane: {
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  paneLabel: {
    background: '#f0f0f0',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.78rem',
    color: '#6b7280',
    padding: '4px 10px',
    borderBottom: '1px solid #e5e7eb',
    flexShrink: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  textarea: {
    flex: 1,
    border: 'none',
    outline: 'none',
    resize: 'none',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '13px',
    padding: '10px',
    color: 'var(--colour-text)',
    lineHeight: 1.6,
  },
  preview: {
    flex: 1,
    padding: '10px 12px',
    overflowY: 'auto',
  },
}
