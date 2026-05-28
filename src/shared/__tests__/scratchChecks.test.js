import { describe, it, expect } from 'vitest'
import { DEFAULT_SPRITES, createSpriteState, evaluateScratchCheck, compare } from '../scratchChecks'

// Minimal workspace stub used by block_used checks.
function makeWorkspace(blockTypes) {
  return {
    getAllBlocks: () => blockTypes.map(type => ({ type })),
  }
}

describe('DEFAULT_SPRITES', () => {
  it('contains one sprite with id sprite1', () => {
    expect(DEFAULT_SPRITES).toHaveLength(1)
    expect(DEFAULT_SPRITES[0].id).toBe('sprite1')
  })
})

describe('createSpriteState', () => {
  it('returns a sprite at the origin facing right', () => {
    const state = createSpriteState()
    expect(state.x).toBe(0)
    expect(state.y).toBe(0)
    expect(state.direction).toBe(90)
    expect(state.size).toBe(100)
    expect(state.visible).toBe(true)
  })

  it('returns a fresh object on every call', () => {
    const a = createSpriteState()
    const b = createSpriteState()
    expect(a).not.toBe(b)
  })
})

describe('compare', () => {
  describe('numeric comparison', () => {
    it('returns true for equals when numbers match', () => {
      expect(compare(50, 'equals', 50)).toBe(true)
    })

    it('returns false for equals when numbers differ', () => {
      expect(compare(50, 'equals', 49)).toBe(false)
    })

    it('returns true for greater_than when a > e', () => {
      expect(compare(51, 'greater_than', 50)).toBe(true)
    })

    it('returns false for greater_than when a === e', () => {
      expect(compare(50, 'greater_than', 50)).toBe(false)
    })

    it('returns true for less_than when a < e', () => {
      expect(compare(49, 'less_than', 50)).toBe(true)
    })

    it('returns false for less_than when a > e', () => {
      expect(compare(51, 'less_than', 50)).toBe(false)
    })

    it('coerces string numbers to numeric comparison', () => {
      expect(compare('100', 'equals', 100)).toBe(true)
      expect(compare(100, 'greater_than', '99')).toBe(true)
    })
  })

  describe('string comparison', () => {
    it('returns true for equals when strings match', () => {
      expect(compare('hello', 'equals', 'hello')).toBe(true)
    })

    it('returns false for equals when strings differ', () => {
      expect(compare('hello', 'equals', 'world')).toBe(false)
    })

    it('falls back to string comparison when one value is non-numeric', () => {
      expect(compare('abc', 'greater_than', 'def')).toBe(false)
    })
  })
})

describe('evaluateScratchCheck', () => {
  describe('block_used', () => {
    it('returns true when the opcode is present in the workspace', () => {
      const ws = makeWorkspace(['motion_movesteps', 'looks_say'])
      const check = { type: 'block_used', opcode: 'motion_movesteps' }
      expect(evaluateScratchCheck(check, ws, null)).toBe(true)
    })

    it('returns false when the opcode is absent', () => {
      const ws = makeWorkspace(['looks_say'])
      const check = { type: 'block_used', opcode: 'motion_movesteps' }
      expect(evaluateScratchCheck(check, ws, null)).toBe(false)
    })

    it('returns false when workspace is null', () => {
      const check = { type: 'block_used', opcode: 'motion_movesteps' }
      expect(evaluateScratchCheck(check, null, null)).toBe(false)
    })
  })

  describe('sprite_property', () => {
    it('returns true when the property satisfies the operator', () => {
      const state = { x: 100, y: 0, size: 100 }
      const check = { type: 'sprite_property', property: 'x', operator: 'greater_than', value: 50 }
      expect(evaluateScratchCheck(check, null, state)).toBe(true)
    })

    it('returns false when the condition is not met', () => {
      const state = { x: 30, y: 0, size: 100 }
      const check = { type: 'sprite_property', property: 'x', operator: 'greater_than', value: 50 }
      expect(evaluateScratchCheck(check, null, state)).toBe(false)
    })

    it('returns false when spriteState is null', () => {
      const check = { type: 'sprite_property', property: 'x', operator: 'equals', value: 0 }
      expect(evaluateScratchCheck(check, null, null)).toBe(false)
    })
  })

  describe('variable_equals', () => {
    it('returns true when the variable equals the expected value', () => {
      const check = { type: 'variable_equals', variableName: 'score', value: 10 }
      const runState = { variables: { score: 10 } }
      expect(evaluateScratchCheck(check, null, null, runState)).toBe(true)
    })

    it('returns false when the variable has a different value', () => {
      const check = { type: 'variable_equals', variableName: 'score', value: 10 }
      const runState = { variables: { score: 5 } }
      expect(evaluateScratchCheck(check, null, null, runState)).toBe(false)
    })

    it('falls back to "score" when variableName is missing', () => {
      const check = { type: 'variable_equals', value: 10 }
      const runState = { variables: { score: 10 } }
      expect(evaluateScratchCheck(check, null, null, runState)).toBe(true)
    })

    it('returns false when runState is null', () => {
      const check = { type: 'variable_equals', variableName: 'score', value: 0 }
      expect(evaluateScratchCheck(check, null, null, null)).toBe(false)
    })
  })

  describe('unknown type', () => {
    it('returns false', () => {
      const check = { type: 'unknown_type' }
      expect(evaluateScratchCheck(check, null, null)).toBe(false)
    })
  })

  describe('null/missing check', () => {
    it('returns false when check is null', () => {
      expect(evaluateScratchCheck(null, null, null)).toBe(false)
    })

    it('returns false when check.type is missing', () => {
      expect(evaluateScratchCheck({}, null, null)).toBe(false)
    })
  })
})
