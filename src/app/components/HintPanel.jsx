import React, { useEffect, useState } from 'react'
import { MarkdownRenderer } from '../../shared/markdown'

function normalizeHints(hints) {
  return Array.isArray(hints) ? hints.map(h => String(h ?? '').trim()).filter(Boolean) : []
}

export default function HintPanel({
  hints,
  mode = 'solo',
  visibleHint,
  onReveal,
  onShowComplete,
  hasCompleteSolution = false,
  // Solo controlled props — managed by StudentView
  open = false,
  viewedHintIndexes = [],
  onViewHint,
  onClose,
}) {
  const [selectedHint, setSelectedHint] = useState(null)
  const normalizedHints = normalizeHints(hints)

  // Reset which hint is displayed each time the modal opens fresh
  useEffect(() => {
    if (open) setSelectedHint(null)
  }, [open])

  // Live mode: sync the teacher-pushed hint into local state
  useEffect(() => {
    if (mode !== 'live') return
    if (!visibleHint?.content) {
      setSelectedHint(null)
      return
    }
    setSelectedHint({
      index: visibleHint.index,
      content: visibleHint.content,
    })
  }, [mode, visibleHint?.taskId, visibleHint?.index, visibleHint?.shownAt, visibleHint?.content])

  if (mode === 'live') {
    if (!visibleHint?.content) return null
    return (
      <HintModal
        hint={selectedHint}
        onClose={() => setSelectedHint(null)}
      />
    )
  }

  if (mode === 'teacher') {
    if (normalizedHints.length === 0) return null
    return (
      <div style={s.teacherPanel} className="card">
        <div style={s.header}>
          <span style={s.title}>Hints</span>
          <button
            type="button"
            className="btn-ghost-outline"
            style={s.clearBtn}
            onClick={() => onReveal?.(null)}
            disabled={!visibleHint}
          >
            Hide
          </button>
        </div>
        <div style={s.teacherList}>
          {normalizedHints.map((hint, index) => {
            const active = visibleHint?.taskId != null && visibleHint?.index === index
            return (
              <button
                key={`${index}-${hint}`}
                type="button"
                style={{ ...s.teacherHintBtn, ...(active ? s.teacherHintBtnActive : {}) }}
                onClick={() => onReveal?.({ index, content: hint })}
              >
                <span style={s.hintNumber}>{index + 1}</span>
                <span style={s.hintPreview}>{active ? 'Showing' : 'Show hint'}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Solo mode — render nothing if there is nothing to offer
  if (normalizedHints.length === 0 && !hasCompleteSolution) return null

  return (
    <SoloHintModal
      open={open}
      hints={normalizedHints}
      viewedHintIndexes={viewedHintIndexes}
      selectedHint={selectedHint}
      hasCompleteSolution={hasCompleteSolution}
      onSelect={hint => {
        setSelectedHint(hint)
        if (hint) onViewHint?.(hint.index)
      }}
      onShowComplete={onShowComplete}
      onClose={onClose}
    />
  )
}

function SoloHintModal({ open, hints, viewedHintIndexes, selectedHint, hasCompleteSolution, onSelect, onShowComplete, onClose }) {
  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  // True when no hints exist at all, or the student has viewed every one
  const allHintsViewed = hints.length === 0 || viewedHintIndexes.length >= hints.length

  // No more hints available — offer the complete solution
  if (allHintsViewed && !selectedHint && hasCompleteSolution) {
    return (
      <div style={s.modalOverlay} role="dialog" aria-modal="true" onClick={onClose}>
        <div style={s.modal} className="card" onClick={event => event.stopPropagation()}>
          <div style={s.modalHeader}>
            <span style={s.modalTitle}>{hints.length === 0 ? 'Need help?' : 'All hints used'}</span>
            <button type="button" style={s.modalCloseBtn} onClick={onClose} title="Close">x</button>
          </div>
          <div style={s.modalContent}>
            <p style={s.modalPrompt}>
              {hints.length === 0
                ? "That attempt didn't pass. Do you want to see the complete code and move on to the next task?"
                : 'You have looked at every hint. Do you want to see the complete code and move on to the next task?'}
            </p>
          </div>
          <div style={s.modalActions}>
            <button type="button" className="btn-ghost-outline" style={s.modalSecondaryBtn} onClick={onClose}>
              Keep trying
            </button>
            <button
              type="button"
              className="btn-primary"
              style={s.modalDoneBtn}
              onClick={() => { onShowComplete?.(); onClose() }}
            >
              Show complete code
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.modalOverlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div style={s.modal} className="card" onClick={event => event.stopPropagation()}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>{selectedHint ? `Hint ${selectedHint.index + 1}` : 'Need a hint?'}</span>
          <button type="button" style={s.modalCloseBtn} onClick={onClose} title="Close hint">
            x
          </button>
        </div>
        {selectedHint ? (
          <>
            <div style={s.modalContent}>
              <MarkdownRenderer content={selectedHint.content} />
            </div>
            <div style={s.modalActions}>
              <button type="button" className="btn-primary" style={s.modalDoneBtn} onClick={onClose}>
                Back to coding
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={s.modalContent}>
              <p style={s.modalPrompt}>Pick a hint, or close this and keep trying.</p>
              <div style={s.soloList}>
                {hints.map((hint, index) => {
                  const viewed = viewedHintIndexes.includes(index)
                  return (
                    <button
                      key={`${index}-${hint}`}
                      type="button"
                      style={{ ...s.soloHintBtn, ...(viewed ? s.soloHintBtnViewed : {}) }}
                      disabled={viewed}
                      onClick={() => onSelect({ index, content: hint })}
                    >
                      <span style={s.soloHintNumber}>{index + 1}</span>
                      <span>{viewed ? 'Viewed' : 'Hint'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div style={s.modalActions}>
              <button type="button" className="btn-primary" style={s.modalDoneBtn} onClick={onClose}>
                Keep trying
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function HintModal({ hint, onClose }) {
  useEffect(() => {
    if (!hint) return undefined
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [hint, onClose])

  if (!hint) return null
  return (
    <div style={s.modalOverlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div style={s.modal} className="card" onClick={event => event.stopPropagation()}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>Hint {hint.index + 1}</span>
          <button type="button" style={s.modalCloseBtn} onClick={onClose} title="Close hint">
            x
          </button>
        </div>
        <div style={s.modalContent}>
          <MarkdownRenderer content={hint.content} />
        </div>
        <div style={s.modalActions}>
          <button type="button" className="btn-primary" style={s.modalDoneBtn} onClick={onClose}>
            Back to coding
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  teacherPanel: {
    flexShrink: 0,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '10px 14px',
    background: 'var(--colour-primary)',
    color: '#fff',
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.85rem',
    letterSpacing: '0.04em',
  },
  soloList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
    gap: 8,
    padding: '4px 0 0',
    background: '#fff',
  },
  soloHintBtn: {
    border: '1px solid #e9d5ff',
    borderRadius: 8,
    background: '#f7f2ff',
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    color: 'var(--colour-primary)',
  },
  soloHintBtnViewed: {
    opacity: 0.45,
    cursor: 'not-allowed',
    background: '#f3f4f6',
    borderColor: '#e5e7eb',
    color: '#9ca3af',
  },
  soloHintNumber: {
    width: 24,
    height: 24,
    borderRadius: 999,
    background: 'var(--colour-primary)',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-title)',
    fontSize: '0.78rem',
  },
  teacherList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))',
    gap: 8,
    padding: 10,
  },
  teacherHintBtn: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    color: 'var(--colour-text)',
    cursor: 'pointer',
    padding: '10px 8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    textAlign: 'center',
    fontFamily: 'var(--font-body)',
  },
  teacherHintBtnActive: {
    borderColor: 'var(--colour-secondary)',
    background: '#fffbeb',
  },
  hintNumber: {
    width: 26,
    height: 26,
    borderRadius: 999,
    background: 'var(--colour-primary)',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.78rem',
  },
  hintPreview: {
    fontSize: '0.8rem',
    fontWeight: 700,
    lineHeight: 1.35,
  },
  clearBtn: {
    fontSize: 12,
    padding: '4px 10px',
    borderColor: 'rgba(255,255,255,0.7)',
    color: '#fff',
    background: 'transparent',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1200,
    background: 'rgba(17, 24, 39, 0.48)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    width: 'min(520px, 94vw)',
    maxHeight: '80vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    borderRadius: 8,
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 16px',
    background: 'var(--colour-primary)',
    color: '#fff',
  },
  modalTitle: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1rem',
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    border: '1px solid rgba(255,255,255,0.55)',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.9rem',
    lineHeight: 1,
  },
  modalContent: {
    padding: '18px 20px',
    background: '#fff',
    overflowY: 'auto',
    color: 'var(--colour-text)',
  },
  modalPrompt: {
    margin: '0 0 14px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.95rem',
    lineHeight: 1.55,
    color: 'var(--colour-text)',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '12px 16px 16px',
    background: '#fff',
  },
  modalDoneBtn: {
    fontSize: 14,
    padding: '9px 18px',
  },
  modalSecondaryBtn: {
    fontSize: 14,
    padding: '9px 18px',
    color: 'var(--colour-primary)',
    border: '1px solid var(--colour-primary)',
    background: '#fff',
  },
}
