import React from 'react'

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
      </div>
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
}
