import React, { useEffect, useState, useRef } from 'react'
import { useIsMobile } from '../../shared/useIsMobile'
import { useSession, decodeFileKey } from '../hooks/useSession'
import { useIdentity } from '../hooks/useIdentity'
import { initPyodide, runPython, stopPython, provideInput, isPyodideReady } from '../../shared/pyodide'
import { buildIframeSrc, waitForIframeText } from '../../shared/iframe'
import { evaluateCheck } from '../../shared/checks'
import TopBar from '../components/TopBar'
import NameEntry from '../components/NameEntry'
import WaitingRoom from '../components/WaitingRoom'
import TaskProgressDots from '../components/TaskProgressDots'
import ExplainerPanel from '../components/ExplainerPanel'
import PythonEditor from '../components/PythonEditor'
import HtmlEditor from '../components/HtmlEditor'
import OutputPanel from '../components/OutputPanel'
import IframePreview from '../components/IframePreview'
import SplitPane from '../../shared/SplitPane'
import JoinSessionPrompt from '../components/JoinSessionPrompt'
import JoinChoiceScreen from '../components/JoinChoiceScreen'

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

export default function StudentView({ lessonId }) {
  const { session, loading: sessionLoading, registerPresence, joinSession, writeStudentRun, writeStudentCode, writeStudentFiles, writeStudentOutput } = useSession(lessonId)
  const { identity, loaded: identityLoaded, createIdentity, updateTimestamp, updateDisplayName } = useIdentity()

  const [lesson, setLesson]             = useState(null)
  const [lessonLoading, setLessonLoading] = useState(true)
  const [phase, setPhase]               = useState('loading') // loading | join-choice | waiting | name-entry | lesson | sandbox | solo | ended
  const [currentTaskId, setCurrentTaskId] = useState(1)
  const [viewingTaskId, setViewingTaskId] = useState(null) // null = current task
  const [code, setCode]                 = useState('')
  const [files, setFiles]               = useState([])
  const [activeFile, setActiveFile]     = useState('')
  const [output, setOutput]             = useState('')
  const [runStatus, setRunStatus]       = useState(null)
  const [running, setRunning]           = useState(false)
  const [pyodideStatus, setPyodideStatus] = useState('idle') // idle | loading | ready
  const [iframeSrc, setIframeSrc]       = useState(null)
  const [inputPrompt, setInputPrompt]   = useState(null)
  const [checkPassed, setCheckPassed]   = useState(false)
  const [showJoinPrompt, setShowJoinPrompt] = useState(false)
  const isMobile = useIsMobile()
  const iframeRef = useRef(null)
  const appendOutputRef = useRef(null)
  const identityRef = useRef(identity)
  identityRef.current = identity
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const declinedSessionRef = useRef(null)
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

  function saveCurrentWorkSnapshot() {
    const id = identityRef.current
    const currentLesson = lessonRef.current
    const taskId = currentTaskIdRef.current
    if (!id || !currentLesson) return

    if (currentLesson.type === 'python') {
      saveCode(lessonId, taskId, id.anonymousId, {
        code: codeRef.current,
        output: outputRef.current,
        runStatus: runStatusRef.current,
      })
    } else {
      filesRef.current.forEach(f => saveFile(lessonId, taskId, f.name, id.anonymousId, f.content))
    }
  }

  // Load lesson JSON
  useEffect(() => {
    const base = import.meta.env.BASE_URL
    fetch(`${base}lessons/${lessonId}.json`)
      .then(r => r.json())
      .then(data => { setLesson(data); setLessonLoading(false) })
      .catch(() => setLessonLoading(false))
  }, [lessonId])

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
    if (sessionLoading || !identityLoaded || lessonLoading) return

    // No session at all — show join-choice on first load; keep it if already there
    if (!session) {
      if (phaseRef.current === 'lesson' || phaseRef.current === 'sandbox') {
        saveCurrentWorkSnapshot()
        setShowJoinPrompt(false)
        setPhase('ended')
        return
      }
      if (phaseRef.current === 'join-choice' || phaseRef.current === 'name-entry' || phaseRef.current === 'waiting') {
        setPhase('join-choice')
        return
      }
      if (phaseRef.current === 'loading') {
        setPhase('join-choice')
        return
      }
      // Already solo — stay solo
      if (!identity) createIdentity('Solo', Date.now())
      setShowJoinPrompt(false)
      setPhase('solo')
      return
    }

    // Session ended — exit any join flow gracefully
    if (session.state === 'ended') {
      if (phaseRef.current === 'lesson' || phaseRef.current === 'sandbox') {
        saveCurrentWorkSnapshot()
        setShowJoinPrompt(false)
        setPhase('ended')
        return
      }
      // Fresh load with ended session — show choice screen rather than jumping to solo
      if (phaseRef.current === 'loading' || phaseRef.current === 'join-choice') {
        setPhase('join-choice')
        return
      }
      if (!identity) createIdentity('Solo', Date.now())
      setShowJoinPrompt(false)
      setPhase('solo')
      return
    }

    // Verify the session belongs to this lesson before proceeding
    if (session.lessonId && session.lessonId !== lessonId) {
      if (!identity) createIdentity('Solo', Date.now())
      setShowJoinPrompt(false)
      setPhase('solo')
      return
    }

    // Student is working solo (or on the ended screen) and a new session appeared — prompt rather than auto-transition
    if (phaseRef.current === 'solo' || phaseRef.current === 'ended') {
      if (declinedSessionRef.current === session.createdAt) return
      setShowJoinPrompt(true)
      return
    }

    // Don't interrupt the student while they're choosing or entering their name
    if (phaseRef.current === 'join-choice' || phaseRef.current === 'name-entry') return

    if (session.state === 'waiting') {
      // Already in waiting room — check if they need to be prompted for name now
      if (phaseRef.current === 'waiting') {
        const alreadyRegistered = identity && identity.lastSessionTimestamp === session.createdAt
        if (!alreadyRegistered) setPhase('name-entry')
        return
      }
      // Fresh arrival → show join-choice
      setPhase('join-choice')
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
  }, [sessionLoading, identityLoaded, lessonLoading, session?.state, session?.createdAt])

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
    // Persist current editing state before leaving the task
    if (lesson?.type === 'python') {
      saveCode(lessonId, currentTaskId, identity.anonymousId, { code, output, runStatus })
    } else {
      files.forEach(f => saveFile(lessonId, currentTaskId, f.name, identity.anonymousId, f.content))
    }
    setViewingTaskId(null)
    setOutput('')
    setRunStatus(null)
    setCheckPassed(false)
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

      const passed = evaluateCheck(task?.check, accumulated)
      setCheckPassed(passed)

      saveCode(lessonId, currentTaskId, identity.anonymousId, { code, output: accumulated, runStatus: status })
      if (phase === 'lesson' || phase === 'sandbox' || isWatched) {
        await writeStudentRun(identity.anonymousId, { code, output: accumulated, status, checkPassed: passed })
      }
      setRunning(false)
      return
    }

    // HTML — build iframe
    const src = buildIframeSrc(files, task?.entryFile ?? 'index.html', {
      assets: lesson.assets ?? [],
      assetsPath: resolveAssetsPath(lesson.assetsPath),
    })
    setIframeSrc(src)
    setRunStatus('success')

    // Wait for the iframe to report its body text via postMessage, then run checks
    waitForIframeText().then(text => {
      const passed = evaluateCheck(task?.check, text)
      setCheckPassed(passed)
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

  function handleJoinFromSolo() {
    setShowJoinPrompt(false)
    // Persist current solo work before transitioning
    if (lesson?.type === 'python') {
      saveCode(lessonId, currentTaskId, identity.anonymousId, { code, output, runStatus })
    } else {
      files.forEach(f => saveFile(lessonId, currentTaskId, f.name, identity.anonymousId, f.content))
    }
    setPhase('name-entry')
  }

  function handleDeclineSolo() {
    declinedSessionRef.current = session?.createdAt
    setShowJoinPrompt(false)
  }

  if (phase === 'join-choice') {
    return (
      <JoinChoiceScreen
        lessonTitle={lesson.title}
        sessionExists={!!session}
        sessionEnded={session?.state === 'ended'}
        onWait={handleWaitForTeacher}
        onSolo={handleGoSolo}
      />
    )
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
    return <WaitingRoom lessonTitle={lesson.title} onGoSolo={handleGoSolo} />
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
      {showJoinPrompt && lesson && (
        <JoinSessionPrompt
          lessonTitle={lesson.title}
          onJoin={handleJoinFromSolo}
          onDecline={handleDeclineSolo}
        />
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

      <div style={styles.body}>
        <div key={`task-${currentTaskId}`} className="task-enter" style={styles.taskContent}>
        {task?.explainer && !isSandbox && (
          <ExplainerPanel content={task.explainer} />
        )}

        <div style={styles.editorArea}>
          {lesson.type === 'python' ? (
            <>
              <PythonEditor
                code={isViewingPrev ? (loadSavedCode(lessonId, viewingTaskId, identity?.anonymousId)?.code ?? '') : code}
                readOnly={isViewingPrev}
                onChange={isViewingPrev ? undefined : handleCodeChange}
                pyodideStatus={pyodideStatus}
              />
              {!isViewingPrev && (
                <button
                  className="btn-primary"
                  style={{
                    margin: '8px 0',
                    alignSelf: 'flex-start',
                    padding: '10px 28px',
                    fontSize: 15,
                    ...(running ? { backgroundColor: '#ef4444', borderColor: '#ef4444' } : {}),
                  }}
                  onClick={running ? handleStop : handleRun}
                  disabled={!running && pyodideStatus === 'loading'}
                >
                  {running ? 'Stop' : pyodideStatus === 'loading' ? 'Getting Python ready…' : 'Run'}
                </button>
              )}
              <OutputPanel
                output={isViewingPrev
                  ? (loadSavedCode(lessonId, viewingTaskId, identity?.anonymousId)?.output ?? '')
                  : output}
                runStatus={isViewingPrev
                  ? (loadSavedCode(lessonId, viewingTaskId, identity?.anonymousId)?.runStatus ?? null)
                  : runStatus}
                inputPrompt={inputPrompt}
                onInputSubmit={handleInputSubmit}
                checkPassed={checkPassed}
                hasCheck={!!task?.check}
              />
            </>
          ) : isMobile ? (
            <div style={styles.htmlMobile}>
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
                {!isViewingPrev && (
                  <button
                    className="btn-primary"
                    style={{ margin: '8px 0', alignSelf: 'flex-start', padding: '10px 28px', fontSize: 15, flexShrink: 0 }}
                    onClick={handleRun}
                    disabled={running}
                  >
                    {running ? 'Running…' : 'Run'}
                  </button>
                )}
              </div>
              <div style={styles.htmlMobilePreview}>
                <IframePreview src={iframeSrc} iframeRef={iframeRef} fill />
              </div>
            </div>
          ) : (
            <SplitPane
              style={{ flex: 1, minHeight: 320 }}
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
                  {!isViewingPrev && (
                    <button
                      className="btn-primary"
                      style={{ margin: '8px 0', alignSelf: 'flex-start', padding: '10px 28px', fontSize: 15, flexShrink: 0 }}
                      onClick={handleRun}
                      disabled={running}
                    >
                      {running ? 'Running…' : 'Run'}
                    </button>
                  )}
                </div>
              }
              right={<IframePreview src={iframeSrc} iframeRef={iframeRef} fill />}
            />
          )}

          {isSolo && (
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
        </div>
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
  },
  taskContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minHeight: 0,
  },
  editorArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  htmlLeft: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'auto',
    gap: 8,
    paddingBottom: 4,
  },
  htmlMobile: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    gap: 8,
    minHeight: 0,
  },
  htmlMobilePreview: {
    flex: 1,
    minHeight: 280,
    display: 'flex',
    flexDirection: 'column',
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
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTop: '1px solid #e5e7eb',
    marginTop: 4,
  },
  soloNavBtn: {
    fontSize: 13,
    padding: '6px 16px',
  },
  soloNavLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    color: '#6b7280',
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
}
