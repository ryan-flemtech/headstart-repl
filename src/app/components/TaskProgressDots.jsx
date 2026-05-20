import React from 'react'

export default function TaskProgressDots({ tasks, currentTaskId, viewingTaskId, onDotClick, isSolo }) {
  return (
    <div style={s.row} title="Task progress">
      {tasks.map(task => {
        const isCurrent  = task.id === currentTaskId
        const isViewing  = task.id === viewingTaskId
        const isPast     = task.id < currentTaskId
        const isFuture   = task.id > currentTaskId
        const clickable  = isPast || isSolo

        return (
          <button
            key={task.id}
            style={{
              ...s.dot,
              ...(isCurrent  ? s.dotCurrent  : {}),
              ...(isViewing  ? s.dotViewing  : {}),
              ...(isPast     ? s.dotPast     : {}),
              ...(!isSolo && isFuture ? s.dotFuture : {}),
              cursor: clickable ? 'pointer' : 'default',
            }}
            onClick={() => clickable && onDotClick?.(task.id)}
            title={task.title}
            aria-label={task.title}
            disabled={!clickable}
          >
            {isPast ? '✓' : task.id}
          </button>
        )
      })}
    </div>
  )
}

const s = {
  row: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.5)',
    background: 'transparent',
    color: '#fff',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.75rem',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s, border-color 0.15s',
  },
  dotCurrent: {
    background: 'var(--colour-secondary)',
    borderColor: 'var(--colour-secondary)',
    color: '#fff',
  },
  dotViewing: {
    background: 'rgba(239,68,68,0.5)',
    borderColor: '#ef4444',
  },
  dotPast: {
    background: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.7)',
  },
  dotFuture: {
    opacity: 0.4,
  },
}
