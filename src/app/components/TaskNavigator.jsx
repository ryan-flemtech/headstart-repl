import React from 'react'

export default function TaskNavigator({
  tasks = [],
  currentTaskId,
  session,
  students = [],
  onTaskSelect,
  onSandbox,
  isSandbox,
  sandboxStaging,
  collapsed,
  onToggle,
}) {
  const total = students.length

  if (collapsed) {
    return (
      <div style={s.collapsedWrap}>
        <button style={s.collapseBtn} onClick={onToggle} title="Show Tasks">›</button>
        <span style={s.collapsedLabel}>Tasks</span>
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.headerLabel}>Tasks</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {session?.state === 'active' && (
            <span style={s.state}>LIVE</span>
          )}
          <button style={s.toggleBtn} onClick={onToggle} title="Collapse Tasks">‹</button>
        </div>
      </div>

      <div style={s.list}>
        {tasks.map((task, i) => {
          const isCurrent   = task.id === currentTaskId
          const runCount    = students.filter(st => st.lastRunStatus != null && st.lastRunAt).length
          const checkCount  = students.filter(st => st.checkPassed).length
          const hasCheck    = task.check != null

          return (
            <button
              key={task.id}
              style={{ ...s.item, ...(isCurrent ? s.itemActive : {}), ...((isSandbox || sandboxStaging) ? { opacity: 0.45, cursor: 'default' } : {}) }}
              onClick={() => (!isSandbox && !sandboxStaging) && onTaskSelect?.(task.id)}
            >
              <span style={s.num}>{task.id}</span>
              <div style={s.detail}>
                <span style={s.taskTitle}>{task.title}</span>
                {isCurrent && total > 0 && (
                  <span style={s.stat}>
                    {runCount}/{total} run
                    {hasCheck ? ` · ${checkCount} ✅` : ''}
                  </span>
                )}
              </div>
              {isCurrent && <span style={s.arrow}>◀</span>}
            </button>
          )
        })}
      </div>

      {/* Previous / Next */}
      <div style={s.navButtons}>
        <button
          className="btn-secondary"
          style={s.navBtn}
          disabled={currentTaskId <= 1}
          onClick={() => onTaskSelect?.(currentTaskId - 1)}
        >
          ← Prev
        </button>
        <button
          className="btn-secondary"
          style={s.navBtn}
          disabled={currentTaskId >= tasks.length}
          onClick={() => onTaskSelect?.(currentTaskId + 1)}
        >
          Next →
        </button>
      </div>

      {/* Sandbox toggle */}
      <div style={s.sandboxArea}>
        {isSandbox ? (
          <button
            className="btn-danger"
            style={{ width: '100%' }}
            onClick={onSandbox}
          >
            Deactivate Sandbox
          </button>
        ) : sandboxStaging ? (
          <button
            className="btn-ghost"
            style={{ width: '100%', color: 'var(--colour-primary)', border: '1px solid var(--colour-primary)' }}
            onClick={onSandbox}
          >
            Cancel Sandbox
          </button>
        ) : (
          <button
            className="btn-ghost"
            style={{ width: '100%', color: 'var(--colour-primary)', border: '1px solid var(--colour-primary)' }}
            onClick={onSandbox}
          >
            Sandbox
          </button>
        )}
      </div>
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
  headerLabel: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.85rem',
    letterSpacing: '0.04em',
  },
  state: {
    fontSize: '0.7rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    background: '#22c55e',
    borderRadius: 4,
    padding: '2px 6px',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 0',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '9px 14px',
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    textAlign: 'left',
    cursor: 'pointer',
    borderLeft: '3px solid transparent',
    transition: 'background 0.1s',
  },
  itemActive: {
    background: '#f0eafa',
    borderLeftColor: 'var(--colour-primary)',
  },
  num: {
    width: 22,
    height: 22,
    background: 'var(--colour-primary)',
    color: '#fff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    flexShrink: 0,
  },
  detail: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  taskTitle: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  stat: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: '#6b7280',
  },
  arrow: { fontSize: '0.7rem', color: 'var(--colour-primary)', flexShrink: 0 },
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
    borderRight: '1px solid #e5e7eb',
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
    transform: 'rotate(180deg)',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.75rem',
    letterSpacing: '0.05em',
    color: 'var(--colour-primary)',
    opacity: 0.6,
    userSelect: 'none',
    marginTop: 4,
  },
  navButtons: {
    display: 'flex',
    gap: 8,
    padding: '8px 12px',
    borderTop: '1px solid #e5e7eb',
    flexShrink: 0,
  },
  navBtn: {
    flex: 1,
    fontSize: 13,
    padding: '6px 0',
  },
  sandboxArea: {
    padding: '8px 12px 12px',
    borderTop: '1px solid #e5e7eb',
    flexShrink: 0,
  },
}
