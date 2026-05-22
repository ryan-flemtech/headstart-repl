import React, { useEffect, useLayoutEffect, useState, useRef } from 'react'
import { useIsMobile } from '../../shared/useIsMobile'
import { useSession, decodeFileKey } from '../hooks/useSession'
import { useIdentity } from '../hooks/useIdentity'
import { initPyodide, runPython, stopPython, provideInput, isPyodideReady } from '../../shared/pyodide'
import { buildIframeSrc, waitForIframeText } from '../../shared/iframe'
import { evaluateCheck, evaluateCheckWithCode } from '../../shared/checks'
import TopBar from '../components/TopBar'
import NameEntry from '../components/NameEntry'
import WaitingRoom from '../components/WaitingRoom'
import TaskProgressDots from '../components/TaskProgressDots'
import ExplainerPanel from '../components/ExplainerPanel'
import PythonEditor from '../components/PythonEditor'
import HtmlEditor from '../components/HtmlEditor'
import OutputPanel from '../components/OutputPanel'
import CollapsibleIframePreview from '../components/CollapsibleIframePreview'
import ScratchWorkspace from '../components/ScratchWorkspace'
import QuizTask from '../components/QuizTask'
import CheckFeedbackBanner from '../components/CheckFeedbackBanner'
import SplitPane from '../../shared/SplitPane'

// Returns a full absolute URL for the assets base so blob-URL iframes can load
// resources without ambiguity (root-relative paths don't resolve in blob docs).
function resolveAssetsPath(rawPath) {
  if (!rawPath) return ''
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const encoded = rawPath.split('/').map(s => (s ? encodeURIComponent(s) : s)).join('/')
  return window.location.origin + base + encoded
}

const LS_KEY = (lessonId, taskId, anonymousId) =>
  `headstart_${lessonId}_${taskId}_${anonymousId}`
const LS_FILE_KEY = (lessonId, taskId, filename, anonymousId) =>
  `headstart_${lessonId}_${taskId}_${filename}_${anonymousId}`

function loadSavedCode(lessonId, taskId, anonymousId) {
  const raw = localStorage.getItem(LS_KEY(lessonId, taskId, anonymousId))
  return raw ? JSON.parse(raw) : null
}
function saveCode(lessonId, taskId, anonymousId, data) {
  localStorage.setItem(LS_KEY(lessonId, taskId, anonymousId), JSON.stringify(data))
}
function loadSavedFile(lessonId, taskId, filename, anonymousId) {
  const raw = localStorage.getItem(LS_FILE_KEY(lessonId, taskId, filename, anonymousId))
  return raw ? JSON.parse(raw).content : null
}
function saveFile(lessonId, taskId, filename, anonymousId, content) {
  localStorage.setItem(LS_FILE_KEY(lessonId, taskId, filename, anonymousId), JSON.stringify({ content }))
}

const TASK_TRANSITION_MS = 380

function TaskSlideTransition({ transitionKey, children, style }) {
  const previousRenderRef = useRef({ key: transitionKey, children })
  const [leavingRender, setLeavingRender] = useState(null)

  useLayoutEffect(() => {
    if (previousRenderRef.current.key === transitionKey) return undefined

    setLeavingRender(previousRenderRef.current)
    previousRenderRef.current = { key: transitionKey, children }

    const timeoutId = window.setTimeout(() => {
      setLeavingRender(null)
    }, TASK_TRANSITION_MS)

    return () => window.clearTimeout(timeoutId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transitionKey])

  useEffect(() => {
    if (!leavingRender && previousRenderRef.current.key === transitionKey) {
      previousRenderRef.current = { key: transitionKey, children }
    }
  }, [transitionKey, children, leavingRender])

  return (
    <div className="task-slide-viewport" style={{ ...style, overflow: leavingRender ? 'hidden' : style?.overflow }}>
      {leavingRender && (
        <div
          key={`leaving-${leavingRender.key}`}
          className="task-slide-panel task-slide-panel--leaving"
          aria-hidden="true"
        >
          {leavingRender.children}
        </div>
      )}
      <div
        key={`entering-${transitionKey}`}
        className="task-slide-panel task-slide-panel--entering"
      >
        {children}
      </div>
    </div>
  )
}

export default function StudentView({ lessonId, soloMode = false }) {
  const { session, loading: sessionLoading, registerPresence, joinSession, writeStudentRun, writeStudentCode, writeStudentFiles, writeStudentOutput } = useSession(lessonId)
  const { identity, loaded: identityLoaded, createIdentity, updateTimestamp, updateDisplayName } = useIdentity()

  const [lesson, setLesson]             = useState(null)
  const [lessonLoading, setLessonLoading] = useState(true)
  const [phase, setPhase]               = useState('loading') // loading | waiting | name-entry | lesson | sandbox | solo | ended
  const [currentTaskId, setCurrentTaskId] = useState(1)
  const [viewingTaskId, setViewingTaskId] = useState(null) // null = current task
  const [code, setCode]                 = useState('')
  const [files, setFiles]               = useState([])
  const [activeFile, setActiveFile]     = useState('')
  const [output, setOutput]             = useState('')
  const [runStatus, setRunStatus]       = useState(null)
  const [running, setRunning]           = useState(false)
  const [pyodideStatus, setPyodideStatus] = useState('idle') // idle | loading | ready
  const [iframeSrc, setIframeSrc]         = useState(null)
  const [htmlPreviewCollapsed, setHtmlPreviewCollapsed] = useState(true)
  const [inputPrompt, setInputPrompt]     = useState(null)
  const [checkPassed, setCheckPassed]     = useState(false)
  const [checkAttempted, setCheckAttempted] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [scratchSandboxProject, setScratchSandboxProject] = useState(null)
  const [scratchExternalState, setScratchExternalState] = useState(null)
  const isMobile = useIsMobile()
  const iframeRef = useRef(null)
  const appendOutputRef = useRef(null)
  const identityRef = useRef(identity)
  identityRef.current = identity
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  // Live refs so the session-end effect can read current editor state without stale closures
  const codeRef = useRef(code)
  codeRef.current = code
  const filesRef = useRef(files)
  filesRef.current = files
  const outputRef = useRef(output)
  outputRef.current = output
  const runStatusRef = useRef(runStatus)
  runStatusRef.current = runStatus
  const currentTaskIdRef = useRef(currentTaskId)
  currentTaskIdRef.current = currentTaskId
  const lessonRef = useRef(lesson)
  lessonRef.current = lesson
  const activeStudentViewRef = useRef(session?.activeStudentView)
  activeStudentViewRef.current = session?.activeStudentView

  function saveCurrentWorkSnapshot() {
    const id = identityRef.current
    const currentLesson = lessonRef.current
    const taskId = currentTaskIdRef.current
    if (!id || !currentLesson) return

    const task = currentLesson.tasks?.find(t => t.id === taskId)
    if (task?.taskType === 'quiz') return

    if (currentLesson.type === 'python') {
      saveCode(lessonId, taskId, id.anonymousId, {
        code: codeRef.current,
        output: outputRef.current,
        runStatus: runStatusRef.current,
      })
    } else if (currentLesson.type === 'html') {
      filesRef.current.forEach(f => saveFile(lessonId, taskId, f.name, id.anonymousId, f.content))
    }
    // Scratch: blocks are saved immediately in handleScratchChange — no snapshot needed
  }

  // Load lesson JSON
  useEffect(() => {
    const base = import.meta.env.BASE_URL
    fetch(`${base}lessons/${lessonId}.json`)
      .then(r => r.json())
      .then(data => { setLesson(data); setLessonLoading(false) })
      .catch(() => setLessonLoading(false))
  }, [lessonId])

  useEffect(() => {
    if (lesson?.type === 'html') setHtmlPreviewCollapsed(true)
  }, [lesson?.type, currentTaskId])

  // Warm up Pyodide for Python lessons
  useEffect(() => {
    if (!lesson || lesson.type !== 'python' || isPyodideReady()) return
    setPyodideStatus('loading')
    initPyodide(msg => setPyodideStatus(msg))
      .then(() => setPyodideStatus('ready'))
      .catch(() => setPyodideStatus('error'))
  }, [lesson])

  // Determine phase once session + identity are loaded
  useEffect(() => {
    if ((!soloMode && sessionLoading) || !identityLoaded || lessonLoading) return

    // No session — go straight to solo or waiting depending on URL mode
    if (!session) {
      if (phaseRef.current === 'lesson' || phaseRef.current === 'sandbox') {
        saveCurrentWorkSnapshot()
        setPhase('ended')
        return
      }
      if (phaseRef.current === 'join-choice' || phaseRef.current === 'name-entry' || phaseRef.current === 'waiting') {
        if (soloMode) { if (!identity) createIdentity('Solo', Date.now()); setPhase('solo') }
        else setPhase('waiting')
        return
      }
      if (phaseRef.current === 'loading') {
        if (soloMode) { if (!identity) createIdentity('Solo', Date.now()); setPhase('solo') }
        else setPhase('waiting')
        return
      }
      // Already solo — stay solo
      if (!identity) createIdentity('Solo', Date.now())
      setPhase('solo')
      return
    }

    // Session ended — exit any join flow gracefully
    if (session.state === 'ended') {
      if (phaseRef.current === 'lesson' || phaseRef.current === 'sandbox') {
        saveCurrentWorkSnapshot()
        setPhase('ended')
        return
      }
      if (phaseRef.current === 'loading' || phaseRef.current === 'join-choice') {
        if (soloMode) { if (!identity) createIdentity('Solo', Date.now()); setPhase('solo') }
        else setPhase('waiting')
        return
      }
      if (!identity) createIdentity('Solo', Date.now())
      setPhase('solo')
      return
    }

    // Verify the session belongs to this lesson before proceeding
    if (session.lessonId && session.lessonId !== lessonId) {
      if (!identity) createIdentity('Solo', Date.now())
      setPhase('solo')
      return
    }

    // Solo mode is URL-determined — stay in current phase when session state changes
    if (phaseRef.current === 'solo' || phaseRef.current === 'ended') return

    // Don't interrupt the student while they're entering their name
    if (phaseRef.current === 'name-entry') return

    if (session.state === 'waiting') {
      // Already in waiting room — check if they need to be prompted for name now
      if (phaseRef.current === 'waiting') {
        const alreadyRegistered = identity && identity.lastSessionTimestamp === session.createdAt
        if (!alreadyRegistered) setPhase('name-entry')
        return
      }
      // Fresh arrival in live mode → name entry
      if (soloMode) return
      setPhase('name-entry')
      return
    }

    // Session is active or sandbox
    const sessionTs = session.createdAt
    const isReturning = identity && identity.lastSessionTimestamp === sessionTs

    // Student was in the waiting room and the session just became active
    if (phaseRef.current === 'waiting') {
      if (isReturning) {
        if (session.state === 'sandbox') { setPhase('sandbox'); return }
        setCurrentTaskId(session.currentTaskId ?? 1)
        setPhase('lesson')
      } else {
        setPhase('name-entry')
      }
      return
    }

    if (!identity || !isReturning) {
      setPhase('name-entry')
      return
    }

    // Returning student — update timestamp and drop in
    updateTimestamp(sessionTs)

    if (session.state === 'sandbox') { setPhase('sandbox'); return }
    setCurrentTaskId(session.currentTaskId ?? 1)
    setPhase('lesson')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, identityLoaded, lessonLoading, session?.state, session?.createdAt, soloMode])

  // React to teacher moving to a new task
  useEffect(() => {
    if (!session?.currentTaskId || phase !== 'lesson') return
    if (session.currentTaskId !== currentTaskId) {
      saveCurrentWorkSnapshot()
      setCurrentTaskId(session.currentTaskId)
      setViewingTaskId(null)
      setOutput('')
      setRunStatus(null)
      setCheckPassed(false)
      setCheckAttempted(false)
      setSelectedAnswer('')
      loadTaskContent(session.currentTaskId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.currentTaskId])

  // React to sandbox code pushes (Python)
  useEffect(() => {
    if (phase !== 'sandbox' || lesson?.type !== 'python' || !session?.sandboxCode) return
    setCode(session.sandboxCode)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, session?.sandboxCodePushedAt])

  // React to sandbox block pushes (Scratch)
  useEffect(() => {
    if (phase !== 'sandbox' || lesson?.type !== 'scratch' || !session?.sandboxCode) return
    try {
      // sandboxCode is a JSON string of the Blockly workspace state
      setScratchSandboxProject(JSON.parse(session.sandboxCode))
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, session?.sandboxCodePushedAt])

  // React to sandbox files pushes (HTML)
  useEffect(() => {
    if (phase !== 'sandbox' || lesson?.type !== 'html') return
    if (session?.sandboxFiles) {
      const decoded = Object.entries(session.sandboxFiles).map(([k, v]) => {
        const name = decodeFileKey(k)
        const type = name.endsWith('.html') ? 'html' : name.endsWith('.css') ? 'css' : 'js'
        return { name, content: v, type }
      })
      setFiles(decoded)
      if (decoded.length > 0) setActiveFile(decoded[0].name)
    } else if (lesson?.sandboxStarterFiles?.length > 0) {
      setFiles(lesson.sandboxStarterFiles)
      setActiveFile(lesson.sandboxStarterFiles[0].name)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, session?.sandboxFilesUpdatedAt])

  // React to teacher remotely resetting or completing this student's code
  const myStudentData = session?.students?.[identity?.anonymousId]
  useEffect(() => {
    if (!myStudentData?.remoteResetPushedAt || (phase !== 'lesson' && phase !== 'solo')) return
    const action = myStudentData.remoteResetAction
    const task = lesson?.tasks.find(t => t.id === currentTaskId)
    if (!task || !action) return

    if (lesson.type === 'python') {
      const target = action === 'starter' ? (task.starterCode ?? '') : (task.completeCode ?? '')
      setCode(target)
      setOutput('')
      setRunStatus(null)
      setCheckPassed(false)
      setCheckAttempted(false)
    } else if (lesson.type === 'html') {
      const targetFiles = action === 'starter' ? (task.starterFiles ?? []) : (task.completeFiles ?? [])
      setFiles(targetFiles.map(f => ({ ...f })))
      setActiveFile(task.entryFile ?? targetFiles[0]?.name ?? '')
      setIframeSrc(null)
      setRunStatus(null)
      setCheckPassed(false)
      setCheckAttempted(false)
    } else if (lesson.type === 'scratch') {
      const targetBlocks = action === 'starter' ? (task.starterBlocks ?? null) : (task.completeBlocks ?? null)
      setScratchExternalState(targetBlocks)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStudentData?.remoteResetPushedAt])

  // Sync teacher rename back to local identity so TopBar updates immediately
  useEffect(() => {
    if (!identity?.anonymousId || !session?.students) return
    const firebaseName = session.students[identity.anonymousId]?.displayName
    if (firebaseName && firebaseName !== identity.displayName) {
      updateDisplayName(firebaseName)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.students?.[identity?.anonymousId]?.displayName])

  function loadTaskContent(taskId) {
    if (!lesson || !identity) return
    const task = lesson.tasks.find(t => t.id === taskId)
    if (!task) return
    if (task.taskType === 'quiz') {
      setCode('')
      setFiles([])
      setActiveFile('')
      setSelectedAnswer('')
      setCheckAttempted(false)
      return
    }
    if (lesson.type === 'python') {
      // In solo mode, restore own saved work if available
      if (phase === 'solo') {
        const ownSaved = loadSavedCode(lessonId, taskId, identity.anonymousId)
        if (ownSaved != null) { setCode(ownSaved.code ?? ''); return }
      }
      // Carry-through > starterCode > empty
      let initial = task.starterCode ?? ''
      if (task.carryCodeFrom) {
        const saved = loadSavedCode(lessonId, task.carryCodeFrom, identity.anonymousId)
        if (saved?.code) initial = saved.code
      }
      setCode(initial)
    } else if (lesson.type === 'scratch') {
      setFiles([])
      setActiveFile('')
    } else {
      const taskFiles = (task.starterFiles ?? []).map(f => {
        // In solo mode, prefer own saved file for this task
        if (phase === 'solo') {
          const ownSaved = loadSavedFile(lessonId, taskId, f.name, identity.anonymousId)
          if (ownSaved != null) return { ...f, content: ownSaved }
        }
        let content = f.content
        if (task.carryCodeFrom) {
          const saved = loadSavedFile(lessonId, task.carryCodeFrom, f.name, identity.anonymousId)
          if (saved != null) content = saved
        }
        return { ...f, content }
      })
      setFiles(taskFiles)
      setActiveFile(task.entryFile ?? taskFiles[0]?.name ?? '')
    }
  }

  useEffect(() => {
    if ((phase === 'lesson' || phase === 'solo') && identity && lesson) {
      loadTaskContent(currentTaskId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentTaskId, lesson, identity])

  // Register Firebase presence so the teacher sees who is connected live
  useEffect(() => {
    if ((phase === 'lesson' || phase === 'sandbox') && identity?.anonymousId) {
      registerPresence(identity.anonymousId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, identity?.anonymousId])

  // When the teacher starts live-viewing this student, publish the current
  // in-memory editor state immediately so the modal is not blank until typing.
  useEffect(() => {
    if (!identity?.anonymousId || session?.activeStudentView !== identity.anonymousId) return
    if (phase !== 'lesson' && phase !== 'sandbox') return
    if (!lesson || viewingTaskId !== null) return

    if (lesson.type === 'python') {
      writeStudentCode(identity.anonymousId, code)
      writeStudentOutput(identity.anonymousId, output)
    } else if (lesson.type === 'html') {
      writeStudentFiles(identity.anonymousId, Object.fromEntries(files.map(f => [f.name, f.content])))
    } else if (lesson.type === 'scratch') {
      const saved = loadSavedCode(lessonId, currentTaskId, identity.anonymousId)
      if (saved?.state) writeStudentCode(identity.anonymousId, JSON.stringify(saved.state))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.activeStudentView])

  // ─── Event handlers ────────────────────────────────────────────────────────

  async function handleNameSubmit(displayName) {
    const sessionTs = session.createdAt
    const id = createIdentity(displayName, sessionTs)
    await joinSession(id.anonymousId, displayName)
    if (session.state === 'waiting') { setPhase('waiting'); return }
    if (session.state === 'sandbox') { setPhase('sandbox'); return }
    setCurrentTaskId(session.currentTaskId ?? 1)
    setPhase('lesson')
  }

  function handleWaitForTeacher() {
    if (session && session.state === 'waiting') {
      setPhase('name-entry')
    } else {
      // No session yet — go to waiting room; when session appears we'll prompt for name
      setPhase('waiting')
    }
  }

  function handleSoloNavigate(taskId) {
    if (!identity) return
    const currentTask = lesson?.tasks.find(t => t.id === currentTaskId)
    // Persist current editing state before leaving the task
    if (currentTask?.taskType === 'quiz') {
      // Quiz answers are not local editor work.
    } else if (lesson?.type === 'python') {
      saveCode(lessonId, currentTaskId, identity.anonymousId, { code, output, runStatus })
    } else if (lesson?.type === 'html') {
      files.forEach(f => saveFile(lessonId, currentTaskId, f.name, identity.anonymousId, f.content))
    }
    // scratch: blocks are saved incrementally via handleScratchChange
    setViewingTaskId(null)
    setOutput('')
    setRunStatus(null)
    setCheckPassed(false)
    setCheckAttempted(false)
    setSelectedAnswer('')
    setIframeSrc(null)
    setCurrentTaskId(taskId)
  }

  async function handleRun() {
    if (!identity || running) return
    const task = lesson?.tasks.find(t => t.id === currentTaskId)
    const isWatched = session?.activeStudentView === identity.anonymousId

    setRunning(true)
    setOutput('')
    setRunStatus(null)
    setCheckPassed(false)
    setCheckAttempted(false)

    if (lesson.type === 'python') {
      let accumulated = ''
      const echoOutput = (text) => {
        accumulated += text
        setOutput(accumulated)
        if (isWatched) writeStudentOutput(identity.anonymousId, accumulated)
      }
      appendOutputRef.current = echoOutput
      const result = await runPython(code, {
        onOutput: (text, _kind) => echoOutput(text),
        onInputRequired: (prompt) => setInputPrompt(prompt),
      })
      setInputPrompt(null)

      if (result.status === 'stopped') {
        setRunning(false)
        return
      }

      const status = result.status
      setRunStatus(status)

      const passed = evaluateCheck(task?.check, accumulated, { status, code })
      setCheckPassed(passed)
      setCheckAttempted(!!task?.check)

      saveCode(lessonId, currentTaskId, identity.anonymousId, { code, output: accumulated, runStatus: status })
      if (phase === 'lesson' || phase === 'sandbox' || isWatched) {
        await writeStudentRun(identity.anonymousId, { code, output: accumulated, status, checkPassed: passed })
      }
      setRunning(false)
      return
    }

    // HTML — build iframe
    setHtmlPreviewCollapsed(false)
    const src = buildIframeSrc(files, task?.entryFile ?? 'index.html', {
      assets: lesson.assets ?? [],
      assetsPath: resolveAssetsPath(lesson.assetsPath),
    })
    setIframeSrc(src)
    setRunStatus('success')

    // Wait for the iframe to report its body text via postMessage, then run checks
    waitForIframeText().then(text => {
      const codeStr = files.map(f => f.content).join('\n')
      const iframeDoc = iframeRef.current?.contentDocument ?? null
      const passed = evaluateCheck(task?.check, text, { code: codeStr, iframeDoc })
      setCheckPassed(passed)
      setCheckAttempted(!!task?.check)
      if (phase === 'lesson' || phase === 'sandbox' || isWatched) {
        const filesMap = Object.fromEntries(files.map(f => [f.name, f.content]))
        writeStudentRun(identity.anonymousId, { files: filesMap, status: 'success', checkPassed: passed })
      }
      files.forEach(f => saveFile(lessonId, currentTaskId, f.name, identity.anonymousId, f.content))
    })
    setRunning(false)
  }

  function handleStop() {
    stopPython()
  }

  function handleInputSubmit(value) {
    appendOutputRef.current?.(value + '\n')
    setInputPrompt(null)
    provideInput(value)
  }

  function handleCodeChange(newCode) {
    setCode(newCode)
    if (identity && lesson?.type === 'python') {
      saveCode(lessonId, currentTaskId, identity.anonymousId, { code: newCode, output, runStatus })
    }
    if (session?.activeStudentView === identity?.anonymousId) {
      writeStudentCode(identity.anonymousId, newCode)
    }
  }

  function handleFileChange(filename, content) {
    setFiles(prev => prev.map(f => f.name === filename ? { ...f, content } : f))
    if (identity && lesson?.type === 'html') {
      saveFile(lessonId, currentTaskId, filename, identity.anonymousId, content)
    }
    if (session?.activeStudentView === identity?.anonymousId) {
      const filesMap = Object.fromEntries(
        files.map(f => [f.name, f.name === filename ? content : f.content])
      )
      writeStudentFiles(identity.anonymousId, filesMap)
    }
  }

  function handleScratchChange(workspaceStates) {
    if (!identity) return
    saveCode(lessonId, currentTaskId, identity.anonymousId, { state: workspaceStates })
    if (activeStudentViewRef.current === identity.anonymousId) {
      writeStudentCode(identity.anonymousId, JSON.stringify(workspaceStates))
    }
  }

  function handleScratchCheck(passed, snapshot) {
    setCheckPassed(passed)
    setCheckAttempted(!!lesson?.tasks.find(t => t.id === currentTaskId)?.check)
    if (!identity || lesson?.type !== 'scratch') return
    if (phase === 'lesson' || phase === 'sandbox' || activeStudentViewRef.current === identity.anonymousId) {
      const states = snapshot?.workspaceStates ?? loadSavedCode(lessonId, currentTaskId, identity.anonymousId)?.state ?? null
      writeStudentRun(identity.anonymousId, {
        code: states ? JSON.stringify(states) : undefined,
        output: snapshot?.spriteStates ? JSON.stringify(snapshot.spriteStates) : undefined,
        status: 'success',
        checkPassed: passed,
      })
    }
  }

  function handleResetCode() {
    if (!window.confirm('Reset your code to the starter code? Your current work will be lost.')) return
    const task = lesson?.tasks.find(t => t.id === currentTaskId)
    if (lesson.type === 'python') {
      setCode(task?.starterCode ?? '')
      setOutput('')
      setRunStatus(null)
      setCheckPassed(false)
      setCheckAttempted(false)
    } else if (lesson.type === 'html') {
      const taskFiles = (task?.starterFiles ?? []).map(f => ({ ...f }))
      setFiles(taskFiles)
      setActiveFile(task?.entryFile ?? taskFiles[0]?.name ?? '')
      setIframeSrc(null)
      setRunStatus(null)
      setCheckPassed(false)
      setCheckAttempted(false)
    } else if (lesson.type === 'scratch') {
      setScratchExternalState(task?.starterBlocks ?? null)
    }
  }

  async function handleSubmit() {
    if (!identity) return
    const task = lesson?.tasks.find(t => t.id === currentTaskId)
    const isHtml = lesson?.type === 'html'
    const codeForCheck = isHtml ? files.map(f => f.content).join('\n') : code
    const passed = task?.check ? evaluateCheckWithCode(task.check, codeForCheck) : false
    setCheckPassed(passed)
    setCheckAttempted(!!task?.check)
    setRunStatus('submitted')
    if (isHtml) {
      files.forEach(f => saveFile(lessonId, currentTaskId, f.name, identity.anonymousId, f.content))
    } else {
      saveCode(lessonId, currentTaskId, identity.anonymousId, { code, output: '', runStatus: 'submitted' })
    }
    if (phase === 'lesson' || phase === 'sandbox') {
      const filesMap = isHtml ? Object.fromEntries(files.map(f => [f.name, f.content])) : undefined
      await writeStudentRun(identity.anonymousId, { code: isHtml ? undefined : code, files: filesMap, output: isHtml ? undefined : '', status: 'submitted', checkPassed: passed })
    }
  }

  async function handleQuizSelect(answer) {
    if (!identity || !answer) return
    const task = lesson?.tasks.find(t => t.id === currentTaskId)
    const passed = task?.check ? evaluateCheck(task.check, answer, { answer }) : false
    setSelectedAnswer(answer)
    setCheckPassed(passed)
    setCheckAttempted(!!task?.check)
    setRunStatus('submitted')
    if (phase === 'lesson' || phase === 'sandbox') {
      await writeStudentRun(identity.anonymousId, {
        answer,
        status: 'submitted',
        checkPassed: passed,
      })
    }
  }

  // ─── Render helpers ────────────────────────────────────────────────────────

  if (phase === 'loading' || sessionLoading || lessonLoading || !identityLoaded) {
    return <LoadingScreen message="Loading…" />
  }

  if (!lesson) {
    return <LoadingScreen message={`Lesson "${lessonId}" not found.`} />
  }

  function handleGoSolo() {
    createIdentity('Solo', Date.now())
    setPhase('solo')
  }

  if (phase === 'name-entry') {
    return (
      <NameEntry
        lessonTitle={lesson.title}
        existingNames={session ? Object.values(session.students ?? {}).map(s => s.displayName) : []}
        onSubmit={handleNameSubmit}
        onGoSolo={handleGoSolo}
        waitingForSession={session?.state === 'waiting'}
      />
    )
  }

  if (phase === 'waiting') {
    return (
      <WaitingRoom
        lessonTitle={lesson.title}
        lessonDescription={lesson.description}
      />
    )
  }

  if (phase === 'ended') {
    return (
      <div style={styles.centreScreen}>
        <h2 style={styles.title}>Session ended</h2>
        <p style={{ color: 'var(--colour-text)', fontFamily: 'var(--font-body)', marginBottom: 8 }}>
          Great work today! Your progress has been saved.
        </p>
        <p style={{ color: '#6b7280', fontFamily: 'var(--font-body)', fontSize: '0.9rem', marginBottom: 24 }}>
          Want to keep practising on your own?
        </p>
        <button
          className="btn-primary"
          style={{ padding: '12px 32px', fontSize: 15 }}
          onClick={() => setPhase('solo')}
        >
          Continue Solo
        </button>
      </div>
    )
  }

  const task = lesson.tasks.find(t => t.id === (viewingTaskId ?? currentTaskId))
  const isViewingPrev = viewingTaskId !== null && viewingTaskId !== currentTaskId
  const isSandbox = phase === 'sandbox'
  const isSolo = phase === 'solo'
  const isQuizTask = task?.taskType === 'quiz'
  const taskContentStyle = isQuizTask
    ? styles.taskContentQuiz
    : lesson.type === 'python' || lesson.type === 'html'
    ? styles.taskContentScroll
    : styles.taskContent
  const editorAreaStyle = isQuizTask
    ? styles.editorAreaQuiz
    : lesson.type === 'scratch'
    ? styles.editorAreaScratch
    : lesson.type === 'python' || lesson.type === 'html'
      ? styles.editorAreaScroll
      : styles.editorArea

  const isPaused = (phase === 'lesson' || phase === 'sandbox') && session?.isPaused

  return (
    <div style={styles.page}>
      {isPaused && (
        <div style={styles.pauseOverlay}>
          <span style={styles.pauseIcon}>⏸</span>
          <h2 style={styles.pauseTitle}>Coding Paused</h2>
          <p style={styles.pauseSubtitle}>Your teacher will resume the session shortly</p>
        </div>
      )}
      <TopBar
        lessonTitle={lesson.title}
        lessonLevel={lesson.level}
        displayName={identity?.displayName}
        isSandbox={isSandbox}
        isSolo={isSolo}

        right={
          !isSandbox && (
            <TaskProgressDots
              tasks={lesson.tasks}
              currentTaskId={currentTaskId}
              viewingTaskId={viewingTaskId}
              isSolo={isSolo}
              onDotClick={id => {
                if (isSolo) {
                  if (id !== currentTaskId) handleSoloNavigate(id)
                } else if (id < currentTaskId) {
                  setViewingTaskId(id === currentTaskId ? null : id)
                }
              }}
            />
          )
        }
      />

      {isViewingPrev && (
        <div style={styles.prevBanner}>
          You are viewing a previous task — return to current task to continue.
          <button
            className="btn-secondary"
            style={{ marginLeft: 16, padding: '4px 12px', fontSize: 13 }}
            onClick={() => setViewingTaskId(null)}
          >
            Back to Current Task
          </button>
        </div>
      )}

      <div style={isSolo && isQuizTask ? { ...styles.body, overflow: 'hidden' } : styles.body}>
        <TaskSlideTransition
          transitionKey={`${phase}-${viewingTaskId ?? currentTaskId}`}
          style={taskContentStyle}
        >
          {task?.explainer && !isSandbox && !isQuizTask && (
            <ExplainerPanel title={task.title} content={task.explainer} />
          )}

        <div style={editorAreaStyle}>
          {task?.check && checkAttempted && (
            <CheckFeedbackBanner
              passed={checkPassed}
              failureMessage={isQuizTask ? 'Wrong answer, try again.' : undefined}
            />
          )}
          {task?.taskType === 'quiz' ? (
            <QuizTask
              task={task}
              showQuestion
              selectedAnswer={selectedAnswer}
              onSelectAnswer={isViewingPrev ? undefined : handleQuizSelect}
              submitted={runStatus === 'submitted'}
              checkPassed={checkPassed}
              disabled={isViewingPrev}
              showResult={false}
            />
          ) : lesson.type === 'scratch' ? (() => {
            const saved = loadSavedCode(lessonId, viewingTaskId ?? currentTaskId, identity?.anonymousId)
            let initialProject = saved?.state ?? null
            if (!initialProject && task?.carryBlocksFrom) {
              const carried = loadSavedCode(lessonId, task.carryBlocksFrom, identity?.anonymousId)
              initialProject = carried?.state ?? null
            }
            if (!initialProject) initialProject = task?.starterBlocks ?? null
            return (
              <>
                {!isViewingPrev && !isSandbox && (
                  <div style={{ display: 'flex', flexShrink: 0, paddingBottom: 4 }}>
                    <button
                      className="btn-ghost-outline"
                      style={styles.resetBtn}
                      onClick={handleResetCode}
                      title="Reset blocks to the starter blocks for this task"
                    >
                      Reset Blocks
                    </button>
                  </div>
                )}
                <ScratchWorkspace
                  key={`scratch-${viewingTaskId ?? currentTaskId}-${isSandbox ? 'sandbox' : 'task'}`}
                  task={task}
                  readOnly={isViewingPrev}
                  unrestricted={isSandbox}
                  assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
                  initialState={initialProject}
                  onStateChange={isViewingPrev ? undefined : handleScratchChange}
                  onCheckResult={isViewingPrev ? undefined : handleScratchCheck}
                  externalState={isSandbox ? scratchSandboxProject : scratchExternalState}
                  syncNowKey={session?.activeStudentView === identity?.anonymousId ? session?.activeStudentView : null}
                />
              </>
            )
          })()
          : lesson.type === 'python' ? (
            <>
              <PythonEditor
                code={isViewingPrev ? (loadSavedCode(lessonId, viewingTaskId, identity?.anonymousId)?.code ?? '') : code}
                readOnly={isViewingPrev}
                onChange={isViewingPrev ? undefined : handleCodeChange}
                pyodideStatus={pyodideStatus}
              />
              {!isViewingPrev && (
                task?.interactionMode === 'submit' ? (
                  <>
                    <button
                      className="btn-primary"
                      style={{ margin: '8px 0', alignSelf: 'flex-start', padding: '10px 28px', fontSize: 15 }}
                      onClick={handleSubmit}
                    >
                      Submit
                    </button>
                    {runStatus === 'submitted' && (
                      task?.check
                        ? null
                        : <div style={styles.submitBanner}>Code submitted</div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={styles.buttonRow}>
                      <button
                        className="btn-primary"
                        style={{
                          padding: '10px 28px',
                          fontSize: 15,
                          ...(running ? { backgroundColor: '#ef4444', borderColor: '#ef4444' } : {}),
                        }}
                        onClick={running ? handleStop : handleRun}
                        disabled={!running && pyodideStatus === 'loading'}
                      >
                        {running ? 'Stop' : pyodideStatus === 'loading' ? 'Getting Python ready…' : 'Run'}
                      </button>
                      <button
                        className="btn-ghost-outline"
                        style={styles.resetBtn}
                        onClick={handleResetCode}
                        disabled={running}
                        title="Reset code to the starter code for this task"
                      >
                        Reset Code
                      </button>
                    </div>
                    <OutputPanel
                      output={output}
                      runStatus={runStatus}
                      inputPrompt={inputPrompt}
                      onInputSubmit={handleInputSubmit}
                      checkPassed={checkPassed}
                      hasCheck={!!task?.check}
                      running={running}
                    />
                  </>
                )
              )}
              {isViewingPrev && (
                <OutputPanel
                  output={loadSavedCode(lessonId, viewingTaskId, identity?.anonymousId)?.output ?? ''}
                  runStatus={loadSavedCode(lessonId, viewingTaskId, identity?.anonymousId)?.runStatus ?? null}
                  checkPassed={false}
                  hasCheck={false}
                  checkAttempted={false}
                />
              )}
            </>
          ) : isMobile ? (
            <div style={styles.htmlMobile}>
              {!isViewingPrev && (
                <div style={styles.htmlMobileButtonRow}>
                  <button
                    className="btn-primary"
                    style={{ padding: '10px 28px', fontSize: 15, flexShrink: 0 }}
                    onClick={task?.interactionMode === 'submit' ? handleSubmit : handleRun}
                    disabled={running}
                  >
                    {task?.interactionMode === 'submit' ? 'Submit' : running ? 'Running…' : 'Run'}
                  </button>
                  <button
                    className="btn-ghost-outline"
                    style={styles.resetBtn}
                    onClick={handleResetCode}
                    title="Reset code to the starter code for this task"
                  >
                    Reset Code
                  </button>
                </div>
              )}
              <div style={styles.htmlLeft}>
                <HtmlEditor
                  files={files}
                  activeFile={activeFile}
                  onTabChange={setActiveFile}
                  onFileChange={isViewingPrev ? undefined : handleFileChange}
                  readOnly={isViewingPrev}
                  assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
                  assets={lesson.assets}
                />
              </div>
              <div style={styles.htmlMobilePreview}>
                <CollapsibleIframePreview
                  src={iframeSrc}
                  iframeRef={iframeRef}
                  fill
                  collapsed={htmlPreviewCollapsed}
                  onToggle={() => setHtmlPreviewCollapsed(v => !v)}
                  animate
                />
              </div>
              {runStatus === 'submitted' && !task?.check && (
                <div style={styles.submitBanner}>Code submitted</div>
              )}
            </div>
          ) : (
            <>
            {!isViewingPrev && (
              <div style={styles.htmlMobileButtonRow}>
                <button
                  className="btn-primary"
                  style={{ padding: '10px 28px', fontSize: 15, flexShrink: 0 }}
                  onClick={task?.interactionMode === 'submit' ? handleSubmit : handleRun}
                  disabled={running}
                >
                  {task?.interactionMode === 'submit' ? 'Submit' : running ? 'Running…' : 'Run'}
                </button>
                <button
                  className="btn-ghost-outline"
                  style={styles.resetBtn}
                  onClick={handleResetCode}
                  title="Reset code to the starter code for this task"
                >
                  Reset Code
                </button>
              </div>
            )}
            <SplitPane
              style={styles.htmlSplitPane}
              rightCollapsed={htmlPreviewCollapsed}
              collapsedRight={
                <CollapsibleIframePreview
                  src={iframeSrc}
                  iframeRef={iframeRef}
                  collapsed
                  onToggle={() => setHtmlPreviewCollapsed(false)}
                />
              }
              left={
                <div style={styles.htmlLeft}>
                  <HtmlEditor
                    files={files}
                    activeFile={activeFile}
                    onTabChange={setActiveFile}
                    onFileChange={isViewingPrev ? undefined : handleFileChange}
                    readOnly={isViewingPrev}
                    assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
                    assets={lesson.assets}
                  />
                </div>
              }
              right={
                <CollapsibleIframePreview
                  src={iframeSrc}
                  iframeRef={iframeRef}
                  fill
                  collapsed={false}
                  onToggle={() => setHtmlPreviewCollapsed(true)}
                  animate
                />
              }
            />
            {runStatus === 'submitted' && !task?.check && (
              <div style={styles.submitBanner}>Code submitted</div>
            )}
            </>
          )}

          {false && isSolo && (
            <div style={styles.soloNav}>
              <button
                className="btn-secondary"
                style={styles.soloNavBtn}
                disabled={currentTaskId <= 1}
                onClick={() => handleSoloNavigate(currentTaskId - 1)}
              >
                ← Previous
              </button>
              <span style={styles.soloNavLabel}>
                Task {currentTaskId} of {lesson.tasks.length}
              </span>
              <button
                className="btn-secondary"
                style={styles.soloNavBtn}
                disabled={currentTaskId >= lesson.tasks.length}
                onClick={() => handleSoloNavigate(currentTaskId + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </div>
        </TaskSlideTransition>
        {isSolo && (
          <div style={isQuizTask ? styles.soloNavStatic : styles.soloNav}>
            <button
              className="btn-secondary"
              style={styles.soloNavBtn}
              disabled={currentTaskId <= 1}
              onClick={() => handleSoloNavigate(currentTaskId - 1)}
            >
              Previous
            </button>
            <span style={styles.soloNavLabel}>
              Task {currentTaskId} of {lesson.tasks.length}
            </span>
            <button
              className={`btn-secondary${checkPassed && currentTaskId < lesson.tasks.length ? ' btn-next-success' : ''}`}
              style={{
                ...styles.soloNavBtn,
                ...(checkPassed && currentTaskId < lesson.tasks.length
                  ? { fontSize: 18, padding: '14px 36px' }
                  : {}),
              }}
              disabled={currentTaskId >= lesson.tasks.length}
              onClick={() => handleSoloNavigate(currentTaskId + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function LoadingScreen({ message }) {
  return (
    <div style={styles.centreScreen}>
      <p style={{ color: 'var(--colour-text)', fontFamily: 'var(--font-body)' }}>{message}</p>
    </div>
  )
}

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#f5f5f5',
  },
  body: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    padding: '16px',
    minHeight: 0,
  },
  taskContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minHeight: 0,
    overflow: 'visible',
  },
  taskContentQuiz: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minHeight: 0,
    overflow: 'hidden',
  },
  editorArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minHeight: 0,
  },
  editorAreaQuiz: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minHeight: 0,
    overflow: 'hidden',
  },
  editorAreaScroll: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  taskContentScroll: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflow: 'visible',
  },
  editorAreaScratch: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minHeight: 0,
  },
  buttonRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    margin: '8px 0',
    flexShrink: 0,
  },
  htmlMobileButtonRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    margin: '0 0 4px',
    flexShrink: 0,
  },
  resetBtn: {
    fontSize: 14,
    padding: '9px 20px',
    color: '#6b7280',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    background: '#fff',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
  },
  htmlLeft: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 420,
    overflow: 'visible',
    gap: 8,
    paddingBottom: 4,
  },
  htmlMobile: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 0,
  },
  htmlMobilePreview: {
    minHeight: 300,
    height: 300,
    display: 'flex',
    flexDirection: 'column',
  },
  htmlSplitPane: {
    flex: '0 0 auto',
    minHeight: 520,
    height: 520,
    overflow: 'visible',
  },
  centreScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 16,
    padding: 32,
    textAlign: 'center',
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.5rem',
    color: 'var(--colour-primary)',
  },
  prevBanner: {
    background: 'rgba(239,68,68,0.08)',
    borderBottom: '1px solid rgba(239,68,68,0.2)',
    padding: '8px 16px',
    fontSize: 13,
    color: '#b91c1c',
    display: 'flex',
    alignItems: 'center',
    fontFamily: 'var(--font-body)',
  },
  soloNav: {
    position: 'sticky',
    bottom: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 0 0',
    borderTop: '2px solid #e5e7eb',
    marginTop: 4,
    background: '#f5f5f5',
  },
  soloNavStatic: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 0 0',
    borderTop: '2px solid #e5e7eb',
    marginTop: 4,
    background: '#f5f5f5',
    flexShrink: 0,
  },
  soloNavBtn: {
    fontSize: 16,
    padding: '12px 28px',
    fontWeight: 600,
  },
  soloNavLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'var(--font-body)',
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--colour-text)',
  },
  pauseOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'var(--colour-primary)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 999,
  },
  pauseIcon: {
    fontSize: '3rem',
    lineHeight: 1,
    color: '#fff',
    opacity: 0.8,
  },
  pauseTitle: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '2rem',
    color: '#fff',
    margin: 0,
  },
  pauseSubtitle: {
    fontFamily: 'var(--font-body)',
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.75)',
    margin: 0,
  },
  submitBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 8,
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: '#1e40af',
    fontWeight: 600,
  },
  submitCheckPass: {
    background: '#dcfce7',
    border: '1px solid #bbf7d0',
    color: '#166534',
    borderRadius: 999,
    padding: '3px 10px',
    fontSize: '0.82rem',
    fontWeight: 700,
  },
  submitCheckFail: {
    background: '#fffbeb',
    border: '1px solid #fde68a',
    color: '#92400e',
    borderRadius: 999,
    padding: '3px 10px',
    fontSize: '0.82rem',
    fontWeight: 700,
  },
}
