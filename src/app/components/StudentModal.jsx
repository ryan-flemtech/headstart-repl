import React, { useEffect, useRef, useState } from 'react'
import { CodeEditor } from '../../shared/CodeEditor'
import OutputPanel from './OutputPanel'
import IframePreview from './IframePreview'
import { buildIframeSrc } from '../../shared/iframe'
import { decodeFileKey } from '../hooks/useSession'

export default function StudentModal({ student, lesson, session, isLive, onGoLive, onStopLive, onClose }) {
  const overlayRef = useRef(null)
  const iframeRef  = useRef(null)

  const isPython  = lesson?.type === 'python'
  const files     = student.currentFiles
    ? Object.entries(student.currentFiles).map(([key, content]) => {
        const name = decodeFileKey(key)
        return { name, content, type: name.endsWith('.css') ? 'css' : name.endsWith('.js') ? 'javascript' : 'html' }
      })
    : []
  const task      = lesson?.tasks?.find(t => t.id === session?.currentTaskId)
  const iframeSrc = !isPython && files.length
    ? buildIframeSrc(files, task?.entryFile ?? 'index.html')
    : null

  const [activeFile, setActiveFile] = useState(task?.entryFile ?? files[0]?.name ?? '')
  const activeFileObj = files.find(f => f.name === activeFile) ?? files[0]

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
            <span
              className={student.online ? 'presence-badge presence-badge--online' : 'presence-badge presence-badge--offline'}
              title={student.online ? 'Student is connected now' : 'Student is offline'}
            >
              <span className="presence-badge__dot" />
              {student.online ? 'Online' : 'Offline'}
            </span>
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
        <div style={isPython ? s.bodyPython : s.bodyHtml}>
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
              {/* Left: tabbed file editor */}
              <div style={s.htmlEditorPane}>
                {files.length > 1 && (
                  <div style={s.tabBar}>
                    {files.map(f => (
                      <button
                        key={f.name}
                        style={{ ...s.tab, ...(f.name === activeFile ? s.tabActive : {}) }}
                        onClick={() => setActiveFile(f.name)}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                )}
                {files.length === 1 && (
                  <div style={s.singleFileLabel}>{files[0]?.name}</div>
                )}
                <div style={s.editorWrap}>
                  {activeFileObj && (
                    <CodeEditor
                      key={activeFileObj.name}
                      value={activeFileObj.content}
                      language={activeFileObj.type}
                      readOnly
                      style={{ height: '100%' }}
                    />
                  )}
                </div>
              </div>
              {/* Right: iframe preview */}
              <div style={s.iframePane}>
                <IframePreview src={iframeSrc} iframeRef={iframeRef} fill />
              </div>
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
    width: 'min(1200px, 92vw)',
    height: '88vh',
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
  bodyPython: {
    flex: 1,
    overflow: 'hidden',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  bodyHtml: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'row',
    gap: 0,
  },
  htmlEditorPane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRight: '1px solid #e5e7eb',
  },
  iframePane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  tabBar: {
    display: 'flex',
    flexShrink: 0,
    borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb',
    overflowX: 'auto',
  },
  tab: {
    fontFamily: 'var(--font-code)',
    fontSize: '0.8rem',
    padding: '7px 14px',
    border: 'none',
    borderBottom: '2px solid transparent',
    background: 'transparent',
    color: '#6b7280',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  tabActive: {
    color: 'var(--colour-primary)',
    borderBottom: '2px solid var(--colour-primary)',
    background: '#fff',
    fontWeight: 600,
  },
  singleFileLabel: {
    fontFamily: 'var(--font-code)',
    fontSize: '0.78rem',
    color: '#6b7280',
    padding: '6px 12px',
    borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb',
    flexShrink: 0,
  },
  editorWrap: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
}
