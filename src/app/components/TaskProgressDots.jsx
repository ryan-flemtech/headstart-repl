import React from 'react'
import { useIsMobile } from '../../shared/useIsMobile'
import { getProgressItems } from '../../shared/taskUtils'

export default function TaskProgressDots({ tasks, currentTaskId, viewingTaskId, onDotClick, isSolo, canSelectTask }) {
  const isMobile = useIsMobile()
  const items = getProgressItems(tasks)

  if (isMobile) {
    const currentIndex = items.findIndex(item => item.taskIds.includes(currentTaskId))
    const completed = Math.max(0, currentIndex)
    return (
      <span style={s.counter} title="Task progress">
        {completed}/{items.length}
      </span>
    )
  }

  return (
    <div style={s.row} title="Task progress">
      {items.map((item, index) => {
        const isCurrent = item.taskIds.includes(currentTaskId)
        const isViewing = viewingTaskId != null && item.taskIds.includes(viewingTaskId)
        const isPast = item.taskIds.every(id => id < currentTaskId)
        const isFuture = item.taskIds.every(id => id > currentTaskId)
        const firstTaskId = item.taskIds[0]
        const clickable = isPast || (isSolo && (canSelectTask ? canSelectTask(firstTaskId) : true))
        const isGroup = item.type === 'group'

        return (
          <button
            key={item.id}
            style={{
              ...s.dot,
              ...(isGroup ? s.dotGroup : {}),
              ...(isCurrent  ? s.dotCurrent  : {}),
              ...(isViewing  ? s.dotViewing  : {}),
              ...(isPast     ? s.dotPast     : {}),
              ...(!isSolo && isFuture ? s.dotFuture : {}),
              cursor: clickable ? 'pointer' : 'default',
            }}
            onClick={() => clickable && onDotClick?.(firstTaskId)}
            title={item.title}
            aria-label={item.title}
            disabled={!clickable}
          >
            {isPast ? '✓' : index + 1}
          </button>
        )
      })}
    </div>
  )
}

const s = {
  counter: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.85rem',
    color: '#fff',
    opacity: 0.9,
  },
  row: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.5)',
    background: 'transparent',
    color: '#fff',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.8rem',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s, border-color 0.2s, transform 0.2s',
  },
  dotGroup: {
    borderRadius: 8,
    width: 36,
  },
  dotCurrent: {
    background: 'var(--colour-secondary)',
    borderColor: 'var(--colour-secondary)',
    color: '#fff',
    transform: 'scale(1.15)',
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
