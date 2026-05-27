import { describe, expect, it } from 'vitest'
import { createSpriteFromPreset, normalizeSpritePresets } from '../spritePresets'

describe('normalizeSpritePresets', () => {
  it('keeps named preset definitions with stable catalogue ids', () => {
    const presets = normalizeSpritePresets([
      { id: 'rocket', name: 'Rocket', type: 'arrow' },
      { id: 2, name: 'Invalid' },
      { id: 'empty-name', name: '' },
    ])

    expect(presets).toEqual([{ id: 'rocket', name: 'Rocket', type: 'arrow' }])
  })
})

describe('createSpriteFromPreset', () => {
  it('copies the public definition into a new uniquely identified sprite', () => {
    const preset = {
      id: 'cat',
      name: 'Cat',
      type: 'cat',
      rotationStyle: 'left-right',
      costumes: [{ name: 'walking', image: 'sprites/cat.png' }],
    }

    const sprite = createSpriteFromPreset([{ id: 'sprite1', name: 'Cat' }], preset)

    expect(sprite).toEqual({
      id: 'sprite2',
      name: 'Cat 2',
      type: 'cat',
      rotationStyle: 'left-right',
      costumes: [{ name: 'walking', image: 'sprites/cat.png' }],
    })
    expect(sprite.costumes).not.toBe(preset.costumes)
  })

  it('fills the first free sprite id when a prior sprite was removed', () => {
    const sprite = createSpriteFromPreset([
      { id: 'sprite1', name: 'Sprite' },
      { id: 'sprite3', name: 'Sprite 3' },
    ])

    expect(sprite.id).toBe('sprite2')
    expect(sprite.name).toBe('Sprite 2')
  })
})
