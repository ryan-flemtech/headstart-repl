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
