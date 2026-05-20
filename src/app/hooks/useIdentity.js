import { useState, useEffect } from 'react'

const STORAGE_KEY = 'headstart_identity'

function generateId() {
  return crypto.randomUUID()
}

/**
 * Manages the student's anonymous ID, display name, and session timestamp.
 * The anonymous ID never changes once created (unless the student clears storage).
 * The display name and session timestamp can be updated independently.
 */
export function useIdentity() {
  const [identity, setIdentity] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        setIdentity(JSON.parse(raw))
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    setLoaded(true)
  }, [])

  function save(id) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(id))
    setIdentity(id)
  }

  /** Create a fresh identity (new session or first ever visit). */
  function createIdentity(displayName, sessionTimestamp) {
    const id = {
      anonymousId:          generateId(),
      displayName,
      lastSessionTimestamp: sessionTimestamp,
    }
    save(id)
    return id
  }

  /** Update only the session timestamp (called after joining an existing session). */
  function updateTimestamp(sessionTimestamp) {
    if (!identity) return
    const updated = { ...identity, lastSessionTimestamp: sessionTimestamp }
    save(updated)
  }

  /** Update only the display name (teacher rename). */
  function updateDisplayName(displayName) {
    if (!identity) return
    const updated = { ...identity, displayName }
    save(updated)
  }

  return { identity, loaded, createIdentity, updateTimestamp, updateDisplayName }
}
