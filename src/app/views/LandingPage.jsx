import React, { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'

export default function LandingPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isTeacher = searchParams.get('teacher') === 'true'

  const [lessonCode, setLessonCode] = useState('')

  function handleGo(e) {
    e.preventDefault()
    const id = lessonCode.trim()
    if (!id) return
    navigate(`/lesson/${id}${isTeacher ? '?teacher=true' : ''}`)
  }

  return (
    <div style={s.page}>
      <div style={s.card} className="card">
        <div style={s.brand}>
          <span style={s.logo}>Headstart Coding - LaunchPad</span>
        </div>

        <h1 style={s.heading}>
          {isTeacher ? 'Teacher Dashboard' : 'Join a lesson'}
        </h1>

        <form onSubmit={handleGo} style={s.form}>
          <label style={s.label} htmlFor="lesson-code">
            {isTeacher ? 'Lesson code' : 'Enter your lesson code'}
          </label>
          <div style={s.row}>
            <input
              id="lesson-code"
              style={s.input}
              type="text"
              value={lessonCode}
              onChange={e => setLessonCode(e.target.value)}
              placeholder="e.g. python-intro"
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
            <button className="btn-primary" style={s.goBtn} type="submit">
              Go
            </button>
          </div>
        </form>


      </div>
    </div>
  )
}

const s = {
  page: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f5f5',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: '36px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  brand: {
    display: 'flex',
    justifyContent: 'center',
  },
  logo: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.5rem',
    color: 'var(--colour-primary)',
  },
  heading: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.15rem',
    color: 'var(--colour-text)',
    textAlign: 'center',
    marginTop: -4,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
  },
  row: {
    display: 'flex',
    gap: 8,
  },
  input: {
    flex: 1,
    fontFamily: 'var(--font-code)',
    fontSize: '0.95rem',
    padding: '9px 12px',
    border: '1.5px solid #d1d5db',
    borderRadius: 6,
    outline: 'none',
    color: 'var(--colour-text)',
    background: '#fff',
    transition: 'border-color 0.15s',
  },
  goBtn: {
    flexShrink: 0,
    padding: '9px 22px',
    fontSize: '0.95rem',
  },

}
