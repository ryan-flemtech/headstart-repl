import React, { useState } from 'react'
import { MarkdownRenderer } from '../../shared/markdown'

export default function ExplainerEditor({ title, value, onChange }) {
  return (
    <MarkdownFieldEditor
      title={title}
      value={value}
      onChange={onChange}
      ariaLabel="Explainer editor views"
      placeholder="Write the task explainer in Markdown..."
      height={240}
      minHeight={180}
      showTitle
    />
  )
}

export function MarkdownFieldEditor({
  title,
  value,
  onChange,
  ariaLabel = 'Markdown editor views',
  placeholder = 'Write in Markdown...',
  height = 150,
  minHeight = 120,
  showTitle = false,
}) {
  const [tab, setTab] = useState('entry')
  const content = value ?? ''

  return (
    <div style={{ ...s.wrap, height, minHeight }}>
      <div style={s.tabs} className="ui-tabs" role="tablist" aria-label={ariaLabel}>
        <button
          type="button"
          className="ui-tab"
          role="tab"
          aria-selected={tab === 'entry'}
          style={tab === 'entry' ? { ...s.tab, ...s.tabActive } : s.tab}
          onClick={() => setTab('entry')}
        >
          Entry
        </button>
        <button
          type="button"
          className="ui-tab"
          role="tab"
          aria-selected={tab === 'preview'}
          style={tab === 'preview' ? { ...s.tab, ...s.tabActive } : s.tab}
          onClick={() => setTab('preview')}
        >
          Preview
        </button>
      </div>

      <div style={s.pane}>
        {tab === 'entry' ? (
          <textarea
            style={s.textarea}
            value={content}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            spellCheck
          />
        ) : (
          <div style={s.preview}>
            {content || (showTitle && title)
              ? <MarkdownRenderer title={showTitle ? title : undefined} content={content} />
              : <span style={s.empty}>Preview will appear here...</span>}
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
  },
  tabs: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: 4,
    border: '1px solid #e5e7eb',
    borderBottom: 'none',
    borderRadius: '8px 8px 0 0',
    background: '#f7f7f7',
    flexShrink: 0,
  },
  tab: {
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: '#6b7280',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    fontWeight: 700,
    padding: '6px 12px',
    cursor: 'pointer',
  },
  tabActive: {
    background: '#ffffff',
    color: 'var(--colour-primary-dark)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
  },
  pane: {
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #e5e7eb',
    borderRadius: '0 0 8px 8px',
    overflow: 'hidden',
    minHeight: 0,
    flex: 1,
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
  empty: {
    color: '#9ca3af',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
  },
}
