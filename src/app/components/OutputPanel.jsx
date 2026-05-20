import React, { useRef, useEffect, useState } from 'react'

export default function OutputPanel({
  output = '',
  runStatus = null,
  inputPrompt = null,
  onInputSubmit,
  checkPassed = false,
  hasCheck = false,
}) {
  const [inputValue, setInputValue] = useState('')
  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)

  // Scroll to bottom when output grows
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [output, inputPrompt])

  // Focus input field when prompt appears
  useEffect(() => {
    if (inputPrompt !== null) inputRef.current?.focus()
  }, [inputPrompt])

  function handleInputSubmit(e) {
    e.preventDefault()
    onInputSubmit?.(inputValue)
    setInputValue('')
  }

  const statusColour = runStatus === 'success' ? '#22c55e' : runStatus === 'error' ? '#ef4444' : '#9ca3af'
  const statusLabel  = runStatus === 'success' ? 'Ran OK' : runStatus === 'error' ? 'Error' : 'Not run'

  return (
    <div style={s.panel} className="card">
      {/* Header */}
      <div style={s.header}>
        <span style={s.headerLabel}>Output</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasCheck && checkPassed && (
            <span style={s.checkBadge}>✅ Check passed!</span>
          )}
          <span style={{ ...s.statusDot, background: statusColour }} />
          <span style={s.statusLabel}>{statusLabel}</span>
        </div>
      </div>

      {/* Output text */}
      <pre style={s.pre}>
        {output || <span style={{ color: '#9ca3af' }}>Run your code to see output here.</span>}

        {/* Input field appears inline when input() is waiting */}
        {inputPrompt !== null && (
          <form onSubmit={handleInputSubmit} style={s.inputRow}>
            <span style={s.prompt}>&gt;</span>
            <input
              ref={inputRef}
              style={s.input}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Type your input and press Enter"
            />
          </form>
        )}

        <span ref={bottomRef} />
      </pre>
    </div>
  )
}

const s = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 140,
    maxHeight: 300,
    overflow: 'hidden',
  },
  header: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '8px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: '10px 10px 0 0',
    flexShrink: 0,
  },
  headerLabel: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.85rem',
    letterSpacing: '0.04em',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  statusLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    opacity: 0.85,
  },
  checkBadge: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.82rem',
    color: '#22c55e',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 6,
    padding: '2px 8px',
  },
  pre: {
    flex: 1,
    margin: 0,
    padding: '10px 14px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '14px',
    lineHeight: 1.6,
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    background: '#fafafa',
    borderRadius: '0 0 10px 10px',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  prompt: {
    color: 'var(--colour-primary)',
    fontWeight: 700,
  },
  input: {
    flex: 1,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '14px',
    border: 'none',
    borderBottom: '2px solid var(--colour-primary)',
    outline: 'none',
    background: 'transparent',
    color: 'var(--colour-text)',
    padding: '2px 4px',
  },
}
