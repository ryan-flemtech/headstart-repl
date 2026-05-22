import React from 'react'
import IframePreview from './IframePreview'

export default function CollapsibleIframePreview({ src, iframeRef, fill = true, collapsed, onToggle, animate = false }) {
  if (collapsed) {
    return (
      <button
        type="button"
        style={s.rail}
        onClick={onToggle}
        title="Show Preview"
        aria-label="Show Preview"
      >
        <span style={s.chevron}>{'<'}</span>
        <span style={s.railLabel}>Preview</span>
      </button>
    )
  }

  const preview = (
    <IframePreview
      src={src}
      iframeRef={iframeRef}
      fill={fill}
      rightActions={
        <button
          type="button"
          style={s.headerButton}
          onClick={onToggle}
          title="Collapse Preview"
          aria-label="Collapse Preview"
        >
          {'>'}
        </button>
      }
    />
  )

  if (!animate) return preview

  return (
    <div className="preview-slide-open" style={s.previewShell}>
      {preview}
    </div>
  )
}

const s = {
  rail: {
    width: '100%',
    height: '100%',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    color: 'var(--colour-primary)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 0',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
  },
  chevron: {
    fontSize: 24,
    lineHeight: 1,
  },
  railLabel: {
    writingMode: 'vertical-rl',
    transform: 'rotate(180deg)',
    fontSize: '0.78rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  headerButton: {
    width: 28,
    height: 28,
    border: '1px solid rgba(255,255,255,0.45)',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 22,
    lineHeight: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  previewShell: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
}
