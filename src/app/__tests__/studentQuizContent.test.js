import { describe, expect, it } from 'vitest'
import { getQuizSuggestion } from '../studentQuizContent'

const mcTask = {
  quizType: 'multiple_choice',
  options: [
    { id: 'a', text: 'Correct', feedback: 'Well done!' },
    { id: 'b', text: 'Wrong', hint: 'Try again.' },
    { id: 'c', text: 'Also wrong' },
  ],
  feedback: 'Task-level feedback',
  check: { hint: 'Check hint' },
}

const shortAnswerTask = {
  quizType: 'short_answer',
  check: { type: 'output_contains', value: 'hello', hint: 'Check for hello' },
}

const matchTask = {
  quizType: 'match',
  feedback: 'Match feedback',
}

describe('getQuizSuggestion', () => {
  it('returns empty string for null task', () => {
    expect(getQuizSuggestion(null, 'a')).toBe('')
  })

  it('returns empty string for undefined task', () => {
    expect(getQuizSuggestion(undefined, 'a')).toBe('')
  })

  describe('multiple_choice (default)', () => {
    it('returns option feedback when present', () => {
      expect(getQuizSuggestion(mcTask, 'a')).toBe('Well done!')
    })

    it('falls back to option hint when no feedback', () => {
      expect(getQuizSuggestion(mcTask, 'b')).toBe('Try again.')
    })

    it('falls back to task-level feedback when option has neither', () => {
      expect(getQuizSuggestion(mcTask, 'c')).toBe('Task-level feedback')
    })

    it('falls back to check hint when task has no feedback', () => {
      const task = { quizType: 'multiple_choice', options: [{ id: 'x' }], check: { hint: 'use check hint' } }
      expect(getQuizSuggestion(task, 'x')).toBe('use check hint')
    })

    it('returns empty string when no feedback exists at any level', () => {
      const task = { quizType: 'multiple_choice', options: [{ id: 'x' }] }
      expect(getQuizSuggestion(task, 'x')).toBe('')
    })

    it('handles undefined quizType (defaults to multiple_choice)', () => {
      const task = { options: [{ id: 'a', feedback: 'mc fallback' }] }
      expect(getQuizSuggestion(task, 'a')).toBe('mc fallback')
    })
  })

  describe('short_answer', () => {
    it('returns the check hint when the answer does not satisfy the check', () => {
      expect(getQuizSuggestion(shortAnswerTask, 'wrong answer')).toBe('Check for hello')
    })

    it('returns empty string when short_answer task has no check', () => {
      const task = { quizType: 'short_answer', feedback: 'ok' }
      expect(getQuizSuggestion(task, 'anything')).toBe('ok')
    })
  })

  describe('other quiz types (match, fill_blank)', () => {
    it('returns task feedback for match type', () => {
      expect(getQuizSuggestion(matchTask, {})).toBe('Match feedback')
    })

    it('returns check hint when no task feedback', () => {
      const task = { quizType: 'fill_blank', check: { hint: 'fill hint' } }
      expect(getQuizSuggestion(task, [])).toBe('fill hint')
    })
  })
})
