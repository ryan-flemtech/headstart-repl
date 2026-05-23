import React, { useState, useMemo } from 'react'
import { InlineMarkdown, MarkdownRenderer } from '../../shared/markdown'
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

function stableHash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return h
}

const DRAG_MIME = 'application/x-headstart-quiz-tile'

function readDraggedTileId(event) {
  return event.dataTransfer.getData(DRAG_MIME) || event.dataTransfer.getData('text/plain')
}

function writeDraggedTileId(event, tileId) {
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData(DRAG_MIME, tileId)
  event.dataTransfer.setData('text/plain', tileId)
}

function setLiftedDragImage(event, label) {
  const dragImage = document.createElement('div')
  dragImage.textContent = label
  Object.assign(dragImage.style, {
    position: 'fixed',
    top: '-1000px',
    left: '-1000px',
    maxWidth: '280px',
    padding: '12px 22px',
    border: '3px solid var(--colour-primary)',
    borderRadius: '8px',
    background: 'var(--colour-primary)',
    color: '#fff',
    boxShadow: '0 18px 42px rgba(35, 18, 76, 0.36), 0 0 0 5px rgba(251, 165, 4, 0.25)',
    fontFamily: 'var(--font-body)',
    fontSize: '1rem',
    fontWeight: '700',
    lineHeight: '1.35',
    transform: 'rotate(-3deg) scale(1.08)',
    zIndex: '99999',
    pointerEvents: 'none',
    whiteSpace: 'normal',
  })
  document.body.appendChild(dragImage)
  const rect = dragImage.getBoundingClientRect()
  event.dataTransfer.setDragImage(dragImage, rect.width / 2, rect.height / 2)
  window.setTimeout(() => dragImage.remove(), 0)
}

function removeTileFromState(state, tileId) {
  const next = { ...state }
  const existingSlot = Object.keys(next).find(k => next[k] === tileId)
  if (existingSlot) delete next[existingSlot]
  return next
}

function QuestionPanel({ task }) {
  if (!task?.explainer) return null
  return (
    <div style={s.question}>
      <div style={s.questionLabel}>Question</div>
      <div style={s.questionBody}>
        <MarkdownRenderer title={task.title} content={task.explainer} />
      </div>
    </div>
  )
}

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
  const quizType = task?.quizType ?? 'multiple_choice'
  const props = { task, selectedAnswer, onSelectAnswer, submitted, checkPassed, disabled, showQuestion, showResult }

  if (quizType === 'match') return <MatchQuiz {...props} />
  if (quizType === 'fill_blank') return <FillBlankQuiz {...props} />
  if (quizType === 'short_answer') return <ShortAnswerQuiz {...props} />
  return <MultipleChoiceQuiz {...props} />
}

function MultipleChoiceQuiz({ task, selectedAnswer, onSelectAnswer, submitted, checkPassed, disabled, showQuestion, showResult }) {
  const options = task?.options ?? []

  return (
    <div style={s.wrap}>
      {showQuestion && <QuestionPanel task={task} />}
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
              <span style={{ ...s.optionId, background: active ? 'rgba(255,255,255,0.22)' : colour.active, color: '#fff' }}>
                {option.id}
              </span>
              <span style={s.optionText}>
                <span style={active ? s.markdownOnDark : undefined}>
                  <InlineMarkdown content={option.text} />
                </span>
              </span>
            </button>
          )
        })}
      </div>
      {showResult && submitted && (
        <CheckFeedbackBanner
          passed={checkPassed}
          failureMessage="Wrong answer, try again."
          suggestion={getMultipleChoiceSuggestion(task, selectedAnswer)}
        />
      )}
    </div>
  )
}

function getMultipleChoiceSuggestion(task, selectedAnswer) {
  if (checkPassedFromTask(task, selectedAnswer)) return ''
  const option = task?.options?.find(o => o.id === selectedAnswer)
  return String(option?.feedback ?? option?.hint ?? task?.feedback ?? task?.check?.hint ?? '').trim()
}

function checkPassedFromTask(task, selectedAnswer) {
  return task?.check?.type === 'answer_equals' && task.check.value === selectedAnswer
}

// ─── Match ────────────────────────────────────────────────────────────────────

function MatchQuiz({ task, selectedAnswer, onSelectAnswer, submitted, checkPassed, disabled, showQuestion, showResult }) {
  const pairs = task?.pairs ?? []
  const [draggingTile, setDraggingTile] = useState(null)
  const [dragOverSlot, setDragOverSlot] = useState(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shuffledAnswers = useMemo(() => [...pairs].sort((a, b) => stableHash(a.answer) - stableHash(b.answer)), [JSON.stringify(pairs)])

  const state = useMemo(() => {
    if (selectedAnswer && typeof selectedAnswer === 'object' && !Array.isArray(selectedAnswer)) return selectedAnswer
    return {}
  }, [selectedAnswer])

  const placedIds = new Set(Object.values(state))
  const blocked = disabled || (submitted && checkPassed)

  function publishState(next) {
    const allFilled = pairs.every(p => next[p.id] !== undefined)
    if (allFilled) {
      const allCorrect = pairs.every(p => next[p.id] === p.id)
      onSelectAnswer?.(next, allCorrect)
    } else {
      onSelectAnswer?.(next, null)
    }
  }

  function handleDragStart(event, pairId) {
    if (blocked) return
    writeDraggedTileId(event, pairId)
    setLiftedDragImage(event, pairs.find(p => p.id === pairId)?.answer ?? '')
    setDraggingTile(pairId)
  }

  function handleDragEnd() {
    setDraggingTile(null)
    setDragOverSlot(null)
  }

  function handleSlotDragOver(event, promptId) {
    if (blocked) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOverSlot(promptId)
  }

  function handleSlotDrop(event, promptId) {
    event.preventDefault()
    if (blocked) return
    const tileId = readDraggedTileId(event)
    if (!tileId) return
    const next = removeTileFromState(state, tileId)
    next[promptId] = tileId
    setDraggingTile(null)
    setDragOverSlot(null)
    publishState(next)
  }

  function handlePoolDragOver(event) {
    if (blocked) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function handlePoolDrop(event) {
    event.preventDefault()
    if (blocked) return
    const tileId = readDraggedTileId(event)
    if (!tileId) return
    setDraggingTile(null)
    setDragOverSlot(null)
    publishState(removeTileFromState(state, tileId))
  }

  return (
    <div style={s.wrap}>
      {showQuestion && <QuestionPanel task={task} />}

      <div style={sm.matchLayout}>
        <div style={sm.promptList}>
          {pairs.map(pair => {
            const placedId = state[pair.id]
            const placedPair = placedId ? pairs.find(p => p.id === placedId) : null
            const isOccupied = !!placedId
            const canReceive = draggingTile && draggingTile !== placedId

            return (
              <div key={pair.id} style={sm.matchRow}>
                <div style={sm.promptCell}>
                  <span style={s.markdownOnDark}>
                    <InlineMarkdown content={pair.prompt} />
                  </span>
                </div>
                <div style={sm.matchArrow}>→</div>
                <div
                  style={{
                    ...sm.slot,
                    ...(isOccupied ? sm.slotFilled : sm.slotEmpty),
                    ...(canReceive && dragOverSlot === pair.id && !blocked ? sm.slotHighlight : {}),
                    cursor: blocked ? 'default' : isOccupied ? 'grab' : 'copy',
                  }}
                  onDragOver={event => handleSlotDragOver(event, pair.id)}
                  onDragLeave={() => setDragOverSlot(null)}
                  onDrop={event => handleSlotDrop(event, pair.id)}
                  draggable={isOccupied && !blocked}
                  onDragStart={event => isOccupied && handleDragStart(event, placedId)}
                  onDragEnd={handleDragEnd}
                >
                  {placedPair?.answer
                    ? <InlineMarkdown content={placedPair.answer} />
                    : (canReceive && !blocked ? 'Drop here' : '—')}
                </div>
              </div>
            )
          })}
        </div>

        <div style={sm.answerPool} onDragOver={handlePoolDragOver} onDrop={handlePoolDrop}>
          <div style={sm.poolLabel}>Answers</div>
          <div style={sm.poolTiles}>
            {shuffledAnswers.filter(p => !placedIds.has(p.id)).map(pair => (
              <button
                key={pair.id}
                type="button"
                style={{
                  ...sm.tile,
                  ...(draggingTile === pair.id ? sm.tileSelected : {}),
                }}
                draggable={!blocked}
                onDragStart={event => handleDragStart(event, pair.id)}
                onDragEnd={handleDragEnd}
                disabled={blocked}
              >
                <InlineMarkdown content={pair.answer} />
              </button>
            ))}
            {shuffledAnswers.filter(p => !placedIds.has(p.id)).length === 0 && !checkPassed && (
              <span style={sm.poolEmpty}>All answers placed</span>
            )}
          </div>
        </div>
      </div>

      {showResult && submitted && (
        <CheckFeedbackBanner passed={checkPassed} failureMessage="Not quite right, try again." suggestion={task?.feedback ?? task?.check?.hint ?? ''} />
      )}
    </div>
  )
}

// ─── Fill in the Blank ────────────────────────────────────────────────────────

function FillBlankQuiz({ task, selectedAnswer, onSelectAnswer, submitted, checkPassed, disabled, showQuestion, showResult }) {
  const blanks = task?.blanks ?? []
  const mode = task?.mode ?? 'drag'
  const text = task?.text ?? ''
  const [draggingTile, setDraggingTile] = useState(null)
  const [dragOverBlank, setDragOverBlank] = useState(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shuffledAnswers = useMemo(() => [...blanks].sort((a, b) => stableHash(a.answer) - stableHash(b.answer)), [JSON.stringify(blanks)])

  const state = useMemo(() => {
    if (selectedAnswer && typeof selectedAnswer === 'object' && !Array.isArray(selectedAnswer)) return selectedAnswer
    return {}
  }, [selectedAnswer])

  const segments = useMemo(() => {
    const parts = text.split('___')
    const result = []
    parts.forEach((part, i) => {
      if (part) result.push({ type: 'text', text: part })
      if (i < parts.length - 1) result.push({ type: 'blank', blankId: blanks[i]?.id ?? `b${i + 1}` })
    })
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, blanks.length])

  const placedIds = new Set(Object.values(state))
  const blocked = disabled || (submitted && checkPassed)

  function publishState(next) {
    const allFilled = blanks.every(b => next[b.id] !== undefined)
    if (allFilled) {
      const allCorrect = blanks.every(b => next[b.id] === b.id)
      onSelectAnswer?.(next, allCorrect)
    } else {
      onSelectAnswer?.(next, null)
    }
  }

  function handleDragStart(event, blankId) {
    if (blocked) return
    writeDraggedTileId(event, blankId)
    setLiftedDragImage(event, blanks.find(b => b.id === blankId)?.answer ?? '')
    setDraggingTile(blankId)
  }

  function handleDragEnd() {
    setDraggingTile(null)
    setDragOverBlank(null)
  }

  function handleBlankDragOver(event, blankId) {
    if (blocked || mode !== 'drag') return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOverBlank(blankId)
  }

  function handleBlankDrop(event, blankId) {
    event.preventDefault()
    if (blocked || mode !== 'drag') return
    const tileId = readDraggedTileId(event)
    if (!tileId) return
    const next = removeTileFromState(state, tileId)
    next[blankId] = tileId
    setDraggingTile(null)
    setDragOverBlank(null)
    publishState(next)
  }

  function handlePoolDragOver(event) {
    if (blocked || mode !== 'drag') return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function handlePoolDrop(event) {
    event.preventDefault()
    if (blocked || mode !== 'drag') return
    const tileId = readDraggedTileId(event)
    if (!tileId) return
    setDraggingTile(null)
    setDragOverBlank(null)
    publishState(removeTileFromState(state, tileId))
  }

  function handleTypeChange(blankId, value) {
    const next = { ...state, [blankId]: value }
    onSelectAnswer?.(next, null)
  }

  function handleTypeSubmit() {
    const allFilled = blanks.every(b => String(state[b.id] ?? '').trim())
    if (!allFilled) return
    const allCorrect = blanks.every(b => {
      const typed = String(state[b.id] ?? '').trim().toLowerCase()
      const expected = String(b.answer ?? '').trim().toLowerCase()
      return typed === expected
    })
    onSelectAnswer?.(state, allCorrect)
  }

  return (
    <div style={s.wrap}>
      {showQuestion && <QuestionPanel task={task} />}

      <div style={sm.fillWrap}>
        <div style={sm.fillText}>
          {segments.map((seg, i) => {
            if (seg.type === 'text') {
              return (
                <MarkdownRenderer
                  key={i}
                  content={seg.text}
                  style={sm.fillMarkdownSegment}
                />
              )
            }

            const { blankId } = seg
            const placedTileId = state[blankId]
            const placedText = blanks.find(b => b.id === placedTileId)?.answer
            const canReceive = mode === 'drag' && draggingTile && draggingTile !== placedTileId

            if (mode === 'type') {
              return (
                <input
                  key={i}
                  style={sm.fillInput}
                  value={state[blankId] ?? ''}
                  onChange={e => handleTypeChange(blankId, e.target.value)}
                  disabled={blocked}
                  placeholder="..."
                />
              )
            }

            return (
              <span
                key={i}
                style={{
                  ...sm.fillBlank,
                  ...(placedTileId ? sm.fillBlankFilled : sm.fillBlankEmpty),
                  ...(canReceive && dragOverBlank === blankId && !blocked ? sm.fillBlankHighlight : {}),
                  cursor: blocked ? 'default' : placedTileId ? 'grab' : 'copy',
                }}
                onDragOver={event => handleBlankDragOver(event, blankId)}
                onDragLeave={() => setDragOverBlank(null)}
                onDrop={event => handleBlankDrop(event, blankId)}
                draggable={!!placedTileId && !blocked}
                onDragStart={event => placedTileId && handleDragStart(event, placedTileId)}
                onDragEnd={handleDragEnd}
              >
                {placedText
                  ? <span style={sm.fillBlankMarkdown}><InlineMarkdown content={placedText} /></span>
                  : (canReceive && !blocked ? 'Drop here' : '___')}
              </span>
            )
          })}
        </div>

        {mode === 'drag' && (
          <div style={sm.answerPool} onDragOver={handlePoolDragOver} onDrop={handlePoolDrop}>
            <div style={sm.poolLabel}>Answer bank</div>
            <div style={sm.poolTiles}>
              {shuffledAnswers.filter(b => !placedIds.has(b.id)).map(b => (
                <button
                  key={b.id}
                  type="button"
                  style={{ ...sm.tile, ...(draggingTile === b.id ? sm.tileSelected : {}) }}
                  draggable={!blocked}
                  onDragStart={event => handleDragStart(event, b.id)}
                  onDragEnd={handleDragEnd}
                  disabled={blocked}
                >
                  <span style={draggingTile === b.id ? sm.selectedTileMarkdown : undefined}>
                    <InlineMarkdown content={b.answer} />
                  </span>
                </button>
              ))}
              {shuffledAnswers.filter(b => !placedIds.has(b.id)).length === 0 && !checkPassed && (
                <span style={sm.poolEmpty}>All answers placed</span>
              )}
            </div>
          </div>
        )}

        {mode === 'type' && !submitted && !blocked && (
          <button
            className="btn-primary"
            style={{ alignSelf: 'flex-start', padding: '8px 24px', marginTop: 4 }}
            onClick={handleTypeSubmit}
            disabled={!blanks.every(b => String(state[b.id] ?? '').trim())}
          >
            Submit
          </button>
        )}
      </div>

      {showResult && submitted && (
        <CheckFeedbackBanner passed={checkPassed} failureMessage="Not quite right, try again." suggestion={task?.feedback ?? task?.check?.hint ?? ''} />
      )}
    </div>
  )
}

// ─── Short Answer ─────────────────────────────────────────────────────────────

function ShortAnswerQuiz({ task, selectedAnswer, onSelectAnswer, submitted, checkPassed, disabled, showQuestion, showResult }) {
  const [localAnswer, setLocalAnswer] = useState(typeof selectedAnswer === 'string' ? selectedAnswer : '')

  React.useEffect(() => {
    setLocalAnswer(typeof selectedAnswer === 'string' ? selectedAnswer : '')
  }, [selectedAnswer])

  function handleSubmit() {
    const trimmed = localAnswer.trim()
    if (!trimmed) return
    onSelectAnswer?.(trimmed)
  }

  return (
    <div style={s.wrap}>
      {showQuestion && <QuestionPanel task={task} />}

      <div style={sm.shortAnswerWrap}>
        <textarea
          style={sm.shortAnswerInput}
          value={localAnswer}
          onChange={e => setLocalAnswer(e.target.value)}
          placeholder="Type your answer here…"
          disabled={disabled || (submitted && checkPassed)}
          rows={3}
        />
        {!submitted && !disabled && (
          <button
            className="btn-primary"
            style={{ alignSelf: 'flex-start', padding: '8px 24px' }}
            onClick={handleSubmit}
            disabled={!localAnswer.trim()}
          >
            Submit Answer
          </button>
        )}
        {submitted && (
          <div style={sm.submittedAnswer}>
            Your answer: <strong>{localAnswer || (typeof selectedAnswer === 'string' ? selectedAnswer : '')}</strong>
          </div>
        )}
      </div>

      {showResult && submitted && (
        <CheckFeedbackBanner passed={checkPassed} failureMessage="Not quite right, try again." suggestion={task?.check?.hint ?? task?.feedback ?? ''} />
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  markdownOnDark: {
    '--colour-text': '#ffffff',
    '--colour-primary-dark': '#ffffff',
  },
}

const sm = {
  // Match
  matchLayout: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    flex: 1,
    minHeight: 0,
  },
  promptList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  matchRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    gap: 10,
    alignItems: 'center',
  },
  promptCell: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '12px 16px',
    borderRadius: 8,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '1rem',
    textAlign: 'center',
  },
  matchArrow: {
    color: '#9ca3af',
    fontSize: '1.25rem',
    flexShrink: 0,
  },
  slot: {
    padding: '12px 16px',
    borderRadius: 8,
    border: '2px dashed',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '1rem',
    textAlign: 'center',
    minHeight: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.12s, border-color 0.12s',
  },
  slotEmpty: {
    borderColor: '#d1d5db',
    background: '#f9fafb',
    color: '#9ca3af',
  },
  slotFilled: {
    borderColor: 'var(--colour-secondary)',
    borderStyle: 'solid',
    background: '#fffbeb',
    color: 'var(--colour-text)',
  },
  slotHighlight: {
    borderColor: 'var(--colour-primary)',
    background: '#f5f3ff',
    color: 'var(--colour-primary)',
    boxShadow: '0 0 0 4px rgba(98, 34, 204, 0.14), inset 0 0 0 2px rgba(251, 165, 4, 0.55)',
    transform: 'scale(1.03)',
  },
  answerPool: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 12,
  },
  poolLabel: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.78rem',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  poolTiles: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    minHeight: 42,
  },
  tile: {
    padding: '8px 16px',
    border: '2px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.95rem',
    color: 'var(--colour-text)',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'border-color 0.12s, background 0.12s, box-shadow 0.12s, transform 0.12s',
  },
  tileSelected: {
    borderColor: 'var(--colour-primary)',
    background: 'var(--colour-primary)',
    color: '#fff',
    boxShadow: '0 16px 34px rgba(35, 18, 76, 0.3), 0 0 0 5px rgba(251, 165, 4, 0.24)',
    transform: 'translateY(-8px) rotate(-2deg) scale(1.06)',
  },
  selectedTileMarkdown: {
    '--colour-text': '#ffffff',
    '--colour-primary-dark': '#ffffff',
  },
  poolEmpty: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  // Fill in the blank
  fillWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    flex: 1,
  },
  fillText: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '16px 20px',
    fontFamily: 'var(--font-body)',
    fontSize: '1.1rem',
    lineHeight: 2.2,
    color: 'var(--colour-text)',
  },
  fillMarkdownSegment: {
    display: 'inline',
    fontSize: 'inherit',
    lineHeight: 'inherit',
  },
  fillBlank: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    padding: '2px 12px',
    borderRadius: 6,
    border: '2px dashed',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '1rem',
    textAlign: 'center',
    margin: '0 2px',
    verticalAlign: 'middle',
    transition: 'background 0.1s, border-color 0.1s',
  },
  fillBlankMarkdown: {
    '--colour-text': 'var(--colour-text)',
    '--colour-primary-dark': 'var(--colour-primary-dark)',
    color: 'var(--colour-text)',
  },
  fillBlankEmpty: {
    borderColor: '#d1d5db',
    background: '#f9fafb',
    color: '#9ca3af',
  },
  fillBlankFilled: {
    borderColor: 'var(--colour-secondary)',
    borderStyle: 'solid',
    background: '#fffbeb',
    color: 'var(--colour-text)',
  },
  fillBlankHighlight: {
    borderColor: 'var(--colour-primary)',
    background: '#f5f3ff',
    color: 'var(--colour-primary)',
    boxShadow: '0 0 0 4px rgba(98, 34, 204, 0.14), inset 0 0 0 2px rgba(251, 165, 4, 0.55)',
    transform: 'scale(1.05)',
  },
  fillInput: {
    display: 'inline-block',
    minWidth: 90,
    width: 'auto',
    padding: '2px 10px',
    borderRadius: 6,
    border: '2px solid #d1d5db',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '1rem',
    color: 'var(--colour-text)',
    background: '#fff',
    margin: '0 2px',
    verticalAlign: 'middle',
    outline: 'none',
  },
  // Short answer
  shortAnswerWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    flex: 1,
  },
  shortAnswerInput: {
    padding: '12px 14px',
    border: '2px solid #d1d5db',
    borderRadius: 8,
    fontFamily: 'var(--font-body)',
    fontSize: '1rem',
    color: 'var(--colour-text)',
    resize: 'vertical',
    lineHeight: 1.6,
    outline: 'none',
    width: '100%',
  },
  submittedAnswer: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: '#4b5563',
    padding: '8px 12px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
  },
}
