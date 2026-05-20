import React, { useEffect, useState, useRef } from 'react'
import { useSession } from '../hooks/useSession'
import { initPyodide, runPython, provideInput, isPyodideReady } from '../../shared/pyodide'
import { buildIframeSrc } from '../../shared/iframe'
import TopBar from '../components/TopBar'
import TaskNavigator from '../components/TaskNavigator'
import PythonEditor from '../components/PythonEditor'
import HtmlEditor from '../components/HtmlEditor'
import OutputPanel from '../components/OutputPanel'
import IframePreview from '../components/IframePreview'
import SplitPane from '../../shared/SplitPane'
import ExplainerPanel from '../components/ExplainerPanel'
import StudentGrid from '../components/StudentGrid'

function resolveAssetsPath(rawPath) {
  if (!rawPath) return ''
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const encoded = rawPath.split('/').map(s => (s ? encodeURIComponent(s) : s)).join('/')
  return window.location.origin + base + encoded
}

export default function TeacherView({ lessonId }) {
  const {
    session, loading,
    createSession, restartSession, startSession, endSession,
    setTaskId, enterSandbox, exitSandbox, pushSandboxCode,
    setActiveStudentView, renameStudent, removeStudent,
  } = useSession(lessonId)

  const [lesson, setLesson]             = useState(null)
  const [lessonLoading, setLessonLoading] = useState(true)
  const [currentTaskId, setCurrentTaskId] = useState(1)
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
  const [inputPrompt, setInputPrompt]   = useState(null)
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

  // Create session only if none exists — don't auto-restart an ended session
  useEffect(() => {
    if (loading || !lesson) return
    if (!session) createSession()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, lesson])

  // Load task content when task changes
  useEffect(() => {
    if (!lesson) return
    const task = lesson.tasks.find(t => t.id === currentTaskId)
    if (!task) return
    if (lesson.type === 'python') {
      setCode(task.starterCode ?? '')
    } else {
      const taskFiles = task.starterFiles ?? []
      setFiles(taskFiles)
      setActiveFile(task.entryFile ?? taskFiles[0]?.name ?? '')
    }
    setOutput('')
    setRunStatus(null)
    setIframeSrc(null)
  }, [currentTaskId, lesson])

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
      let accumulated = ''
      const echoOutput = (text) => { accumulated += text; setOutput(accumulated) }
      appendOutputRef.current = echoOutput
      const result = await runPython(code, {
        onOutput: echoOutput,
        onInputRequired: (p) => setInputPrompt(p),
      })
      setInputPrompt(null)
      setRunStatus(result.status)
    } else {
      const task = lesson.tasks.find(t => t.id === currentTaskId)
      const src = buildIframeSrc(files, task?.entryFile ?? 'index.html', {
        assets: lesson.assets ?? [],
        assetsPath: resolveAssetsPath(lesson.assetsPath),
      })
      setIframeSrc(src)
      setRunStatus('success')
    }
    setRunning(false)
  }

  async function handleTaskChange(taskId) {
    setCurrentTaskId(taskId)
    await setTaskId(taskId)
  }

  async function handlePushToAll() {
    if (lesson.type === 'python') await pushSandboxCode(code)
  }

  async function handleShareLink() {
    const url = `${window.location.origin}${window.location.pathname}#/lesson/${lessonId}`
    await navigator.clipboard.writeText(url).catch(() => {})
    alert(`Share link copied!\n${url}`)
  }

  const isSandbox = session?.state === 'sandbox'
  const task = lesson?.tasks.find(t => t.id === currentTaskId)
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
            {!isSandbox && (
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
              <button className="btn-danger" style={{ fontSize: 13, padding: '5px 12px' }} onClick={endSession}>
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
            onSandbox={isSandbox ? exitSandbox : enterSandbox}
            isSandbox={isSandbox}
            collapsed={leftCollapsed}
            onToggle={() => setLeftCollapsed(v => !v)}
          />
        </aside>

        {/* Centre — Teacher Editor */}
        <main style={{ ...s.centre, ...(lesson.type === 'html' ? { overflow: 'hidden' } : {}) }}>
          {task?.explainer && !isSandbox && (
            <ExplainerPanel content={task.explainer} />
          )}

          {lesson.type === 'python' ? (
            <>
              <PythonEditor
                code={code}
                onChange={setCode}
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
                {isSandbox && (
                  <button className="btn-secondary" onClick={handlePushToAll}>
                    Push to All
                  </button>
                )}
              </div>
              <OutputPanel
                output={output}
                runStatus={runStatus}
                inputPrompt={inputPrompt}
                onInputSubmit={v => { appendOutputRef.current?.(v + '\n'); setInputPrompt(null); provideInput(v) }}
              />
            </>
          ) : (
            <SplitPane
              style={{ flex: 1, minHeight: 0 }}
              left={
                <div style={s.htmlLeft}>
                  <HtmlEditor
                    files={files}
                    activeFile={activeFile}
                    onTabChange={setActiveFile}
                    onFileChange={(name, content) =>
                      setFiles(prev => prev.map(f => f.name === name ? { ...f, content } : f))
                    }
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
                    {isSandbox && (
                      <button className="btn-secondary" onClick={handlePushToAll}>
                        Push to All
                      </button>
                    )}
                  </div>
                </div>
              }
              right={<IframePreview src={iframeSrc} iframeRef={iframeRef} fill />}
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
  right: {
    background: '#fff',
    borderLeft: '1px solid #e5e7eb',
    overflow: 'auto',
  },
}
