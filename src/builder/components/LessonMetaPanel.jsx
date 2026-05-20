import React, { useState } from 'react'

export default function LessonMetaPanel({ lesson, onUpdate }) {
  function set(field, value) {
    onUpdate(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div style={s.panel}>
      <div style={s.header}>Lesson Details</div>
      <div style={s.fields}>
        <Field label="Lesson ID" hint="e.g. python-intro">
          <input
            style={s.input}
            value={lesson.id}
            onChange={e => set('id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="python-intro"
          />
        </Field>

        <Field label="Lesson title">
          <input
            style={s.input}
            value={lesson.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Introduction to Python"
          />
        </Field>

        <Field label="Level" hint="optional, e.g. Level 1">
          <input
            style={s.input}
            value={lesson.level ?? ''}
            onChange={e => {
              const v = e.target.value
              set('level', v || undefined)
            }}
            placeholder="Level 1"
          />
        </Field>

        <Field label="Description">
          <textarea
            style={{ ...s.input, resize: 'vertical', minHeight: 60 }}
            value={lesson.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Short summary shown on entry screen."
          />
        </Field>

        <Field label="Lesson type">
          <div style={s.toggle}>
            {['python', 'html'].map(t => (
              <button
                key={t}
                style={{
                  ...s.toggleBtn,
                  ...(lesson.type === t ? s.toggleBtnActive : {}),
                }}
                onClick={() => set('type', t)}
              >
                {t === 'python' ? '🐍 Python' : '🌐 HTML / CSS / JS'}
              </button>
            ))}
          </div>
        </Field>

        {lesson.type === 'html' && (
          <>
            <Field label="Assets path" hint="e.g. /assets/web-intro/">
              <input
                style={s.input}
                value={lesson.assetsPath ?? ''}
                onChange={e => {
                  const v = e.target.value
                  set('assetsPath', v || undefined)
                }}
                placeholder="/assets/lesson-id/"
              />
            </Field>

            <AssetManager
              assets={lesson.assets ?? []}
              onChange={assets => set('assets', assets.length ? assets : undefined)}
            />
          </>
        )}
      </div>
    </div>
  )
}

function AssetManager({ assets, onChange }) {
  const [draft, setDraft] = useState('')

  function add() {
    const v = draft.trim().replace(/^\//, '')
    if (!v || assets.includes(v)) return
    onChange([...assets, v])
    setDraft('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={s.fieldLabel}>Asset files</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          style={{ ...s.input, flex: 1 }}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="images/logo.png"
        />
        <button style={s.addBtn} onClick={add}>Add</button>
      </div>
      {assets.map(path => (
        <div key={path} style={s.assetRow}>
          <span style={s.assetPath}>{path}</span>
          <button
            style={s.removeBtn}
            onClick={() => onChange(assets.filter(a => a !== path))}
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <label style={s.field}>
      <span style={s.fieldLabel}>
        {label}
        {hint && <span style={s.fieldHint}> ({hint})</span>}
      </span>
      {children}
    </label>
  )
}

const s = {
  panel: { borderBottom: '1px solid #e5e7eb', flexShrink: 0 },
  header: {
    background: 'var(--colour-primary)',
    color: '#fff',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.85rem',
    letterSpacing: '0.04em',
    padding: '10px 14px',
  },
  fields: {
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  fieldLabel: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.82rem',
    color: 'var(--colour-text)',
  },
  fieldHint: {
    fontWeight: 400,
    color: '#9ca3af',
  },
  input: {
    padding: '7px 10px',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
    outline: 'none',
    width: '100%',
  },
  toggle: {
    display: 'flex',
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    padding: '6px 8px',
    background: '#f5f5f5',
    color: 'var(--colour-text)',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontSize: '0.82rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
  },
  toggleBtnActive: {
    background: 'var(--colour-primary)',
    color: '#fff',
    borderColor: 'var(--colour-primary)',
  },
  addBtn: {
    padding: '7px 12px',
    background: 'var(--colour-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.82rem',
    cursor: 'pointer',
    flexShrink: 0,
  },
  assetRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#f5f5f5',
    border: '1px solid #e5e7eb',
    borderRadius: 5,
    padding: '4px 8px',
  },
  assetPath: {
    flex: 1,
    fontFamily: 'var(--font-code)',
    fontSize: '0.78rem',
    color: 'var(--colour-text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  removeBtn: {
    flexShrink: 0,
    background: 'none',
    border: 'none',
    color: '#ef4444',
    fontSize: '1rem',
    cursor: 'pointer',
    padding: '0 2px',
    lineHeight: 1,
  },
}
