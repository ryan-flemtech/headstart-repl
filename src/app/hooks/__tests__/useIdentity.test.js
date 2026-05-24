import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useIdentity } from '../useIdentity'

const STORAGE_KEY = 'headstart_identity'

describe('useIdentity', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loaded becomes true and identity stays null when localStorage is empty', async () => {
    const { result } = renderHook(() => useIdentity())

    // In the jsdom/Vitest environment effects flush synchronously during render,
    // so loaded may already be true on the first render.  waitFor covers both cases.
    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    expect(result.current.identity).toBe(null)
  })

  it('reads an existing identity from localStorage on mount', async () => {
    const stored = {
      anonymousId: 'existing-id',
      displayName: 'Alice',
      lastSessionTimestamp: 1000,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))

    const { result } = renderHook(() => useIdentity())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    expect(result.current.identity).toEqual(stored)
  })

  it('createIdentity writes a new identity to localStorage and updates state', async () => {
    const { result } = renderHook(() => useIdentity())

    await waitFor(() => expect(result.current.loaded).toBe(true))

    let created
    act(() => {
      created = result.current.createIdentity('Bob', 5000)
    })

    expect(created).toMatchObject({
      displayName: 'Bob',
      lastSessionTimestamp: 5000,
    })
    expect(typeof created.anonymousId).toBe('string')
    expect(created.anonymousId.length).toBeGreaterThan(0)

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored).toEqual(created)
  })

  it('hook returns the identity on subsequent renders after createIdentity', async () => {
    const { result } = renderHook(() => useIdentity())

    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      result.current.createIdentity('Charlie', 9999)
    })

    expect(result.current.identity).toMatchObject({
      displayName: 'Charlie',
      lastSessionTimestamp: 9999,
    })
  })

  it('updateTimestamp updates only the lastSessionTimestamp in state and localStorage', async () => {
    const { result } = renderHook(() => useIdentity())

    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      result.current.createIdentity('Dana', 1000)
    })

    const originalId = result.current.identity.anonymousId

    act(() => {
      result.current.updateTimestamp(2000)
    })

    expect(result.current.identity.lastSessionTimestamp).toBe(2000)
    expect(result.current.identity.displayName).toBe('Dana')
    expect(result.current.identity.anonymousId).toBe(originalId)

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored.lastSessionTimestamp).toBe(2000)
  })

  it('updateTimestamp does nothing when identity is null', async () => {
    const { result } = renderHook(() => useIdentity())

    await waitFor(() => expect(result.current.loaded).toBe(true))

    // identity is null at this point — calling updateTimestamp should not throw
    act(() => {
      result.current.updateTimestamp(9999)
    })

    expect(result.current.identity).toBe(null)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(null)
  })

  it('updateDisplayName updates only the displayName in state and localStorage', async () => {
    const { result } = renderHook(() => useIdentity())

    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      result.current.createIdentity('Eve', 3000)
    })

    const originalId = result.current.identity.anonymousId

    act(() => {
      result.current.updateDisplayName('Evelyn')
    })

    expect(result.current.identity.displayName).toBe('Evelyn')
    expect(result.current.identity.lastSessionTimestamp).toBe(3000)
    expect(result.current.identity.anonymousId).toBe(originalId)

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored.displayName).toBe('Evelyn')
  })

  it('updateDisplayName does nothing when identity is null', async () => {
    const { result } = renderHook(() => useIdentity())

    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      result.current.updateDisplayName('Ghost')
    })

    expect(result.current.identity).toBe(null)
  })

  it('handles corrupted localStorage JSON gracefully without throwing', async () => {
    localStorage.setItem(STORAGE_KEY, 'this is { not valid JSON !!!')

    const { result } = renderHook(() => useIdentity())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    // Corrupted entry should be removed and identity stays null
    expect(result.current.identity).toBe(null)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(null)
  })
})
