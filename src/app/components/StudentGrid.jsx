import React, { useState } from 'react'
import StudentCard from './StudentCard'
import StudentModal from './StudentModal'

export default function StudentGrid({ students = [], lesson, lessonId, session, onRename, onRemove, onGoLive, onStopLive, collapsed, onToggle }) {
  const [expandedStudent, setExpandedStudent] = useState(null)

  function handleExpand(student) {
    setExpandedStudent(student)
  }

  function handleClose() {
    // Always clear live view on close
    onStopLive?.()
    setExpandedStudent(null)
  }

  if (collapsed) {
    const currentTask = lesson?.tasks?.find(t => t.id === session?.currentTaskId)
    const hasCheck    = currentTask?.check != null
    const runCount    = students.filter(s => s.lastRunStatus != null).length
    const checkCount  = students.filter(s => s.checkPassed).length

    return (
      <div style={s.collapsedWrap}>
        <button style={s.collapseBtn} onClick={onToggle} title="Show Students">‹</button>

        <div style={s.collapsedStat}>
          <span style={{ ...s.collapsedBadge, background: 'var(--colour-primary)' }}>{students.length}</span>
          <span style={s.collapsedStatLabel}>joined</span>
        </div>

        {students.length > 0 && (
          <div style={s.collapsedStat}>
            <span style={{ ...s.collapsedBadge, background: '#6b7280' }}>{runCount}</span>
            <span style={s.collapsedStatLabel}>run</span>
          </div>
        )}

        {students.length > 0 && hasCheck && (
          <div style={s.collapsedStat}>
            <span style={{ ...s.collapsedBadge, background: '#22c55e' }}>{checkCount}</span>
            <span style={s.collapsedStatLabel}>done</span>
          </div>
        )}

        <span style={s.collapsedLabel}>Students</span>
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.label}>Students</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={s.count}>{students.length}</span>
          <button style={s.toggleBtn} onClick={onToggle} title="Collapse Students">›</button>
        </div>
      </div>

      {students.length === 0 ? (
        <div style={s.empty}>
          <p>No students yet.</p>
          <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: 6 }}>Share the lesson link to invite students.</p>
        </div>
      ) : (
        <div style={s.grid}>
          {students.map(student => (
            <StudentCard
              key={student.anonymousId}
              student={student}
              lesson={lesson}
              lessonId={lessonId}
              session={session}
              onRename={onRename}
              onRemove={onRemove}
              onExpand={handleExpand}
            />
          ))}
        </div>
      )}

      {expandedStudent && (
        <StudentModal
          student={students.find(s => s.anonymousId === expandedStudent.anonymousId) ?? expandedStudent}
          lesson={lesson}
          session={session}
          isLive={session?.activeStudentView === expandedStudent.anonymousId}
          onGoLive={() => onGoLive?.(expandedStudent.anonymousId)}
          onStopLive={() => onStopLive?.()}
          onClose={handleClose}
        />
      )}
    </div>
  )
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  header: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '10px 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  label: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.85rem',
    letterSpacing: '0.04em',
  },
  count: {
    background: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    padding: '1px 8px',
    fontSize: '0.8rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
  },
  grid: {
    flex: 1,
    overflowY: 'auto',
    padding: 10,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 10,
    alignContent: 'start',
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    color: '#6b7280',
    fontFamily: 'var(--font-body)',
    fontSize: '0.92rem',
    textAlign: 'center',
  },
  toggleBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.8)',
    fontSize: '1.1rem',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
    borderRadius: 3,
  },
  collapsedWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '100%',
    background: '#fff',
    borderLeft: '1px solid #e5e7eb',
    paddingTop: 8,
    gap: 8,
  },
  collapseBtn: {
    background: 'var(--colour-primary)',
    border: 'none',
    color: '#fff',
    fontSize: '1.1rem',
    cursor: 'pointer',
    width: 28,
    height: 28,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
  },
  collapsedLabel: {
    writingMode: 'vertical-rl',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.75rem',
    letterSpacing: '0.05em',
    color: 'var(--colour-primary)',
    opacity: 0.6,
    userSelect: 'none',
    marginTop: 4,
  },
  collapsedStat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    marginTop: 6,
  },
  collapsedBadge: {
    color: '#fff',
    borderRadius: 10,
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.8rem',
    minWidth: 22,
    height: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 5px',
  },
  collapsedStatLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.6rem',
    color: '#9ca3af',
    textAlign: 'center',
  },
}
