import React from 'react'

export default function TaskList({ tasks, selectedTaskId, onSelect, onAdd, onDuplicate, onDelete, onReorder }) {
  function moveUp(index) {
    if (index === 0) return
    const reordered = [...tasks]
    ;[reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]]
    onReorder(reordered)
  }

  function moveDown(index) {
    if (index === tasks.length - 1) return
    const reordered = [...tasks]
    ;[reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]]
    onReorder(reordered)
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.label}>Tasks</span>
        <button className="btn-primary" style={s.addBtn} onClick={onAdd}>+ Add</button>
      </div>

      <div style={s.list}>
        {tasks.length === 0 && (
          <p style={s.empty}>No tasks yet. Click "+ Add" to create one.</p>
        )}
        {tasks.map((task, i) => (
          <div
            key={task.id}
            style={{
              ...s.item,
              ...(task.id === selectedTaskId ? s.itemActive : {}),
            }}
            onClick={() => onSelect(task.id)}
          >
            <span style={s.num}>{i + 1}</span>
            <span style={s.title}>{task.title || <em style={{ opacity: 0.5 }}>Untitled</em>}</span>
            <div style={s.actions} onClick={e => e.stopPropagation()}>
              <button style={s.iconBtn} onClick={() => moveUp(i)} title="Move up" disabled={i === 0}>▲</button>
              <button style={s.iconBtn} onClick={() => moveDown(i)} title="Move down" disabled={i === tasks.length - 1}>▼</button>
              <button style={s.iconBtn} onClick={() => onDuplicate(task)} title="Duplicate">⧉</button>
              <button style={{ ...s.iconBtn, color: '#ef4444' }} onClick={() => onDelete(task.id)} title="Delete">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const s = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '8px 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  label: { fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.04em' },
  addBtn: { fontSize: 12, padding: '4px 10px' },
  list: { flex: 1, overflowY: 'auto' },
  empty: {
    padding: '16px 14px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: '#9ca3af',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px 8px 14px',
    cursor: 'pointer',
    borderLeft: '3px solid transparent',
    transition: 'background 0.1s',
  },
  itemActive: {
    background: '#f0eafa',
    borderLeftColor: 'var(--colour-primary)',
  },
  num: {
    width: 20,
    height: 20,
    background: 'var(--colour-primary)',
    color: '#fff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.72rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    flexShrink: 0,
  },
  title: {
    flex: 1,
    fontFamily: 'var(--font-body)',
    fontSize: '0.87rem',
    fontWeight: 600,
    color: 'var(--colour-text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  actions: { display: 'flex', gap: 2, flexShrink: 0 },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    padding: '2px 4px',
    fontSize: '0.8rem',
    cursor: 'pointer',
    borderRadius: 4,
    color: '#6b7280',
    opacity: 0.7,
  },
}
