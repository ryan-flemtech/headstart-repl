import React, { useEffect, useState } from 'react'
import SplitPane from '../../shared/SplitPane'
import { CodeEditor } from '../../shared/CodeEditor'
import { initPyodide, runPython, stopPython, provideInput, isPyodideReady } from '../../shared/pyodide'
import { buildIframeSrc, waitForIframeText } from '../../shared/iframe'
import { evaluateCheck } from '../../shared/checks'
import AssetBrowser from '../../shared/AssetBrowser'
import ExplainerEditor from './ExplainerEditor'
import FileManager from './FileManager'
import BuilderOutputPanel from './BuilderOutputPanel'
import IframePreview from '../../app/components/IframePreview'

function resolveAssetsPath(rawPath) {
  if (!rawPath) return ''
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const encoded = rawPath.split('/').map(s => (s ? encodeURIComponent(s) : s)).join('/')
  return window.location.origin + base + encoded
}

export default function TaskEditor({ task, lesson, onUpdate }) {
  const [output, setOutput]             = useState('')
  const [runStatus, setRunStatus]       = useState(null)
  const [running, setRunning]           = useState(false)
  const [pyodideStatus, setPyodideStatus] = useState(isPyodideReady() ? 'ready' : 'idle')
  const [inputPrompt, setInputPrompt]   = useState(null)
  const [iframeSrc, setIframeSrc]       = useState(null)
  const [checkResult, setCheckResult]   = useState(null)
  const iframeRef = React.useRef(null)
  const appendOutputRef = React.useRef(null)

  const isPython  = lesson.type === 'python'
  const [selectedFile, setSelectedFile] = useState(task.starterFiles?.[0]?.name ?? '')
  const [codeTab, setCodeTab] = useState('starter')
  const [testCode, setTestCode] = useState('')
  const [testFiles, setTestFiles] = useState([])
  const [selectedTestFile, setSelectedTestFile] = useState('')
  const [testEntryFile, setTestEntryFile] = useState('')
  const isTestTab = codeTab === 'test'
  const activePythonCode = isTestTab ? testCode : (task.starterCode ?? '')
  const activeFiles = isTestTab ? testFiles : (task.starterFiles ?? [])
  const activeSelectedFile = isTestTab ? selectedTestFile : selectedFile
  const activeEntryFile = isTestTab ? testEntryFile : (task.entryFile ?? 'index.html')

  useEffect(() => {
    if (codeTab !== 'starter') return
    setTestCode('')
    setTestFiles([])
    setSelectedTestFile('')
    setTestEntryFile('')
  }, [codeTab])

  function set(field, value) {
    onUpdate({ ...task, [field]: value })
  }

  function cloneFiles(files) {
    return (files ?? []).map(file => ({ ...file }))
  }

  function handleCodeTabChange(tab) {
    if (tab === codeTab) return

    setOutput('')
    setRunStatus(null)
    setCheckResult(null)
    setIframeSrc(null)

    if (tab === 'test') {
      setTestCode(task.starterCode ?? '')
      const files = cloneFiles(task.starterFiles)
      setTestFiles(files)
      setSelectedTestFile(selectedFile || files[0]?.name || '')
      setTestEntryFile(task.entryFile ?? 'index.html')
    }

    setCodeTab(tab)
  }

  function handleStop() {
    stopPython()
  }

  async function handleRun() {
    if (running) return
    setRunning(true)
    setOutput('')
    setRunStatus(null)
    setCheckResult(null)
    setIframeSrc(null)

    if (isPython) {
      if (!isPyodideReady()) {
        setPyodideStatus('loading')
        await initPyodide(msg => setPyodideStatus(msg))
        setPyodideStatus('ready')
      }

      let accumulated = ''
      const echoOutput = text => { accumulated += text; setOutput(accumulated) }
      appendOutputRef.current = echoOutput
      const result = await runPython(activePythonCode, {
        onOutput: echoOutput,
        onInputRequired: p => setInputPrompt(p),
      })
      setInputPrompt(null)

      if (result.status === 'stopped') {
        setRunning(false)
        return
      }

      setRunStatus(result.status)

      if (task.check?.value) {
        const passes = evaluateCheck(task.check, accumulated)
        setCheckResult(passes ? 'pass' : 'fail')
        set('_checkTested', true)
      }
    } else {
      const src = buildIframeSrc(activeFiles, activeEntryFile, {
        assets: lesson.assets ?? [],
        assetsPath: resolveAssetsPath(lesson.assetsPath),
      })
      setIframeSrc(src)
      setRunStatus('success')

      if (task.check?.value) {
        waitForIframeText().then(text => {
          const passes = evaluateCheck(task.check, text)
          setCheckResult(passes ? 'pass' : 'fail')
          set('_checkTested', true)
        })
      }
    }
    setRunning(false)
  }

  return (
    <div style={s.wrap}>
      <Field label="Task title">
        <input
          style={s.input}
          value={task.title}
          onChange={e => set('title', e.target.value)}
          placeholder="e.g. Hello World"
        />
      </Field>

      <Field label="Explainer (Markdown)">
        <ExplainerEditor
          value={task.explainer}
          onChange={v => set('explainer', v)}
        />
      </Field>

      <Field label="Carry code from task">
        <select
          style={s.select}
          value={task.carryCodeFrom ?? ''}
          onChange={e => set('carryCodeFrom', e.target.value ? parseInt(e.target.value, 10) : null)}
        >
          <option value="">None</option>
          {lesson.tasks.filter(t => t.id !== task.id).map(t => (
            <option key={t.id} value={t.id}>{t.id}. {t.title || 'Untitled'}</option>
          ))}
        </select>
      </Field>

      <Field label="Completion check">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={s.checkToggle}>
            <input
              type="checkbox"
              checked={!!task.check}
              onChange={e => set('check', e.target.checked ? { type: 'output_contains', value: '' } : null)}
            />
            Enable check
          </label>
        </div>
        {task.check && (
          <div style={s.checkEditor}>
            <select style={{ ...s.select, flex: '0 0 auto' }} value={task.check.type} onChange={e => set('check', { ...task.check, type: e.target.value })}>
              <option value="output_contains">output_contains</option>
              <option value="output_equals">output_equals</option>
              <option value="output_line_count">output_line_count</option>
            </select>
            <textarea
              style={s.checkValue}
              value={task.check.value}
              onChange={e => set('check', { ...task.check, value: e.target.value })}
              placeholder={
                task.check.type === 'output_line_count'
                  ? 'Expected number of output lines...'
                  : task.check.type === 'output_equals'
                    ? 'Exact output expected...'
                    : 'String that output must contain...'
              }
            />
          </div>
        )}
      </Field>

      <div style={s.divider} />

      {isPython ? (
        <>
          <CodeWorkspaceTabs activeTab={codeTab} onChange={handleCodeTabChange} />

          <Field label={isTestTab ? 'Test check code' : 'Starter code'}>
            <div style={s.pythonEditor}>
              <CodeEditor
                value={activePythonCode}
                language="python"
                onChange={v => isTestTab ? setTestCode(v) : set('starterCode', v)}
              />
            </div>
          </Field>

          <div style={s.runRow}>
            <button
              className="btn-primary"
              onClick={running ? handleStop : handleRun}
              disabled={!running && pyodideStatus === 'loading'}
              style={{
                padding: '10px 28px',
                fontSize: 15,
                ...(running ? { backgroundColor: '#ef4444', borderColor: '#ef4444' } : {}),
              }}
            >
              {running ? 'Stop' : pyodideStatus === 'loading' ? 'Getting Python ready...' : 'Run'}
            </button>
            {pyodideStatus === 'loading' && (
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--colour-primary)' }}>
                Getting Python ready...
              </span>
            )}
          </div>

          <BuilderOutputPanel
            output={output}
            runStatus={runStatus}
            inputPrompt={inputPrompt}
            onInputSubmit={v => { appendOutputRef.current?.(v + '\n'); setInputPrompt(null); provideInput(v) }}
            checkResult={checkResult}
            checkValue={task.check?.value ?? ''}
          />
        </>
      ) : (
        <>
          <CodeWorkspaceTabs activeTab={codeTab} onChange={handleCodeTabChange} />

          <div style={s.htmlSplit}>
            <span style={s.htmlSplitLabel}>{isTestTab ? 'Test check files' : 'Starter files'}</span>
            <SplitPane
              defaultSplit={34}
              style={{ flex: 1, minHeight: 0 }}
              left={
                <div style={s.htmlLeft}>
                  <FileManager
                    files={activeFiles}
                    entryFile={activeEntryFile}
                    selectedFile={activeSelectedFile}
                    onSelectFile={isTestTab ? setSelectedTestFile : setSelectedFile}
                    onAddFile={f => {
                      if (isTestTab) {
                        setTestFiles([...(testFiles ?? []), f])
                        setSelectedTestFile(f.name)
                      } else {
                        set('starterFiles', [...(task.starterFiles ?? []), f])
                        setSelectedFile(f.name)
                      }
                    }}
                    onDeleteFile={name => {
                      const current = isTestTab ? testFiles : (task.starterFiles ?? [])
                      const next = current.filter(f => f.name !== name)
                      if (isTestTab) {
                        setTestFiles(next)
                        setSelectedTestFile(next[0]?.name ?? '')
                      } else {
                        set('starterFiles', next)
                        setSelectedFile(next[0]?.name ?? '')
                      }
                    }}
                    onChangeType={(name, type) => {
                      if (isTestTab) setTestFiles(testFiles.map(f => f.name === name ? { ...f, type } : f))
                      else set('starterFiles', (task.starterFiles ?? []).map(f => f.name === name ? { ...f, type } : f))
                    }}
                    onChangeEntryFile={name => isTestTab ? setTestEntryFile(name) : set('entryFile', name)}
                  />
                </div>
              }
              right={
                <div style={s.htmlEditorPane}>
                  {activeSelectedFile ? (
                    <CodeEditor
                      key={`${codeTab}-${activeSelectedFile}`}
                      value={activeFiles.find(f => f.name === activeSelectedFile)?.content ?? ''}
                      language={activeFiles.find(f => f.name === activeSelectedFile)?.type ?? 'html'}
                      onChange={v => {
                        if (isTestTab) setTestFiles(testFiles.map(f => f.name === activeSelectedFile ? { ...f, content: v } : f))
                        else set('starterFiles', (task.starterFiles ?? []).map(f => f.name === activeSelectedFile ? { ...f, content: v } : f))
                      }}
                      style={s.htmlCodeEditor}
                    />
                  ) : (
                    <div style={s.noFile}>Select or add a file to edit.</div>
                  )}
                </div>
              }
            />
          </div>

          <div style={s.previewPanel}>
            <div style={s.previewHeader}>
              <span style={s.previewTitle}>Preview</span>
              <button
                className="btn-primary"
                onClick={handleRun}
                disabled={running}
                style={{ padding: '8px 22px', fontSize: 14 }}
              >
                {running ? 'Running...' : 'Run'}
              </button>
            </div>
            <div style={s.previewFrame}>
              <IframePreview src={iframeSrc} iframeRef={iframeRef} fill />
            </div>
            {checkResult !== null && (
              <div style={{
                border: '1px solid',
                borderRadius: 8,
                padding: '10px 14px',
                fontFamily: 'var(--font-body)',
                fontSize: '0.88rem',
                lineHeight: 1.6,
                background: checkResult === 'pass' ? '#f0fdf4' : '#fffbeb',
                borderColor: checkResult === 'pass' ? '#bbf7d0' : '#fde68a',
              }}>
                {checkResult === 'pass'
                  ? 'Check passes - students will see the completion banner.'
                  : `Check does not pass - review your check value ("${task.check?.value ?? ''}")`}
              </div>
            )}
          </div>

          {lesson.assetsPath && lesson.assets?.length > 0 && (
            <Field label="Asset browser (read-only - copy paths to use in starter code)">
              <AssetBrowser
                assetsPath={resolveAssetsPath(lesson.assetsPath)}
                assets={lesson.assets}
                copyMode="full"
              />
            </Field>
          )}
        </>
      )}
    </div>
  )
}

function CodeWorkspaceTabs({ activeTab, onChange }) {
  return (
    <div style={s.workspaceTabs} role="tablist" aria-label="Code workspace">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'starter'}
        style={{ ...s.workspaceTab, ...(activeTab === 'starter' ? s.workspaceTabActive : {}) }}
        onClick={() => onChange('starter')}
      >
        Starter code
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'test'}
        style={{ ...s.workspaceTab, ...(activeTab === 'test' ? s.workspaceTabActive : {}) }}
        onClick={() => onChange('test')}
      >
        Test check code
      </button>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem', color: 'var(--colour-text)' }}>
        {label}
      </span>
      {children}
    </div>
  )
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    maxWidth: 1120,
    margin: '0 auto',
  },
  input: {
    padding: '8px 10px',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: 'var(--colour-text)',
    outline: 'none',
    width: '100%',
  },
  select: {
    padding: '7px 10px',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
    background: '#fff',
    cursor: 'pointer',
    outline: 'none',
  },
  checkToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    cursor: 'pointer',
  },
  checkEditor: {
    display: 'grid',
    gridTemplateColumns: 'max-content minmax(0, 1fr)',
    gap: 8,
    alignItems: 'start',
    marginTop: 8,
  },
  checkValue: {
    padding: '8px 10px',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.9rem',
    lineHeight: 1.5,
    color: 'var(--colour-text)',
    outline: 'none',
    width: '100%',
    minHeight: 92,
    resize: 'vertical',
    whiteSpace: 'pre-wrap',
  },
  divider: {
    height: 1,
    background: '#e5e7eb',
    margin: '4px 0',
  },
  workspaceTabs: {
    display: 'inline-grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 4,
    alignSelf: 'flex-start',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 4,
    background: '#fff',
  },
  workspaceTab: {
    border: 0,
    borderRadius: 6,
    background: 'transparent',
    color: '#4b5563',
    padding: '8px 12px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  workspaceTabActive: {
    background: 'var(--colour-primary)',
    color: '#fff',
  },
  pythonEditor: {
    height: 300,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  runRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  previewPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    minHeight: 420,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    padding: 12,
  },
  previewHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  previewTitle: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.9rem',
    color: 'var(--colour-text)',
  },
  previewFrame: {
    flex: 1,
    minHeight: 320,
    overflow: 'hidden',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
  },
  htmlSplit: {
    display: 'flex',
    flexDirection: 'column',
    height: 430,
    gap: 6,
    width: '100%',
    minWidth: 0,
  },
  htmlSplitLabel: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
    flexShrink: 0,
  },
  htmlLeft: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    gap: 0,
  },
  htmlEditorPane: {
    display: 'flex',
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
  },
  htmlCodeEditor: {
    width: '100%',
    minWidth: 0,
    flex: '1 1 auto',
  },
  noFile: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9ca3af',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
  },
}
