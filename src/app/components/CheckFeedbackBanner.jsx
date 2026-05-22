import React from 'react'

export default function CheckFeedbackBanner({
  passed,
  failureMessage = 'Check again, something is not right.',
  successMessage = 'Correct!',
  onHintsClick,
  onShowCompleteCode,
}) {
  return (
    <div style={{ ...s.banner, ...(passed ? s.pass : s.fail) }} role="status">
      <span style={{ ...s.icon, background: passed ? '#166534' : '#92400e' }}>{passed ? '✓' : '!'}</span>
      <span style={s.text}>{passed ? successMessage : failureMessage}</span>
      {!passed && onHintsClick && (
        <button type="button" style={s.actionLink} onClick={onHintsClick}>
          Hints
        </button>
      )}
      {!passed && onShowCompleteCode && (
        <button type="button" style={s.actionLink} onClick={onShowCompleteCode}>
          See complete code
        </button>
      )}
    </div>
  )
}

const s = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid',
    fontFamily: 'var(--font-body)',
    fontSize: '0.92rem',
    fontWeight: 700,
  },
  pass: {
    background: '#dcfce7',
    borderColor: '#bbf7d0',
    color: '#166534',
  },
  fail: {
    background: '#fffbeb',
    borderColor: '#fde68a',
    color: '#92400e',
  },
  icon: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: '#fff',
    fontFamily: 'var(--font-title)',
    fontSize: '0.86rem',
    lineHeight: 1,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  actionLink: {
    flexShrink: 0,
    background: 'none',
    border: 'none',
    padding: '2px 0',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.88rem',
    color: '#92400e',
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
}
