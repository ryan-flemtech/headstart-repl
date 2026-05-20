import { useState, useEffect, useRef } from 'react'
import { ref, onValue, set, update, remove, serverTimestamp, onDisconnect } from 'firebase/database'
import { db } from '../../shared/firebase'

// Firebase keys cannot contain dots — encode/decode file names like "index.html"
function encodeFileKeys(files) {
  return Object.fromEntries(
    Object.entries(files).map(([k, v]) => [k.replace(/\./g, '__dot__'), v])
  )
}

export function decodeFileKey(key) {
  return key.replace(/__dot__/g, '.')
}

/**
 * Subscribes to a Firebase session and exposes helpers for reading/writing state.
 * Used by both the teacher view and the student view.
 */
export function useSession(lessonId) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(null)
  const sessionRef = useRef(null)

  useEffect(() => {
    const connRef = ref(db, '.info/connected')
    const unsub = onValue(connRef, snap => setConnected(snap.val() === true))
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!lessonId) return
    const r = ref(db, `sessions/${lessonId}`)
    sessionRef.current = r

    const unsub = onValue(r, snap => {
      setSession(snap.exists() ? snap.val() : null)
      setLoading(false)
    })

    return () => unsub()
  }, [lessonId])

  // ─── Teacher helpers ──────────────────────────────────────────────────────

  async function createSession() {
    await set(ref(db, `sessions/${lessonId}`), {
      lessonId,
      state:              'waiting',
      currentTaskId:      1,
      createdAt:          Date.now(),
      activeStudentView:  null,
      sandboxCode:        null,
      sandboxCodePushedAt: null,
      students:           {},
    })
  }

  async function startSession() {
    await update(ref(db, `sessions/${lessonId}`), { state: 'active' })
  }

  async function endSession() {
    await update(ref(db, `sessions/${lessonId}`), {
      state:              'ended',
      activeStudentView:  null,
      sandboxCode:        null,
      sandboxCodePushedAt: null,
      students:           null,
    })
    // When the teacher closes the tab, remove the session entirely so the
    // lesson becomes available for solo study without a stale "ended" record.
    onDisconnect(ref(db, `sessions/${lessonId}`)).remove()
  }

  async function setTaskId(taskId) {
    const updates = { currentTaskId: taskId }
    for (const anonymousId of Object.keys(session?.students ?? {})) {
      updates[`students/${anonymousId}/checkPassed`]    = false
      updates[`students/${anonymousId}/lastRunStatus`]  = null
      updates[`students/${anonymousId}/currentOutput`]  = ''
      updates[`students/${anonymousId}/currentCode`]    = ''
      updates[`students/${anonymousId}/currentFiles`]   = null
    }
    await update(ref(db, `sessions/${lessonId}`), updates)
  }

  async function enterSandbox() {
    await update(ref(db, `sessions/${lessonId}`), { state: 'sandbox' })
  }

  async function exitSandbox() {
    await update(ref(db, `sessions/${lessonId}`), {
      state:              'active',
      sandboxCode:        null,
      sandboxCodePushedAt: null,
    })
  }

  async function pushSandboxCode(code) {
    await update(ref(db, `sessions/${lessonId}`), {
      sandboxCode:        code,
      sandboxCodePushedAt: Date.now(),
    })
  }

  async function setActiveStudentView(anonymousId) {
    const r2 = ref(db, `sessions/${lessonId}/activeStudentView`)
    await set(r2, anonymousId || null)
    if (anonymousId) {
      // Clear on unexpected disconnect
      onDisconnect(r2).set(null)
    }
  }

  async function renameStudent(anonymousId, newName) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/displayName`), newName)
  }

  async function removeStudent(anonymousId) {
    if (session?.activeStudentView === anonymousId) {
      await set(ref(db, `sessions/${lessonId}/activeStudentView`), null)
    }
    await remove(ref(db, `sessions/${lessonId}/students/${anonymousId}`))
  }

  // ─── Student helpers ──────────────────────────────────────────────────────

  async function registerPresence(anonymousId) {
    const presenceRef = ref(db, `sessions/${lessonId}/students/${anonymousId}/online`)
    await set(presenceRef, true)
    onDisconnect(presenceRef).remove()
  }

  async function joinSession(anonymousId, displayName) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      displayName,
      joinedAt:      Date.now(),
      currentCode:   '',
      currentOutput: '',
      lastRunStatus: null,
      checkPassed:   false,
      lastRunAt:     null,
    })
  }

  async function writeStudentRun(anonymousId, { code, files, output, status, checkPassed }) {
    const updates = {
      lastRunStatus: status,
      checkPassed:   checkPassed ?? false,
      lastRunAt:     Date.now(),
    }
    if (code  != null) updates.currentCode   = code
    if (files != null) updates.currentFiles  = encodeFileKeys(files)
    if (output != null) updates.currentOutput = output
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), updates)
  }

  async function writeStudentCode(anonymousId, code) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/currentCode`), code)
  }

  async function writeStudentFiles(anonymousId, files) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/currentFiles`), encodeFileKeys(files))
  }

  async function writeStudentOutput(anonymousId, output) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/currentOutput`), output)
  }

  return {
    session,
    loading,
    connected,
    // teacher
    createSession, startSession, endSession,
    setTaskId, enterSandbox, exitSandbox, pushSandboxCode,
    setActiveStudentView, renameStudent, removeStudent,
    // student
    registerPresence, joinSession, writeStudentRun, writeStudentCode, writeStudentFiles, writeStudentOutput,
  }
}
