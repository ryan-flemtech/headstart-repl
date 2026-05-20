import React, { useState } from 'react'
import SplitPane from '../../shared/SplitPane'
import { CodeEditor } from '../../shared/CodeEditor'
import { initPyodide, runPython, provideInput, isPyodideReady } from '../../shared/pyodide'
import { buildIframeSrc, getIframeText } from '../../shared/iframe'
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

  function set(field, value) {
    onUpdate({ ...task, [field]: value })
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
      const result = await runPython(task.starterCode ?? '', {
        onOutput: echoOutput,
        onInputRequired: p => setInputPrompt(p),
      })
      setInputPrompt(null)
      setRunStatus(result.status)

      if (task.check?.value) {
        const passes = accumulated.toLowerCase().includes(task.check.value.toLowerCase())
        setCheckResult(passes ? 'pass' : 'fail')
        set('_checkTested', true)
      }
    } else {
      const src = buildIframeSrc(task.starterFiles ?? [], task.entryFile ?? 'index.html', {
        assets: lesson.assets ?? [],
        assetsPath: resolveAssetsPath(lesson.assetsPath),
      })
      setIframeSrc(src)
      setRunStatus('success')

      if (task.check?.value) {
        setTimeout(() => {
          const text = getIframeText(iframeRef.current)
          const passes = text.toLowerCase().includes(task.check.value.toLowerCase())
          setCheckResult(passes ? 'pass' : 'fail')
          set('_checkTested', true)
        }, 400)
      }
    }
    setRunning(false)
  }

  return (
    <div style={s.wrap}>
      {/* Task title */}
      <Field label="Task title">
        <input
          style={s.input}
          value={task.title}
          onChange={e => set('title', e.target.value)}
          placeholder="e.g. Hello World"
        />
      </Field>

      {/* Explainer */}
      <Field label="Explainer (Markdown)">
        <ExplainerEditor
          value={task.explainer}
          onChange={v => set('explainer', v)}
        />
      </Field>

      {/* Carry-through */}
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

      {/* Completion check */}
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
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <select style={{ ...s.select, flex: '0 0 auto' }} value={task.check.type} onChange={e => set('check', { ...task.check, type: e.target.value })}>
              <option value="output_contains">output_contains</option>
            </select>
            <input
              style={{ ...s.input, flex: 1 }}
              value={task.check.value}
              onChange={e => set('check', { ...task.check, value: e.target.value })}
              placeholder="String that output must contain…"
            />
          </div>
        )}
      </Field>

      <div style={s.divider} />

      {/* Starter code / files */}
      {isPython ? (
        <>
          <Field label="Starter code">
            <div style={{ height: 200 }}>
              <CodeEditor
                value={task.starterCode ?? ''}
                language="python"
                onChange={v => set('starterCode', v)}
              />
            </div>
          </Field>

          {/* Run button — Python */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="btn-primary"
              onClick={handleRun}
              disabled={running || pyodideStatus === 'loading'}
              style={{ padding: '10px 28px', fontSize: 15 }}
            >
              {running ? 'Running…' : pyodideStatus === 'loading' ? 'Getting Python ready…' : 'Run'}
            </button>
            {pyodideStatus === 'loading' && (
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--colour-primary)' }}>
                Getting Python ready…
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
        {/* HTML — editor left, preview right */}
        <div style={s.htmlSplit}>
          <span style={s.htmlSplitLabel}>Files &amp; Preview</span>
          <SplitPane
            style={{ flex: 1, minHeight: 0 }}
            left={
              <div style={s.htmlLeft}>
                <FileManager
                  files={task.starterFiles ?? []}
                  entryFile={task.entryFile}
                  selectedFile={selectedFile}
                  onSelectFile={setSelectedFile}
                  onAddFile={f => set('starterFiles', [...(task.starterFiles ?? []), f])}
                  onDeleteFile={name => set('starterFiles', (task.starterFiles ?? []).filter(f => f.name !== name))}
                  onChangeType={(name, type) => set('starterFiles', (task.starterFiles ?? []).map(f => f.name === name ? { ...f, type } : f))}
                  onChangeEntryFile={name => set('entryFile', name)}
                />
                {selectedFile && (
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <CodeEditor
                      key={selectedFile}
                      value={(task.starterFiles ?? []).find(f => f.name === selectedFile)?.content ?? ''}
                      language={(task.starterFiles ?? []).find(f => f.name === selectedFile)?.type ?? 'html'}
                      onChange={v => set('starterFiles', (task.starterFiles ?? []).map(f => f.name === selectedFile ? { ...f, content: v } : f))}
                    />
                  </div>
                )}
                <div style={{ flexShrink: 0, padding: '8px 0 4px' }}>
                  <button
                    className="btn-primary"
                    onClick={handleRun}
                    disabled={running}
                    style={{ padding: '10px 28px', fontSize: 15 }}
                  >
                    {running ? 'Running…' : 'Run'}
                  </button>
                </div>
              </div>
            }
            right={
              <div style={s.htmlRight}>
                <IframePreview src={iframeSrc} iframeRef={iframeRef} fill />
                {checkResult !== null && (
                  <div style={{
                    flexShrink: 0,
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
                      ? '✅ Check passes — students will see the completion banner.'
                      : `⚠️ Check does not pass — review your check value ("${task.check?.value ?? ''}")`}
                  </div>
                )}
              </div>
            }
          />
        </div>

        {/* Asset browser — shown when lesson has assets configured */}
        {lesson.assetsPath && lesson.assets?.length > 0 && (
          <Field label="Asset browser (read-only — copy paths to use in starter code)">
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
    gap: 20,
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
  divider: {
    height: 1,
    background: '#e5e7eb',
    margin: '4px 0',
  },
  htmlSplit: {
    display: 'flex',
    flexDirection: 'column',
    height: 380,
    gap: 6,
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
  htmlRight: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    gap: 8,
    padding: '0 0 4px 0',
  },
}
