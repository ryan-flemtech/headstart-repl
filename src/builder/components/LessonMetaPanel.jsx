import React, { useState } from 'react'
import SplitPane from '../../shared/SplitPane'
import { CodeEditor } from '../../shared/CodeEditor'
import FileManager from './FileManager'

export default function LessonMetaPanel({ lesson, onUpdate }) {
  const [sandboxOpen, setSandboxOpen] = useState(false)

  function set(field, value) {
    onUpdate(prev => ({ ...prev, [field]: value }))
  }

  const isPython = lesson.type === 'python'
  const sandboxLineCount = (lesson.sandboxStarter ?? '').trim()
    ? (lesson.sandboxStarter ?? '').split('\n').length
    : 0
  const sandboxFileCount = lesson.sandboxStarterFiles?.length ?? 0

  return (
    <div style={s.panel}>
      <div style={s.header}>Lesson Details</div>
      <div style={s.fields}>
        <Field label="Lesson type">
          <div style={s.typeBadge}>{isPython ? 'Python' : 'Web'}</div>
        </Field>

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

        <div style={s.divider} />

        <div style={s.sandboxSummary}>
          <div>
            <span style={s.fieldLabel}>Sandbox starter</span>
            <p style={s.summaryText}>
              {isPython
                ? (sandboxLineCount ? `${sandboxLineCount} lines configured` : 'No sandbox starter code set.')
                : (sandboxFileCount ? `${sandboxFileCount} starter files configured` : 'No sandbox starter files set.')}
            </p>
          </div>
          <button className="btn-ghost" style={s.secondaryBtn} onClick={() => setSandboxOpen(true)}>
            Edit
          </button>
        </div>

        {sandboxOpen && (
          <Modal title="Sandbox starter" onClose={() => setSandboxOpen(false)}>
            {isPython ? (
              <div style={s.modalEditor}>
                <CodeEditor
                  value={lesson.sandboxStarter ?? ''}
                  language="python"
                  onChange={v => set('sandboxStarter', v || undefined)}
                  style={s.modalCodeEditor}
                />
              </div>
            ) : (
              <SandboxStarterFiles
                files={lesson.sandboxStarterFiles ?? []}
                onChange={files => set('sandboxStarterFiles', files.length ? files : undefined)}
              />
            )}
          </Modal>
        )}
      </div>
    </div>
  )
}

function SandboxStarterFiles({ files, onChange }) {
  const [selectedFile, setSelectedFile] = useState(files[0]?.name ?? '')

  return (
    <SplitPane
      defaultSplit={34}
      style={{ flex: 1, minHeight: 0 }}
      left={
        <FileManager
          files={files}
          entryFile={files.find(f => f.type === 'html')?.name ?? files[0]?.name ?? ''}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
          onAddFile={f => { onChange([...files, f]); setSelectedFile(f.name) }}
          onDeleteFile={name => {
            const next = files.filter(f => f.name !== name)
            onChange(next)
            setSelectedFile(next[0]?.name ?? '')
          }}
          onChangeType={(name, type) => onChange(files.map(f => f.name === name ? { ...f, type } : f))}
          onChangeEntryFile={() => {}}
        />
      }
      right={
        <div style={s.modalEditor}>
          {selectedFile ? (
            <CodeEditor
              key={selectedFile}
              value={files.find(f => f.name === selectedFile)?.content ?? ''}
              language={files.find(f => f.name === selectedFile)?.type ?? 'html'}
              onChange={v => onChange(files.map(f => f.name === selectedFile ? { ...f, content: v } : f))}
              style={s.htmlCodeEditor}
            />
          ) : (
            <div style={s.noFile}>Select or add a file to edit.</div>
          )}
        </div>
      }
    />
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
            x
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

function Modal({ title, children, onClose }) {
  return (
    <div style={s.modalBackdrop} role="dialog" aria-modal="true">
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>{title}</span>
          <button style={s.closeBtn} onClick={onClose} title="Close">x</button>
        </div>
        <div style={s.modalBody}>
          {children}
        </div>
      </div>
    </div>
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
  typeBadge: {
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#f7f2ff',
    color: 'var(--colour-primary)',
    padding: '8px 10px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
    fontWeight: 700,
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
  divider: {
    height: 1,
    background: '#e5e7eb',
    margin: '4px 0',
  },
  removeBtn: {
    flexShrink: 0,
    background: 'none',
    border: 'none',
    color: '#ef4444',
    fontSize: '0.95rem',
    cursor: 'pointer',
    padding: '0 2px',
    lineHeight: 1,
  },
  sandboxSummary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '12px 14px',
    background: '#fff',
  },
  summaryText: {
    margin: '4px 0 0',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: '#6b7280',
    lineHeight: 1.45,
  },
  secondaryBtn: {
    color: 'var(--colour-primary)',
    border: '1px solid var(--colour-primary)',
    padding: '7px 12px',
    fontSize: '0.82rem',
    whiteSpace: 'nowrap',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 40,
    background: 'rgba(17, 24, 39, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    width: 'min(980px, 94vw)',
    height: 'min(680px, 88vh)',
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 24px 70px rgba(0, 0, 0, 0.28)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    height: 50,
    padding: '0 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #e5e7eb',
    background: '#fafafa',
    flexShrink: 0,
  },
  modalTitle: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    color: 'var(--colour-text)',
  },
  closeBtn: {
    width: 32,
    height: 32,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '1rem',
    lineHeight: 1,
  },
  modalBody: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    padding: 14,
  },
  modalEditor: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: '100%',
    display: 'flex',
  },
  htmlCodeEditor: {
    width: '100%',
    minWidth: 0,
    flex: '1 1 auto',
  },
  modalCodeEditor: {
    width: '100%',
    minWidth: 0,
    flex: '1 1 auto',
  },
  noFile: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9ca3af',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
  },
}
