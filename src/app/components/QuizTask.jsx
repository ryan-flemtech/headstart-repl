import React from 'react'
import { MarkdownRenderer } from '../../shared/markdown'
import CheckFeedbackBanner from './CheckFeedbackBanner'

export function getQuizOptionText(task, answerId) {
  return task?.options?.find(option => option.id === answerId)?.text ?? ''
}

const OPTION_COLOURS = [
  { background: '#dbeafe', border: '#2563eb', active: '#2563eb', text: '#1e3a8a' },
  { background: '#fee2e2', border: '#dc2626', active: '#dc2626', text: '#7f1d1d' },
  { background: '#fef3c7', border: '#f59e0b', active: '#f59e0b', text: '#78350f' },
  { background: '#dcfce7', border: '#16a34a', active: '#16a34a', text: '#14532d' },
]

export default function QuizTask({
  task,
  selectedAnswer,
  onSelectAnswer,
  submitted = false,
  checkPassed = false,
  disabled = false,
  showQuestion = false,
  showResult = true,
}) {
  const options = task?.options ?? []

  return (
    <div style={s.wrap}>
      {showQuestion && task?.explainer && (
        <div style={s.question}>
          <div style={s.questionLabel}>Question</div>
          <div style={s.questionBody}>
            <MarkdownRenderer title={task.title} content={task.explainer} />
          </div>
        </div>
      )}

      <div style={s.options} role="radiogroup" aria-label={task?.title ?? 'Quiz options'}>
        {options.map((option, index) => {
          const active = selectedAnswer === option.id
          const colour = OPTION_COLOURS[index % OPTION_COLOURS.length]
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              style={{
                ...s.option,
                background: active ? colour.active : colour.background,
                borderColor: colour.border,
                color: active ? '#fff' : colour.text,
                ...(active ? s.optionActive : {}),
              }}
              onClick={() => onSelectAnswer?.(option.id)}
              disabled={disabled}
            >
              <span
                style={{
                  ...s.optionId,
                  background: active ? 'rgba(255,255,255,0.22)' : colour.active,
                  color: '#fff',
                }}
              >
                {option.id}
              </span>
              <span style={s.optionText}>{option.text}</span>
            </button>
          )
        })}
      </div>

      {showResult && submitted && (
        <CheckFeedbackBanner
          passed={checkPassed}
          failureMessage="Wrong answer, try again."
        />
      )}
    </div>
  )
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    width: '100%',
    flex: 1,
    minHeight: 0,
  },
  question: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
    flexShrink: 0,
  },
  questionLabel: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '10px 14px',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.85rem',
    letterSpacing: '0.04em',
  },
  questionBody: {
    padding: '14px 16px',
  },
  options: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gridAutoRows: 'minmax(0, 1fr)',
    gap: 10,
    flex: 1,
    minHeight: 0,
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    minHeight: 0,
    height: '100%',
    padding: '18px 20px',
    border: '2px solid',
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'var(--font-body)',
    fontSize: '1.35rem',
    fontWeight: 600,
  },
  optionActive: {
    boxShadow: '0 6px 18px rgba(17, 24, 39, 0.18)',
    transform: 'scale(1.035)',
    zIndex: 2,
    fontSize: '1.55rem',
  },
  optionId: {
    width: 42,
    height: 42,
    borderRadius: 6,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  optionText: {
    minWidth: 0,
    lineHeight: 1.35,
  },
  submitBtn: {
    padding: '10px 28px',
    fontSize: 15,
  },
}
