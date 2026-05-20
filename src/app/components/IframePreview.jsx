import React from 'react'

export default function IframePreview({ src, iframeRef, height = 300, fill = false }) {
  const wrapStyle = fill
    ? { ...s.wrap, flex: 1, minHeight: 0, flexShrink: 1 }
    : { ...s.wrap, height }
  return (
    <div style={wrapStyle}>
      <div style={s.header}>
        <span style={s.label}>Preview</span>
      </div>
      <iframe
        ref={iframeRef}
        src={src ?? 'about:blank'}
        style={s.frame}
        sandbox="allow-scripts allow-same-origin"
        title="Output preview"
      />
    </div>
  )
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 10,
    overflow: 'hidden',
    border: '1px solid #e5e7eb',
    background: '#fff',
    flexShrink: 0,
  },
  header: {
    background: 'var(--colour-primary)',
    padding: '8px 12px',
    flexShrink: 0,
  },
  label: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.85rem',
    color: '#fff',
    letterSpacing: '0.04em',
  },
  frame: {
    flex: 1,
    border: 'none',
    width: '100%',
    background: '#fff',
  },
}
