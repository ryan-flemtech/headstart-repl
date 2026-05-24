import React from 'react'

export function CollapseTabButton({
  onClick,
  direction = 'right',
  title = 'Collapse panel',
  ariaLabel = title,
  style,
}) {
  return (
    <button
      type="button"
      style={{ ...s.tabButton, ...style }}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
    >
      {direction === 'left' ? '<' : '>'}
    </button>
  )
}

export function CollapsedPanelRail({
  onClick,
  label = 'Panel',
  direction = 'left',
  title = `Show ${label}`,
  ariaLabel = title,
  style,
}) {
  return (
    <button
      type="button"
      style={{ ...s.rail, ...style }}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
    >
      <span style={s.railChevron}>{direction === 'left' ? '<' : '>'}</span>
      <span style={s.railLabel}>{label}</span>
    </button>
  )
}

export function AnimatedPanelShell({ animate = false, children }) {
  if (!animate) return children

  return (
    <div className="preview-slide-open" style={s.panelShell}>
      {children}
    </div>
  )
}

const s = {
  tabButton: {
    width: 34,
    alignSelf: 'stretch',
    border: 0,
    borderRadius: 6,
    background: 'transparent',
    color: '#6b5b7d',
    cursor: 'pointer',
    fontSize: 18,
    lineHeight: 1,
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    boxShadow: 'none',
  },
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
  railChevron: {
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
  panelShell: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
}
