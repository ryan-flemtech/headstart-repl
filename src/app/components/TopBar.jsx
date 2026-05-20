import React from 'react'

// isSolo: true = solo, false = live teacher session, undefined = don't show badge (teacher view)
export default function TopBar({ lessonTitle, lessonLevel, displayName, isSandbox, isSolo, right }) {
  return (
    <header style={s.bar}>
      <div style={s.left}>
        <span style={s.logo}>Headstart Coding</span>
        <span style={s.divider}>·</span>
        {lessonLevel && <span style={s.level}>{lessonLevel}</span>}
        <span style={s.title}>{lessonTitle}</span>
        {isSandbox && <span style={s.sandboxBadge}>SANDBOX</span>}
        {!isSandbox && isSolo === true  && <span style={{ ...s.modeBadge, background: '#6b7280' }}>SOLO</span>}
        {!isSandbox && isSolo === false && <span style={{ ...s.modeBadge, background: '#22c55e' }}>LIVE</span>}
      </div>
      <div style={s.centre}>{/* progress dots injected here by parent */}</div>
      <div style={s.rightSlot}>
        {right}
        {displayName && !isSolo && (
          <span style={s.name}>{displayName}</span>
        )}
      </div>
    </header>
  )
}

const s = {
  bar: {
    background: 'var(--colour-primary)',
    color: 'var(--colour-text-on-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    height: 52,
    flexShrink: 0,
    gap: 12,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flex: '0 0 auto',
  },
  logo: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1rem',
    whiteSpace: 'nowrap',
    color: '#ffffff',
  },
  level: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.75rem',
    whiteSpace: 'nowrap',
    background: 'rgba(255,255,255,0.15)',
    color: '#ffffff',
    padding: '2px 8px',
    borderRadius: 4,
  },
  divider: {
    opacity: 0.4,
  },
  title: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.95rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 240,
  },
  sandboxBadge: {
    background: 'var(--colour-secondary)',
    color: 'var(--colour-text-on-secondary)',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.7rem',
    padding: '2px 8px',
    borderRadius: 4,
    letterSpacing: '0.05em',
  },
  modeBadge: {
    color: '#fff',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.7rem',
    padding: '2px 8px',
    borderRadius: 4,
    letterSpacing: '0.05em',
  },
  centre: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
  },
  rightSlot: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flex: '0 0 auto',
  },
  name: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.9rem',
    opacity: 0.9,
  },
}
