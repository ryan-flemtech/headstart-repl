import React, { useEffect, useState, useRef } from 'react'
import { useSession } from '../hooks/useSession'
import { useIdentity } from '../hooks/useIdentity'
import { initPyodide, runPython, provideInput, isPyodideReady } from '../../shared/pyodide'
import { buildIframeSrc, getIframeText } from '../../shared/iframe'
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
  const [iframeSrc, setIframeSrc]       = useState(null)
  const [inputPrompt, setInputPrompt]   = useState(null)
  const [checkPassed, setCheckPassed]   = useState(false)
  const iframeRef = useRef(null)
  const appendOutputRef = useRef(null)
  const identityRef = useRef(identity)
  identityRef.current = identity

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

    if (!session || session.state === 'ended') {
      // No live session — go straight to solo, no prompts
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

    if (session.state === 'waiting') {
      // Teacher hasn't started yet — hold in waiting room, name not required yet
      setPhase('waiting')
      return
    }

    // Session is active or sandbox
    const sessionTs = session.createdAt
    const isReturning = identity && identity.lastSessionTimestamp === sessionTs

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
      setCurrentTaskId(session.currentTaskId)
      setViewingTaskId(null)
      setOutput('')
      setRunStatus(null)
      setCheckPassed(false)
      loadTaskContent(session.currentTaskId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.currentTaskId])

  // React to sandbox code pushes
  useEffect(() => {
    if (phase !== 'sandbox' || !session?.sandboxCode) return
    if (lesson?.type === 'python') setCode(session.sandboxCode)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sandboxCodePushedAt])

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
    if (session.state === 'sandbox') { setPhase('sandbox'); return }
    setCurrentTaskId(session.currentTaskId ?? 1)
    setPhase('lesson')
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
        onInputRequired: (prompt) => {
          setInputPrompt(prompt)
        },
      })
      setInputPrompt(null)
      const status = result.status
      setRunStatus(status)

      const passed = task?.check
        ? accumulated.toLowerCase().includes(task.check.value.toLowerCase())
        : false
      setCheckPassed(passed)

      saveCode(lessonId, currentTaskId, identity.anonymousId, { code, output: accumulated, runStatus: status })
      if (phase === 'lesson' || isWatched) {
        await writeStudentRun(identity.anonymousId, { code, output: accumulated, status, checkPassed: passed })
      }
    } else {
      // HTML — build iframe
      const src = buildIframeSrc(files, task?.entryFile ?? 'index.html')
      setIframeSrc(src)
      setRunStatus('success')

      // Check after a short render delay
      setTimeout(() => {
        let passed = false
        if (task?.check) {
          const text = getIframeText(iframeRef.current)
          passed = text.toLowerCase().includes(task.check.value.toLowerCase())
          setCheckPassed(passed)
        }
        if (phase === 'lesson' || isWatched) {
          const filesMap = Object.fromEntries(files.map(f => [f.name, f.content]))
          writeStudentRun(identity.anonymousId, { files: filesMap, status: 'success', checkPassed: passed })
        }
        // Save each file to localStorage
        files.forEach(f => saveFile(lessonId, currentTaskId, f.name, identity.anonymousId, f.content))
      }, 300)
    }

    setRunning(false)
  }

  function handleInputSubmit(value) {
    appendOutputRef.current?.(value + '\n')
    setInputPrompt(null)
    provideInput(value)
  }

  function handleCodeChange(newCode) {
    setCode(newCode)
    if (session?.activeStudentView === identity?.anonymousId) {
      writeStudentCode(identity.anonymousId, newCode)
    }
  }

  function handleFileChange(filename, content) {
    setFiles(prev => prev.map(f => f.name === filename ? { ...f, content } : f))
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

  if (phase === 'name-entry') {
    return (
      <NameEntry
        lessonTitle={lesson.title}
        existingNames={session ? Object.values(session.students ?? {}).map(s => s.displayName) : []}
        onSubmit={handleNameSubmit}
        onGoSolo={handleGoSolo}
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
        <p>Thanks for joining! Great work today.</p>
      </div>
    )
  }

  const task = lesson.tasks.find(t => t.id === (viewingTaskId ?? currentTaskId))
  const isViewingPrev = viewingTaskId !== null && viewingTaskId !== currentTaskId
  const isSandbox = phase === 'sandbox'
  const isSolo = phase === 'solo'

  return (
    <div style={styles.page}>
      <TopBar
        lessonTitle={lesson.title}
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

      <div style={{ ...styles.body, ...(lesson.type === 'html' ? { overflow: 'hidden' } : {}) }}>
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
                  style={{ margin: '8px 0', alignSelf: 'flex-start', padding: '10px 28px', fontSize: 15 }}
                  onClick={handleRun}
                  disabled={running || pyodideStatus === 'loading'}
                >
                  {running ? 'Running…' : pyodideStatus === 'loading' ? 'Getting Python ready…' : 'Run'}
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
          ) : (
            <SplitPane
              style={{ flex: 1, minHeight: 0 }}
              left={
                <div style={styles.htmlLeft}>
                  <HtmlEditor
                    files={files}
                    activeFile={activeFile}
                    onTabChange={setActiveFile}
                    onFileChange={isViewingPrev ? undefined : handleFileChange}
                    readOnly={isViewingPrev}
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
    gap: '12px',
  },
  editorArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minHeight: 0,
  },
  htmlLeft: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    gap: 8,
    paddingBottom: 4,
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
}
