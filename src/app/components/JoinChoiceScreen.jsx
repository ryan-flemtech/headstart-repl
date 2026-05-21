import React from 'react'

export default function JoinChoiceScreen({ lessonTitle, sessionExists, sessionEnded, onWait, onSolo }) {
  return (
    <div style={s.page}>
      <div style={s.card} className="card">
        <div style={s.header}>
          <span style={s.logo}>Headstart Coding</span>
          <h1 style={s.title}>{lessonTitle}</h1>
        </div>
        <div style={s.body}>
          <p style={s.subtitle}>
            {sessionEnded
              ? 'The session has ended.'
              : sessionExists
                ? 'Your teacher is setting up the session.'
                : 'No session is active yet.'}
          </p>
          <p style={s.sub}>What would you like to do?</p>
          <button className="btn-primary" style={s.mainBtn} onClick={onWait}>
            Wait for Teacher
          </button>
          <button type="button" onClick={onSolo} style={s.soloLink}>
            Work Solo instead
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    background: 'var(--colour-primary)',
  },
  card: {
    width: 400,
    overflow: 'hidden',
    borderRadius: 18,
  },
  header: {
    background: 'var(--colour-primary)',
    padding: '24px 28px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  logo: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.85rem',
    color: 'var(--colour-secondary)',
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.6rem',
    color: '#fff',
    margin: 0,
  },
  body: {
    padding: '28px',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    alignItems: 'center',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '1.1rem',
    color: 'var(--colour-text)',
    margin: 0,
  },
  sub: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: '#6b7280',
    margin: 0,
  },
  mainBtn: {
    width: '100%',
    padding: '12px 0',
    fontSize: '1rem',
    marginTop: 4,
  },
  soloLink: {
    background: 'none',
    border: 'none',
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    color: '#9ca3af',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: 0,
    marginTop: 4,
  },
}
