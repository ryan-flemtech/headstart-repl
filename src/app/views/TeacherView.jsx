import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession, decodeFileKey } from '../hooks/useSession'
import { flattenTasks } from '../../shared/taskUtils'
import TopBar from '../components/TopBar'
import TaskNavigator from '../components/TaskNavigator'
import PythonEditor from '../components/PythonEditor'
import HtmlEditor from '../components/HtmlEditor'
import ScratchWorkspace from '../components/ScratchWorkspace'
import ExplainerPanel from '../components/ExplainerPanel'
import InformationTask from '../components/InformationTask'
import StudentGrid from '../components/StudentGrid'
import QuizTask from '../components/QuizTask'
import LiveActivityToast from '../components/LiveActivityToast'
import TeacherTimers from '../components/TeacherTimers'
import TeacherSessionControls from '../components/TeacherSessionControls'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { cloneFiles, cloneScratchState } from '../../shared/workspaceData'
import { buildStudentLivePayload } from '../teacherLivePayload'
import {
  getSandboxConfiguredCode,
  getSandboxConfiguredFiles,
  getSandboxConfiguredScratch,
  getSandboxStarterCode,
  getSandboxStarterFiles,
  getSandboxStarterScratch,
} from '../teacherSandboxContent'

export default function TeacherView({ lessonId }) {
  const navigate = useNavigate()
  const {
    session, loading,
    createSession, restartSession, startSession, endSession,
    setTaskId, enterSandbox, exitSandbox, pushSandboxCode, pushSandboxFiles,
    setPaused, setActiveStudentView, setTeacherLive, renameStudent, removeStudent, pushResetToStudent,
  } = useSession(lessonId)

  const [lesson, setLesson]             = useState(null)
  const [lessonLoading, setLessonLoading] = useState(true)
  const [currentTaskId, setCurrentTaskId] = useState(1)
  // previewTaskId: non-null while the teacher is previewing a task locally without moving students
  const [previewTaskId, setPreviewTaskId]   = useState(null)
  const [showEndModal, setShowEndModal]     = useState(false)
  const [leftCollapsed, setLeftCollapsed]   = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [code, setCode]                 = useState('')
  const [files, setFiles]               = useState([])
  const [activeFile, setActiveFile]     = useState('')
  const [sandboxStaging, setSandboxStaging] = useState(false)
  const [scratchState, setScratchState] = useState(null)
  const [teacherCodeTab, setTeacherCodeTab] = useState('starter')
  const [showSharePanel, setShowSharePanel] = useState(false)
  const [copiedLink, setCopiedLink] = useState(null) // 'live' | 'solo' | null
  const [activeCompleteFile, setActiveCompleteFile] = useState('')
  const [editorActivity, setEditorActivity] = useState(null)
  const sandboxDraftRef = useRef({ code: null, files: null, scratchState: null })

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

  useEffect(() => {
    if (!session?.currentTaskId || sandboxStaging) return
    if (session.currentTaskId !== currentTaskId) {
      setCurrentTaskId(session.currentTaskId)
    }
  }, [session?.currentTaskId, currentTaskId, sandboxStaging])

  function loadCurrentTaskContent(taskId) {
    if (!lesson) return
    const task = flattenTasks(lesson?.tasks ?? []).find(t => t.id === taskId)
    if (!task) return
    if (task.taskType === 'quiz' || task.taskType === 'information') {
      setCode('')
      setFiles([])
      setActiveFile('')
      setScratchState(null)
    } else
    if (lesson.type === 'python') {
      setCode(task.starterCode ?? '')
    } else if (lesson.type === 'scratch') {
      setScratchState(task.starterBlocks ?? null)
    } else {
      const taskFiles = task.starterFiles ?? []
      setFiles(taskFiles)
      setActiveFile(task.entryFile ?? taskFiles[0]?.name ?? '')
    }
  }

  // Load task content when displayed task changes (preview or session task)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (sandboxStaging || session?.state === 'sandbox') return
    loadCurrentTaskContent(previewTaskId ?? currentTaskId)
  }, [currentTaskId, previewTaskId, lesson, sandboxStaging, session?.state])

  // If the teacher opens/reloads while the sandbox is already live, show the
  // live sandbox payload instead of the normal task starter.
  useEffect(() => {
    if (!lesson || sandboxStaging || session?.state !== 'sandbox') return
    if (lesson.type === 'python') {
      setCode(getSandboxStarterCode({
        lesson, taskId: currentTaskId, session,
        draftCode: sandboxDraftRef.current.code, currentCode: code,
      }))
    } else if (lesson.type === 'scratch') {
      setScratchState(getSandboxStarterScratch({
        lesson, taskId: currentTaskId, session,
        draftState: sandboxDraftRef.current.scratchState, currentState: scratchState,
      }))
    } else {
      const starterFiles = getSandboxStarterFiles({
        lesson, taskId: currentTaskId, session,
        draftFiles: sandboxDraftRef.current.files, currentFiles: files, decodeFileKey,
      })
      setFiles(starterFiles)
      setActiveFile(starterFiles[0]?.name ?? '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, sandboxStaging, session?.state, session?.sandboxCodePushedAt, session?.sandboxFilesUpdatedAt])

  // Reset complete code tab when displayed task changes
  useEffect(() => {
    setTeacherCodeTab('starter')
  }, [currentTaskId, previewTaskId])

  async function handleTaskChange(taskId) {
    setPreviewTaskId(null)
    setCurrentTaskId(taskId)
    await setTaskId(taskId)
  }

  // Preview a task locally without moving students
  function handlePreviewTask(taskId) {
    if (taskId === currentTaskId) {
      setPreviewTaskId(null)
    } else {
      setPreviewTaskId(taskId)
    }
  }

  function handleEnterSandbox() {
    setPreviewTaskId(null)
    if (lesson.type === 'python') {
      setCode(getSandboxStarterCode({
        lesson, taskId: currentTaskId, session,
        draftCode: sandboxDraftRef.current.code, currentCode: code,
      }))
    } else if (lesson.type === 'scratch') {
      setScratchState(getSandboxStarterScratch({
        lesson, taskId: currentTaskId, session,
        draftState: sandboxDraftRef.current.scratchState, currentState: scratchState,
      }))
    } else {
      const starterFiles = getSandboxStarterFiles({
        lesson, taskId: currentTaskId, session,
        draftFiles: sandboxDraftRef.current.files, currentFiles: files, decodeFileKey,
      })
      setFiles(starterFiles)
      setActiveFile(starterFiles[0]?.name ?? '')
    }
    setSandboxStaging(true)
  }

  function handleCancelSandbox() {
    setSandboxStaging(false)
    loadCurrentTaskContent(currentTaskId)
  }

  async function handleGoLiveSandbox() {
    if (lesson.type === 'python') {
      sandboxDraftRef.current.code = code
      await enterSandbox({ code })
    } else if (lesson.type === 'scratch') {
      sandboxDraftRef.current.scratchState = cloneScratchState(scratchState)
      await enterSandbox({ code: JSON.stringify(scratchState ?? {}) })
    } else {
      sandboxDraftRef.current.files = cloneFiles(files)
      await enterSandbox({ files })
    }
    setSandboxStaging(false)
  }

  async function handlePushScratchSandbox() {
    sandboxDraftRef.current.scratchState = cloneScratchState(scratchState)
    await pushSandboxCode(JSON.stringify(scratchState ?? {}))
  }

  async function handleResetSandboxStarter() {
    if (lesson.type === 'python') {
      const starterCode = getSandboxConfiguredCode({ lesson, taskId: currentTaskId })
      sandboxDraftRef.current.code = starterCode
      setCode(starterCode)
      if (isSandbox) await pushSandboxCode(starterCode)
    } else if (lesson.type === 'scratch') {
      const starterScratch = getSandboxConfiguredScratch({ lesson, taskId: currentTaskId })
      sandboxDraftRef.current.scratchState = cloneScratchState(starterScratch)
      setScratchState(starterScratch)
      if (isSandbox) await pushSandboxCode(JSON.stringify(starterScratch ?? {}))
    } else {
      const starterFiles = getSandboxConfiguredFiles({ lesson, taskId: currentTaskId })
      sandboxDraftRef.current.files = cloneFiles(starterFiles)
      setFiles(starterFiles)
      setActiveFile(starterFiles[0]?.name ?? '')
      if (isSandbox) await pushSandboxFiles(starterFiles)
    }
  }

  async function handleDeactivateSandbox() {
    if (lesson.type === 'python') sandboxDraftRef.current.code = code
    else if (lesson.type === 'scratch') sandboxDraftRef.current.scratchState = cloneScratchState(scratchState)
    else sandboxDraftRef.current.files = cloneFiles(files)
    setSandboxStaging(false)
    await exitSandbox()
    loadCurrentTaskContent(currentTaskId)
  }

  async function handleEndSession(goHome) {
    await endSession()
    setShowEndModal(false)
    if (goHome) navigate('/')
  }

  async function handleGoLiveForMe(studentId) {
    await setTeacherLive(null)
    await setActiveStudentView(studentId)
  }

  async function handleGoLiveForAll(student) {
    await setActiveStudentView(student.anonymousId)
    await setTeacherLive(buildStudentLivePayload({
      student,
      lesson,
      taskId: session?.currentTaskId ?? currentTaskId,
      entryFileTaskId: session?.currentTaskId,
      decodeFileKey,
    }))
  }

  async function handleStopStudentLive() {
    await setTeacherLive(null)
    await setActiveStudentView(null)
  }

  function getLessonLinks() {
    const base = `${window.location.origin}${window.location.pathname}#/lesson/${lessonId}`
    return {
      live: `${base}?live=true`,
      solo: base,
    }
  }

  async function handleCopyLink(type) {
    const url = getLessonLinks()[type]
    await navigator.clipboard.writeText(url).catch(() => {})
    setCopiedLink(type)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  function handleOpenPresentationWindow() {
    const base = `${window.location.origin}${window.location.pathname}#/lesson/${lessonId}`
    window.open(`${base}?teacher=true&present=true`, `headstart-present-${lessonId}`, 'popup=yes,width=1280,height=800')
  }

  const isSandbox = session?.state === 'sandbox'
  const isInSandbox = isSandbox || sandboxStaging
  const flatTasks = flattenTasks(lesson?.tasks ?? [])
  // displayTaskId: what the teacher's centre panel is currently showing
  const displayTaskId = previewTaskId ?? currentTaskId
  const task = flatTasks.find(t => t.id === displayTaskId)
  const currentTask = flatTasks.find(t => t.id === (session?.currentTaskId ?? currentTaskId))
  const displayIndex = flatTasks.findIndex(t => t.id === displayTaskId)
  const showingComplete = teacherCodeTab === 'complete' && !isInSandbox
  const isInformationTask = task?.taskType === 'information'
  const students = session ? Object.entries(session.students ?? {}).map(([id, s]) => ({ ...s, anonymousId: id })) : []
  const isPreviewing = previewTaskId !== null && !isInSandbox

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
          <TeacherSessionControls
            session={session}
            isInSandbox={isInSandbox}
            displayIndex={displayIndex}
            taskCount={flatTasks.length}
            links={getLessonLinks()}
            copiedLink={copiedLink}
            showSharePanel={showSharePanel}
            onPreviousTask={() => {
              if (displayIndex > 0) handlePreviewTask(flatTasks[displayIndex - 1].id)
            }}
            onNextTask={() => {
              if (displayIndex < flatTasks.length - 1) handlePreviewTask(flatTasks[displayIndex + 1].id)
            }}
            onOpenPresentationWindow={handleOpenPresentationWindow}
            onToggleSharePanel={() => setShowSharePanel(v => !v)}
            onCloseSharePanel={() => setShowSharePanel(false)}
            onCopyLink={handleCopyLink}
            onStartSession={startSession}
            onTogglePaused={() => setPaused(!session?.isPaused)}
            onEndSession={() => setShowEndModal(true)}
            onRestartSession={restartSession}
          />
        }
      />
      <TeacherTimers session={session} task={currentTask} tasks={lesson.tasks} />
      <LiveActivityToast activity={editorActivity} showClicks={false} />



      <div style={{ ...s.body, gridTemplateColumns: `${leftCollapsed ? '40px' : '220px'} 1fr ${rightCollapsed ? '40px' : '280px'}` }}>
        {/* Left — Task Navigator */}
        <aside style={s.left}>
          <TaskNavigator
            tasks={lesson.tasks}
            currentTaskId={currentTaskId}
            previewTaskId={previewTaskId}
            session={session}
            students={students}
            onTaskSelect={handlePreviewTask}
            onSandbox={isSandbox ? handleDeactivateSandbox : sandboxStaging ? handleCancelSandbox : handleEnterSandbox}
            isSandbox={isSandbox}
            sandboxStaging={sandboxStaging}
            collapsed={leftCollapsed}
            onToggle={() => setLeftCollapsed(v => !v)}
          />
        </aside>

        {/* Centre — Teacher Editor */}
        <main style={{ ...s.centre, ...(isInformationTask || lesson.type === 'html' || lesson.type === 'scratch' ? { overflow: 'hidden' } : {}) }}>
          {task?.explainer && !isInSandbox && task?.taskType !== 'quiz' && !isInformationTask && (
            <ExplainerPanel title={task.title} content={task.explainer} />
          )}

          {isPreviewing && (
            <div style={s.previewBanner}>
              <span style={s.previewBannerText}>
                Preview — Task {displayIndex + 1}: {task?.title ?? ''}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn-ghost"
                  style={{ ...s.previewBannerBtn, color: '#1e40af', borderColor: '#1e40af', background: 'transparent' }}
                  onClick={() => setPreviewTaskId(null)}
                >
                  Back to Current Task
                </button>
                <button
                  className="btn-primary"
                  style={s.previewBannerBtn}
                  onClick={() => handleTaskChange(previewTaskId)}
                >
                  Move All to This Task
                </button>
              </div>
            </div>
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
                    <button className="btn-ghost" style={{ ...s.sandboxBannerBtn, color: '#92400e', borderColor: '#92400e', background: 'transparent' }} onClick={handleResetSandboxStarter}>
                      Reset to Sandbox Starter
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
                    <button className="btn-ghost" style={{ ...s.sandboxBannerBtn, background: 'transparent' }} onClick={handleResetSandboxStarter}>
                      Reset to Sandbox Starter
                    </button>
                    <button className="btn-danger" style={s.sandboxBannerBtn} onClick={handleDeactivateSandbox}>
                      Deactivate Sandbox
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {!isInSandbox && isInformationTask ? (
            <InformationTask task={task} lesson={lesson} fill />
          ) : !isInSandbox && task?.taskType === 'quiz' ? (
            <QuizTask task={task} showQuestion disabled />
          ) : lesson.type === 'python' ? (
            <div style={!isInSandbox ? s.codeWorkspaceStack : undefined}>
              {!isInSandbox && (
                <TeacherCodeTabs
                  s={s}
                  activeTab={teacherCodeTab}
                  onStarter={() => setTeacherCodeTab('starter')}
                  onComplete={() => { setTeacherCodeTab('complete'); setActiveCompleteFile(task?.completeFiles?.[0]?.name ?? '') }}
                />
              )}
              <PythonEditor
                code={showingComplete ? (task?.completeCode ?? '') : code}
                onChange={showingComplete || !isInSandbox ? undefined : value => {
                  setCode(value)
                  if (isInSandbox) sandboxDraftRef.current.code = value
                }}
                onActivity={setEditorActivity}
                readOnly={showingComplete || !isInSandbox}
                pyodideStatus="idle"
                editorStyle={isInSandbox ? undefined : s.attachedCodeEditor}
              />
            </div>
          ) : lesson.type === 'scratch' ? (
            <div style={s.scratchWrap}>
              <ScratchWorkspace
                key={`teacher-scratch-${displayTaskId}-${isInSandbox ? 'sandbox' : 'task'}`}
                task={task}
                unrestricted={isInSandbox}
                assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
                initialState={scratchState}
                externalState={scratchState}
                readOnly={showingComplete || !isInSandbox}
                hideStage
                onStateChange={showingComplete || !isInSandbox ? undefined : state => {
                  setScratchState(state)
                  if (isInSandbox) sandboxDraftRef.current.scratchState = cloneScratchState(state)
                }}
              />
            </div>
          ) : (
            <div style={!isInSandbox ? s.codeWorkspaceStack : s.htmlLeft}>
              {!isInSandbox && (
                <TeacherCodeTabs
                  s={s}
                  activeTab={teacherCodeTab}
                  onStarter={() => setTeacherCodeTab('starter')}
                  onComplete={() => { setTeacherCodeTab('complete'); setActiveCompleteFile(task?.completeFiles?.[0]?.name ?? '') }}
                />
              )}
              <div style={s.htmlLeft}>
                <HtmlEditor
                  files={showingComplete ? (task?.completeFiles ?? []) : files}
                  activeFile={showingComplete ? activeCompleteFile : activeFile}
                  onTabChange={showingComplete ? setActiveCompleteFile : setActiveFile}
                  onFileChange={showingComplete || !isInSandbox ? undefined : (name, content) =>
                    setFiles(prev => {
                      const next = prev.map(f => f.name === name ? { ...f, content } : f)
                      if (isInSandbox) sandboxDraftRef.current.files = cloneFiles(next)
                      return next
                    })
                  }
                  onActivity={setEditorActivity}
                  readOnly={showingComplete || !isInSandbox}
                  assetsPath={resolveAssetsPath(lesson.assetsPath) || undefined}
                  assets={lesson.assets}
                  attachedTop={!isInSandbox}
                />
              </div>
            </div>
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
            onGoLive={handleGoLiveForMe}
            onGoLiveForAll={handleGoLiveForAll}
            onStopLive={handleStopStudentLive}
            onRemoteReset={pushResetToStudent}
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

function TeacherCodeTabs({ s, activeTab, onStarter, onComplete }) {
  return (
    <div style={s.codeTabStrip} className="ui-tabs ui-tabs--editor" role="tablist" aria-label="Teacher code workspace">
      <button
        type="button"
        className="ui-tab"
        role="tab"
        aria-selected={activeTab === 'starter'}
        style={{ ...s.codeTabBtn, ...(activeTab === 'starter' ? s.codeTabBtnActive : {}) }}
        onClick={onStarter}
      >
        Starter code
      </button>
      <button
        type="button"
        className="ui-tab"
        role="tab"
        aria-selected={activeTab === 'complete'}
        style={{ ...s.codeTabBtn, ...(activeTab === 'complete' ? s.codeTabBtnActive : {}) }}
        onClick={onComplete}
      >
        Complete code
      </button>
    </div>
  )
}

const s = {
  taskTitleHeader: {
    background: 'var(--colour-primary-dark)',
    color: '#fff',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.1rem',
    padding: '10px 16px',
    letterSpacing: '0.04em',
    flexShrink: 0,
  },
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
  codeWorkspaceStack: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    gap: 0,
  },
  codeTabStrip: {
    display: 'flex',
    gap: 4,
    border: '1px solid #e5e7eb',
    borderBottom: 0,
    borderRadius: '8px 8px 0 0',
    padding: '4px 4px 0',
    background: '#e5e7eb',
    flexShrink: 0,
    alignSelf: 'stretch',
    width: '100%',
  },
  codeTabBtn: {
    border: 0,
    borderRadius: '6px 6px 0 0',
    background: 'transparent',
    color: '#4b5563',
    padding: '7px 14px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  codeTabBtnActive: {
    background: '#fafafa',
    color: 'var(--colour-primary)',
  },
  attachedCodeEditor: {
    borderRadius: '0 0 8px 8px',
  },
  codeTabActions: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: 8,
  },
  previewBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    background: '#eff6ff',
    border: '1px solid #93c5fd',
    borderRadius: 8,
    padding: '10px 14px',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  previewBannerText: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: '#1e40af',
  },
  previewBannerBtn: {
    fontSize: 13,
    padding: '5px 12px',
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
