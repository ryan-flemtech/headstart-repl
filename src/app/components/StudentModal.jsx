import React, { useEffect, useRef } from 'react'
import { CodeEditor } from '../../shared/CodeEditor'
import OutputPanel from './OutputPanel'
import IframePreview from './IframePreview'
import { buildIframeSrc } from '../../shared/iframe'

export default function StudentModal({ student, lesson, session, isLive, onGoLive, onStopLive, onClose }) {
  const overlayRef = useRef(null)
  const iframeRef  = useRef(null)

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const isPython  = lesson?.type === 'python'
  const files     = student.currentFiles
    ? Object.entries(student.currentFiles).map(([name, content]) => ({ name, content, type: name.endsWith('.css') ? 'css' : name.endsWith('.js') ? 'javascript' : 'html' }))
    : []
  const task      = lesson?.tasks?.find(t => t.id === session?.currentTaskId)
  const iframeSrc = !isPython && files.length
    ? buildIframeSrc(files, task?.entryFile ?? 'index.html')
    : null

  return (
    <div
      ref={overlayRef}
      style={s.overlay}
      onClick={e => { if (e.target === overlayRef.current) onClose?.() }}
      role="dialog"
      aria-modal="true"
    >
      <div style={s.modal}>
        {/* Modal header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <span style={s.name}>{student.displayName}</span>
            {isLive && <span style={s.liveBadge}>● LIVE</span>}
            {student.checkPassed && <span style={s.checkBadge}>✅</span>}
          </div>
          <div style={s.headerRight}>
            <button
              className={isLive ? 'btn-danger' : 'btn-primary'}
              style={{ fontSize: 13, padding: '5px 14px' }}
              onClick={isLive ? onStopLive : onGoLive}
            >
              {isLive ? 'Stop Live' : 'Go Live'}
            </button>
            <button
              className="btn-ghost"
              style={{ fontSize: 13, padding: '5px 10px' }}
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={s.body}>
          {isPython ? (
            <>
              <div style={s.editorWrap}>
                <CodeEditor
                  value={student.currentCode ?? ''}
                  language="python"
                  readOnly
                  style={{ height: '100%' }}
                />
              </div>
              <OutputPanel
                output={student.currentOutput ?? ''}
                runStatus={student.lastRunStatus}
                hasCheck={!!task?.check}
                checkPassed={student.checkPassed}
              />
            </>
          ) : (
            <>
              <div style={s.editorWrap}>
                {files.map(f => (
                  <div key={f.name}>
                    <div style={s.fileLabel}>{f.name}</div>
                    <CodeEditor
                      value={f.content}
                      language={f.type}
                      readOnly
                      style={{ height: 120 }}
                    />
                  </div>
                ))}
              </div>
              <IframePreview src={iframeSrc} iframeRef={iframeRef} height={240} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 720,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
  name: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.05rem',
  },
  liveBadge: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.78rem',
    color: '#86efac',
    letterSpacing: '0.05em',
  },
  checkBadge: { fontSize: '1rem' },
  body: {
    flex: 1,
    overflow: 'auto',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  editorWrap: {
    flex: 1,
    minHeight: 200,
    maxHeight: 320,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  fileLabel: {
    fontFamily: 'var(--font-code)',
    fontSize: '0.78rem',
    color: '#6b7280',
    marginBottom: 2,
  },
}
