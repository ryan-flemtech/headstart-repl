export const SPRITE_PRESETS_PATH = 'scratch-assets/sprites.json'

const BLANK_SPRITE = {
  type: 'cat',
  x: 0,
  y: 0,
  size: 100,
  direction: 90,
}

function cloneSpriteDefinition(sprite) {
  return JSON.parse(JSON.stringify(sprite))
}

function nextSpriteId(sprites) {
  const usedIds = new Set(sprites.map(sprite => sprite.id))
  let number = 1
  while (usedIds.has(`sprite${number}`)) number += 1
  return `sprite${number}`
}

function uniqueName(name, sprites) {
  const usedNames = new Set(sprites.map(sprite => sprite.name))
  if (!usedNames.has(name)) return name
  let number = 2
  while (usedNames.has(`${name} ${number}`)) number += 1
  return `${name} ${number}`
}

export function normalizeSpritePresets(data) {
  if (!Array.isArray(data)) return []
  return data.filter(preset => (
    preset
    && typeof preset.id === 'string'
    && typeof preset.name === 'string'
    && preset.name.trim() !== ''
  ))
}

export function createSpriteFromPreset(sprites, preset = null) {
  const id = nextSpriteId(sprites)
  const source = preset
    ? cloneSpriteDefinition(preset)
    : { ...BLANK_SPRITE, name: `Sprite ${id.replace('sprite', '')}` }
  delete source.id
  return {
    ...source,
    id,
    name: uniqueName(source.name, sprites),
  }
}
