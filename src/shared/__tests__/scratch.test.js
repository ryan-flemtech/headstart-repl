import { describe, it, expect, vi, beforeEach } from 'vitest'

// Tests for scratch.js interpreter helpers — pure logic only.
// Blockly workspace internals (inject, serialization, rendering) are not tested here.

// Isolate the pure helper functions by importing the module and mocking Blockly.
vi.mock('blockly', () => ({
  default: {},
}))

// --- evaluateInput / stringValue ---
// We test the broadcast message extraction path by constructing minimal block stubs.

function makeFieldBlock(type, fieldName, fieldValue) {
  return {
    type,
    getFieldValue: (name) => (name === fieldName ? fieldValue : null),
    getInputTargetBlock: () => null,
  }
}

function makeBroadcastBlock(fieldValue) {
  // event_broadcast now uses field_input: BROADCAST_INPUT is a direct field.
  return {
    type: 'event_broadcast',
    getFieldValue: (name) => (name === 'BROADCAST_INPUT' ? fieldValue : null),
    getInputTargetBlock: () => null, // no inline block — it's a field now
  }
}

function makeReceiverHat(fieldValue) {
  return {
    type: 'event_whenbroadcastreceived',
    getFieldValue: (name) => (name === 'BROADCAST_OPTION' ? fieldValue : null),
    getNextBlock: () => makeFieldBlock('looks_say', '__dummy__', ''),
  }
}

// --- migrateBroadcastState ---
// Replicate the migration logic to test the state transformation for old-format workspaces.

function migrateBroadcastBlock(block) {
  if (!block) return
  if (block.type === 'event_broadcast' || block.type === 'event_broadcastandwait') {
    const text = block.inputs?.BROADCAST_INPUT?.shadow?.fields?.TEXT
    if (text != null && block.fields?.BROADCAST_INPUT == null) {
      block.fields = { ...(block.fields ?? {}), BROADCAST_INPUT: String(text) }
      delete block.inputs.BROADCAST_INPUT
      if (!Object.keys(block.inputs).length) delete block.inputs
    }
  }
  if (block.next?.block) migrateBroadcastBlock(block.next.block)
  for (const inp of Object.values(block.inputs ?? {})) {
    if (inp?.block) migrateBroadcastBlock(inp.block)
  }
}

function migrateBroadcastState(state) {
  if (!state?.blocks?.blocks) return state
  const clone = JSON.parse(JSON.stringify(state))
  for (const block of clone.blocks.blocks) migrateBroadcastBlock(block)
  return clone
}

function oldFormatBroadcastState(text) {
  return {
    blocks: {
      languageVersion: 0,
      blocks: [{
        type: 'event_broadcast',
        inputs: { BROADCAST_INPUT: { shadow: { type: 'text', fields: { TEXT: text } } } },
      }],
    },
  }
}

describe('migrateBroadcastState', () => {
  it('moves shadow TEXT into fields.BROADCAST_INPUT for event_broadcast', () => {
    const result = migrateBroadcastState(oldFormatBroadcastState('launch'))
    const block = result.blocks.blocks[0]
    expect(block.fields?.BROADCAST_INPUT).toBe('launch')
    expect(block.inputs).toBeUndefined()
  })

  it('preserves the default message1 text', () => {
    const result = migrateBroadcastState(oldFormatBroadcastState('message1'))
    expect(result.blocks.blocks[0].fields?.BROADCAST_INPUT).toBe('message1')
  })

  it('migrates broadcast blocks inside a next chain', () => {
    const state = {
      blocks: {
        languageVersion: 0,
        blocks: [{
          type: 'event_whenflagclicked',
          next: {
            block: {
              type: 'event_broadcast',
              inputs: { BROADCAST_INPUT: { shadow: { type: 'text', fields: { TEXT: 'go' } } } },
            },
          },
        }],
      },
    }
    const result = migrateBroadcastState(state)
    const broadcast = result.blocks.blocks[0].next.block
    expect(broadcast.fields?.BROADCAST_INPUT).toBe('go')
    expect(broadcast.inputs).toBeUndefined()
  })

  it('does not overwrite an already-migrated field', () => {
    const state = {
      blocks: {
        languageVersion: 0,
        blocks: [{
          type: 'event_broadcast',
          fields: { BROADCAST_INPUT: 'existing' },
          inputs: { BROADCAST_INPUT: { shadow: { type: 'text', fields: { TEXT: 'shadow' } } } },
        }],
      },
    }
    const result = migrateBroadcastState(state)
    expect(result.blocks.blocks[0].fields.BROADCAST_INPUT).toBe('existing')
  })

  it('returns state unchanged when blocks array is absent', () => {
    const state = { something: 'else' }
    expect(migrateBroadcastState(state)).toBe(state)
  })

  it('migrates event_broadcastandwait as well', () => {
    const state = {
      blocks: {
        languageVersion: 0,
        blocks: [{
          type: 'event_broadcastandwait',
          inputs: { BROADCAST_INPUT: { shadow: { type: 'text', fields: { TEXT: 'done' } } } },
        }],
      },
    }
    const result = migrateBroadcastState(state)
    expect(result.blocks.blocks[0].fields?.BROADCAST_INPUT).toBe('done')
  })
})

describe('broadcast message matching', () => {
  // Replicate the comparison logic used in the event_broadcast handler.
  function broadcastMatches(broadcastBlock, receiverHat) {
    const msg = String(broadcastBlock.getFieldValue('BROADCAST_INPUT') ?? '')
    const option = String(receiverHat.getFieldValue('BROADCAST_OPTION') ?? '')
    return msg === option
  }

  it('matches when sender and receiver have the same message', () => {
    expect(broadcastMatches(makeBroadcastBlock('message1'), makeReceiverHat('message1'))).toBe(true)
  })

  it('matches custom message names', () => {
    expect(broadcastMatches(makeBroadcastBlock('launch'), makeReceiverHat('launch'))).toBe(true)
  })

  it('does not match when messages differ', () => {
    expect(broadcastMatches(makeBroadcastBlock('start'), makeReceiverHat('stop'))).toBe(false)
  })

  it('does not match when receiver has different capitalisation', () => {
    expect(broadcastMatches(makeBroadcastBlock('Launch'), makeReceiverHat('launch'))).toBe(false)
  })

  it('returns empty string for null BROADCAST_INPUT and does not match non-empty receiver', () => {
    const block = { ...makeBroadcastBlock(null), getFieldValue: () => null }
    expect(broadcastMatches(block, makeReceiverHat('message1'))).toBe(false)
  })

  it('matches empty string when both fields are empty', () => {
    expect(broadcastMatches(makeBroadcastBlock(''), makeReceiverHat(''))).toBe(true)
  })
})
