import React, { useEffect, useState } from 'react'
import SplitPane from '../../shared/SplitPane'
import { CodeEditor } from '../../shared/CodeEditor'
import { initPyodide, runPython, stopPython, provideInput, isPyodideReady } from '../../shared/pyodide'
import { buildIframeSrc, waitForIframeText } from '../../shared/iframe'
import { evaluateSingleCheck, normalizeChecks } from '../../shared/checks'
import AssetBrowser from '../../shared/AssetBrowser'
import ExplainerEditor from './ExplainerEditor'
import FileManager from './FileManager'
import BuilderOutputPanel from './BuilderOutputPanel'
import IframePreview from '../../app/components/IframePreview'
import ScratchWorkspace, { SPRITE_TYPES } from '../../app/components/ScratchWorkspace'
import { DEFAULT_SPRITES } from '../../shared/scratch'

const CODE_FONT_STYLE = {
  fontFamily: "'JetBrains Mono', monospace",
  fontVariantLigatures: 'none',
  fontFeatureSettings: '"liga" 0, "calt" 0',
}

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
  const [checkResult, setCheckResult]   = useState(null)  // scratch only
  const [checkResults, setCheckResults] = useState(null)  // python/html: null | [{type,value,passed}]
  const [htmlPreviewOpen, setHtmlPreviewOpen] = useState(false)
  const iframeRef = React.useRef(null)
  const appendOutputRef = React.useRef(null)

  const isPython  = lesson.type === 'python'
  const isScratch = lesson.type === 'scratch'
  const [selectedFile, setSelectedFile] = useState(task.starterFiles?.[0]?.name ?? '')
  const [codeTab, setCodeTab] = useState('starter')
  const [selectedCompleteFile, setSelectedCompleteFile] = useState('')
  const [testScratchBlocks, setTestScratchBlocks] = useState(null)
  const [starterBlocksOpen, setStarterBlocksOpen] = useState(false)
  const [starterBlocksSyncKey, setStarterBlocksSyncKey] = useState(0)
  const [scratchModalTab, setScratchModalTab] = useState('starter')
  const [modalStarterBlocks, setModalStarterBlocks] = useState(null)
  const modalStarterBlocksRef = React.useRef(null)
  const modalCompleteBlocksRef = React.useRef(null)
  const isCompleteTab = codeTab === 'complete'
  const activePythonCode = isCompleteTab ? (task.completeCode ?? '') : (task.starterCode ?? '')
  const activeFiles = isCompleteTab ? (task.completeFiles ?? []) : (task.starterFiles ?? [])
  const activeSelectedFile = isCompleteTab ? selectedCompleteFile : selectedFile
  const activeEntryFile = isCompleteTab ? (task.completeEntryFile ?? task.entryFile ?? 'index.html') : (task.entryFile ?? 'index.html')

  function set(field, value) {
    onUpdate({ ...task, [field]: value })
  }

  function cloneBlocks(blocks) {
    if (!blocks) return null
    if (typeof structuredClone === 'function') return structuredClone(blocks)
    return JSON.parse(JSON.stringify(blocks))
  }

  function handleCodeTabChange(tab) {
    if (tab === codeTab) return

    setOutput('')
    setRunStatus(null)
    setCheckResult(null)
    setCheckResults(null)
    setIframeSrc(null)
    setHtmlPreviewOpen(false)

    if (tab === 'complete') {
      if (isPython) {
        if (task.completeCode == null) {
          set('completeCode', task.starterCode ?? '')
        }
      } else if (!isScratch) {
        if (!task.completeFiles?.length) {
          const initFiles = (task.starterFiles ?? []).map(f => ({ ...f }))
          onUpdate({ ...task, completeFiles: initFiles })
          setSelectedCompleteFile(initFiles[0]?.name ?? '')
        } else {
          setSelectedCompleteFile(task.completeFiles[0]?.name ?? selectedFile ?? '')
        }
      }
    }

    setCodeTab(tab)
  }

  function handleStop() {
    stopPython()
  }

  useEffect(() => {
    if (!isPython && !isScratch) setHtmlPreviewOpen(false)
  }, [task.id, lesson.type])

  function handleOpenStarterBlocks() {
    const blocks = cloneBlocks(task.starterBlocks)
    modalStarterBlocksRef.current = blocks
    modalCompleteBlocksRef.current = cloneBlocks(task.completeBlocks)
    setModalStarterBlocks(blocks)
    setTestScratchBlocks(cloneBlocks(blocks))
    setScratchModalTab('starter')
    setStarterBlocksOpen(true)
    setCheckResult(null)
  }

  function handleCloseStarterBlocks() {
    setStarterBlocksSyncKey(key => key + 1)
    requestAnimationFrame(() => setStarterBlocksOpen(false))
  }

  function handleScratchModalTabChange(tab) {
    if (tab === scratchModalTab) return
    setCheckResult(null)

    if (tab === 'complete') {
      setStarterBlocksSyncKey(key => key + 1)
      requestAnimationFrame(() => {
        const starterSnapshot = modalStarterBlocksRef.current ?? modalStarterBlocks ?? task.starterBlocks
        const initBlocks = task.completeBlocks != null
          ? cloneBlocks(task.completeBlocks)
          : cloneBlocks(starterSnapshot)
        if (task.completeBlocks == null) {
          set('completeBlocks', initBlocks)
        }
        modalCompleteBlocksRef.current = initBlocks
        setTestScratchBlocks(initBlocks)
        setScratchModalTab('complete')
      })
      return
    }

    setScratchModalTab('starter')
  }

  async function handleRun() {
    if (running) return
    setRunning(true)
    setOutput('')
    setRunStatus(null)
    setCheckResult(null)
    setCheckResults(null)
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

      const checksToEval = normalizeChecks(task.check)
      if (checksToEval.length > 0) {
        setCheckResults(checksToEval.map(c => ({ ...c, passed: evaluateSingleCheck(c, accumulated, { status: result.status }) })))
        set('_checkTested', true)
      }
    } else if (!isScratch) {
      setHtmlPreviewOpen(true)
      const src = buildIframeSrc(activeFiles, activeEntryFile, {
        assets: lesson.assets ?? [],
        assetsPath: resolveAssetsPath(lesson.assetsPath),
      })
      setIframeSrc(src)
      setRunStatus('success')

      const checksToEval = normalizeChecks(task.check)
      if (checksToEval.length > 0) {
        waitForIframeText().then(text => {
          setCheckResults(checksToEval.map(c => ({ ...c, passed: evaluateSingleCheck(c, text) })))
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem', color: 'var(--colour-text)' }}>
            Explainer (Markdown)
          </span>
          <label style={s.checkToggle}>
            <input
              type="checkbox"
              checked={task.explainer !== null && task.explainer !== undefined}
              onChange={e => set('explainer', e.target.checked ? '' : null)}
            />
            Enable
          </label>
        </div>
        {task.explainer !== null && task.explainer !== undefined && (
          <ExplainerEditor
            title={task.title}
            value={task.explainer}
            onChange={v => set('explainer', v)}
          />
        )}
      </div>

      <Field label={isScratch ? 'Carry blocks from task' : 'Carry code from task'}>
        <select
          style={s.select}
          value={(isScratch ? task.carryBlocksFrom : task.carryCodeFrom) ?? ''}
          onChange={e => set(isScratch ? 'carryBlocksFrom' : 'carryCodeFrom', e.target.value ? parseInt(e.target.value, 10) : null)}
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
              onChange={e => set('check', e.target.checked
                ? (isScratch
                  ? [{ type: 'block_used', evaluation: 'after_run', opcode: 'motion_movesteps' }]
                  : isPython
                    ? [{ type: 'code_no_error' }]
                    : [{ type: 'output_contains', value: '' }])
                : null)}
            />
            Enable check
          </label>
        </div>
        {task.check && isScratch ? (
          <ScratchCheckListEditor
            checks={normalizeChecks(task.check)}
            onChange={checks => set('check', checks)}
            sprites={task.sprites?.length > 0 ? task.sprites : DEFAULT_SPRITES}
          />
        ) : task.check && (
          <CheckListEditor
            checks={normalizeChecks(task.check)}
            onChange={checks => set('check', checks)}
            allowCodeNoError={isPython}
          />
        )}
      </Field>

      <div style={s.divider} />

      {isPython ? (
        <>
          <CodeWorkspaceTabs activeTab={codeTab} onChange={handleCodeTabChange} />

          <Field label={isCompleteTab ? 'Complete code' : 'Starter code'}>
            <div style={s.pythonEditor}>
              <CodeEditor
                value={activePythonCode}
                language="python"
                onChange={v => isCompleteTab ? set('completeCode', v) : set('starterCode', v)}
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
            running={running}
            inputPrompt={inputPrompt}
            onInputSubmit={v => { appendOutputRef.current?.(v + '\n'); setInputPrompt(null); provideInput(v) }}
            checkResults={checkResults}
          />
        </>
      ) : isScratch ? (
        <>
          <div style={s.starterBlocksSummary}>
            <div>
              <span style={s.previewTitle}>Starter Blocks</span>
              <p style={s.summaryText}>
                {task.starterBlocks && Object.values(task.starterBlocks).some(Boolean)
                  ? 'Starter blocks configured for this task.'
                  : 'No starter blocks set. Students will start with an empty workspace.'}
              </p>
            </div>
            <button className="btn-ghost" style={s.secondaryBtn} onClick={handleOpenStarterBlocks}>
              Edit
            </button>
          </div>

          {starterBlocksOpen && (
            <Modal title="Starter blocks" onClose={handleCloseStarterBlocks}>
              <div style={s.scratchModalContent}>
                <div style={s.scratchModalHeader}>
                  <CodeWorkspaceTabs
                    activeTab={scratchModalTab}
                    onChange={handleScratchModalTabChange}
                    starterLabel="Starter blocks"
                    testLabel="Complete blocks"
                  />
                  {scratchModalTab === 'complete' && checkResult !== null && (
                    <span style={checkResult === 'pass' ? s.scratchCheckPass : s.scratchCheckFail}>
                      {checkResult === 'pass' ? 'Check passes' : 'Check not passing'}
                    </span>
                  )}
                </div>

                <div style={s.scratchModalBody}>
                  {scratchModalTab === 'starter' && (
                    <div style={s.scratchConfigSidebar}>
                      <div style={s.sidebarSection}>
                        <span style={s.sidebarSectionTitle}>Toolbox blocks</span>
                        <ScratchToolboxPicker
                          toolbox={task.toolbox ?? ''}
                          onChange={toolbox => set('toolbox', toolbox)}
                        />
                      </div>
                      <div style={s.sidebarSection}>
                        <span style={s.sidebarSectionTitle}>Sprites</span>
                        <SpriteManager
                          sprites={task.sprites?.length > 0 ? task.sprites : DEFAULT_SPRITES}
                          onChange={sprites => set('sprites', sprites)}
                          assetsPath={lesson.assetsPath ? resolveAssetsPath(lesson.assetsPath) : ''}
                        />
                      </div>
                      <div style={s.sidebarSection}>
                        <span style={s.sidebarSectionTitle}>Backdrops</span>
                        <BackdropManager
                          backdrops={task.backdrops?.length > 0 ? task.backdrops : [{ id: 'backdrop1', name: 'Backdrop 1', colour: '#ffffff' }]}
                          onChange={backdrops => set('backdrops', backdrops)}
                          assetsPath={lesson.assetsPath ? resolveAssetsPath(lesson.assetsPath) : ''}
                        />
                      </div>
                    </div>
                  )}

                  <div style={s.scratchModalWorkspace}>
                    {scratchModalTab === 'starter' ? (
                      <ScratchWorkspace
                        key={`builder-scratch-starter-${task.id}-${(task.sprites ?? []).map(sp => sp.id).join(',')}`}
                        task={task}
                        hideStage
                        assetsPath={lesson.assetsPath ? resolveAssetsPath(lesson.assetsPath) : ''}
                        initialStates={modalStarterBlocks}
                        onStateChange={states => {
                          modalStarterBlocksRef.current = states
                          setModalStarterBlocks(states)
                          set('starterBlocks', states)
                        }}
                        syncNowKey={starterBlocksSyncKey}
                      />
                    ) : (
                      <ScratchWorkspace
                        key={`builder-scratch-complete-${task.id}-${(task.sprites ?? []).map(sp => sp.id).join(',')}`}
                        task={task}
                        assetsPath={lesson.assetsPath ? resolveAssetsPath(lesson.assetsPath) : ''}
                        initialStates={testScratchBlocks}
                        onStateChange={states => {
                          modalCompleteBlocksRef.current = states
                          setTestScratchBlocks(states)
                          set('completeBlocks', states)
                        }}
                        onCheckResult={passed => {
                          setCheckResult(passed ? 'pass' : 'fail')
                          if (task.check) {
                            onUpdate({
                              ...task,
                              completeBlocks: modalCompleteBlocksRef.current ?? testScratchBlocks,
                              _checkTested: true,
                            })
                          }
                        }}
                        syncNowKey={starterBlocksSyncKey}
                      />
                    )}
                  </div>
                </div>
              </div>
            </Modal>
          )}
        </>
      ) : (
        <>
          <CodeWorkspaceTabs activeTab={codeTab} onChange={handleCodeTabChange} />

          <div style={s.htmlSplit}>
            <div style={s.htmlSplitHeader}>
              <span style={s.htmlSplitLabel}>{isCompleteTab ? 'Complete files' : 'Starter files'}</span>
              <button
                className="btn-primary"
                onClick={handleRun}
                disabled={running}
                style={{ padding: '8px 22px', fontSize: 14 }}
              >
                {running ? 'Running...' : 'Run'}
              </button>
            </div>
            <SplitPane
              defaultSplit={34}
              style={{ flex: 1, minHeight: 0 }}
              left={
                <div style={s.htmlLeft}>
                  <FileManager
                    files={activeFiles}
                    entryFile={activeEntryFile}
                    selectedFile={activeSelectedFile}
                    onSelectFile={isCompleteTab ? setSelectedCompleteFile : setSelectedFile}
                    onAddFile={f => {
                      if (isCompleteTab) {
                        set('completeFiles', [...(task.completeFiles ?? []), f])
                        setSelectedCompleteFile(f.name)
                      } else {
                        set('starterFiles', [...(task.starterFiles ?? []), f])
                        setSelectedFile(f.name)
                      }
                    }}
                    onSetFiles={(newFiles, newEntry) => {
                      if (isCompleteTab) {
                        onUpdate({ ...task, completeFiles: newFiles, completeEntryFile: newEntry })
                        setSelectedCompleteFile(newFiles[0]?.name ?? '')
                      } else {
                        onUpdate({ ...task, starterFiles: newFiles, entryFile: newEntry })
                        setSelectedFile(newFiles[0]?.name ?? '')
                      }
                    }}
                    onDeleteFile={name => {
                      const current = isCompleteTab ? (task.completeFiles ?? []) : (task.starterFiles ?? [])
                      const next = current.filter(f => f.name !== name)
                      if (isCompleteTab) {
                        set('completeFiles', next)
                        setSelectedCompleteFile(next[0]?.name ?? '')
                      } else {
                        set('starterFiles', next)
                        setSelectedFile(next[0]?.name ?? '')
                      }
                    }}
                    onChangeType={(name, type) => {
                      if (isCompleteTab) set('completeFiles', (task.completeFiles ?? []).map(f => f.name === name ? { ...f, type } : f))
                      else set('starterFiles', (task.starterFiles ?? []).map(f => f.name === name ? { ...f, type } : f))
                    }}
                    onChangeEntryFile={name => isCompleteTab ? set('completeEntryFile', name) : set('entryFile', name)}
                  />
                </div>
              }
              right={
                htmlPreviewOpen ? (
                  <div style={s.builderPreviewPane}>
                    <IframePreview
                      src={iframeSrc}
                      iframeRef={iframeRef}
                      fill
                      rightActions={
                        <button
                          type="button"
                          style={s.previewCollapseBtn}
                          onClick={() => setHtmlPreviewOpen(false)}
                          title="Collapse Preview"
                          aria-label="Collapse Preview"
                        >
                          {'>'}
                        </button>
                      }
                    />
                    {checkResults !== null && (() => {
                      const allPassed = checkResults.every(r => r.passed)
                      return (
                        <div style={{ border: '1px solid', borderRadius: 8, padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: '0.88rem', lineHeight: 1.6, background: allPassed ? '#f0fdf4' : '#fffbeb', borderColor: allPassed ? '#bbf7d0' : '#fde68a', flexShrink: 0 }}>
                          {checkResults.length === 1 ? (
                            checkResults[0].passed
                              ? 'Check passes - students will see the completion banner.'
                              : `Check does not pass - review your check value ("${checkResults[0].value ?? ''}")`
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {checkResults.map((r, i) => (
                                <div key={i}>{r.passed ? `Check ${i + 1} passes.` : `Check ${i + 1} does not pass - review value ("${r.value ?? ''}")`}</div>
                              ))}
                              <div style={{ marginTop: 4, fontWeight: 700 }}>{allPassed ? 'All checks pass - students will see the completion banner.' : 'Not all checks pass.'}</div>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                ) : (
                  <div style={s.htmlEditorWithRail}>
                    <div style={s.htmlEditorPane}>
                      {activeSelectedFile ? (
                        <CodeEditor
                          key={`${codeTab}-${activeSelectedFile}`}
                          value={activeFiles.find(f => f.name === activeSelectedFile)?.content ?? ''}
                          language={activeFiles.find(f => f.name === activeSelectedFile)?.type ?? 'html'}
                          onChange={v => {
                            if (isCompleteTab) set('completeFiles', (task.completeFiles ?? []).map(f => f.name === activeSelectedFile ? { ...f, content: v } : f))
                            else set('starterFiles', (task.starterFiles ?? []).map(f => f.name === activeSelectedFile ? { ...f, content: v } : f))
                          }}
                          style={s.htmlCodeEditor}
                        />
                      ) : (
                        <div style={s.noFile}>Select or add a file to edit.</div>
                      )}
                    </div>
                    <button
                      type="button"
                      style={s.previewRail}
                      onClick={() => setHtmlPreviewOpen(true)}
                      title="Show Preview"
                      aria-label="Show Preview"
                    >
                      <span style={s.previewRailIcon}>{'<'}</span>
                      <span style={s.previewRailLabel}>Preview</span>
                    </button>
                  </div>
                )
              }
            />
          </div>

          <div style={{ display: 'none' }}>
            {checkResults !== null && (() => {
              const allPassed = checkResults.every(r => r.passed)
              return (
                <div style={{ border: '1px solid', borderRadius: 8, padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: '0.88rem', lineHeight: 1.6, background: allPassed ? '#f0fdf4' : '#fffbeb', borderColor: allPassed ? '#bbf7d0' : '#fde68a' }}>
                  {checkResults.length === 1 ? (
                    checkResults[0].passed
                      ? 'Check passes - students will see the completion banner.'
                      : `Check does not pass - review your check value ("${checkResults[0].value ?? ''}")`
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {checkResults.map((r, i) => (
                        <div key={i}>{r.passed ? `✅ Check ${i + 1} passes.` : `⚠️ Check ${i + 1} does not pass - review value ("${r.value ?? ''}")`}</div>
                      ))}
                      <div style={{ marginTop: 4, fontWeight: 700 }}>{allPassed ? '✅ All checks pass - students will see the completion banner.' : '⚠️ Not all checks pass.'}</div>
                    </div>
                  )}
                </div>
              )
            })()}
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

function CheckListEditor({ checks, onChange, allowCodeNoError = false }) {
  function updateCheckType(index, type) {
    const current = checks[index]
    const next = type === 'code_no_error' || type === 'output_not_empty'
      ? { type }
      : { ...current, type, value: current.value ?? '' }
    updateCheck(index, next)
  }

  function updateCheck(index, updated) {
    onChange(checks.map((c, i) => i === index ? updated : c))
  }
  function removeCheck(index) {
    onChange(checks.filter((_, i) => i !== index))
  }
  function addCheck() {
    onChange([...checks, allowCodeNoError ? { type: 'code_no_error' } : { type: 'output_contains', value: '' }])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      {checks.map((check, index) => (
        <div key={index} style={s.checkRow}>
          {checks.length > 1 && (
            <span style={s.checkIndexLabel}>#{index + 1}</span>
          )}
          <div style={s.checkEditor}>
            <select style={{ ...s.select, flex: '0 0 auto' }} value={check.type} onChange={e => updateCheckType(index, e.target.value)}>
              {allowCodeNoError && <option value="code_no_error">code_no_error</option>}
              <option value="output_contains">output_contains</option>
              <option value="output_equals">output_equals</option>
              <option value="output_line_count">output_line_count</option>
              <option value="output_not_empty">output_not_empty</option>
            </select>
            {check.type === 'code_no_error' || check.type === 'output_not_empty' ? (
              <div style={s.checkHelp}>
                {check.type === 'code_no_error'
                  ? 'Passes when Python runs without an error.'
                  : 'Passes when the run produces any visible output.'}
              </div>
            ) : (
              <textarea
                style={s.checkValue}
                value={check.value ?? ''}
                onChange={e => updateCheck(index, { ...check, value: e.target.value })}
                placeholder={
                  check.type === 'output_line_count'
                    ? 'Expected number of output lines...'
                    : check.type === 'output_equals'
                      ? 'Exact output expected...'
                      : 'String that output must contain...'
                }
              />
            )}
          </div>
          {checks.length > 1 && (
            <button type="button" style={s.removeCheckBtn} onClick={() => removeCheck(index)} title="Remove check">×</button>
          )}
        </div>
      ))}
      <button type="button" className="btn-ghost" style={s.addCheckBtn} onClick={addCheck}>
        + Add check
      </button>
    </div>
  )
}

const SCRATCH_TOOLBOX_GROUPS = [
  {
    name: 'Events',
    colour: '#FFAB19',
    blocks: [
      ['event_whenflagclicked', 'when green flag clicked'],
      ['event_whenkeypressed', 'when key pressed'],
      ['event_whenthisspriteclicked', 'when sprite clicked'],
      ['event_whenbackdropswitchesto', 'when backdrop switches to'],
      ['event_broadcast', 'broadcast'],
      ['event_broadcastandwait', 'broadcast and wait'],
      ['event_whenbroadcastreceived', 'when I receive'],
    ],
  },
  {
    name: 'Motion',
    colour: '#4C97FF',
    blocks: [
      ['motion_movesteps', 'move steps'],
      ['motion_turnright', 'turn right'],
      ['motion_turnleft', 'turn left'],
      ['motion_pointindirection', 'point in direction'],
      ['motion_gotoxy', 'go to x/y'],
      ['motion_goto', 'go to'],
      ['motion_glidesecstoxy', 'glide to x/y'],
      ['motion_glideto', 'glide to'],
      ['motion_ifonedge_bounce', 'if on edge, bounce'],
      ['motion_setx', 'set x'],
      ['motion_sety', 'set y'],
      ['motion_changexby', 'change x'],
      ['motion_changeyby', 'change y'],
      ['motion_setrotationstyle', 'set rotation style'],
    ],
  },
  {
    name: 'Looks',
    colour: '#9966FF',
    blocks: [
      ['looks_sayforsecs', 'say for seconds'],
      ['looks_say', 'say'],
      ['looks_think', 'think'],
      ['looks_thinkforsecs', 'think for seconds'],
      ['looks_show', 'show'],
      ['looks_hide', 'hide'],
      ['looks_setsizeto', 'set size'],
      ['looks_changesizeby', 'change size'],
      ['looks_switchcostumeto', 'switch costume to'],
      ['looks_nextcostume', 'next costume'],
      ['looks_costumenumber', 'costume number'],
      ['looks_switchbackdropto', 'switch backdrop to'],
      ['looks_nextbackdrop', 'next backdrop'],
    ],
  },
  {
    name: 'Control',
    colour: '#FFAB19',
    blocks: [
      ['control_wait', 'wait'],
      ['control_repeat', 'repeat'],
      ['control_forever', 'forever'],
      ['control_if', 'if then'],
      ['control_if_else', 'if then else'],
      ['control_stop', 'stop all'],
    ],
  },
  {
    name: 'Sensing',
    colour: '#5CB1D6',
    blocks: [
      ['sensing_askandwait', 'ask and wait'],
      ['sensing_answer', 'answer'],
      ['sensing_keypressed', 'key pressed?'],
      ['sensing_mousedown', 'mouse down?'],
      ['sensing_touchingedge', 'touching edge?'],
    ],
  },
  {
    name: 'Operators',
    colour: '#59C059',
    blocks: [
      ['operator_equals', 'equals'],
      ['operator_gt', 'greater than'],
      ['operator_lt', 'less than'],
      ['operator_and', 'and'],
      ['operator_or', 'or'],
      ['operator_not', 'not'],
      ['operator_add', 'add'],
      ['operator_subtract', 'subtract'],
      ['operator_join', 'join'],
    ],
  },
  {
    name: 'Variables',
    colour: '#FF8C1A',
    blocks: [
      ['data_variable', 'variable'],
      ['data_setvariableto', 'set variable'],
      ['data_changevariableby', 'change variable'],
    ],
  },
  {
    name: 'Sound',
    colour: '#CF63CF',
    blocks: [
      ['sound_play', 'start sound'],
      ['sound_playuntildone', 'play sound until done'],
      ['sound_stopallsounds', 'stop all sounds'],
    ],
  },
]

const SCRATCH_BLOCK_OPTIONS = SCRATCH_TOOLBOX_GROUPS.flatMap(group => group.blocks)
const SCRATCH_ALL_BLOCK_TYPES = SCRATCH_BLOCK_OPTIONS.map(([type]) => type)

function buildScratchToolboxXml(selectedTypes) {
  const selected = new Set(selectedTypes)
  const categories = SCRATCH_TOOLBOX_GROUPS.map(group => {
    const blocks = group.blocks
      .filter(([type]) => selected.has(type))
      .map(([type]) => `<block type="${type}"/>`)
      .join('')

    if (!blocks) return ''
    return `<category name="${group.name}" colour="${group.colour}">${blocks}</category>`
  }).join('')

  return `<xml>${categories}</xml>`
}

function parseScratchToolboxXml(toolbox) {
  if (!toolbox) return SCRATCH_ALL_BLOCK_TYPES
  if (typeof DOMParser === 'undefined') return []

  try {
    const parsed = new DOMParser().parseFromString(toolbox, 'text/xml')
    if (parsed.querySelector('parsererror')) return []
    return Array.from(parsed.querySelectorAll('block'))
      .map(block => block.getAttribute('type'))
      .filter(Boolean)
  } catch {
    return []
  }
}

export function ScratchToolboxPicker({ toolbox, onChange }) {
  const usesAllBlocks = !toolbox
  const selectedTypes = new Set(parseScratchToolboxXml(toolbox))

  function setSelected(nextSelected) {
    onChange(buildScratchToolboxXml(nextSelected))
  }

  function toggleBlock(type, checked) {
    const next = new Set(selectedTypes)
    if (checked) next.add(type)
    else next.delete(type)
    setSelected(next)
  }

  function toggleGroup(group, checked) {
    const next = new Set(selectedTypes)
    for (const [type] of group.blocks) {
      if (checked) next.add(type)
      else next.delete(type)
    }
    setSelected(next)
  }

  return (
    <div style={s.toolboxPicker}>
      <label style={s.toolboxAllRow}>
        <input
          type="checkbox"
          checked={usesAllBlocks}
          onChange={e => onChange(e.target.checked ? '' : buildScratchToolboxXml(SCRATCH_ALL_BLOCK_TYPES))}
        />
        <span>All blocks</span>
      </label>

      <div style={usesAllBlocks ? s.toolboxDisabled : s.toolboxGroups}>
        {SCRATCH_TOOLBOX_GROUPS.map(group => {
          const groupTypes = group.blocks.map(([type]) => type)
          const checkedCount = groupTypes.filter(type => selectedTypes.has(type)).length
          const groupChecked = checkedCount === groupTypes.length

          return (
            <div key={group.name} style={s.toolboxGroup}>
              <label style={s.toolboxGroupHeader}>
                <input
                  type="checkbox"
                  checked={groupChecked}
                  disabled={usesAllBlocks}
                  onChange={e => toggleGroup(group, e.target.checked)}
                />
                <span style={{ ...s.toolboxGroupSwatch, background: group.colour }} />
                <span>{group.name}</span>
              </label>
              <div style={s.toolboxBlockGrid}>
                {group.blocks.map(([type, label]) => (
                  <label key={type} style={s.toolboxBlockItem}>
                    <input
                      type="checkbox"
                      checked={usesAllBlocks || selectedTypes.has(type)}
                      disabled={usesAllBlocks}
                      onChange={e => toggleBlock(type, e.target.checked)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ScratchCheckListEditor({ checks, onChange, sprites }) {
  function updateCheck(index, updated) {
    onChange(checks.map((c, i) => i === index ? updated : c))
  }
  function removeCheck(index) {
    onChange(checks.filter((_, i) => i !== index))
  }
  function addCheck() {
    onChange([...checks, { type: 'block_used', evaluation: 'manual', opcode: 'motion_movesteps' }])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      {checks.map((check, index) => (
        <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          {checks.length > 1 && (
            <span style={{ ...s.checkIndexLabel, paddingTop: 10 }}>#{index + 1}</span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <ScratchCheckEditor
              check={check}
              onChange={updated => updateCheck(index, updated)}
              sprites={sprites}
            />
          </div>
          {checks.length > 1 && (
            <button type="button" style={{ ...s.removeCheckBtn, marginTop: 8 }} onClick={() => removeCheck(index)} title="Remove check">×</button>
          )}
        </div>
      ))}
      <button type="button" className="btn-ghost" style={s.addCheckBtn} onClick={addCheck}>
        + Add check
      </button>
    </div>
  )
}

function ScratchCheckEditor({ check, onChange, sprites = [{ id: 'sprite1', name: 'Sprite 1' }] }) {
  const type = check.type ?? 'block_used'

  function changeType(nextType) {
    if (nextType === 'sprite_property') {
      onChange({
        type: 'sprite_property',
        evaluation: 'after_run',
        spriteName: sprites[0]?.name ?? 'Sprite 1',
        property: 'x',
        operator: 'greater_than',
        value: 50,
      })
      return
    }

    if (nextType === 'variable_equals') {
      onChange({
        type: 'variable_equals',
        evaluation: 'manual',
        variableName: 'score',
        value: 10,
      })
      return
    }

    onChange({ type: 'block_used', evaluation: 'manual', opcode: 'motion_movesteps' })
  }

  return (
    <div style={s.scratchCheckEditor}>
      <select style={s.select} value={type} onChange={e => changeType(e.target.value)}>
        <option value="block_used">block_used</option>
        <option value="sprite_property">sprite_property</option>
        <option value="variable_equals">variable_equals</option>
      </select>

      <select
        style={s.select}
        value={check.evaluation ?? (type === 'block_used' ? 'manual' : 'after_run')}
        onChange={e => onChange({ ...check, evaluation: e.target.value })}
      >
        <option value="manual">manual</option>
        <option value="after_run">after run</option>
      </select>

      {type === 'block_used' ? (
        <select
          style={s.select}
          value={check.opcode ?? ''}
          onChange={e => onChange({ ...check, opcode: e.target.value })}
        >
          {SCRATCH_BLOCK_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      ) : type === 'variable_equals' ? (
        <>
          <input
            style={s.input}
            value={check.variableName ?? 'score'}
            onChange={e => onChange({ ...check, variableName: e.target.value })}
            placeholder="Variable name"
          />
          <input
            style={s.input}
            value={check.value ?? ''}
            onChange={e => onChange({ ...check, value: e.target.value })}
            placeholder="Expected value"
          />
        </>
      ) : (
        <>
          <select
            style={s.select}
            value={check.spriteName ?? sprites[0]?.name ?? 'Sprite 1'}
            onChange={e => onChange({ ...check, spriteName: e.target.value })}
          >
            {sprites.map(sp => <option key={sp.id} value={sp.name}>{sp.name}</option>)}
          </select>
          <select
            style={s.select}
            value={check.property ?? 'x'}
            onChange={e => onChange({ ...check, property: e.target.value })}
          >
            <option value="x">x</option>
            <option value="y">y</option>
            <option value="size">size</option>
            <option value="direction">direction</option>
            <option value="visible">visible</option>
          </select>
          <select
            style={s.select}
            value={check.operator ?? 'equals'}
            onChange={e => onChange({ ...check, operator: e.target.value })}
          >
            <option value="equals">equals</option>
            <option value="greater_than">greater_than</option>
            <option value="less_than">less_than</option>
          </select>
          <input
            style={s.input}
            value={check.value ?? ''}
            onChange={e => onChange({ ...check, value: e.target.value })}
            placeholder="Expected value"
          />
        </>
      )}
    </div>
  )
}

function CodeWorkspaceTabs({ activeTab, onChange, starterLabel = 'Starter code', testLabel = 'Complete code' }) {
  return (
    <div style={s.workspaceTabs} role="tablist" aria-label="Code workspace">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'starter'}
        style={{ ...s.workspaceTab, ...(activeTab === 'starter' ? s.workspaceTabActive : {}) }}
        onClick={() => onChange('starter')}
      >
        {starterLabel}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'complete'}
        style={{ ...s.workspaceTab, ...(activeTab === 'complete' ? s.workspaceTabActive : {}) }}
        onClick={() => onChange('complete')}
      >
        {testLabel}
      </button>
    </div>
  )
}

function Modal({ title, children, onClose }) {
  return (
    <div style={s.modalBackdrop} role="dialog" aria-modal="true">
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>{title}</span>
          <button style={s.closeBtn} onClick={onClose} title="Close">x</button>
        </div>
        <div style={s.modalBody}>
          {children}
        </div>
      </div>
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

const SPRITE_TYPE_OPTIONS = SPRITE_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))

export function SpriteManager({ sprites, onChange, assetsPath = '' }) {
  const [expandedCostumes, setExpandedCostumes] = React.useState({})

  function addSprite() {
    const next = sprites.length + 1
    onChange([...sprites, { id: `sprite${next}`, name: `Sprite ${next}`, type: 'cat', x: 0, y: 0, size: 100, direction: 90 }])
  }

  function removeSprite(id) {
    if (sprites.length <= 1) return
    onChange(sprites.filter(sp => sp.id !== id))
  }

  function update(id, field, value) {
    onChange(sprites.map(sp => sp.id === id ? { ...sp, [field]: value } : sp))
  }

  function toggleCostumes(id) {
    setExpandedCostumes(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function addCostume(spriteId) {
    const sp = sprites.find(s => s.id === spriteId)
    const next = (sp?.costumes ?? []).length + 1
    onChange(sprites.map(s => s.id === spriteId ? { ...s, costumes: [...(s.costumes ?? []), { name: `costume${next}`, image: '' }] } : s))
  }

  function removeCostume(spriteId, idx) {
    onChange(sprites.map(s => s.id === spriteId ? { ...s, costumes: (s.costumes ?? []).filter((_, i) => i !== idx) } : s))
  }

  function updateCostume(spriteId, idx, field, value) {
    onChange(sprites.map(s => {
      if (s.id !== spriteId) return s
      return { ...s, costumes: (s.costumes ?? []).map((c, i) => i === idx ? { ...c, [field]: value } : c) }
    }))
  }

  return (
    <div style={s.spriteManager}>
      {sprites.map(sp => (
        <div key={sp.id}>
          <div style={s.spriteRow}>
            <input
              style={{ ...s.input, width: 120, flex: '0 0 120px' }}
              value={sp.name}
              onChange={e => update(sp.id, 'name', e.target.value)}
              placeholder="Name"
            />
            <select style={{ ...s.select, flex: '0 0 auto' }} value={sp.type ?? 'cat'} onChange={e => update(sp.id, 'type', e.target.value)}>
              {SPRITE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <label style={s.spriteField}>
              <span style={s.spriteFieldLabel}>X</span>
              <input style={{ ...s.input, width: 56 }} type="number" value={sp.x ?? 0} onChange={e => update(sp.id, 'x', Number(e.target.value))} />
            </label>
            <label style={s.spriteField}>
              <span style={s.spriteFieldLabel}>Y</span>
              <input style={{ ...s.input, width: 56 }} type="number" value={sp.y ?? 0} onChange={e => update(sp.id, 'y', Number(e.target.value))} />
            </label>
            <label style={s.spriteField}>
              <span style={s.spriteFieldLabel}>Size</span>
              <input style={{ ...s.input, width: 60 }} type="number" min="10" max="500" value={sp.size ?? 100} onChange={e => update(sp.id, 'size', Number(e.target.value))} />
            </label>
            <label style={s.spriteField}>
              <span style={s.spriteFieldLabel}>Dir</span>
              <input style={{ ...s.input, width: 56 }} type="number" value={sp.direction ?? 90} onChange={e => update(sp.id, 'direction', Number(e.target.value))} />
            </label>
            <button
              type="button"
              style={s.costumeToggleBtn}
              onClick={() => toggleCostumes(sp.id)}
              title="Edit costumes"
            >
              Costumes ({(sp.costumes ?? []).length})
            </button>
            <button
              type="button"
              style={s.removeBtn}
              onClick={() => removeSprite(sp.id)}
              disabled={sprites.length <= 1}
              title="Remove sprite"
            >
              ✕
            </button>
          </div>
          {expandedCostumes[sp.id] && (
            <CostumeManager
              costumes={sp.costumes ?? []}
              assetsPath={assetsPath}
              onAdd={() => addCostume(sp.id)}
              onRemove={idx => removeCostume(sp.id, idx)}
              onUpdate={(idx, field, value) => updateCostume(sp.id, idx, field, value)}
            />
          )}
        </div>
      ))}
      <button type="button" className="btn-ghost" style={s.addSpriteBtn} onClick={addSprite}>
        + Add sprite
      </button>
    </div>
  )
}

function CostumeManager({ costumes, assetsPath, onAdd, onRemove, onUpdate }) {
  return (
    <div style={s.costumeManager}>
      {costumes.length === 0 && (
        <p style={s.costumeEmpty}>No costumes — sprite uses its built-in shape. Add a costume to use an image from the assets folder.</p>
      )}
      {costumes.map((c, idx) => {
        const resolvedUrl = c.image && assetsPath
          ? assetsPath.replace(/\/$/, '') + '/' + c.image.replace(/^\//, '')
          : null
        return (
          <div key={idx} style={s.costumeRow}>
            {idx === 0 && <span style={s.costumeTag}>Default</span>}
            <input
              style={{ ...s.input, flex: '1 1 100px', minWidth: 0 }}
              value={c.name}
              onChange={e => onUpdate(idx, 'name', e.target.value)}
              placeholder="Costume name"
            />
            <input
              style={{ ...s.input, flex: '2 1 160px', minWidth: 0 }}
              value={c.image ?? ''}
              onChange={e => onUpdate(idx, 'image', e.target.value)}
              placeholder="e.g. sprites/cat1.png"
            />
            {resolvedUrl && (
              <img
                src={resolvedUrl}
                alt=""
                style={s.costumeThumb}
                onError={e => { e.target.style.display = 'none' }}
                onLoad={e => { e.target.style.display = 'block' }}
              />
            )}
            <button
              type="button"
              style={s.removeBtn}
              onClick={() => onRemove(idx)}
              title="Remove costume"
            >✕</button>
          </div>
        )
      })}
      <button type="button" className="btn-ghost" style={s.addSpriteBtn} onClick={onAdd}>
        + Add costume
      </button>
    </div>
  )
}

export function BackdropManager({ backdrops, onChange, assetsPath }) {
  function add() {
    const next = backdrops.length + 1
    onChange([...backdrops, { id: `backdrop${next}`, name: `Backdrop ${next}`, colour: '#87CEEB' }])
  }
  function remove(id) {
    if (backdrops.length <= 1) return
    onChange(backdrops.filter(b => b.id !== id))
  }
  function update(id, updates) {
    onChange(backdrops.map(b => b.id === id ? { ...b, ...updates } : b))
  }

  return (
    <div style={s.backdropManager}>
      {backdrops.map((b, i) => {
        const isImage = b.image !== undefined
        const resolvedUrl = isImage && b.image && assetsPath
          ? assetsPath.replace(/\/$/, '') + '/' + b.image.replace(/^\//, '')
          : null
        return (
          <div key={b.id} style={s.backdropRow}>
            {i === 0 && <span style={s.backdropTag}>Default</span>}
            <input
              style={{ ...s.input, flex: '1 1 110px', minWidth: 0 }}
              value={b.name}
              onChange={e => update(b.id, { name: e.target.value })}
              placeholder="Name"
            />
            <select
              style={{ ...s.select, flex: '0 0 auto' }}
              value={isImage ? 'image' : 'colour'}
              onChange={e => {
                if (e.target.value === 'image') update(b.id, { image: '', colour: undefined })
                else update(b.id, { colour: b.colour ?? '#ffffff', image: undefined })
              }}
            >
              <option value="colour">Colour</option>
              <option value="image">Image</option>
            </select>
            {isImage ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 160px', minWidth: 0 }}>
                <input
                  style={{ ...s.input, flex: 1, minWidth: 0 }}
                  value={b.image ?? ''}
                  onChange={e => update(b.id, { image: e.target.value })}
                  placeholder="e.g. backdrops/sky.png"
                />
                {resolvedUrl && (
                  <img
                    src={resolvedUrl}
                    alt=""
                    style={s.backdropThumb}
                    onError={e => { e.target.style.display = 'none' }}
                    onLoad={e => { e.target.style.display = 'block' }}
                  />
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="color"
                  value={b.colour ?? '#ffffff'}
                  onChange={e => update(b.id, { colour: e.target.value })}
                  style={s.colorInput}
                />
                <div style={{ ...s.backdropSwatch, background: b.colour ?? '#ffffff' }} />
              </div>
            )}
            <button
              type="button"
              style={s.removeBtn}
              onClick={() => remove(b.id)}
              disabled={backdrops.length <= 1}
              title="Remove backdrop"
            >✕</button>
          </div>
        )
      })}
      <button type="button" className="btn-ghost" style={s.addSpriteBtn} onClick={add}>
        + Add backdrop
      </button>
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
  checkRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
  },
  checkIndexLabel: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.8rem',
    color: '#6b7280',
    paddingTop: 10,
    minWidth: 22,
    textAlign: 'right',
  },
  removeCheckBtn: {
    marginTop: 8,
    flexShrink: 0,
    width: 28,
    height: 28,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#fff',
    color: '#6b7280',
    cursor: 'pointer',
    fontSize: '1rem',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCheckBtn: {
    alignSelf: 'flex-start',
    color: 'var(--colour-primary)',
    border: '1px solid var(--colour-primary)',
    padding: '6px 12px',
    fontSize: '0.83rem',
  },
  checkEditor: {
    display: 'grid',
    gridTemplateColumns: 'max-content minmax(0, 1fr)',
    gap: 8,
    alignItems: 'start',
    flex: 1,
  },
  checkValue: {
    padding: '8px 10px',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    ...CODE_FONT_STYLE,
    fontSize: '0.9rem',
    lineHeight: 1.5,
    color: 'var(--colour-text)',
    outline: 'none',
    width: '100%',
    minHeight: 92,
    resize: 'vertical',
    whiteSpace: 'pre-wrap',
  },
  checkHelp: {
    padding: '8px 10px',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
    color: '#4b5563',
    background: '#f9fafb',
  },
  scratchCheckEditor: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 8,
    alignItems: 'start',
    marginTop: 8,
  },
  collapsibleField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
    background: '#fff',
  },
  collapsibleHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '12px 14px',
    border: 0,
    background: 'transparent',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
  },
  collapsibleLabel: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
  },
  collapsibleChevron: {
    fontSize: '1rem',
    color: '#6b7280',
    transition: 'transform 0.15s ease',
    lineHeight: 1,
  },
  toolboxPicker: {
    borderTop: '1px solid #e5e7eb',
    background: '#fff',
    overflow: 'hidden',
  },
  toolboxAllRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 14px',
    borderBottom: '1px solid #e5e7eb',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    fontWeight: 700,
    color: 'var(--colour-text)',
    cursor: 'pointer',
  },
  toolboxGroups: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
    gap: 12,
    padding: 14,
  },
  toolboxDisabled: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
    gap: 12,
    padding: 14,
    opacity: 0.5,
  },
  toolboxGroup: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
    background: '#fafafa',
  },
  toolboxGroupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    borderBottom: '1px solid #e5e7eb',
    background: '#fff',
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
    fontWeight: 700,
    color: 'var(--colour-text)',
    cursor: 'pointer',
  },
  toolboxGroupSwatch: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  toolboxBlockGrid: {
    display: 'grid',
    gap: 6,
    padding: 10,
  },
  toolboxBlockItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'var(--font-body)',
    fontSize: '0.83rem',
    lineHeight: 1.35,
    color: '#374151',
    cursor: 'pointer',
  },
  scratchPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    height: 560,
    minHeight: 480,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    padding: 12,
  },
  scratchWorkspaceWrap: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  scratchCheckPass: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    fontWeight: 700,
    color: '#166534',
    background: '#dcfce7',
    border: '1px solid #bbf7d0',
    borderRadius: 999,
    padding: '4px 10px',
  },
  scratchCheckFail: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    fontWeight: 700,
    color: '#92400e',
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: 999,
    padding: '4px 10px',
  },
  starterBlocksSummary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '14px 16px',
    background: '#fff',
  },
  summaryText: {
    margin: '4px 0 0',
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
    lineHeight: 1.45,
    color: '#6b7280',
  },
  secondaryBtn: {
    color: 'var(--colour-primary)',
    border: '1px solid var(--colour-primary)',
    padding: '8px 14px',
    fontSize: '0.86rem',
    whiteSpace: 'nowrap',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 40,
    background: 'rgba(17, 24, 39, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    width: 'min(1400px, 97vw)',
    height: 'min(900px, 93vh)',
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 24px 70px rgba(0, 0, 0, 0.28)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    height: 50,
    padding: '0 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #e5e7eb',
    background: '#fafafa',
    flexShrink: 0,
  },
  modalTitle: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    color: 'var(--colour-text)',
  },
  closeBtn: {
    width: 32,
    height: 32,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '1rem',
    lineHeight: 1,
  },
  modalBody: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    padding: 14,
  },
  scratchModalContent: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  scratchModalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexShrink: 0,
  },
  scratchModalBody: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    overflow: 'hidden',
  },
  scratchConfigSidebar: {
    width: 300,
    flexShrink: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    borderRight: '1px solid #e5e7eb',
    background: '#fafafa',
    padding: '12px 10px',
  },
  scratchModalWorkspace: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    display: 'flex',
    overflow: 'hidden',
  },
  sidebarSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  sidebarSectionTitle: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.78rem',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    paddingBottom: 4,
    borderBottom: '1px solid #e5e7eb',
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
  htmlSplitHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexShrink: 0,
  },
  htmlSplitLabel: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
    flexShrink: 0,
  },
  htmlEditorWithRail: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
    gap: 8,
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
  builderPreviewPane: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
    gap: 10,
  },
  previewRail: {
    width: 44,
    minWidth: 44,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    color: 'var(--colour-primary)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 0',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
  },
  previewRailIcon: {
    fontSize: 22,
    lineHeight: 1,
  },
  previewRailLabel: {
    writingMode: 'vertical-rl',
    transform: 'rotate(180deg)',
    fontSize: '0.74rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  previewCollapseBtn: {
    width: 28,
    height: 28,
    border: '1px solid rgba(255,255,255,0.45)',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 20,
    lineHeight: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
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
  spriteManager: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 12,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#fafafa',
  },
  spriteRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  costumeToggleBtn: {
    padding: '4px 8px',
    fontSize: '0.78rem',
    fontFamily: 'var(--font-body)',
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    background: '#fff',
    cursor: 'pointer',
    color: '#6b7280',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  costumeManager: {
    marginLeft: 8,
    marginTop: 2,
    marginBottom: 4,
    padding: '10px 12px',
    background: '#f5f3ff',
    border: '1px dashed #c4b5fd',
    borderRadius: 6,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  costumeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  costumeTag: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--colour-primary)',
    background: '#f3eeff',
    border: '1px solid #e9d5ff',
    borderRadius: 4,
    padding: '2px 6px',
    flexShrink: 0,
  },
  costumeThumb: {
    width: 32,
    height: 32,
    objectFit: 'contain',
    borderRadius: 4,
    border: '1px solid #e5e7eb',
    flexShrink: 0,
    background: '#fff',
  },
  costumeEmpty: {
    margin: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: '#9ca3af',
    lineHeight: 1.4,
  },
  spriteField: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  spriteFieldLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    color: '#6b7280',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  removeBtn: {
    width: 28,
    height: 28,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#fff',
    cursor: 'pointer',
    fontSize: '0.8rem',
    color: '#9ca3af',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addSpriteBtn: {
    alignSelf: 'flex-start',
    fontSize: '0.83rem',
    padding: '6px 12px',
    color: 'var(--colour-primary)',
    border: '1px dashed var(--colour-primary)',
    borderRadius: 6,
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
  },
  backdropManager: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 12,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#fafafa',
  },
  backdropRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  backdropTag: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--colour-primary)',
    background: '#f3eeff',
    border: '1px solid #e9d5ff',
    borderRadius: 4,
    padding: '2px 6px',
    flexShrink: 0,
  },
  backdropSwatch: {
    width: 28,
    height: 28,
    borderRadius: 5,
    border: '1px solid #e5e7eb',
    flexShrink: 0,
  },
  backdropThumb: {
    width: 40,
    height: 28,
    objectFit: 'cover',
    borderRadius: 4,
    border: '1px solid #e5e7eb',
    flexShrink: 0,
  },
  colorInput: {
    width: 36,
    height: 28,
    padding: 2,
    border: '1px solid #e5e7eb',
    borderRadius: 5,
    cursor: 'pointer',
    flexShrink: 0,
  },
}
