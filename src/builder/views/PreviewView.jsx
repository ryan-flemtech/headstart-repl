import React, { useEffect, useRef, useState } from 'react'
import { useIsMobile } from '../../shared/useIsMobile'
import { initPyodide, runPython, stopPython, provideInput, isPyodideReady } from '../../shared/pyodide'
import { buildIframeSrc, waitForIframeText } from '../../shared/iframe'
import { evaluateCheck, evaluateCheckWithCode } from '../../shared/checks'
import TopBar from '../../app/components/TopBar'
import ExplainerPanel from '../../app/components/ExplainerPanel'
import PythonEditor from '../../app/components/PythonEditor'
import HtmlEditor from '../../app/components/HtmlEditor'
import OutputPanel from '../../app/components/OutputPanel'
import CollapsibleIframePreview from '../../app/components/CollapsibleIframePreview'
import TaskProgressDots from '../../app/components/TaskProgressDots'
import QuizTask from '../../app/components/QuizTask'
import CheckFeedbackBanner from '../../app/components/CheckFeedbackBanner'
import SplitPane from '../../shared/SplitPane'

export default function PreviewView({ lesson, onClose }) {
  const isMobile = useIsMobile()
  const firstTaskId = lesson.tasks[0]?.id ?? 1

  const [currentTaskId, setCurrentTaskId] = useState(firstTaskId)
  const [code, setCode]                   = useState('')
  const [files, setFiles]                 = useState([])
  const [activeFile, setActiveFile]       = useState('')
  const [output, setOutput]               = useState('')
  const [runStatus, setRunStatus]         = useState(null)
  const [running, setRunning]             = useState(false)
  const [pyodideStatus, setPyodideStatus] = useState(isPyodideReady() ? 'ready' : 'idle')
  const [iframeSrc, setIframeSrc]         = useState(null)
  const [htmlPreviewCollapsed, setHtmlPreviewCollapsed] = useState(true)
  const [inputPrompt, setInputPrompt]     = useState(null)
  const [checkPassed, setCheckPassed]     = useState(false)
  const [checkAttempted, setCheckAttempted] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState('')

  const appendOutputRef = useRef(null)
  const iframeRef       = useRef(null)
  // Per-task snapshots so carry-through works as the student edits
  const taskCodeRef  = useRef({})
  const taskFilesRef = useRef({})
  // Keep live refs to avoid stale closure when saving before navigate
  const codeRef  = useRef(code)
  const filesRef = useRef(files)
  codeRef.current  = code
  filesRef.current = files

  // Warm up Pyodide for Python lessons
  useEffect(() => {
    if (lesson.type !== 'python' || isPyodideReady()) return
    setPyodideStatus('loading')
    initPyodide(msg => setPyodideStatus(msg))
      .then(() => setPyodideStatus('ready'))
      .catch(() => setPyodideStatus('error'))
  }, [lesson.type])

  // Load content whenever the current task changes
  useEffect(() => {
    loadTask(currentTaskId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTaskId])

  function saveCurrentSnapshot() {
    if (lesson.type === 'python') {
      taskCodeRef.current[currentTaskId] = codeRef.current
    } else if (lesson.type === 'html') {
      taskFilesRef.current[currentTaskId] = filesRef.current
    }
  }

  function loadTask(taskId) {
    const task = lesson.tasks.find(t => t.id === taskId)
    if (!task) return

    setOutput('')
    setRunStatus(null)
    setCheckPassed(false)
    setCheckAttempted(false)
    setIframeSrc(null)
    setHtmlPreviewCollapsed(true)
    setSelectedAnswer('')

    if (task.taskType === 'quiz') {
      setCode('')
      setFiles([])
      setActiveFile('')
      return
    }

    if (lesson.type === 'python') {
      if (taskCodeRef.current[taskId] != null) {
        setCode(taskCodeRef.current[taskId])
        return
      }
      if (task.carryCodeFrom != null && taskCodeRef.current[task.carryCodeFrom] != null) {
        setCode(taskCodeRef.current[task.carryCodeFrom])
        return
      }
      setCode(task.starterCode ?? '')
    } else if (lesson.type === 'html') {
      if (taskFilesRef.current[taskId]) {
        const saved = taskFilesRef.current[taskId]
        setFiles(saved)
        setActiveFile(task.entryFile ?? saved[0]?.name ?? '')
        return
      }
      const taskFiles = (task.starterFiles ?? []).map(f => {
        if (task.carryCodeFrom != null && taskFilesRef.current[task.carryCodeFrom]) {
          const carried = taskFilesRef.current[task.carryCodeFrom].find(cf => cf.name === f.name)
          if (carried) return { ...f, content: carried.content }
        }
        return { ...f }
      })
      setFiles(taskFiles)
      setActiveFile(task.entryFile ?? taskFiles[0]?.name ?? '')
    }
  }

  function handleNavigate(taskId) {
    saveCurrentSnapshot()
    setCurrentTaskId(taskId)
  }

  async function handleRun() {
    if (running) return
    const task = lesson.tasks.find(t => t.id === currentTaskId)

    setRunning(true)
    setOutput('')
    setRunStatus(null)
    setCheckPassed(false)
    setCheckAttempted(false)

    if (lesson.type === 'python') {
      let accumulated = ''
      const emit = text => { accumulated += text; setOutput(accumulated) }
      appendOutputRef.current = emit
      const result = await runPython(code, {
        onOutput: (text) => emit(text),
        onInputRequired: (prompt) => setInputPrompt(prompt),
      })
      setInputPrompt(null)
      if (result.status !== 'stopped') {
        setRunStatus(result.status)
        setCheckPassed(evaluateCheck(task?.check, accumulated, { status: result.status, code }))
        setCheckAttempted(!!task?.check)
      }
      setRunning(false)
      return
    }

    // HTML
    setHtmlPreviewCollapsed(false)
    const src = buildIframeSrc(files, task?.entryFile ?? 'index.html')
    setIframeSrc(src)
    setRunStatus('success')
    waitForIframeText().then(text => {
      const codeStr = files.map(f => f.content).join('\n')
      const iframeDoc = iframeRef.current?.contentDocument ?? null
      setCheckPassed(evaluateCheck(task?.check, text, { code: codeStr, iframeDoc }))
      setCheckAttempted(!!task?.check)
    })
    setRunning(false)
  }

  function handleInputSubmit(value) {
    appendOutputRef.current?.(value + '\n')
    setInputPrompt(null)
    provideInput(value)
  }

  function handleFileChange(filename, content) {
    setFiles(prev => prev.map(f => f.name === filename ? { ...f, content } : f))
  }

  function handleSubmit() {
    const task = lesson.tasks.find(t => t.id === currentTaskId)
    const codeForCheck = lesson.type === 'html' ? files.map(f => f.content).join('\n') : code
    const passed = task?.check ? evaluateCheckWithCode(task.check, codeForCheck) : false
    setCheckPassed(passed)
    setCheckAttempted(!!task?.check)
    setRunStatus('submitted')
  }

  function handleQuizSelect(answer) {
    const task = lesson.tasks.find(t => t.id === currentTaskId)
    const passed = task?.check ? evaluateCheck(task.check, answer, { answer }) : false
    setSelectedAnswer(answer)
    setCheckPassed(passed)
    setCheckAttempted(!!task?.check)
    setRunStatus('submitted')
  }

  const task = lesson.tasks.find(t => t.id === currentTaskId)
  const isScratch = lesson.type === 'scratch'

  return (
    <div style={s.page}>
      {/* Preview banner */}
      <div style={s.banner}>
        <span style={s.bannerText}>This is a preview — changes are not saved</span>
        <button className="btn-secondary" style={s.backBtn} onClick={onClose}>
          Go back to Builder
        </button>
      </div>

      {/* Student top bar */}
      <TopBar
        lessonTitle={lesson.title}
        lessonLevel={lesson.level}
        isSolo
        right={
          <TaskProgressDots
            tasks={lesson.tasks}
            currentTaskId={currentTaskId}
            viewingTaskId={null}
            isSolo
            onDotClick={id => { if (id !== currentTaskId) handleNavigate(id) }}
          />
        }
      />

      <div style={s.body}>
        {isScratch ? (
          <div style={s.scratchPlaceholder}>
            <p>Scratch lesson preview is not available in the builder.</p>
            <p>Open the student app to preview Scratch lessons.</p>
          </div>
        ) : (
          <>
            {task?.explainer && task?.taskType !== 'quiz' && (
              <ExplainerPanel title={task.title} content={task.explainer} />
            )}

            <div style={task?.taskType === 'quiz' || (lesson.type === 'html' && !isMobile) ? s.editorAreaFlex : s.editorArea}>
              {task?.check && checkAttempted && (
                <CheckFeedbackBanner
                  passed={checkPassed}
                  failureMessage={task?.taskType === 'quiz' ? 'Wrong answer, try again.' : undefined}
                />
              )}
              {task?.taskType === 'quiz' ? (
                <QuizTask
                  task={task}
                  showQuestion
                  selectedAnswer={selectedAnswer}
                  onSelectAnswer={handleQuizSelect}
                  submitted={runStatus === 'submitted'}
                  checkPassed={checkPassed}
                  showResult={false}
                />
              ) : lesson.type === 'python' ? (
                <>
                  <PythonEditor
                    code={code}
                    onChange={setCode}
                    pyodideStatus={pyodideStatus}
                  />
                  {task?.interactionMode === 'submit' ? (
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
                          : <div style={s.submitBanner}>Code submitted</div>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        className="btn-primary"
                        style={{
                          margin: '8px 0',
                          alignSelf: 'flex-start',
                          padding: '10px 28px',
                          fontSize: 15,
                          ...(running ? { backgroundColor: '#ef4444', borderColor: '#ef4444' } : {}),
                        }}
                        onClick={running ? () => stopPython() : handleRun}
                        disabled={!running && pyodideStatus === 'loading'}
                      >
                        {running ? 'Stop' : pyodideStatus === 'loading' ? 'Getting Python ready…' : 'Run'}
                      </button>
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
                  )}
                </>
              ) : isMobile ? (
                <>
                  <HtmlEditor
                    files={files}
                    activeFile={activeFile}
                    onTabChange={setActiveFile}
                    onFileChange={handleFileChange}
                  />
                  <button
                    className="btn-primary"
                    style={{ margin: '8px 0', alignSelf: 'flex-start', padding: '10px 28px', fontSize: 15 }}
                    onClick={task?.interactionMode === 'submit' ? handleSubmit : handleRun}
                    disabled={running}
                  >
                    {task?.interactionMode === 'submit' ? 'Submit' : running ? 'Running…' : 'Run'}
                  </button>
                  <CollapsibleIframePreview
                    src={iframeSrc}
                    iframeRef={iframeRef}
                    fill
                    collapsed={htmlPreviewCollapsed}
                    onToggle={() => setHtmlPreviewCollapsed(v => !v)}
                    animate
                  />
                </>
              ) : (
                <>
                  <SplitPane
                    style={{ flex: 1, minHeight: 320 }}
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
                          files={files}
                          activeFile={activeFile}
                          onTabChange={setActiveFile}
                          onFileChange={handleFileChange}
                        />
                        <button
                          className="btn-primary"
                          style={{ margin: '8px 0', alignSelf: 'flex-start', padding: '10px 28px', fontSize: 15, flexShrink: 0 }}
                          onClick={task?.interactionMode === 'submit' ? handleSubmit : handleRun}
                          disabled={running}
                        >
                          {task?.interactionMode === 'submit' ? 'Submit' : running ? 'Running…' : 'Run'}
                        </button>
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
                </>
              )}
            </div>
          </>
        )}

        {/* Solo navigation */}
        <div style={s.soloNav}>
          <button
            className="btn-secondary"
            style={s.soloNavBtn}
            disabled={currentTaskId <= firstTaskId}
            onClick={() => handleNavigate(currentTaskId - 1)}
          >
            Previous
          </button>
          <span style={s.soloNavLabel}>
            Task {lesson.tasks.findIndex(t => t.id === currentTaskId) + 1} of {lesson.tasks.length}
          </span>
          <button
            className={`btn-secondary${checkPassed && currentTaskId < lesson.tasks[lesson.tasks.length - 1]?.id ? ' btn-next-success' : ''}`}
            style={{
              ...s.soloNavBtn,
              ...(checkPassed && currentTaskId < lesson.tasks[lesson.tasks.length - 1]?.id
                ? { fontSize: 18, padding: '14px 36px' }
                : {}),
            }}
            disabled={currentTaskId >= lesson.tasks[lesson.tasks.length - 1]?.id}
            onClick={() => handleNavigate(currentTaskId + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#f5f5f5',
  },
  banner: {
    background: 'var(--colour-secondary)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    height: 40,
    flexShrink: 0,
    gap: 12,
  },
  bannerText: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
  },
  backBtn: {
    fontSize: 13,
    padding: '4px 14px',
    background: 'rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.4)',
    color: '#fff',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    cursor: 'pointer',
  },
  body: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    padding: '16px',
    gap: 12,
  },
  editorArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  editorAreaFlex: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 0,
  },
  htmlLeft: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'auto',
    gap: 8,
    paddingBottom: 4,
  },
  soloNav: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    borderTop: '2px solid #e5e7eb',
    marginTop: 4,
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
  scratchPlaceholder: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    color: '#6b7280',
    fontFamily: 'var(--font-body)',
    fontSize: '1rem',
    textAlign: 'center',
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
