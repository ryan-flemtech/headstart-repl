import React from 'react'

export default function FileManager({ files = [], entryFile, onAddFile, onDeleteFile, onRenameFile, onChangeType, onChangeEntryFile, selectedFile, onSelectFile }) {
  function handleAdd() {
    const name = prompt('Filename (e.g. about.html, style.css, script.js):')
    if (!name || !name.trim()) return
    const trimmed = name.trim()
    if (files.some(f => f.name === trimmed)) {
      alert(`A file named "${trimmed}" already exists.`)
      return
    }
    const type = trimmed.endsWith('.css') ? 'css'
      : trimmed.endsWith('.js') ? 'javascript'
      : 'html'
    onAddFile({ name: trimmed, type, content: '' })
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.label}>Files</span>
        <button className="btn-primary" style={s.addBtn} onClick={handleAdd}>+ File</button>
      </div>

      {files.map(f => (
        <div
          key={f.name}
          style={{
            ...s.row,
            ...(f.name === selectedFile ? s.rowActive : {}),
          }}
          onClick={() => onSelectFile?.(f.name)}
        >
          <span style={s.filename}>{f.name}</span>
          <select
            style={s.typeSelect}
            value={f.type}
            onClick={e => e.stopPropagation()}
            onChange={e => onChangeType?.(f.name, e.target.value)}
          >
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="javascript">JS</option>
          </select>
          <button
            style={s.deleteBtn}
            onClick={e => { e.stopPropagation(); onDeleteFile?.(f.name) }}
            title="Delete file"
          >
            ✕
          </button>
        </div>
      ))}

      {files.length > 0 && (
        <div style={s.entryRow}>
          <label style={s.entryLabel}>
            Entry file:
            <select
              style={s.typeSelect}
              value={entryFile ?? files[0]?.name ?? ''}
              onChange={e => onChangeEntryFile?.(e.target.value)}
            >
              {files.filter(f => f.type === 'html' || f.name.endsWith('.html')).map(f => (
                <option key={f.name} value={f.name}>{f.name}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  header: {
    background: '#f0f0f0',
    padding: '6px 10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e5e7eb',
  },
  label: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.8rem',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  addBtn: { fontSize: 11, padding: '3px 8px' },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    cursor: 'pointer',
    borderBottom: '1px solid #f5f5f5',
  },
  rowActive: { background: '#f0eafa' },
  filename: {
    flex: 1,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.82rem',
    color: 'var(--colour-text)',
  },
  typeSelect: {
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    fontSize: '0.78rem',
    padding: '2px 4px',
    fontFamily: 'var(--font-body)',
    background: '#fff',
    cursor: 'pointer',
  },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    color: '#ef4444',
    fontSize: '0.8rem',
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: 4,
    opacity: 0.7,
  },
  entryRow: {
    padding: '6px 10px',
    background: '#f9fafb',
    borderTop: '1px solid #e5e7eb',
  },
  entryLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#6b7280',
  },
}
