import React from 'react'
import { CodeEditor } from '../../shared/CodeEditor'

export default function HtmlEditor({ files = [], activeFile, onTabChange, onFileChange, readOnly = false }) {
  const current = files.find(f => f.name === activeFile) ?? files[0]

  return (
    <div style={s.wrap}>
      {/* File tabs */}
      <div style={s.tabs}>
        {files.map(f => (
          <button
            key={f.name}
            style={{
              ...s.tab,
              ...(f.name === activeFile ? s.tabActive : {}),
            }}
            onClick={() => onTabChange?.(f.name)}
          >
            {f.name}
          </button>
        ))}
      </div>

      {/* Editor */}
      {current && (
        <CodeEditor
          key={current.name}
          value={current.content}
          language={current.type ?? 'html'}
          readOnly={readOnly}
          onChange={content => onFileChange?.(current.name, content)}
          style={{ flex: 1, minHeight: 240 }}
        />
      )}
    </div>
  )
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
  tabs: {
    display: 'flex',
    gap: 2,
    background: '#e5e7eb',
    padding: '4px 4px 0',
    borderRadius: '8px 8px 0 0',
    overflowX: 'auto',
  },
  tab: {
    background: 'transparent',
    color: 'var(--colour-text)',
    fontFamily: 'var(--font-code)',
    fontSize: '0.8rem',
    padding: '5px 14px',
    borderRadius: '6px 6px 0 0',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    opacity: 0.65,
  },
  tabActive: {
    background: '#fafafa',
    opacity: 1,
    fontWeight: 700,
  },
}
