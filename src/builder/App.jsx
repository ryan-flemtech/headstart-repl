import React, { useState, useEffect, useCallback } from 'react'
import BuilderView from './views/BuilderView'

const LS_KEY = 'headstart_builder_current'

const blankLesson = () => ({
  id: '',
  type: 'python',
  title: '',
  description: '',
  tasks: [],
})

export default function BuilderApp() {
  const [lesson, setLesson]   = useState(null)
  const [dirty, setDirty]     = useState(false)
  const [restorePrompt, setRestorePrompt] = useState(false)

  // On mount — check localStorage for in-progress lesson
  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      try {
        const saved = JSON.parse(raw)
        if (saved?.id != null) { setRestorePrompt(true); return }
      } catch { /* ignore */ }
    }
    setLesson(blankLesson())
  }, [])

  // Auto-save on every change
  const updateLesson = useCallback((updater) => {
    setLesson(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      localStorage.setItem(LS_KEY, JSON.stringify(next))
      setDirty(true)
      return next
    })
  }, [])

  // Guard unload
  useEffect(() => {
    function handler(e) {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = 'You have unsaved changes — download your lesson first.'
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  if (restorePrompt) {
    const saved = JSON.parse(localStorage.getItem(LS_KEY))
    return (
      <div style={s.centreScreen}>
        <div style={s.card} className="card">
          <div style={s.cardHeader}>
            <span style={s.logo}>Headstart Lesson Builder</span>
          </div>
          <div style={s.cardBody}>
            <p style={s.message}>
              You have an unsaved lesson in progress: <strong>{saved.title || saved.id || 'Untitled'}</strong>.
              Do you want to restore it?
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn-primary" onClick={() => { setLesson(saved); setDirty(true); setRestorePrompt(false) }}>
                Restore
              </button>
              <button className="btn-ghost" style={{ color: 'var(--colour-primary)', border: '1px solid var(--colour-primary)' }}
                onClick={() => { localStorage.removeItem(LS_KEY); setLesson(blankLesson()); setRestorePrompt(false) }}>
                Start fresh
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!lesson) return null

  return (
    <BuilderView
      lesson={lesson}
      dirty={dirty}
      onUpdate={updateLesson}
      onNew={() => {
        if (dirty && !confirm('You have unsaved changes — download your lesson first.\n\nAre you sure you want to start a new lesson?')) return
        localStorage.removeItem(LS_KEY)
        setLesson(blankLesson())
        setDirty(false)
      }}
      onMarkSaved={() => setDirty(false)}
    />
  )
}

const s = {
  centreScreen: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    background: 'var(--colour-primary)',
  },
  card: { width: 440, overflow: 'hidden', borderRadius: 12 },
  cardHeader: {
    background: 'var(--colour-primary)',
    padding: '20px 24px 16px',
  },
  logo: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    color: 'var(--colour-secondary)',
    fontSize: '1rem',
  },
  cardBody: {
    padding: '20px 24px',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  message: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.95rem',
    lineHeight: 1.6,
    color: 'var(--colour-text)',
  },
}
