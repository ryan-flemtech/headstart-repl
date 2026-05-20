import React, { useRef, useEffect, useState } from 'react'

/**
 * Output panel for the lesson builder.
 * Like the classroom OutputPanel but also shows check verification results.
 */
export default function BuilderOutputPanel({
  output = '',
  runStatus = null,
  inputPrompt = null,
  onInputSubmit,
  checkResult = null, // null | 'pass' | 'fail'
  checkValue = '',
}) {
  const [inputValue, setInputValue] = useState('')
  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [output, inputPrompt])
  useEffect(() => { if (inputPrompt !== null) inputRef.current?.focus() }, [inputPrompt])

  function handleInputSubmit(e) {
    e.preventDefault()
    onInputSubmit?.(inputValue)
    setInputValue('')
  }

  const statusColour = runStatus === 'success' ? '#22c55e' : runStatus === 'error' ? '#ef4444' : '#9ca3af'
  const statusLabel  = runStatus === 'success' ? 'Ran OK' : runStatus === 'error' ? 'Error' : 'Not run'

  return (
    <div style={s.wrap}>
      {/* Output */}
      <div style={s.panel} className="card">
        <div style={s.header}>
          <span style={s.headerLabel}>Output</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...s.statusDot, background: statusColour }} />
            <span style={s.statusLabel}>{statusLabel}</span>
          </div>
        </div>
        <pre style={s.pre}>
          {output || <span style={{ color: '#9ca3af' }}>Run to see output.</span>}
          {inputPrompt !== null && (
            <form onSubmit={handleInputSubmit} style={s.inputRow}>
              <span style={s.prompt}>&gt;</span>
              <input ref={inputRef} style={s.input} value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Type input and press Enter" />
            </form>
          )}
          <span ref={bottomRef} />
        </pre>
      </div>

      {/* Check verification */}
      {checkResult !== null && (
        <div style={{ ...s.checkResult, background: checkResult === 'pass' ? '#f0fdf4' : '#fffbeb', borderColor: checkResult === 'pass' ? '#bbf7d0' : '#fde68a' }}>
          {checkResult === 'pass'
            ? <span>✅ <strong>Check passes</strong> — students will see the completion banner.</span>
            : <span>⚠️ <strong>Check does not pass</strong> with this output — review your check value (<code style={s.code}>{checkValue}</code>).</span>}
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  panel: { overflow: 'hidden' },
  header: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '8px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: '10px 10px 0 0',
  },
  headerLabel: { fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.04em' },
  statusDot: { width: 8, height: 8, borderRadius: '50%' },
  statusLabel: { fontFamily: 'var(--font-body)', fontSize: '0.8rem', opacity: 0.85 },
  pre: {
    margin: 0,
    padding: '10px 14px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '14px',
    lineHeight: 1.6,
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    background: '#fafafa',
    minHeight: 100,
    maxHeight: 240,
    borderRadius: '0 0 10px 10px',
  },
  inputRow: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 },
  prompt: { color: 'var(--colour-primary)', fontWeight: 700 },
  input: {
    flex: 1,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '14px',
    border: 'none',
    borderBottom: '2px solid var(--colour-primary)',
    outline: 'none',
    background: 'transparent',
    padding: '2px 4px',
  },
  checkResult: {
    border: '1px solid',
    borderRadius: 8,
    padding: '10px 14px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    lineHeight: 1.6,
    color: 'var(--colour-text)',
  },
  code: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.85em',
    background: 'rgba(0,0,0,0.06)',
    padding: '1px 5px',
    borderRadius: 4,
  },
}
