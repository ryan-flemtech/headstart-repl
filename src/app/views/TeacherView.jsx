import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession, decodeFileKey } from '../hooks/useSession'
import { initPyodide, runPython, provideInput, isPyodideReady } from '../../shared/pyodide'
import { buildIframeSrc } from '../../shared/iframe'
import TopBar from '../components/TopBar'
import TaskNavigator from '../components/TaskNavigator'
import PythonEditor from '../components/PythonEditor'
import HtmlEditor from '../components/HtmlEditor'
import OutputPanel from '../components/OutputPanel'
import CollapsibleIframePreview from '../components/CollapsibleIframePreview'
import ScratchWorkspace from '../components/ScratchWorkspace'
import SplitPane from '../../shared/SplitPane'
import ExplainerPanel from '../components/ExplainerPanel'
import StudentGrid from '../components/StudentGrid'

function resolveAssetsPath(rawPath) {
  if (!rawPath) return ''
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const encoded = rawPath.split('/').map(s => (s ? encodeURIComponent(s) : s)).join('/')
  return window.location.origin + base + encoded
}

function getFileType(name) {
  if (name.endsWith('.html')) return 'html'
  if (name.endsWith('.css')) return 'css'
  if (name.endsWith('.js')) return 'javascript'
  return 'text'
}

function decodeSessionFiles(sessionFiles) {
  if (!sessionFiles) return []
  return Object.entries(sessionFiles).map(([key, content]) => {
    const name = decodeFileKey(key)
    return { name, content, type: getFileType(name) }
  })
}

function parseScratchState(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return null }
}

export default function TeacherView({ lessonId }) {
  const navigate = useNavigate()
  const {
    session, loading,
    createSession, restartSession, startSession, endSession,
    setTaskId, enterSandbox, exitSandbox, pushSandboxCode,
    setPaused, setActiveStudentView, renameStudent, removeStudent,
  } = useSession(lessonId)

  const [lesson, setLesson]             = useState(null)
  const [lessonLoading, setLessonLoading] = useState(true)
  const [currentTaskId, setCurrentTaskId] = useState(1)
  const [showEndModal, setShowEndModal]     = useState(false)
  const [leftCollapsed, setLeftCollapsed]   = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [code, setCode]                 = useState('')
  const [files, setFiles]               = useState([])
  const [activeFile, setActiveFile]     = useState('')
  const [output, setOutput]             = useState('')
  const [runStatus, setRunStatus]       = useState(null)
  const [running, setRunning]           = useState(false)
  const [pyodideStatus, setPyodideStatus] = useState('idle')
  const [iframeSrc, setIframeSrc]       = useState(null)
  const [htmlPreviewCollapsed, setHtmlPreviewCollapsed] = useState(true)
  const [inputPrompt, setInputPrompt]   = useState(null)
  const [sandboxStaging, setSandboxStaging] = useState(false)
  const [scratchState, setScratchState] = useState(null)
  const [teacherCodeTab, setTeacherCodeTab] = useState('starter')
  const [activeCompleteFile, setActiveCompleteFile] = useState('')
  const iframeRef = useRef(null)
  const appendOutputRef = useRef(null)

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

  // Create session only if none exists — don't auto-restart an ended session
  useEffect(() => {
    if (loading || !lesson) return
    if (!session) createSession()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, lesson])

  function loadCurrentTaskContent(taskId) {
    if (!lesson) return
    const task = lesson.tasks.find(t => t.id === taskId)
    if (!task) return
    if (lesson.type === 'python') {
      setCode(task.starterCode ?? '')
    } else if (lesson.type === 'scratch') {
      setScratchState(task.starterBlocks ?? null)
    } else {
      const taskFiles = task.starterFiles ?? []
      setFiles(taskFiles)
      setActiveFile(task.entryFile ?? taskFiles[0]?.name ?? '')
    }
    setOutput('')
    setRunStatus(null)
    setIframeSrc(null)
  }

  function getSandboxStarterCode() {
    const task = lesson?.tasks.find(t => t.id === currentTaskId)
    if (session?.state === 'sandbox' && session.sandboxCode != null) return session.sandboxCode
    if (lesson?.sandboxStarter != null) return lesson.sandboxStarter
    if (code) return code
    return task?.starterCode ?? ''
  }

  function getSandboxStarterFiles() {
    const task = lesson?.tasks.find(t => t.id === currentTaskId)
    const liveFiles = session?.state === 'sandbox' ? decodeSessionFiles(session.sandboxFiles) : []
    if (liveFiles.length > 0) return liveFiles
    if (lesson?.sandboxStarterFiles?.length > 0) return lesson.sandboxStarterFiles
    if (files.length > 0) return files
    return task?.starterFiles ?? []
  }

  function getSandboxStarterScratch() {
    const task = lesson?.tasks.find(t => t.id === currentTaskId)
    if (session?.state === 'sandbox' && session.sandboxCode != null) {
      return parseScratchState(session.sandboxCode)
    }
    if (scratchState) return scratchState
    return task?.starterBlocks ?? null
  }

  // Load task content when task changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (sandboxStaging || session?.state === 'sandbox') return
    loadCurrentTaskContent(currentTaskId)
  }, [currentTaskId, lesson, sandboxStaging, session?.state])

  // If the teacher opens/reloads while the sandbox is already live, show the
  // live sandbox payload instead of the normal task starter.
  useEffect(() => {
    if (!lesson || sandboxStaging || session?.state !== 'sandbox') return
    if (lesson.type === 'python') {
      setCode(getSandboxStarterCode())
    } else if (lesson.type === 'scratch') {
      setScratchState(getSandboxStarterScratch())
    } else {
      const starterFiles = getSandboxStarterFiles()
      setFiles(starterFiles)
      setActiveFile(starterFiles[0]?.name ?? '')
    }
    setOutput('')
    setRunStatus(null)
    setIframeSrc(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, sandboxStaging, session?.state, session?.sandboxCodePushedAt, session?.sandboxFilesUpdatedAt])

  // Reset complete code tab when task changes
  useEffect(() => {
    setTeacherCodeTab('starter')
  }, [currentTaskId])

  // Warm up Pyodide
  useEffect(() => {
    if (!lesson || lesson.type !== 'python' || isPyodideReady()) return
    setPyodideStatus('loading')
    initPyodide(msg => setPyodideStatus(msg))
      .then(() => setPyodideStatus('ready'))
      .catch(() => setPyodideStatus('error'))
  }, [lesson])

  async function handleRun() {
    if (running) return
    setRunning(true)
    setOutput('')
    setRunStatus(null)

    if (lesson.type === 'python') {
      const codeToRun = showingComplete ? (task?.completeCode ?? '') : code
      let accumulated = ''
      const echoOutput = (text) => { accumulated += text; setOutput(accumulated) }
      appendOutputRef.current = echoOutput
      const result = await runPython(codeToRun, {
        onOutput: echoOutput,
        onInputRequired: (p) => setInputPrompt(p),
      })
      setInputPrompt(null)
      setRunStatus(result.status)
    } else if (lesson.type === 'html') {
      setHtmlPreviewCollapsed(false)
      const filesToRun = showingComplete ? (task?.completeFiles ?? []) : files
      const src = buildIframeSrc(filesToRun, task?.entryFile ?? 'index.html', {
        assets: lesson.assets ?? [],
        assetsPath: resolveAssetsPath(lesson.assetsPath),
      })
      setIframeSrc(src)
      setRunStatus('success')
    } else if (lesson.type === 'scratch') {
      setRunStatus('success')
    }
    setRunning(false)
  }

  async function handleTaskChange(taskId) {
    setCurrentTaskId(taskId)
    await setTaskId(taskId)
  }

  function handleEnterSandbox() {
    if (lesson.type === 'python') {
      setCode(getSandboxStarterCode())
    } else if (lesson.type === 'scratch') {
      setScratchState(getSandboxStarterScratch())
    } else {
      const starterFiles = getSandboxStarterFiles()
      setFiles(starterFiles)
      setActiveFile(starterFiles[0]?.name ?? '')
    }
    setOutput('')
    setRunStatus(null)
    setIframeSrc(null)
    setSandboxStaging(true)
  }

  function handleCancelSandbox() {
    setSandboxStaging(false)
    loadCurrentTaskContent(currentTaskId)
  }

  async function handleGoLiveSandbox() {
    if (lesson.type === 'python') {
      await enterSandbox({ code })
    } else if (lesson.type === 'scratch') {
      await enterSandbox({ code: JSON.stringify(scratchState ?? {}) })
    } else {
      await enterSandbox({ files })
    }
    setSandboxStaging(false)
  }

  async function handlePushScratchSandbox() {
    await pushSandboxCode(JSON.stringify(scratchState ?? {}))
  }



  async function handleDeactivateSandbox() {
    setSandboxStaging(false)
    await exitSandbox()
    loadCurrentTaskContent(currentTaskId)
  }

  async function handleEndSession(goHome) {
    await endSession()
    setShowEndModal(false)
    if (goHome) navigate('/')
  }

  async function handleShareLink() {
    const url = `${window.location.origin}${window.location.pathname}#/lesson/${lessonId}`
    await navigator.clipboard.writeText(url).catch(() => {})
    alert(`Share link copied!\n${url}`)
  }

  const isSandbox = session?.state === 'sandbox'
  const isInSandbox = isSandbox || sandboxStaging
  const task = lesson?.tasks.find(t => t.id === currentTaskId)
  const showingComplete = teacherCodeTab === 'complete' && !isInSandbox
  const students = session ? Object.entries(session.students ?? {}).map(([id, s]) => ({ ...s, anonymousId: id })) : []

  if (lessonLoading || !lesson) {
    return <div style={s.centre}><p>Loading…</p></div>
  }

  return (
    <div style={s.page}>
      <TopBar
        lessonTitle={lesson.title}
        lessonLevel={lesson.level}
        isSandbox={isSandbox}
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!isInSandbox && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 13, padding: '4px 10px' }}
                  disabled={currentTaskId <= 1}
                  onClick={() => handleTaskChange(currentTaskId - 1)}
                >
                  ← Prev
                </button>
                <span style={{ fontSize: 13, opacity: 0.85, minWidth: 70, textAlign: 'center', fontFamily: 'var(--font-body)' }}>
                  Task {currentTaskId} / {lesson.tasks.length}
                </span>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 13, padding: '4px 10px' }}
                  disabled={currentTaskId >= lesson.tasks.length}
                  onClick={() => handleTaskChange(currentTaskId + 1)}
                >
                  Next →
                </button>
              </div>
            )}
            <span style={{ fontSize: 13, opacity: 0.85 }}>
              {session ? `Session: ${session.state}` : 'No session'}
            </span>
            <button className="btn-ghost" style={{ fontSize: 13, padding: '5px 12px' }} onClick={handleShareLink}>
              Share Link
            </button>
            {session?.state === 'waiting' && (
              <button className="btn-primary" style={{ fontSize: 13, padding: '5px 12px' }} onClick={startSession}>
                Start Session
              </button>
            )}
            {(session?.state === 'active' || session?.state === 'sandbox') && (
              <button
                className={session?.isPaused ? 'btn-paused' : 'btn-ghost'}
                style={{ fontSize: 13, padding: '5px 12px' }}
                onClick={() => setPaused(!session?.isPaused)}
              >
                {session?.isPaused ? 'Resume Coding' : 'Pause Coding'}
              </button>
            )}
            {(session?.state === 'active' || session?.state === 'sandbox') && (
              <button className="btn-danger" style={{ fontSize: 13, padding: '5px 12px' }} onClick={() => setShowEndModal(true)}>
                End Session
              </button>
            )}
            {session?.state === 'ended' && (
              <button className="btn-primary" style={{ fontSize: 13, padding: '5px 12px' }} onClick={restartSession}>
                Restart Session
              </button>
            )}
          </div>
        }
      />

      <div style={{ ...s.body, gridTemplateColumns: `${leftCollapsed ? '40px' : '220px'} 1fr ${rightCollapsed ? '40px' : '280px'}` }}>
        {/* Left — Task Navigator */}
        <aside style={s.left}>
          <TaskNavigator
            tasks={lesson.tasks}
            currentTaskId={currentTaskId}
            session={session}
            students={students}
            onTaskSelect={handleTaskChange}
            onSandbox={isSandbox ? handleDeactivateSandbox : sandboxStaging ? handleCancelSandbox : handleEnterSandbox}
            isSandbox={isSandbox}
            sandboxStaging={sandboxStaging}
            collapsed={leftCollapsed}
            onToggle={() => setLeftCollapsed(v => !v)}
          />
        </aside>

        {/* Centre — Teacher Editor */}
        <main style={{ ...s.centre, ...(lesson.type === 'html' || lesson.type === 'scratch' ? { overflow: 'hidden' } : {}) }}>
          {task?.explainer && !isInSandbox && (
            <ExplainerPanel title={task.title} content={task.explainer} />
          )}

          {isInSandbox && (
            <div style={s.sandboxBanner}>
              <span style={s.sandboxBannerText}>
                {sandboxStaging
                  ? 'Sandbox preview — students are still on the lesson'
                  : 'Sandbox is LIVE — students can see this'}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                {sandboxStaging ? (
                  <>
                    <button className="btn-ghost" style={{ ...s.sandboxBannerBtn, color: '#92400e', borderColor: '#92400e', background: 'transparent' }} onClick={handleCancelSandbox}>
                      Cancel
                    </button>
                    <button className="btn-primary" style={s.sandboxBannerBtn} onClick={handleGoLiveSandbox}>
                      Go Live &amp; Send to Students
                    </button>
                  </>
                ) : (
                  <>
                    {lesson.type === 'scratch' && (
                      <button className="btn-primary" style={s.sandboxBannerBtn} onClick={handlePushScratchSandbox}>
                        Push to All
                      </button>
                    )}
                    <button className="btn-danger" style={s.sandboxBannerBtn} onClick={handleDeactivateSandbox}>
                      Deactivate Sandbox
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {!isInSandbox && (lesson.type === 'python' || lesson.type === 'html') && (
            <div style={s.codeTabStrip}>
              <button
                style={{ ...s.codeTabBtn, ...(teacherCodeTab === 'starter' ? s.codeTabBtnActive : {}) }}
                onClick={() => setTeacherCodeTab('starter')}
              >
                Starter Code
              </button>
              <button
                style={{ ...s.codeTabBtn, ...(teacherCodeTab === 'complete' ? s.codeTabBtnActive : {}) }}
                onClick={() => { setTeacherCodeTab('complete'); setActiveCompleteFile(task?.completeFiles?.[0]?.name ?? '') }}
              >
                Complete Code
              </button>
            </div>
          )}

          {lesson.type === 'python' ? (
            <>
              <PythonEditor
                code={showingComplete ? (task?.completeCode ?? '') : code}
                onChange={showingComplete ? undefined : setCode}
                readOnly={showingComplete}
                pyodideStatus={pyodideStatus}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn-primary"
                  onClick={handleRun}
                  disabled={running || pyodideStatus === 'loading'}
                >
                  {running ? 'Running…' : 'Run'}
                </button>
              </div>
              <OutputPanel
                output={output}
                runStatus={runStatus}
                inputPrompt={inputPrompt}
                onInputSubmit={v => { appendOutputRef.current?.(v + '\n'); setInputPrompt(null); provideInput(v) }}
                running={running}
              />
            </>
          ) : lesson.type === 'scratch' ? (
            <div style={s.scratchWrap}>
              <ScratchWorkspace
                key={`teacher-scratch-${currentTaskId}-${isInSandbox ? 'sandbox' : 'task'}`}
                task={task}
                unrestricted={isInSandbox}
                assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
                initialState={scratchState}
                externalState={scratchState}
                onStateChange={setScratchState}
              />
            </div>
          ) : (
            <SplitPane
              style={{ flex: 1, minHeight: 0 }}
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
                <div style={s.htmlLeft}>
                  <HtmlEditor
                    files={showingComplete ? (task?.completeFiles ?? []) : files}
                    activeFile={showingComplete ? activeCompleteFile : activeFile}
                    onTabChange={showingComplete ? setActiveCompleteFile : setActiveFile}
                    onFileChange={showingComplete ? undefined : (name, content) =>
                      setFiles(prev => prev.map(f => f.name === name ? { ...f, content } : f))
                    }
                    readOnly={showingComplete}
                    assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
                    assets={lesson.assets}
                  />
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, padding: '8px 0 4px' }}>
                    <button
                      className="btn-primary"
                      onClick={handleRun}
                      disabled={running}
                    >
                      {running ? 'Running…' : 'Run'}
                    </button>
                  </div>
                </div>
              }
              right={
                <CollapsibleIframePreview
                  src={iframeSrc}
                  iframeRef={iframeRef}
                  fill
                  collapsed={false}
                  onToggle={() => setHtmlPreviewCollapsed(true)}
                />
              }
            />
          )}
        </main>

        {/* Right — Student Grid */}
        <aside style={s.right}>
          <StudentGrid
            students={students}
            lesson={lesson}
            lessonId={lessonId}
            session={session}
            onRename={renameStudent}
            onRemove={removeStudent}
            onGoLive={setActiveStudentView}
            onStopLive={() => setActiveStudentView(null)}
            collapsed={rightCollapsed}
            onToggle={() => setRightCollapsed(v => !v)}
          />
        </aside>
      </div>

      {showEndModal && (
        <div style={s.overlay} onClick={() => setShowEndModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h2 style={s.modalTitle}>End Session?</h2>
            <p style={s.modalBody}>
              This will end the session for all students. They will see a session-ended screen.
            </p>
            <div style={s.modalActions}>
              <button
                className="btn-ghost"
                style={{ fontSize: 14 }}
                onClick={() => setShowEndModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                style={{ fontSize: 14 }}
                onClick={() => handleEndSession(false)}
              >
                End Session
              </button>
              <button
                className="btn-primary"
                style={{ fontSize: 14 }}
                onClick={() => handleEndSession(true)}
              >
                End &amp; Go to Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  body: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '220px 1fr 280px',
    overflow: 'hidden',
    gap: 0,
  },
  left: {
    background: '#fff',
    borderRight: '1px solid #e5e7eb',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  centre: {
    display: 'flex',
    flexDirection: 'column',
    padding: 16,
    gap: 10,
    overflow: 'auto',
    background: '#f5f5f5',
  },
  htmlLeft: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    gap: 0,
  },
  scratchWrap: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
  },
  codeTabStrip: {
    display: 'inline-flex',
    gap: 4,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 4,
    background: '#fff',
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  codeTabBtn: {
    border: 0,
    borderRadius: 6,
    background: 'transparent',
    color: '#4b5563',
    padding: '7px 14px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  codeTabBtnActive: {
    background: 'var(--colour-primary)',
    color: '#fff',
  },
  sandboxBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    background: '#fef3c7',
    border: '1px solid #fcd34d',
    borderRadius: 8,
    padding: '10px 14px',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  sandboxBannerText: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: '#92400e',
  },
  sandboxBannerBtn: {
    fontSize: 13,
    padding: '5px 12px',
  },
  right: {
    background: '#fff',
    borderLeft: '1px solid #e5e7eb',
    overflow: 'auto',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    padding: '28px 32px',
    maxWidth: 420,
    width: '90%',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
  modalTitle: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.2rem',
    color: 'var(--colour-text)',
    margin: '0 0 12px',
  },
  modalBody: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.95rem',
    color: 'var(--colour-text)',
    margin: '0 0 24px',
    lineHeight: 1.5,
  },
  modalActions: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
}
