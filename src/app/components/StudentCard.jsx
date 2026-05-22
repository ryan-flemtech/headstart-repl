import React, { useState } from 'react'
import { getQuizOptionText } from './QuizTask'

export default function StudentCard({ student, lesson, lessonId, session, onRename, onRemove, onExpand }) {
  const [editing, setEditing] = useState(false)
  const [nameValue, setNameValue] = useState(student.displayName)

  function handleRename(e) {
    e.preventDefault()
    onRename?.(student.anonymousId, nameValue.trim() || student.displayName)
    setEditing(false)
  }

  const currentTask = lesson?.tasks?.find(t => t.id === session?.currentTaskId)
  const isSubmitMode = currentTask?.interactionMode === 'submit'
  const isQuiz = currentTask?.taskType === 'quiz'
  const isInformation = currentTask?.taskType === 'information'
  const quizAnswerText = isQuiz ? getQuizOptionText(currentTask, student.currentAnswer) : ''

  const statusColour =
    student.lastRunStatus === 'success'   ? '#22c55e' :
    student.lastRunStatus === 'error'     ? '#ef4444' :
    student.lastRunStatus === 'submitted' ? '#3b82f6' : '#9ca3af'

  const hasCheck = currentTask?.check != null
  const isWaiting = session?.state === 'waiting'
  const presenceClass = isWaiting
    ? 'presence-badge presence-badge--waiting'
    : student.online ? 'presence-badge presence-badge--online' : 'presence-badge presence-badge--offline'
  const presenceLabel = isWaiting ? 'Waiting' : student.online ? 'Online' : 'Offline'

  return (
    <div style={s.card} className="card">
      {/* Header row */}
      <div style={s.header}>
        <span style={{ ...s.statusDot, background: statusColour }} />
        {editing ? (
          <form onSubmit={handleRename} style={s.nameForm}>
            <input
              style={s.nameInput}
              value={nameValue}
              autoFocus
              onChange={e => setNameValue(e.target.value)}
              onBlur={handleRename}
            />
          </form>
        ) : (
          <span style={s.name} title={student.displayName}>{student.displayName}</span>
        )}
        <button
          style={s.pencil}
          onClick={() => setEditing(e => !e)}
          title="Rename student"
        >
          ✏️
        </button>
        <span className={presenceClass} title={student.online ? 'Student is connected now' : 'Student is offline'}>
          <span className="presence-badge__dot" />
          {presenceLabel}
        </span>
        {hasCheck && student.checkPassed && (
          <span style={s.checkBadge} title="Check passed">✅</span>
        )}
        <button
          style={s.removeBtn}
          onClick={() => {
            if (window.confirm(`Remove ${student.displayName} from the session?`)) {
              onRemove?.(student.anonymousId)
            }
          }}
          title="Remove student"
        >
          ✕
        </button>
      </div>

      {/* Output / preview snippet */}
      {isInformation ? (
        <div style={s.iframeThumb}>
          <span style={{ color: '#6b7280', fontSize: 12 }}>Information task</span>
        </div>
      ) : isQuiz ? (
        <div style={s.quizAnswer}>
          {student.currentAnswer
            ? (
              <>
                <span style={s.quizAnswerId}>{student.currentAnswer}</span>
                <span style={s.quizAnswerText}>{quizAnswerText || 'Selected answer'}</span>
              </>
            )
            : <span style={{ color: '#9ca3af', fontSize: 12 }}>No answer yet</span>}
        </div>
      ) : lesson?.type === 'python' ? (
        isSubmitMode ? (
          <pre style={s.snippet}>
            {student.lastRunStatus === 'submitted'
              ? (student.currentCode ?? '').split('\n').slice(0, 3).join('\n') || <span style={{ color: '#9ca3af' }}>No code yet</span>
              : <span style={{ color: '#9ca3af' }}>Waiting for submission</span>}
          </pre>
        ) : (
          <pre style={s.snippet}>{(student.currentOutput ?? '').split('\n').slice(0, 3).join('\n') || <span style={{ color: '#9ca3af' }}>No output yet</span>}</pre>
        )
      ) : (
        <div style={s.iframeThumb}>
          {student.currentFiles
            ? <span style={{ color: '#6b7280', fontSize: 12 }}>HTML project</span>
            : <span style={{ color: '#9ca3af', fontSize: 12 }}>No run yet</span>}
        </div>
      )}

      {/* Expand button */}
      <button
        className="btn-secondary"
        style={s.expandBtn}
        onClick={() => onExpand?.(student)}
      >
        Expand
      </button>
    </div>
  )
}

const s = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 10,
    minWidth: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  name: {
    flex: 1,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  pencil: {
    background: 'transparent',
    border: 'none',
    padding: '0 2px',
    fontSize: '0.8rem',
    cursor: 'pointer',
    opacity: 0.5,
    borderRadius: 4,
  },
  checkBadge: {
    fontSize: '0.85rem',
    flexShrink: 0,
  },
  removeBtn: {
    background: 'transparent',
    border: 'none',
    padding: '0 2px',
    fontSize: '0.75rem',
    cursor: 'pointer',
    opacity: 0.4,
    color: '#ef4444',
    borderRadius: 4,
    lineHeight: 1,
    flexShrink: 0,
  },
  nameForm: { flex: 1, display: 'flex' },
  nameInput: {
    flex: 1,
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    fontWeight: 600,
    border: 'none',
    borderBottom: '2px solid var(--colour-primary)',
    outline: 'none',
    background: 'transparent',
    padding: '0 2px',
  },
  snippet: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.78rem',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    background: '#f5f5f5',
    borderRadius: 6,
    padding: '6px 8px',
    margin: 0,
    maxHeight: 54,
    overflow: 'hidden',
    color: 'var(--colour-text)',
  },
  iframeThumb: {
    height: 54,
    background: '#f5f5f5',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizAnswer: {
    minHeight: 54,
    background: '#f5f5f5',
    borderRadius: 6,
    padding: '6px 8px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  quizAnswerId: {
    width: 24,
    height: 24,
    borderRadius: 5,
    background: 'var(--colour-primary)',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    textTransform: 'uppercase',
    fontSize: '0.78rem',
  },
  quizAnswerText: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    lineHeight: 1.3,
    color: 'var(--colour-text)',
    fontWeight: 600,
  },
  expandBtn: {
    fontSize: 12,
    padding: '5px 0',
    width: '100%',
  },
}
