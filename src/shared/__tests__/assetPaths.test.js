import { describe, expect, it } from 'vitest'
import { resolveAssetsPath } from '../assetPaths'

describe('resolveAssetsPath', () => {
  it('returns no URL for an unset lesson asset path', () => {
    expect(resolveAssetsPath('', { baseUrl: '/editor/', origin: 'https://classroom.test' })).toBe('')
  })

  it('preserves separators while URL-encoding path segments', () => {
    expect(resolveAssetsPath('/assets/my lesson/icon #1.png/', {
      baseUrl: '/editor/',
      origin: 'https://classroom.test',
    })).toBe('https://classroom.test/editor/assets/my%20lesson/icon%20%231.png/')
  })
})
