import { describe, it, expect } from 'vitest'
import {
  normalizeChecks,
  evaluateSingleCheck,
  evaluateCheck,
  evaluateCheckResults,
  evaluateCheckWithCode,
  checkRequiresRun,
  checkAllowedForSubmit,
  filterChecksForInteraction,
  getFirstFailedCheckHint,
  getIncorrectCheckHint,
} from '../checks.js'

// ─── normalizeChecks ──────────────────────────────────────────────────────────

describe('normalizeChecks', () => {
  it('returns empty array for null', () => {
    expect(normalizeChecks(null)).toEqual([])
  })

  it('wraps a single check object in an array', () => {
    const check = { type: 'output_contains', value: 'hello' }
    expect(normalizeChecks(check)).toEqual([check])
  })

  it('filters out items without a type from arrays', () => {
    const checks = [{ type: 'output_contains', value: 'hi' }, { value: 'no-type' }, null]
    expect(normalizeChecks(checks)).toHaveLength(1)
  })
})

// ─── output_contains (via fallthrough) ───────────────────────────────────────

describe('evaluateSingleCheck — output_contains (fallthrough)', () => {
  it('returns true when output contains the value', () => {
    const check = { type: 'output_contains', value: 'hello' }
    expect(evaluateSingleCheck(check, 'hello world')).toBe(true)
  })

  it('returns false when output does not contain the value', () => {
    const check = { type: 'output_contains', value: 'goodbye' }
    expect(evaluateSingleCheck(check, 'hello world')).toBe(false)
  })
})

// ─── output_equals ────────────────────────────────────────────────────────────

describe('evaluateSingleCheck — output_equals', () => {
  it('returns true when output exactly matches value (case-insensitive, trimmed)', () => {
    const check = { type: 'output_equals', value: 'Hello' }
    expect(evaluateSingleCheck(check, 'hello\n')).toBe(true)
  })

  it('returns false when output does not match', () => {
    const check = { type: 'output_equals', value: 'hello' }
    expect(evaluateSingleCheck(check, 'world')).toBe(false)
  })
})

// ─── output_not_empty ─────────────────────────────────────────────────────────

describe('evaluateSingleCheck — output_not_empty', () => {
  it('returns true when output has content', () => {
    expect(evaluateSingleCheck({ type: 'output_not_empty' }, 'some text')).toBe(true)
  })

  it('returns false for empty or whitespace-only output', () => {
    expect(evaluateSingleCheck({ type: 'output_not_empty' }, '   ')).toBe(false)
    expect(evaluateSingleCheck({ type: 'output_not_empty' }, '')).toBe(false)
  })
})

// ─── output_line_count ────────────────────────────────────────────────────────

describe('evaluateSingleCheck — output_line_count', () => {
  it('returns true when line count matches', () => {
    const check = { type: 'output_line_count', value: '3' }
    expect(evaluateSingleCheck(check, 'a\nb\nc')).toBe(true)
  })

  it('returns false when line count does not match', () => {
    const check = { type: 'output_line_count', value: '2' }
    expect(evaluateSingleCheck(check, 'a\nb\nc')).toBe(false)
  })
})

// ─── code_contains ────────────────────────────────────────────────────────────

describe('evaluateSingleCheck — code_contains', () => {
  it('returns true when code contains the value', () => {
    const check = { type: 'code_contains', value: 'print' }
    expect(evaluateSingleCheck(check, '', { code: 'print("hello")' })).toBe(true)
  })

  it('returns false when code does not contain the value', () => {
    const check = { type: 'code_contains', value: 'for' }
    expect(evaluateSingleCheck(check, '', { code: 'x = 1' })).toBe(false)
  })
})

// ─── code_does_not_contain ───────────────────────────────────────────────────

describe('evaluateSingleCheck — code_does_not_contain', () => {
  it('returns true when code does not contain the value', () => {
    const check = { type: 'code_does_not_contain', value: 'eval' }
    expect(evaluateSingleCheck(check, '', { code: 'x = 1' })).toBe(true)
  })

  it('returns false when code contains the value', () => {
    const check = { type: 'code_does_not_contain', value: 'print' }
    expect(evaluateSingleCheck(check, '', { code: 'print("hi")' })).toBe(false)
  })
})

// ─── output_matches_regex ─────────────────────────────────────────────────────

describe('evaluateSingleCheck — output_matches_regex', () => {
  it('returns true when output matches the regex', () => {
    const check = { type: 'output_matches_regex', value: '^\\d+$' }
    expect(evaluateSingleCheck(check, '42')).toBe(true)
  })

  it('returns false when output does not match the regex', () => {
    const check = { type: 'output_matches_regex', value: '^\\d+$' }
    expect(evaluateSingleCheck(check, 'abc')).toBe(false)
  })

  it('returns false for an invalid regex pattern', () => {
    const check = { type: 'output_matches_regex', value: '[invalid' }
    expect(evaluateSingleCheck(check, 'anything')).toBe(false)
  })
})

// ─── answer_equals ────────────────────────────────────────────────────────────

describe('evaluateSingleCheck — answer_equals', () => {
  it('returns true when context.answer matches value (case-insensitive)', () => {
    const check = { type: 'answer_equals', value: 'Paris' }
    expect(evaluateSingleCheck(check, '', { answer: 'paris' })).toBe(true)
  })

  it('returns false when context.answer does not match', () => {
    const check = { type: 'answer_equals', value: 'Paris' }
    expect(evaluateSingleCheck(check, '', { answer: 'London' })).toBe(false)
  })

  it('falls back to output when context.answer is absent', () => {
    const check = { type: 'answer_equals', value: 'hello' }
    expect(evaluateSingleCheck(check, 'hello')).toBe(true)
  })
})

// ─── Wildcard matching ────────────────────────────────────────────────────────

describe('evaluateSingleCheck — wildcard matching', () => {
  it('output_contains passes with wildcard * pattern', () => {
    const check = { type: 'output_contains', value: 'hel*orld' }
    expect(evaluateSingleCheck(check, 'hello world')).toBe(true)
  })

  it('output_equals passes with leading/trailing wildcard', () => {
    const check = { type: 'output_equals', value: '*world*' }
    expect(evaluateSingleCheck(check, 'hello world!')).toBe(true)
  })

  it('output_equals fails when wildcard pattern does not match', () => {
    const check = { type: 'output_equals', value: 'foo*baz' }
    expect(evaluateSingleCheck(check, 'foo bar qux')).toBe(false)
  })
})

// ─── Normalisation ────────────────────────────────────────────────────────────

describe('evaluateSingleCheck — normalisation', () => {
  it('output_equals is case-insensitive', () => {
    const check = { type: 'output_equals', value: 'HELLO' }
    expect(evaluateSingleCheck(check, 'hello')).toBe(true)
  })

  it('output_equals strips trailing newlines (normalizeExactOutput behaviour)', () => {
    // normalizeExactOutput strips trailing newlines but not leading/internal spaces
    const check = { type: 'output_equals', value: 'hello\n' }
    expect(evaluateSingleCheck(check, 'hello')).toBe(true)
  })

  it('output_contains normalises CRLF to LF', () => {
    const check = { type: 'output_contains', value: 'a\nb' }
    expect(evaluateSingleCheck(check, 'a\r\nb')).toBe(true)
  })
})

// ─── evaluateCheckResults ─────────────────────────────────────────────────────

describe('evaluateCheckResults', () => {
  it('returns an array of check objects with passed flag', () => {
    const checks = [
      { type: 'output_contains', value: 'hello' },
      { type: 'output_contains', value: 'missing' },
    ]
    const results = evaluateCheckResults(checks, 'hello world')
    expect(results).toHaveLength(2)
    expect(results[0].passed).toBe(true)
    expect(results[1].passed).toBe(false)
  })

  it('preserves original check properties in results', () => {
    const check = { type: 'output_contains', value: 'hi', hint: 'Try printing hi' }
    const [result] = evaluateCheckResults(check, 'hi there')
    expect(result.hint).toBe('Try printing hi')
    expect(result.type).toBe('output_contains')
  })

  it('returns empty array when no valid checks provided', () => {
    expect(evaluateCheckResults(null, 'output')).toEqual([])
  })
})

// ─── evaluateCheck (all-must-pass) ───────────────────────────────────────────

describe('evaluateCheck', () => {
  it('returns true when all checks pass', () => {
    const checks = [
      { type: 'output_contains', value: 'hello' },
      { type: 'output_contains', value: 'world' },
    ]
    expect(evaluateCheck(checks, 'hello world')).toBe(true)
  })

  it('returns false when any check fails', () => {
    const checks = [
      { type: 'output_contains', value: 'hello' },
      { type: 'output_contains', value: 'missing' },
    ]
    expect(evaluateCheck(checks, 'hello world')).toBe(false)
  })

  it('returns false for empty checks', () => {
    expect(evaluateCheck([], 'anything')).toBe(false)
  })
})

// ─── evaluateCheckWithCode ────────────────────────────────────────────────────

describe('evaluateCheckWithCode', () => {
  it('returns true when code satisfies a code_contains check', () => {
    const check = { type: 'code_contains', value: 'for' }
    expect(evaluateCheckWithCode(check, 'for i in range(10):')).toBe(true)
  })

  it('returns false when a run-required check is in the list', () => {
    const checks = [
      { type: 'code_contains', value: 'print' },
      { type: 'output_contains', value: 'hello' },
    ]
    expect(evaluateCheckWithCode(checks, 'print("hello")')).toBe(false)
  })
})

// ─── checkRequiresRun / checkAllowedForSubmit ─────────────────────────────────

describe('checkRequiresRun', () => {
  it('returns true for output_contains', () => {
    expect(checkRequiresRun({ type: 'output_contains' })).toBe(true)
  })

  it('returns false for code_contains', () => {
    expect(checkRequiresRun({ type: 'code_contains' })).toBe(false)
  })
})

describe('checkAllowedForSubmit', () => {
  it('returns true for code_contains', () => {
    expect(checkAllowedForSubmit({ type: 'code_contains' })).toBe(true)
  })

  it('returns false for output_contains', () => {
    expect(checkAllowedForSubmit({ type: 'output_contains' })).toBe(false)
  })
})

// ─── filterChecksForInteraction ───────────────────────────────────────────────

describe('filterChecksForInteraction', () => {
  const mixed = [
    { type: 'code_contains', value: 'for' },
    { type: 'output_contains', value: 'hello' },
  ]

  it('returns all checks in non-submit mode', () => {
    expect(filterChecksForInteraction(mixed, 'run')).toHaveLength(2)
  })

  it('filters to submit-allowed checks only in submit mode', () => {
    const result = filterChecksForInteraction(mixed, 'submit')
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('code_contains')
  })
})

// ─── getFirstFailedCheckHint ──────────────────────────────────────────────────

describe('getFirstFailedCheckHint', () => {
  it('returns hint from first failed check that has one', () => {
    const checks = [
      { type: 'output_contains', value: 'missing', hint: 'Use print' },
    ]
    expect(getFirstFailedCheckHint(checks, 'hello')).toBe('Use print')
  })

  it('returns empty string when all checks pass', () => {
    const checks = [{ type: 'output_contains', value: 'hello', hint: 'Try again' }]
    expect(getFirstFailedCheckHint(checks, 'hello world')).toBe('')
  })
})

// ─── getIncorrectCheckHint ────────────────────────────────────────────────────

describe('getIncorrectCheckHint', () => {
  it('returns hint from the first incorrect check that passes', () => {
    const checks = [
      { type: 'output_contains', value: 'hello', hint: 'You used print — good start but wrong output' },
    ]
    expect(getIncorrectCheckHint(checks, 'hello')).toBe('You used print — good start but wrong output')
  })

  it('returns empty string when no incorrect check matches', () => {
    const checks = [{ type: 'output_contains', value: 'missing', hint: 'Hint' }]
    expect(getIncorrectCheckHint(checks, 'hello')).toBe('')
  })
})

// ─── DOM checks with null iframeDoc ───────────────────────────────────────────

describe('evaluateSingleCheck — DOM checks with null iframeDoc', () => {
  it('element_exists returns false when iframeDoc is null', () => {
    expect(evaluateSingleCheck({ type: 'element_exists', selector: 'h1' }, '', { iframeDoc: null })).toBe(false)
  })

  it('element_count returns false when iframeDoc is null', () => {
    expect(evaluateSingleCheck({ type: 'element_count', selector: 'p', value: '2' }, '', { iframeDoc: null })).toBe(false)
  })

  it('element_value returns false when iframeDoc is null', () => {
    expect(evaluateSingleCheck({ type: 'element_value', selector: '#out', value: 'hi' }, '', { iframeDoc: null })).toBe(false)
  })
})

// ─── variable checks with empty context ───────────────────────────────────────

describe('evaluateSingleCheck — variable checks', () => {
  it('variable_exists returns false when variables is empty', () => {
    expect(evaluateSingleCheck({ type: 'variable_exists', name: 'x' }, '', { variables: {} })).toBe(false)
  })

  it('variable_exists returns true when variable is present', () => {
    expect(evaluateSingleCheck(
      { type: 'variable_exists', name: 'x' },
      '',
      { variables: { x: { json: '"hello"', type: 'str' } } },
    )).toBe(true)
  })

  it('variable_equals returns true for matching value', () => {
    expect(evaluateSingleCheck(
      { type: 'variable_equals', name: 'x', value: '42' },
      '',
      { variables: { x: { json: '42', type: 'int' } } },
    )).toBe(true)
  })

  it('variable_equals returns false for mismatched value', () => {
    expect(evaluateSingleCheck(
      { type: 'variable_equals', name: 'x', value: '99' },
      '',
      { variables: { x: { json: '42', type: 'int' } } },
    )).toBe(false)
  })
})

// ─── guard: null/malformed check ──────────────────────────────────────────────

describe('evaluateSingleCheck — guard conditions', () => {
  it('returns false for null check', () => {
    expect(evaluateSingleCheck(null, 'output')).toBe(false)
  })

  it('returns false for check without type', () => {
    expect(evaluateSingleCheck({ value: 'hello' }, 'hello')).toBe(false)
  })

  it('returns false when check.value is null for output_equals', () => {
    expect(evaluateSingleCheck({ type: 'output_equals' }, 'hello')).toBe(false)
  })
})
