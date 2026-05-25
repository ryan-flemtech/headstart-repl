import React, { useEffect, useState } from 'react'
import SplitPane from '../../shared/SplitPane'
import { CodeEditor } from '../../shared/CodeEditor'
import { initPyodide, runPython, stopPython, provideInput, isPyodideReady } from '../../shared/pyodide'
import { buildIframeSrc, waitForIframeText } from '../../shared/iframe'
import { evaluateSingleCheck, filterChecksForInteraction, normalizeChecks } from '../../shared/checks'
import AssetBrowser from '../../shared/AssetBrowser'
import AssetPicker from '../../shared/AssetPicker'
import ExplainerEditor, { MarkdownFieldEditor } from './ExplainerEditor'
import FileManager from './FileManager'
import BuilderOutputPanel from './BuilderOutputPanel'
import IframePreview from '../../app/components/IframePreview'
import { CollapseTabButton } from '../../app/components/CollapsiblePanelControls'
import ScratchWorkspace, { SPRITE_TYPES } from '../../app/components/ScratchWorkspace'
import QuizTask from '../../app/components/QuizTask'
import InformationTask from '../../app/components/InformationTask'
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

function getTaskInlineCodeLanguages(lessonType, task) {
  if (lessonType === 'python') return ['python']
  if (lessonType === 'scratch') return ['scratch']
  if (lessonType === 'html') return ['html', 'javascript', 'css']
  return []
}

export default function TaskEditor({ task, lesson, onUpdate, parentGroup }) {
  const [optionsOpen, setOptionsOpen]   = useState(false)
  const [output, setOutput]             = useState('')
  const [runStatus, setRunStatus]       = useState(null)
  const [running, setRunning]           = useState(false)
  const [pyodideStatus, setPyodideStatus] = useState(isPyodideReady() ? 'ready' : 'idle')
  const [inputPrompt, setInputPrompt]   = useState(null)
  const [iframeSrc, setIframeSrc]       = useState(null)
  const [checkResult, setCheckResult]   = useState(null)  // scratch only
  const [checkResults, setCheckResults] = useState(null)  // python/html: null | [{type,value,passed}]
  const [incorrectCheckResults, setIncorrectCheckResults] = useState(null) // null | [{type,value,passed,hint}]
  const [htmlPreviewOpen, setHtmlPreviewOpen] = useState(false)
  const iframeRef = React.useRef(null)
  const appendOutputRef = React.useRef(null)

  const isPython  = lesson.type === 'python'
  const isScratch = lesson.type === 'scratch'
  const isQuiz = task.taskType === 'quiz'
  const isInformation = task.taskType === 'information'
  const [quizSelectedAnswer, setQuizSelectedAnswer] = useState('')
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
  const activeCodeForChecks = isPython
    ? activePythonCode
    : activeFiles.map(file => `--- ${file.name} ---\n${file.content ?? ''}`).join('\n\n')
  const explainerInlineCodeLanguages = getTaskInlineCodeLanguages(lesson.type, task)

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
    setIncorrectCheckResults(null)
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

  function makeDefaultQuizOptions() {
    return [
      { id: 'a', text: '' },
      { id: 'b', text: '' },
    ]
  }

  function renumberQuizOptions(options) {
    return options.map((option, index) => ({
      ...option,
      id: String.fromCharCode(97 + index),
    }))
  }

  function handleTaskTypeChange(taskType) {
    setOutput('')
    setRunStatus(null)
    setCheckResult(null)
    setCheckResults(null)
    setIncorrectCheckResults(null)
    setIframeSrc(null)
    setQuizSelectedAnswer('')

    if (taskType === 'quiz') {
      const quizType = task.taskType === 'quiz' ? (task.quizType ?? 'multiple_choice') : 'multiple_choice'
      const options = task.options?.length ? renumberQuizOptions(task.options) : makeDefaultQuizOptions()
      const answer = options.some(option => option.id === task.check?.value) ? task.check.value : ''
      onUpdate({
        ...task,
        taskType: 'quiz',
        quizType,
        options,
        check: answer ? { type: 'answer_equals', value: answer } : null,
        carryCodeFrom: null,
        carryBlocksFrom: null,
      })
      return
    }

    if (taskType === 'information') {
      const {
        options: _options,
        check: _check,
        carryCodeFrom: _carryCodeFrom,
        carryBlocksFrom: _carryBlocksFrom,
        starterCode: _starterCode,
        completeCode: _completeCode,
        starterFiles: _starterFiles,
        completeFiles: _completeFiles,
        entryFile: _entryFile,
        completeEntryFile: _completeEntryFile,
        toolbox: _toolbox,
        starterBlocks: _starterBlocks,
        completeBlocks: _completeBlocks,
        interactionMode: _interactionMode,
        _checkTested,
        ...rest
      } = task
      onUpdate({
        ...rest,
        taskType: 'information',
        informationType: task.informationType ?? 'standard',
        explainer: task.explainer ?? '',
      })
      return
    }

    const { taskType: _taskType, informationType: _informationType, options: _options, ...rest } = task
    const typeFields = lesson.type === 'python'
      ? { starterCode: task.starterCode ?? '', carryCodeFrom: task.carryCodeFrom ?? null }
      : lesson.type === 'scratch'
      ? { toolbox: task.toolbox ?? '', starterBlocks: task.starterBlocks ?? null, carryBlocksFrom: task.carryBlocksFrom ?? null }
      : {
          starterFiles: task.starterFiles?.length ? task.starterFiles : [{ name: 'index.html', type: 'html', content: '<!DOCTYPE html>\n<html>\n<body>\n\n</body>\n</html>' }],
          entryFile: task.entryFile ?? 'index.html',
          carryCodeFrom: task.carryCodeFrom ?? null,
        }
    onUpdate({
      ...rest,
      ...typeFields,
      check: null,
    })
  }

  function handleInteractionModeChange(interactionMode) {
    const nextChecks = filterChecksForInteraction(task.check, interactionMode)
    onUpdate({
      ...task,
      interactionMode,
      check: task.check ? (nextChecks.length > 0 ? nextChecks : null) : task.check,
      _checkTested: false,
    })
    setCheckResults(null)
    setRunStatus(null)
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
    setIncorrectCheckResults(null)
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
        const checkContext = { status: result.status, code: activePythonCode, variables: result.variables ?? {} }
        const results = checksToEval.map(c => ({ ...c, passed: evaluateSingleCheck(c, accumulated, checkContext) }))
        setCheckResults(results)
        set('_checkTested', true)
        if (!results.every(r => r.passed)) {
          const incorrectChecksToEval = normalizeChecks(task.incorrectChecks ?? [])
          if (incorrectChecksToEval.length > 0) {
            setIncorrectCheckResults(incorrectChecksToEval.map(c => ({ ...c, passed: evaluateSingleCheck(c, accumulated, checkContext) })))
          }
        }
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
        const codeStr = activeFiles.map(f => f.content).join('\n')
        waitForIframeText().then(text => {
          setOutput(text)
          const iframeDoc = iframeRef.current?.contentDocument ?? null
          const results = checksToEval.map(c => ({ ...c, passed: evaluateSingleCheck(c, text, { code: codeStr, iframeDoc }) }))
          setCheckResults(results)
          set('_checkTested', true)
          if (!results.every(r => r.passed)) {
            const incorrectChecksToEval = normalizeChecks(task.incorrectChecks ?? [])
            if (incorrectChecksToEval.length > 0) {
              setIncorrectCheckResults(incorrectChecksToEval.map(c => ({ ...c, passed: evaluateSingleCheck(c, text, { code: codeStr, iframeDoc }) })))
            }
          }
        })
      }
    }
    setRunning(false)
  }

  function handleTestChecks() {
    const checksToEval = normalizeChecks(task.check)
    if (checksToEval.length === 0) return
    const codeStr = isPython ? activePythonCode : activeFiles.map(f => f.content).join('\n')
    const results = checksToEval.map(c => ({ ...c, passed: evaluateSingleCheck(c, '', { code: codeStr }) }))
    setCheckResults(results)
    setIncorrectCheckResults(null)
    set('_checkTested', true)
    if (!results.every(r => r.passed)) {
      const incorrectChecksToEval = normalizeChecks(task.incorrectChecks ?? [])
      if (incorrectChecksToEval.length > 0) {
        setIncorrectCheckResults(incorrectChecksToEval.map(c => ({ ...c, passed: evaluateSingleCheck(c, '', { code: codeStr }) })))
      }
    }
  }

  function handleQuizTypeChange(quizType) {
    setQuizSelectedAnswer('')
    setCheckResults(null)
    setRunStatus(null)

    if (quizType === 'multiple_choice') {
      const options = task.options?.length ? task.options : makeDefaultQuizOptions()
      const answer = options.some(o => o.id === task.check?.value) ? task.check.value : ''
      onUpdate({ ...task, quizType: 'multiple_choice', options, check: answer ? { type: 'answer_equals', value: answer } : null })
      return
    }
    if (quizType === 'match') {
      const defaultPairs = [{ id: 'p1', prompt: '', answer: '' }, { id: 'p2', prompt: '', answer: '' }]
      onUpdate({ ...task, quizType: 'match', pairs: task.pairs?.length ? task.pairs : defaultPairs, check: null })
      return
    }
    if (quizType === 'fill_blank') {
      onUpdate({ ...task, quizType: 'fill_blank', mode: task.mode ?? 'drag', text: task.text ?? '', blanks: task.blanks ?? [], check: null })
      return
    }
    if (quizType === 'short_answer') {
      const existing = task.check?.type?.startsWith('answer_') ? task.check : null
      onUpdate({ ...task, quizType: 'short_answer', check: existing ?? { type: 'answer_contains', value: '' } })
    }
  }

  function handleQuizPreviewSelect(answer, passedOverride) {
    if (passedOverride === null) {
      setQuizSelectedAnswer(answer)
      return
    }
    const passed =
      typeof passedOverride === 'boolean'
        ? passedOverride
        : task.check
          ? evaluateSingleCheck(task.check, answer, { answer: typeof answer === 'string' ? answer : '' })
          : false
    setQuizSelectedAnswer(answer)
    setRunStatus('submitted')
    setCheckResults([{ type: 'quiz_result', passed }])
    if (task.check || typeof passedOverride === 'boolean') set('_checkTested', true)
  }

  return (
    <div style={s.wrap}>
      {parentGroup ? (
        <Field label="Task title">
          <div style={{ ...s.input, background: '#f8f5ff', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1 }}>{task.title}</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--colour-primary)', opacity: 0.7 }}>auto-named from group</span>
          </div>
        </Field>
      ) : (
        <Field label="Task title">
          <input
            style={s.input}
            value={task.title}
            onChange={e => set('title', e.target.value)}
            placeholder="e.g. Hello World"
          />
        </Field>
      )}

      <Field label="Task format">
        <div style={s.taskFormatGrid}>
          {[
            { value: 'code', label: lesson.type === 'scratch' ? 'Scratch' : 'Code', iconType: lesson.type === 'scratch' ? 'scratch' : 'code' },
            { value: 'information', label: 'Information', iconType: 'information' },
            { value: 'quiz', label: 'Quiz', iconType: 'quiz' },
          ].map(({ value, label, iconType }) => {
            const active = value === (isQuiz ? 'quiz' : isInformation ? 'information' : 'code')
            return (
              <button
                key={value}
                type="button"
                style={{ ...s.taskFormatBtn, ...(active ? s.taskFormatBtnActive : {}) }}
                onClick={() => handleTaskTypeChange(value)}
              >
                <TaskFormatIcon type={iconType} />
                <span style={s.taskFormatLabel}>{label}</span>
              </button>
            )
          })}
        </div>
      </Field>

      {isInformation && (
        <Field label="Information type">
          <div style={s.infoTypeGrid}>
            {[
              { value: 'standard', label: 'Standard', hint: 'Markdown explainer' },
              { value: 'recap', label: 'Recap', hint: 'Recap pane plus markdown' },
              { value: 'introduction', label: 'Introduction', hint: 'Lesson metadata slide' },
            ].map(option => {
              const active = (task.informationType ?? 'standard') === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  style={{ ...s.infoTypeBtn, ...(active ? s.infoTypeBtnActive : {}) }}
                  onClick={() => set('informationType', option.value)}
                >
                  <span style={s.infoTypeLabel}>{option.label}</span>
                  <span style={s.infoTypeHint}>{option.hint}</span>
                </button>
              )
            })}
          </div>
        </Field>
      )}

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
            lessonType={lesson.type}
            inlineCodeLanguages={explainerInlineCodeLanguages}
          />
        )}
      </div>

      {isInformation && (
        <div style={s.previewPanel}>
          <div style={s.previewHeader}>
            <span style={s.previewTitle}>Student preview</span>
          </div>
          <div style={s.infoPreview}>
            <InformationTask task={task} lesson={lesson} />
          </div>
        </div>
      )}

      {!isQuiz && !isInformation && (() => {
        const summaryParts = []
        if (task.check) summaryParts.push('check enabled')
        if (task.interactionMode === 'submit') summaryParts.push('submit mode')
        const summary = summaryParts.join(' · ')

        return (
          <div style={s.optionsSection}>
            <button
              type="button"
              style={s.optionsSectionToggle}
              onClick={() => setOptionsOpen(o => !o)}
              aria-expanded={optionsOpen}
            >
              <span style={s.optionsSectionTitle}>Task options</span>
              {!optionsOpen && summary && (
                <span style={s.optionsSummaryText}>{summary}</span>
              )}
              <span style={{ ...s.optionsChevron, transform: optionsOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>

            {optionsOpen && (
              <div style={s.optionsBody}>
                <CarryThroughPicker task={task} lesson={lesson} onUpdate={onUpdate} isScratch={isScratch} isPython={isPython} />

                {!isScratch && (
                  <Field label="Student interaction">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={s.optionChoiceGrid}>
                        {[
                          { value: 'run', label: 'Run', text: 'Students run code and see output.' },
                          { value: 'submit', label: 'Submit', text: 'Students submit code without running it.' },
                        ].map(choice => {
                          const active = choice.value === (task.interactionMode ?? 'run')
                          return (
                            <label
                              key={choice.value}
                              style={{ ...s.optionChoiceCard, ...(active ? s.optionChoiceCardActive : {}) }}
                            >
                              <input
                                type="radio"
                                name={`interaction-${task.id}`}
                                checked={active}
                                onChange={() => handleInteractionModeChange(choice.value)}
                                style={s.optionChoiceInput}
                              />
                              <span style={s.optionChoiceTitle}>{choice.label}</span>
                              <span style={{ ...s.optionChoiceText, ...(active ? s.optionChoiceTextActive : {}) }}>{choice.text}</span>
                            </label>
                          )
                        })}
                      </div>
                      {task.interactionMode === 'submit' && (
                        <p style={s.optionNote}>
                          Submit mode hides the Run button. Only code-based checks can be evaluated on submit.
                        </p>
                      )}
                    </div>
                  </Field>
                )}

                <Field label="Completion check">
                  <label style={{ ...s.optionToggleCard, ...(task.check ? s.optionToggleCardActive : {}) }}>
                    <input
                      type="checkbox"
                      checked={!!task.check}
                      onChange={e => set('check', e.target.checked
                        ? (isScratch
                          ? [{ type: 'block_used', evaluation: 'after_run', opcode: 'motion_movesteps' }]
                          : task.interactionMode === 'submit'
                            ? [{ type: 'code_contains', value: '' }]
                            : isPython
                            ? [{ type: 'code_no_error' }]
                            : [{ type: 'output_contains', value: '' }])
                        : null)}
                      style={s.optionChoiceInput}
                    />
                    <span style={s.optionChoiceTitle}>Enable check</span>
                    <span style={{ ...s.optionChoiceText, ...(task.check ? s.optionChoiceTextActive : {}) }}>
                      Add completion criteria students can pass.
                    </span>
                  </label>
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
                      interactionMode={task.interactionMode ?? 'run'}
                      allowCodeNoError={isPython && task.interactionMode !== 'submit'}
                      allowVariableChecks={isPython && task.interactionMode !== 'submit'}
                      allowDomChecks={!isPython && !isScratch && task.interactionMode !== 'submit'}
                      lessonType={lesson.type}
                      output={output}
                      code={activeCodeForChecks}
                    />
                  )}
                </Field>

                {task.check && !isScratch && (
                  <Field label="Incorrect checks">
                    <p style={s.optionNote}>
                      When the completion check fails, these detect specific mistakes and show a targeted hint in the feedback banner. Each check passes when it detects a particular wrong pattern.
                    </p>
                    <CheckListEditor
                      checks={normalizeChecks(task.incorrectChecks ?? [])}
                      onChange={checks => set('incorrectChecks', checks.length > 0 ? checks : null)}
                      interactionMode={task.interactionMode ?? 'run'}
                      allowCodeNoError={false}
                      allowVariableChecks={isPython && task.interactionMode !== 'submit'}
                      allowDomChecks={!isPython && task.interactionMode !== 'submit'}
                      lessonType={lesson.type}
                      output={output}
                      code={activeCodeForChecks}
                    />
                  </Field>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {!isInformation && <div style={s.divider} />}

      {isInformation ? null : isQuiz ? (
        <>
          <QuizTypePicker task={task} onQuizTypeChange={handleQuizTypeChange} />
          {(!task.quizType || task.quizType === 'multiple_choice') ? (
            <QuizOptionsBuilder task={task} onUpdate={onUpdate} lessonType={lesson.type} />
          ) : task.quizType === 'match' ? (
            <MatchPairsBuilder task={task} onUpdate={onUpdate} lessonType={lesson.type} />
          ) : task.quizType === 'fill_blank' ? (
            <FillBlankBuilder task={task} onUpdate={onUpdate} lessonType={lesson.type} />
          ) : task.quizType === 'short_answer' ? (
            <ShortAnswerBuilder task={task} onUpdate={onUpdate} lessonType={lesson.type} />
          ) : null}
          <div style={s.previewPanel}>
            <div style={s.previewHeader}>
              <span style={s.previewTitle}>Student preview</span>
            </div>
            <QuizTask
              task={task}
              showQuestion
              selectedAnswer={quizSelectedAnswer}
              onSelectAnswer={handleQuizPreviewSelect}
              submitted={runStatus === 'submitted'}
              checkPassed={checkResults?.every(r => r.passed) ?? false}
            />
            {checkResults !== null && (() => {
              const allPassed = checkResults.every(r => r.passed)
              return (
                <div style={{ border: '1px solid', borderRadius: 8, padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: '0.88rem', lineHeight: 1.6, background: allPassed ? '#f0fdf4' : '#fffbeb', borderColor: allPassed ? '#bbf7d0' : '#fde68a' }}>
                  {allPassed
                    ? 'Check passes — students will see the completion banner.'
                    : task.quizType === 'match' || task.quizType === 'fill_blank'
                      ? 'Check does not pass — try placing the correct answers in the preview.'
                      : 'Check does not pass — review the answer or check configuration.'}
                </div>
              )
            })()}
          </div>
        </>
      ) : isPython ? (
        <>
          <div style={s.codeWorkspaceStack}>
            <CodeWorkspaceTabs activeTab={codeTab} onChange={handleCodeTabChange} />

            <div style={s.pythonEditor}>
              <CodeEditor
                value={activePythonCode}
                language="python"
                onChange={v => isCompleteTab ? set('completeCode', v) : set('starterCode', v)}
                style={s.attachedCodeEditor}
              />
            </div>
          </div>

          {task.interactionMode === 'submit' ? (
            <>
              <div style={s.runRow}>
                <button
                  className="btn-primary"
                  onClick={handleTestChecks}
                  disabled={!task.check}
                  style={{ padding: '10px 28px', fontSize: 15 }}
                >
                  Test checks
                </button>
                {!task.check && (
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#9ca3af' }}>
                    No checks configured — add a check to test.
                  </span>
                )}
              </div>
              {checkResults !== null && (() => {
                const allPassed = checkResults.every(r => r.passed)
                return (
                  <>
                    <div style={{ border: '1px solid', borderRadius: 8, padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: '0.88rem', lineHeight: 1.6, background: allPassed ? '#f0fdf4' : '#fffbeb', borderColor: allPassed ? '#bbf7d0' : '#fde68a' }}>
                      {checkResults.length === 1 ? (
                        checkResults[0].passed
                          ? 'Check passes — students will see the completion banner.'
                          : formatCheckFailure(checkResults[0])
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {checkResults.map((r, i) => (
                            <div key={i}>{r.passed ? `Check ${i + 1} passes.` : `Check ${i + 1} does not pass — ${formatCheckFailureDetail(r)}`}</div>
                          ))}
                          <div style={{ marginTop: 4, fontWeight: 700 }}>{allPassed ? 'All checks pass — students will see the completion banner.' : 'Not all checks pass.'}</div>
                        </div>
                      )}
                    </div>
                    {!allPassed && <IncorrectCheckResultsDisplay results={incorrectCheckResults} />}
                  </>
                )
              })()}
            </>
          ) : (
            <>
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
                incorrectCheckResults={incorrectCheckResults}
              />
            </>
          )}
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
                          lessonId={lesson.id}
                          lessonType={lesson.type}
                        />
                      </div>
                      <div style={s.sidebarSection}>
                        <span style={s.sidebarSectionTitle}>Backdrops</span>
                        <BackdropManager
                          backdrops={task.backdrops?.length > 0 ? task.backdrops : [{ id: 'backdrop1', name: 'Backdrop 1', colour: '#ffffff' }]}
                          onChange={backdrops => set('backdrops', backdrops)}
                          assetsPath={lesson.assetsPath ? resolveAssetsPath(lesson.assetsPath) : ''}
                          lessonId={lesson.id}
                          lessonType={lesson.type}
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
          <div style={s.codeWorkspaceStack}>
            <CodeWorkspaceTabs
              activeTab={codeTab}
              onChange={handleCodeTabChange}
              rightAction={
                <button
                  type="button"
                  className="btn-primary"
                  onClick={task.interactionMode === 'submit' ? handleTestChecks : handleRun}
                  disabled={task.interactionMode === 'submit' ? !task.check : running}
                  style={{ padding: '7px 18px', fontSize: 13 }}
                >
                  {task.interactionMode === 'submit' ? 'Test checks' : running ? 'Running...' : 'Run'}
                </button>
              }
            />

            <div style={s.htmlSplit}>
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
                    attachedTop
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
                      leadingActions={
                        <CollapseTabButton
                          onClick={() => setHtmlPreviewOpen(false)}
                          direction="right"
                          title="Collapse Preview"
                          ariaLabel="Collapse Preview"
                        />
                      }
                    />
                    {checkResults !== null && (() => {
                      const allPassed = checkResults.every(r => r.passed)
                      return (
                        <>
                          <div style={{ border: '1px solid', borderRadius: 8, padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: '0.88rem', lineHeight: 1.6, background: allPassed ? '#f0fdf4' : '#fffbeb', borderColor: allPassed ? '#bbf7d0' : '#fde68a', flexShrink: 0 }}>
                            {checkResults.length === 1 ? (
                              checkResults[0].passed
                                ? 'Check passes - students will see the completion banner.'
                                : formatCheckFailure(checkResults[0])
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {checkResults.map((r, i) => (
                                  <div key={i}>{r.passed ? `Check ${i + 1} passes.` : `Check ${i + 1} does not pass - ${formatCheckFailureDetail(r)}`}</div>
                                ))}
                                <div style={{ marginTop: 4, fontWeight: 700 }}>{allPassed ? 'All checks pass - students will see the completion banner.' : 'Not all checks pass.'}</div>
                              </div>
                            )}
                          </div>
                          {!allPassed && <IncorrectCheckResultsDisplay results={incorrectCheckResults} />}
                        </>
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
          </div>

          <div style={task.interactionMode === 'submit' ? { marginTop: 8 } : { display: 'none' }}>
            {checkResults !== null && (() => {
              const allPassed = checkResults.every(r => r.passed)
              return (
                <>
                  <div style={{ border: '1px solid', borderRadius: 8, padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: '0.88rem', lineHeight: 1.6, background: allPassed ? '#f0fdf4' : '#fffbeb', borderColor: allPassed ? '#bbf7d0' : '#fde68a' }}>
                    {checkResults.length === 1 ? (
                      checkResults[0].passed
                        ? 'Check passes - students will see the completion banner.'
                        : formatCheckFailure(checkResults[0])
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {checkResults.map((r, i) => (
                          <div key={i}>{r.passed ? `✅ Check ${i + 1} passes.` : `⚠️ Check ${i + 1} does not pass - ${formatCheckFailureDetail(r)}`}</div>
                        ))}
                        <div style={{ marginTop: 4, fontWeight: 700 }}>{allPassed ? '✅ All checks pass - students will see the completion banner.' : '⚠️ Not all checks pass.'}</div>
                      </div>
                    )}
                  </div>
                  {!allPassed && <IncorrectCheckResultsDisplay results={incorrectCheckResults} />}
                </>
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

function QuizTypePicker({ task, onQuizTypeChange }) {
  const quizType = task.quizType ?? 'multiple_choice'
  const types = [
    { value: 'multiple_choice', label: 'Multiple Choice', meta: 'Pick one answer', icon: 'choice' },
    { value: 'match', label: 'Match', meta: 'Pair items', icon: 'match' },
    { value: 'fill_blank', label: 'Fill Blank', meta: 'Complete gaps', icon: 'blank' },
    { value: 'short_answer', label: 'Short Answer', meta: 'Typed response', icon: 'answer' },
  ]
  return (
    <Field label="Quiz type">
      <div style={s.quizTypeGrid}>
        {types.map(t => {
          const active = quizType === t.value
          return (
            <button
              key={t.value}
              type="button"
              style={{ ...s.quizTypeBtn, ...(active ? s.quizTypeBtnActive : {}) }}
              onClick={() => onQuizTypeChange(t.value)}
            >
              <QuizTypeIcon type={t.icon} />
              <span style={s.quizTypeLabel}>{t.label}</span>
              <span style={{ ...s.quizTypeMeta, ...(active ? s.quizTypeMetaActive : {}) }}>{t.meta}</span>
            </button>
          )
        })}
      </div>
    </Field>
  )
}

function MatchPairsBuilder({ task, onUpdate, lessonType = null }) {
  const pairs = task.pairs?.length ? task.pairs : [{ id: 'p1', prompt: '', answer: '' }, { id: 'p2', prompt: '', answer: '' }]

  function renumber(nextPairs) {
    return nextPairs.map((p, i) => ({ ...p, id: `p${i + 1}` }))
  }
  function updatePairs(nextPairs) {
    onUpdate({ ...task, pairs: renumber(nextPairs), _checkTested: false })
  }
  function updatePair(index, field, value) {
    updatePairs(pairs.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  return (
    <Field label="Pairs (students match left to right)">
      <div style={s.quizAnswerStack}>
        {pairs.map((pair, index) => (
          <div key={pair.id || index} style={s.quizAnswerCard}>
            <span style={s.quizAnswerBadge}>{index + 1}</span>
            <div style={s.matchPairEditorRow}>
              <div style={s.quizAnswerEditorBlock}>
                <span style={s.quizAnswerLabel}>Prompt</span>
                <MarkdownFieldEditor
                  height={132}
                  minHeight={118}
                  ariaLabel={`Match prompt ${index + 1} Markdown editor views`}
                  value={pair.prompt}
                  onChange={value => updatePair(index, 'prompt', value)}
                  placeholder={`Prompt ${index + 1} in Markdown`}
                  lessonType={lessonType}
                />
              </div>
              <span style={s.matchArrow}>-</span>
              <div style={s.quizAnswerEditorBlock}>
                <span style={s.quizAnswerLabel}>Answer</span>
                <MarkdownFieldEditor
                  height={132}
                  minHeight={118}
                  ariaLabel={`Match answer ${index + 1} Markdown editor views`}
                  value={pair.answer}
                  onChange={value => updatePair(index, 'answer', value)}
                  placeholder={`Correct answer ${index + 1} in Markdown`}
                  lessonType={lessonType}
                />
              </div>
            </div>
            <button
              type="button"
              style={s.removeBtn}
              onClick={() => updatePairs(pairs.filter((_, i) => i !== index))}
              disabled={pairs.length <= 2}
              title="Remove pair"
            >✕</button>
          </div>
        ))}
        <button type="button" className="btn-ghost" style={s.addCheckBtn} onClick={() => updatePairs([...pairs, { id: '', prompt: '', answer: '' }])}>
          + Add pair
        </button>
      </div>
    </Field>
  )
}

function FillBlankBuilder({ task, onUpdate, lessonType = null }) {
  const mode = task.mode ?? 'drag'
  const text = task.text ?? ''
  const blanks = task.blanks ?? []
  const blankCount = (text.match(/___/g) ?? []).length

  function handleTextChange(newText) {
    const count = (newText.match(/___/g) ?? []).length
    let newBlanks = [...blanks]
    while (newBlanks.length < count) newBlanks.push({ id: `b${newBlanks.length + 1}`, answer: '' })
    if (newBlanks.length > count) newBlanks = newBlanks.slice(0, count)
    onUpdate({ ...task, text: newText, blanks: newBlanks, _checkTested: false })
  }

  function updateBlank(index, answer) {
    const next = blanks.map((b, i) => i === index ? { ...b, answer } : b)
    onUpdate({ ...task, blanks: next, _checkTested: false })
  }

  return (
    <>
      <Field label="Mode">
        <div style={{ display: 'flex', gap: 24 }}>
          <label style={s.carryRadioLabel}>
            <input type="radio" checked={mode === 'drag'} onChange={() => onUpdate({ ...task, mode: 'drag' })} />
            Drag and drop
          </label>
          <label style={s.carryRadioLabel}>
            <input type="radio" checked={mode === 'type'} onChange={() => onUpdate({ ...task, mode: 'type' })} />
            Type answer
          </label>
        </div>
      </Field>
      <Field label="Text (use ___ for each blank)">
        <MarkdownFieldEditor
          height={150}
          minHeight={130}
          ariaLabel="Fill in the blank text Markdown editor views"
          value={text}
          onChange={handleTextChange}
          placeholder="e.g. Python uses ___ to print output and ___ to get input."
          lessonType={lessonType}
        />
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#6b7280' }}>
          {blankCount} blank{blankCount !== 1 ? 's' : ''} detected
        </span>
      </Field>
      {blanks.length > 0 && (
        <Field label="Correct answers (in order)">
          <div style={s.quizAnswerStack}>
            {blanks.map((blank, index) => (
              <div key={blank.id} style={s.quizAnswerCard}>
                <span style={s.quizAnswerBadge}>{index + 1}</span>
                <div style={s.quizAnswerEditorBlock}>
                  <span style={s.quizAnswerLabel}>Blank {index + 1}</span>
                <MarkdownFieldEditor
                  height={118}
                  minHeight={104}
                  ariaLabel={`Blank ${index + 1} answer Markdown editor views`}
                  value={blank.answer}
                  onChange={value => updateBlank(index, value)}
                  placeholder={`Answer for blank ${index + 1}`}
                  lessonType={lessonType}
                />
                </div>
              </div>
            ))}
          </div>
        </Field>
      )}
    </>
  )
}

function ShortAnswerBuilder({ task, onUpdate, lessonType = null }) {
  const check = task.check ?? { type: 'answer_contains', value: '' }

  function updateCheck(updates) {
    onUpdate({ ...task, check: { ...check, ...updates }, _checkTested: false })
  }

  return (
    <Field label="Completion check">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <select
          style={s.select}
          value={check.type ?? 'answer_contains'}
          onChange={e => updateCheck({ type: e.target.value })}
        >
          <option value="answer_contains">Answer contains</option>
          <option value="answer_equals">Answer equals (exact match)</option>
          <option value="answer_matches_regex">Answer matches regex</option>
        </select>
        <textarea
          style={s.checkValue}
          value={check.value ?? ''}
          onChange={e => updateCheck({ value: e.target.value })}
          placeholder={
            check.type === 'answer_equals' ? 'Exact expected answer…'
            : check.type === 'answer_matches_regex' ? 'Regular expression…'
            : 'Text that the answer must contain…'
          }
        />
        <MarkdownFieldEditor
          height={118}
          minHeight={104}
          ariaLabel="Short answer check hint Markdown editor views"
          value={check.hint ?? ''}
          onChange={value => updateCheck({ hint: value })}
          placeholder="Suggestion shown when this answer is wrong..."
          lessonType={lessonType}
        />
        <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#6b7280', lineHeight: 1.5 }}>
          Matching is case-insensitive. Test by typing an answer in the student preview below.
        </p>
      </div>
    </Field>
  )
}

function QuizOptionsBuilder({ task, onUpdate, lessonType = null }) {
  const options = task.options?.length ? task.options : [{ id: 'a', text: '' }, { id: 'b', text: '' }]
  const correctAnswer = task.check?.type === 'answer_equals' ? task.check.value : ''

  function renumber(nextOptions) {
    return nextOptions.map((option, index) => ({
      ...option,
      id: String.fromCharCode(97 + index),
    }))
  }

  function updateOptions(nextOptions, nextAnswer = correctAnswer) {
    const renumbered = renumber(nextOptions)
    const answer = renumbered.some(option => option.id === nextAnswer) ? nextAnswer : ''
    const existingHint = task.check?.hint ? { hint: task.check.hint } : {}
    onUpdate({
      ...task,
      options: renumbered,
      check: answer ? { type: 'answer_equals', value: answer, ...existingHint } : null,
      _checkTested: false,
    })
  }

  function setCorrectAnswer(answer) {
    onUpdate({
      ...task,
      check: { type: 'answer_equals', value: answer, ...(task.check?.hint ? { hint: task.check.hint } : {}) },
      _checkTested: false,
    })
  }

  return (
    <Field label="Options">
      <div style={s.quizOptions}>
        {options.map((option, index) => (
          <div key={option.id} style={s.quizOptionCard}>
            <label style={s.quizCorrectLabel}>
              <span style={s.quizOptionId}>{option.id}</span>
              <input
                type="radio"
                name={`quiz-correct-${task.id}`}
                checked={correctAnswer === option.id}
                onChange={() => setCorrectAnswer(option.id)}
              />
              <span style={{ ...s.quizCorrectPill, ...(correctAnswer === option.id ? s.quizCorrectPillActive : {}) }}>
                Correct
              </span>
            </label>
            <div style={s.quizOptionEditor}>
              <MarkdownFieldEditor
                height={132}
                minHeight={118}
                ariaLabel={`Option ${option.id.toUpperCase()} Markdown editor views`}
                value={option.text}
                onChange={value => updateOptions(options.map((o, i) => i === index ? { ...o, text: value } : o))}
                placeholder={`Option ${option.id.toUpperCase()} in Markdown`}
                lessonType={lessonType}
              />
              <MarkdownFieldEditor
                height={118}
                minHeight={104}
                ariaLabel={`Option ${option.id.toUpperCase()} feedback Markdown editor views`}
                value={option.feedback ?? ''}
                onChange={value => updateOptions(options.map((o, i) => i === index ? { ...o, feedback: value } : o))}
                placeholder="Feedback shown if students choose this wrong answer..."
                lessonType={lessonType}
              />
            </div>
            <button
              type="button"
              style={s.removeBtn}
              onClick={() => updateOptions(options.filter((_, i) => i !== index))}
              disabled={options.length <= 2}
              title="Remove option"
            >
              x
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-ghost"
          style={s.addCheckBtn}
          onClick={() => updateOptions([...options, { id: '', text: '' }])}
        >
          + Add option
        </button>
      </div>
    </Field>
  )
}

function CopyButtons({ output, code }) {
  const [copiedOutput, setCopiedOutput] = React.useState(false)
  const [copiedCode, setCopiedCode] = React.useState(false)

  function copyText(text, setCopied) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const btnBase = {
    fontFamily: 'var(--font-body)', fontSize: '0.78rem', padding: '3px 10px',
    borderRadius: 6, border: '1px solid var(--colour-primary)', background: 'transparent',
    color: 'var(--colour-primary)', cursor: 'pointer',
  }
  const btnDone = { background: '#22c55e', border: '1px solid #22c55e', color: '#fff' }

  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
      {output != null && output !== '' && (
        <button type="button" style={{ ...btnBase, ...(copiedOutput ? btnDone : {}) }}
          onClick={() => copyText(output, setCopiedOutput)} title="Copy the current output to clipboard">
          {copiedOutput ? '✓ Copied' : '📋 Copy output'}
        </button>
      )}
      {code != null && code !== '' && (
        <button type="button" style={{ ...btnBase, ...(copiedCode ? btnDone : {}) }}
          onClick={() => copyText(code, setCopiedCode)} title="Copy the current code to clipboard">
          {copiedCode ? '✓ Copied' : '📋 Copy code'}
        </button>
      )}
    </div>
  )
}

function IncorrectCheckResultsDisplay({ results }) {
  if (!results || results.length === 0) return null
  const anyMatched = results.some(r => r.passed)
  return (
    <div style={{ border: '1px solid #c7d2fe', borderRadius: 8, padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: '0.88rem', lineHeight: 1.6, background: '#f0f4ff', marginTop: 8 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Incorrect checks:</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {results.map((r, i) => (
          <div key={i}>
            {r.passed
              ? <span>🎯 <strong>Incorrect check {i + 1} matched</strong>{r.hint ? <> — hint: <em>"{r.hint}"</em></> : ' — no hint set'}</span>
              : <span style={{ color: '#6b7280' }}>— Incorrect check {i + 1} did not match</span>}
          </div>
        ))}
        {!anyMatched && (
          <div style={{ marginTop: 4, color: '#6b7280', fontSize: '0.85em' }}>
            No incorrect check matched — the completion check hint (if any) will be shown instead.
          </div>
        )}
      </div>
    </div>
  )
}

function formatCheckFailure(result) {
  return `Check does not pass - ${formatCheckFailureDetail(result)}`
}

function formatCheckFailureDetail(result) {
  if (result.type === 'element_exists') return `no element matches selector "${result.selector ?? ''}"`
  if (result.type === 'element_count') return `expected ${result.value ?? ''} elements matching selector "${result.selector ?? ''}"`
  if (result.type === 'element_value') return `review expected text or input value "${result.value ?? ''}"`
  return `review your check value "${result.value ?? ''}"`
}

function subjectOpFromType(type) {
  const map = {
    'code_no_error':               { subject: 'output',  operator: 'no_error' },
    'output_not_empty':            { subject: 'output',  operator: 'not_empty' },
    'output_contains':             { subject: 'output',  operator: 'contains' },
    'output_equals':               { subject: 'output',  operator: 'equals' },
    'output_not_contains':         { subject: 'output',  operator: 'not_contains' },
    'output_not_equals':           { subject: 'output',  operator: 'not_equals' },
    'output_matches_regex':        { subject: 'output',  operator: 'matches_regex' },
    'output_line_count':           { subject: 'output',  operator: 'line_count' },
    'code_contains':               { subject: 'code',    operator: 'contains' },
    'code_equals':                 { subject: 'code',    operator: 'equals' },
    'code_does_not_contain':       { subject: 'code',    operator: 'not_contains' },
    'code_not_equals':             { subject: 'code',    operator: 'not_equals' },
    'code_matches_regex':          { subject: 'code',    operator: 'matches_regex' },
    'element_exists':              { subject: 'element', operator: 'exists' },
    'element_count':               { subject: 'element', operator: 'count' },
    'element_value':               { subject: 'element', operator: 'value_contains' },
    'element_value_equals':        { subject: 'element', operator: 'value_equals' },
    'element_value_not_contains':  { subject: 'element', operator: 'value_not_contains' },
    'element_value_not_equals':    { subject: 'element', operator: 'value_not_equals' },
    'element_value_matches_regex': { subject: 'element', operator: 'value_matches_regex' },
    'element_attribute':           { subject: 'element', operator: 'attribute_equals' },
    'element_style_property':      { subject: 'element', operator: 'style_equals' },
    'variable_exists':             { subject: 'variable', operator: 'exists' },
    'variable_type':               { subject: 'variable', operator: 'type' },
    'variable_equals':             { subject: 'variable', operator: 'equals' },
    'variable_dict_contains':      { subject: 'variable', operator: 'dict_contains' },
    'variable_dict_equals':        { subject: 'variable', operator: 'dict_equals' },
    'variable_dict_key_value':     { subject: 'variable', operator: 'dict_key_value' },
    'variable_array_contains':     { subject: 'variable', operator: 'array_contains' },
    'variable_array_equals':       { subject: 'variable', operator: 'array_equals' },
    'variable_array_nth_item':     { subject: 'variable', operator: 'array_nth_item' },
  }
  return map[type] ?? { subject: 'output', operator: 'contains' }
}

function typeFromSubjectOp(subject, operator) {
  const maps = {
    output: {
      no_error:      'code_no_error',
      contains:      'output_contains',
      equals:        'output_equals',
      not_contains:  'output_not_contains',
      not_equals:    'output_not_equals',
      matches_regex: 'output_matches_regex',
      not_empty:     'output_not_empty',
      line_count:    'output_line_count',
    },
    code: {
      contains:      'code_contains',
      equals:        'code_equals',
      not_contains:  'code_does_not_contain',
      not_equals:    'code_not_equals',
      matches_regex: 'code_matches_regex',
    },
    element: {
      exists:              'element_exists',
      count:               'element_count',
      value_contains:      'element_value',
      value_equals:        'element_value_equals',
      value_not_contains:  'element_value_not_contains',
      value_not_equals:    'element_value_not_equals',
      value_matches_regex: 'element_value_matches_regex',
      attribute_equals:    'element_attribute',
      style_equals:        'element_style_property',
    },
    variable: {
      exists:          'variable_exists',
      type:            'variable_type',
      equals:          'variable_equals',
      dict_contains:   'variable_dict_contains',
      dict_equals:     'variable_dict_equals',
      dict_key_value:  'variable_dict_key_value',
      array_contains:  'variable_array_contains',
      array_equals:    'variable_array_equals',
      array_nth_item:  'variable_array_nth_item',
    },
  }
  return maps[subject]?.[operator] ?? 'output_contains'
}

function getOperatorOptions(subject, { allowCodeNoError }) {
  if (subject === 'output') return [
    ...(allowCodeNoError ? [{ value: 'no_error', label: 'no error' }] : []),
    { value: 'contains',      label: 'contains' },
    { value: 'equals',        label: 'equals' },
    { value: 'not_contains',  label: 'does not contain' },
    { value: 'not_equals',    label: 'does not equal' },
    { value: 'matches_regex', label: 'matches regex' },
    { value: 'not_empty',     label: 'is not empty' },
    { value: 'line_count',    label: 'line count equals' },
  ]
  if (subject === 'code') return [
    { value: 'contains',      label: 'contains' },
    { value: 'equals',        label: 'equals' },
    { value: 'not_contains',  label: 'does not contain' },
    { value: 'not_equals',    label: 'does not equal' },
    { value: 'matches_regex', label: 'matches regex' },
  ]
  if (subject === 'element') return [
    { value: 'exists',              label: 'exists' },
    { value: 'count',               label: 'count equals' },
    { value: 'value_contains',      label: 'value contains' },
    { value: 'value_equals',        label: 'value equals' },
    { value: 'value_not_contains',  label: 'value does not contain' },
    { value: 'value_not_equals',    label: 'value does not equal' },
    { value: 'value_matches_regex', label: 'value matches regex' },
    { value: 'attribute_equals',    label: 'attribute equals' },
    { value: 'style_equals',        label: 'style property equals' },
  ]
  if (subject === 'variable') return [
    { value: 'exists',          label: 'exists' },
    { value: 'type',            label: 'type is' },
    { value: 'equals',          label: 'equals' },
    { value: 'dict_contains',   label: 'dictionary contains' },
    { value: 'dict_equals',     label: 'dictionary equals' },
    { value: 'dict_key_value',  label: 'dictionary key value equals' },
    { value: 'array_contains',  label: 'array contains' },
    { value: 'array_equals',    label: 'array equals' },
    { value: 'array_nth_item',  label: 'array N-th item equals' },
  ]
  return []
}

function makeCheckSkeleton(type, prev = {}) {
  const hint = prev.hint ? { hint: prev.hint } : {}
  if (type === 'code_no_error' || type === 'output_not_empty') return { type, ...hint }
  if (type === 'variable_exists') return { type, name: prev.name ?? '', ...hint }
  if (type === 'variable_dict_key_value') return { type, name: prev.name ?? '', key: prev.key ?? '', value: prev.value ?? '', ...hint }
  if (type === 'variable_array_nth_item') return { type, name: prev.name ?? '', index: prev.index ?? '0', value: prev.value ?? '', ...hint }
  if (type.startsWith('variable_')) return { type, name: prev.name ?? '', value: prev.value ?? '', ...hint }
  if (type === 'element_exists') return { type, selector: prev.selector ?? '', ...hint }
  if (type === 'element_count') return { type, selector: prev.selector ?? '', value: prev.value ?? '1', ...hint }
  if (type === 'element_attribute') return { type, selector: prev.selector ?? '', attribute: prev.attribute ?? '', value: prev.value ?? '', ...hint }
  if (type === 'element_style_property') return { type, selector: prev.selector ?? '', property: prev.property ?? '', value: prev.value ?? '', ...hint }
  if (type === 'element_value' || type === 'element_value_equals' || type === 'element_value_not_contains' || type === 'element_value_not_equals' || type === 'element_value_matches_regex') {
    return { type, selector: prev.selector ?? '', value: prev.value ?? '', ...hint }
  }
  return { type, value: prev.value ?? '', ...hint }
}

function CheckValueEditor({ check, subject, operator, onChange, output = '', code = '' }) {
  if (check.type === 'code_no_error') {
    return <div style={s.checkHelp}>Passes when Python runs without an error.</div>
  }
  if (check.type === 'output_not_empty') {
    return <div style={s.checkHelp}>Passes when the run produces any visible output.</div>
  }

  if (subject === 'element') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.88rem' }}
          value={check.selector ?? ''}
          onChange={e => onChange({ ...check, selector: e.target.value })}
          placeholder="CSS selector, e.g. h1  .myClass  #myId  input[type=text]"
        />
        {operator === 'exists' && (
          <div style={s.checkHelp}>Passes when at least one matching element exists in the page.</div>
        )}
        {operator === 'attribute_equals' && (
          <>
            <input
              style={s.input}
              value={check.attribute ?? ''}
              onChange={e => onChange({ ...check, attribute: e.target.value })}
              placeholder="Attribute name, e.g. href, src, alt, class"
            />
            <input
              style={s.input}
              value={check.value ?? ''}
              onChange={e => onChange({ ...check, value: e.target.value })}
              placeholder="Optional expected attribute value..."
            />
          </>
        )}
        {operator === 'style_equals' && (
          <>
            <input
              style={s.input}
              value={check.property ?? ''}
              onChange={e => onChange({ ...check, property: e.target.value })}
              placeholder="CSS property, e.g. color, background-color, font-size"
            />
            <input
              style={s.input}
              value={check.value ?? ''}
              onChange={e => onChange({ ...check, value: e.target.value })}
              placeholder="Optional expected computed value, e.g. rgb(255, 0, 0) or 16px"
            />
          </>
        )}
        {operator === 'count' && (
          <input
            style={{ ...s.input, width: 160 }}
            type="number"
            min="0"
            value={check.value ?? '1'}
            onChange={e => onChange({ ...check, value: e.target.value })}
            placeholder="Expected count"
          />
        )}
        {operator !== 'exists' && operator !== 'count' && operator !== 'attribute_equals' && operator !== 'style_equals' && (
          <input
            style={s.input}
            value={check.value ?? ''}
            onChange={e => onChange({ ...check, value: e.target.value })}
            placeholder={
              operator === 'value_matches_regex' ? 'Regular expression, e.g. ^\\d+$  (matched case-insensitively)'
              : operator === 'value_equals'        ? 'Exact text or input value...'
              : operator === 'value_not_contains'  ? 'Text that must NOT be present...'
              : operator === 'value_not_equals'    ? 'Value it must NOT equal...'
              :                                      'Text that value must contain...'
            }
          />
        )}
      </div>
    )
  }

  if (subject === 'variable') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          style={{ ...s.input, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.88rem' }}
          value={check.name ?? ''}
          onChange={e => onChange({ ...check, name: e.target.value })}
          placeholder="Variable name, e.g. score"
        />
        {operator === 'exists' && (
          <div style={s.checkHelp}>Passes when the variable exists after the Python code runs.</div>
        )}
        {operator === 'dict_key_value' && (
          <input
            style={s.input}
            value={check.key ?? ''}
            onChange={e => onChange({ ...check, key: e.target.value })}
            placeholder="Dictionary key, e.g. name"
          />
        )}
        {operator === 'array_nth_item' && (
          <input
            style={{ ...s.input, width: 180 }}
            type="number"
            min="0"
            value={check.index ?? '0'}
            onChange={e => onChange({ ...check, index: e.target.value })}
            placeholder="Zero-based item index"
          />
        )}
        {operator !== 'exists' && (
          <textarea
            style={s.checkValue}
            value={check.value ?? ''}
            onChange={e => onChange({ ...check, value: e.target.value })}
            placeholder={
              operator === 'type' ? 'Expected type, e.g. string, number, boolean, array, dictionary'
              : operator === 'dict_equals' ? 'Expected dictionary as JSON, e.g. {"name":"Ada","age":12}'
              : operator === 'array_equals' ? 'Expected array as JSON, e.g. ["red", "blue"]'
              : 'Expected value, e.g. hello, 5, true, or JSON'
            }
          />
        )}
      </div>
    )
  }

  if (check.type === 'output_line_count') {
    return (
      <input
        style={{ ...s.input, width: 160 }}
        type="number"
        min="0"
        value={check.value ?? ''}
        onChange={e => onChange({ ...check, value: e.target.value })}
        placeholder="Expected number of lines"
      />
    )
  }

  const showOutputCopy = subject === 'output' && output !== ''
  const showCodeCopy   = subject === 'code'   && code !== ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {(showOutputCopy || showCodeCopy) && (
        <CopyButtons output={showOutputCopy ? output : ''} code={showCodeCopy ? code : ''} />
      )}
      <textarea
        style={s.checkValue}
        value={check.value ?? ''}
        onChange={e => onChange({ ...check, value: e.target.value })}
        placeholder={
          operator === 'matches_regex' ? 'Regular expression, e.g. ^\\d+$  (matched against lowercased output)'
          : operator === 'equals'       ? 'Exact expected value...'
          : operator === 'not_equals'   ? 'Value it must NOT equal...'
          : operator === 'not_contains' ? 'String that must NOT be present...'
          :                               'String that must be present...'
        }
      />
    </div>
  )
}

function CheckListEditor({ checks, onChange, interactionMode = 'run', allowCodeNoError = false, allowVariableChecks = false, allowDomChecks = false, lessonType = null, output = '', code = '' }) {
  const submitMode = interactionMode === 'submit'

  function updateCheck(index, updated) {
    onChange(checks.map((c, i) => i === index ? updated : c))
  }
  function removeCheck(index) {
    onChange(checks.filter((_, i) => i !== index))
  }
  function addCheck() {
    onChange([...checks, submitMode ? { type: 'code_contains', value: '' } : allowCodeNoError ? { type: 'code_no_error' } : { type: 'output_contains', value: '' }])
  }

  function handleSubjectChange(index, newSubject) {
    const current = checks[index]
    const defaultOp = newSubject === 'output' ? (allowCodeNoError ? 'no_error' : 'contains')
      : newSubject === 'code' ? 'contains'
      : newSubject === 'variable' ? 'exists'
      : 'exists'
    updateCheck(index, makeCheckSkeleton(typeFromSubjectOp(newSubject, defaultOp), current))
  }

  function handleOperatorChange(index, newOperator) {
    const current = checks[index]
    const { subject } = subjectOpFromType(current.type)
    updateCheck(index, makeCheckSkeleton(typeFromSubjectOp(subject, newOperator), current))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      {checks.map((check, index) => {
        const { subject, operator } = subjectOpFromType(check.type)
        const operatorOptions = getOperatorOptions(subject, { allowCodeNoError })
        return (
          <div key={index} style={s.checkRow}>
            {checks.length > 1 && <span style={s.checkIndexLabel}>#{index + 1}</span>}
            <div style={s.checkEditor}>
              <select
                style={{ ...s.select, flex: '0 0 auto' }}
                value={subject}
                onChange={e => handleSubjectChange(index, e.target.value)}
              >
                {!submitMode && <option value="output">Output</option>}
                <option value="code">Code</option>
                {allowVariableChecks && <option value="variable">Variable</option>}
                {allowDomChecks && <option value="element">Element</option>}
              </select>
              <select
                style={{ ...s.select, flex: '0 0 auto' }}
                value={operator}
                onChange={e => handleOperatorChange(index, e.target.value)}
              >
                {operatorOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <CheckValueEditor
                check={check}
                subject={subject}
                operator={operator}
                onChange={updated => updateCheck(index, updated)}
                output={output}
                code={code}
              />
              <div style={{ gridColumn: '1 / -1' }}>
                <MarkdownFieldEditor
                  height={118}
                  minHeight={104}
                  ariaLabel={`Check ${index + 1} hint Markdown editor views`}
                  value={check.hint ?? ''}
                  onChange={value => updateCheck(index, { ...check, hint: value })}
                  placeholder="Suggestion shown in the completion banner when this check fails..."
                  lessonType={lessonType}
                />
              </div>
            </div>
            {checks.length > 1 && (
              <button type="button" style={s.removeCheckBtn} onClick={() => removeCheck(index)} title="Remove check">×</button>
            )}
          </div>
        )
      })}
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
          onChange={e => onChange(e.target.checked ? '' : buildScratchToolboxXml([]))}
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
        ...(check.hint ? { hint: check.hint } : {}),
      })
      return
    }

    if (nextType === 'variable_equals') {
      onChange({
        type: 'variable_equals',
        evaluation: 'manual',
        variableName: 'score',
        value: 10,
        ...(check.hint ? { hint: check.hint } : {}),
      })
      return
    }

    onChange({ type: 'block_used', evaluation: 'manual', opcode: 'motion_movesteps', ...(check.hint ? { hint: check.hint } : {}) })
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
      <MarkdownFieldEditor
        height={118}
        minHeight={104}
        ariaLabel="Scratch check hint Markdown editor views"
        value={check.hint ?? ''}
        onChange={value => onChange({ ...check, hint: value })}
        placeholder="Suggestion shown in the completion banner when this check fails..."
        lessonType="scratch"
      />
    </div>
  )
}

function CodeWorkspaceTabs({ activeTab, onChange, starterLabel = 'Starter code', testLabel = 'Complete code', rightAction = null }) {
  return (
    <div style={s.workspaceTabs} className="ui-tabs ui-tabs--editor" role="tablist" aria-label="Code workspace">
      <button
        type="button"
        className="ui-tab"
        role="tab"
        aria-selected={activeTab === 'starter'}
        style={{ ...s.workspaceTab, ...(activeTab === 'starter' ? s.workspaceTabActive : {}) }}
        onClick={() => onChange('starter')}
      >
        {starterLabel}
      </button>
      <button
        type="button"
        className="ui-tab"
        role="tab"
        aria-selected={activeTab === 'complete'}
        style={{ ...s.workspaceTab, ...(activeTab === 'complete' ? s.workspaceTabActive : {}) }}
        onClick={() => onChange('complete')}
      >
        {testLabel}
      </button>
      {rightAction && <div style={s.workspaceTabActions}>{rightAction}</div>}
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

function CarryThroughPicker({ task, lesson, onUpdate, isScratch, isPython }) {
  const taskIndex = lesson.tasks.findIndex(t => t.id === task.id)
  const prevTask = taskIndex > 0 ? lesson.tasks[taskIndex - 1] : null
  const otherTasks = lesson.tasks.filter(t => t.id !== task.id)

  const carryField = isScratch ? 'carryBlocksFrom' : 'carryCodeFrom'
  const carryFrom = isScratch ? task.carryBlocksFrom : task.carryCodeFrom

  const mode = carryFrom == null
    ? 'new'
    : (prevTask && carryFrom === prevTask.id ? 'last' : 'other')

  function copyCompleteCode(sourceTask) {
    const updates = { [carryField]: sourceTask.id }
    if (isPython) {
      updates.starterCode = sourceTask.completeCode ?? sourceTask.starterCode ?? ''
    } else if (isScratch) {
      updates.starterBlocks = sourceTask.completeBlocks ?? sourceTask.starterBlocks ?? null
    } else {
      updates.starterFiles = (sourceTask.completeFiles ?? sourceTask.starterFiles ?? []).map(f => ({ ...f }))
      const newEntry = sourceTask.completeEntryFile ?? sourceTask.entryFile
      if (newEntry) updates.entryFile = newEntry
    }
    onUpdate({ ...task, ...updates })
  }

  function handleOther() {
    const defaultTask = otherTasks.find(t => t.id !== prevTask?.id) ?? otherTasks[0]
    if (defaultTask) copyCompleteCode(defaultTask)
  }

  const radioName = `carry-${task.id}`

  return (
    <Field label={isScratch ? 'Carry blocks from task' : 'Carry code from task'}>
      <div style={s.carryRadioGroup}>
        <label style={{
          ...s.optionChoiceCard,
          ...(mode === 'last' ? s.optionChoiceCardActive : {}),
          ...(!prevTask ? s.optionChoiceCardDisabled : {}),
        }}>
          <input
            type="radio"
            name={radioName}
            checked={mode === 'last'}
            disabled={!prevTask}
            onChange={() => prevTask && copyCompleteCode(prevTask)}
            style={s.optionChoiceInput}
          />
          <span style={s.optionChoiceTitle}>Carry from last task</span>
          <span style={{ ...s.optionChoiceText, ...(mode === 'last' ? s.optionChoiceTextActive : {}) }}>
            {prevTask ? `${prevTask.id}. ${prevTask.title || 'Untitled'}` : 'No previous task'}
          </span>
        </label>

        <label style={{ ...s.optionChoiceCard, ...(mode === 'new' ? s.optionChoiceCardActive : {}) }}>
          <input
            type="radio"
            name={radioName}
            checked={mode === 'new'}
            onChange={() => onUpdate({ ...task, [carryField]: null })}
            style={s.optionChoiceInput}
          />
          <span style={s.optionChoiceTitle}>New starter code</span>
          <span style={{ ...s.optionChoiceText, ...(mode === 'new' ? s.optionChoiceTextActive : {}) }}>
            Start this task from its own starter content.
          </span>
        </label>

        <label style={{
          ...s.optionChoiceCard,
          ...(mode === 'other' ? s.optionChoiceCardActive : {}),
          ...(otherTasks.length === 0 ? s.optionChoiceCardDisabled : {}),
        }}>
          <input
            type="radio"
            name={radioName}
            checked={mode === 'other'}
            disabled={otherTasks.length === 0}
            onChange={handleOther}
            style={s.optionChoiceInput}
          />
          <span style={s.optionChoiceTitle}>From other task</span>
          <span style={{ ...s.optionChoiceText, ...(mode === 'other' ? s.optionChoiceTextActive : {}) }}>
            Copy complete code from a chosen task.
          </span>
        </label>

        {mode === 'other' && (
          <select
            style={s.select}
            value={carryFrom ?? ''}
            onChange={e => {
              const sourceTask = lesson.tasks.find(t => t.id === parseInt(e.target.value, 10))
              if (sourceTask) copyCompleteCode(sourceTask)
            }}
          >
            {otherTasks.map(t => (
              <option key={t.id} value={t.id}>{t.id}. {t.title || 'Untitled'}</option>
            ))}
          </select>
        )}
      </div>
    </Field>
  )
}

function TaskFormatIcon({ type }) {
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (type === 'scratch') return (
    <svg {...common}>
      <rect x="2" y="2" width="9" height="9" rx="1.5" />
      <rect x="13" y="2" width="9" height="9" rx="1.5" />
      <rect x="2" y="13" width="9" height="9" rx="1.5" />
      <rect x="13" y="13" width="9" height="9" rx="1.5" />
    </svg>
  )
  if (type === 'information') return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
  if (type === 'quiz') return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  )
  return (
    <svg {...common}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
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

function QuizTypeIcon({ type }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (type === 'match') return (
    <svg {...common}>
      <path d="M7 7h.01" />
      <path d="M7 17h.01" />
      <path d="M17 7h.01" />
      <path d="M17 17h.01" />
      <path d="M8 7h8" />
      <path d="M8 17h8" />
    </svg>
  )
  if (type === 'blank') return (
    <svg {...common}>
      <path d="M4 7h16" />
      <path d="M4 12h6" />
      <path d="M14 12h6" />
      <path d="M4 17h16" />
    </svg>
  )
  if (type === 'answer') return (
    <svg {...common}>
      <path d="M4 5h16" />
      <path d="M4 12h10" />
      <path d="M4 19h7" />
      <path d="M15 18l2 2 4-5" />
    </svg>
  )
  return (
    <svg {...common}>
      <circle cx="7" cy="7" r="2" />
      <path d="M11 7h8" />
      <circle cx="7" cy="17" r="2" />
      <path d="M11 17h8" />
    </svg>
  )
}

const SPRITE_TYPE_OPTIONS = SPRITE_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))

export function SpriteManager({ sprites, onChange, assetsPath = '', lessonId, lessonType }) {
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
              lessonId={lessonId}
              lessonType={lessonType}
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

function CostumeManager({ costumes, assetsPath, lessonId, lessonType, onAdd, onRemove, onUpdate }) {
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
            <div style={{ flex: '2 1 160px', minWidth: 0 }}>
              <AssetPicker
                lessonId={lessonId}
                lessonType={lessonType}
                value={c.image ?? ''}
                onChange={v => onUpdate(idx, 'image', v)}
                placeholder="e.g. sprites/cat1.png"
                assetsPath={assetsPath}
              />
            </div>
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

export function BackdropManager({ backdrops, onChange, assetsPath, lessonId, lessonType }) {
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  <AssetPicker
                    lessonId={lessonId}
                    lessonType={lessonType}
                    value={b.image ?? ''}
                    onChange={v => update(b.id, { image: v })}
                    placeholder="e.g. backdrops/sky.png"
                    assetsPath={assetsPath}
                  />
                </div>
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
  optionsSection: {
    border: '1px solid var(--ui-border)',
    borderRadius: 8,
    overflow: 'hidden',
    background: '#fff',
    boxShadow: '0 5px 16px rgba(40, 22, 78, 0.06)',
  },
  optionsSectionToggle: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 14px',
    background: 'linear-gradient(180deg, #ffffff 0%, var(--ui-surface-soft) 100%)',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    boxShadow: 'none',
  },
  optionsSectionTitle: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
    flexShrink: 0,
  },
  optionsSummaryText: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: '#6b7280',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  optionsChevron: {
    marginLeft: 'auto',
    color: 'var(--colour-primary)',
    fontSize: '1rem',
    lineHeight: 1,
    flexShrink: 0,
    transition: 'transform 0.15s ease',
  },
  optionsBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: '16px',
    borderTop: '1px solid var(--ui-border)',
    background: '#fff',
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
    gridTemplateColumns: 'max-content max-content minmax(0, 1fr)',
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
  hintsEditor: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    padding: 10,
  },
  hintsEmpty: {
    margin: 0,
    color: '#9ca3af',
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
  },
  hintRow: {
    display: 'grid',
    gridTemplateColumns: '72px minmax(0, 1fr) 28px',
    gap: 8,
    alignItems: 'start',
  },
  hintIndex: {
    paddingTop: 9,
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    fontWeight: 700,
    color: 'var(--colour-primary)',
  },
  hintInput: {
    padding: '8px 10px',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: 'var(--colour-text)',
    outline: 'none',
    resize: 'vertical',
    minHeight: 38,
    lineHeight: 1.45,
  },
  addHintBtn: {
    alignSelf: 'flex-start',
    color: 'var(--colour-primary)',
    border: '1px dashed var(--colour-primary)',
    padding: '6px 12px',
    fontSize: '0.83rem',
  },
  quizOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  quizTypeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 10,
  },
  quizTypeBtn: {
    minHeight: 92,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: '12px 8px',
    border: '2px solid #e5e7eb',
    borderRadius: 10,
    background: '#fff',
    color: 'var(--colour-primary)',
    cursor: 'pointer',
    transition: 'border-color 0.12s, background 0.12s, color 0.12s',
  },
  quizTypeBtnActive: {
    borderColor: 'var(--colour-primary)',
    background: 'var(--colour-primary)',
    color: '#fff',
  },
  quizTypeLabel: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.82rem',
    lineHeight: 1.1,
    textAlign: 'center',
  },
  quizTypeMeta: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.72rem',
    lineHeight: 1.2,
    color: '#6b7280',
    textAlign: 'center',
  },
  quizTypeMetaActive: {
    color: 'rgba(255, 255, 255, 0.82)',
  },
  quizOptionCard: {
    display: 'grid',
    gridTemplateColumns: '116px minmax(0, 1fr) 32px',
    gap: 10,
    alignItems: 'start',
    padding: 10,
    border: '1px solid var(--ui-border)',
    borderRadius: 8,
    background: 'var(--ui-surface-soft)',
  },
  quizCorrectLabel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 7,
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
    color: 'var(--colour-text)',
    cursor: 'pointer',
    paddingTop: 2,
  },
  quizOptionId: {
    width: 34,
    height: 34,
    borderRadius: 8,
    background: 'var(--colour-primary)',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  quizCorrectPill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 24,
    padding: '4px 8px',
    border: '1px solid var(--ui-border)',
    borderRadius: 999,
    background: '#fff',
    color: '#6b7280',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.72rem',
    lineHeight: 1,
  },
  quizCorrectPillActive: {
    borderColor: '#22c55e',
    background: '#f0fdf4',
    color: '#15803d',
  },
  quizOptionEditor: {
    minWidth: 0,
  },
  quizAnswerStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  quizAnswerCard: {
    display: 'grid',
    gridTemplateColumns: '34px minmax(0, 1fr) 32px',
    gap: 10,
    alignItems: 'start',
    padding: 10,
    border: '1px solid var(--ui-border)',
    borderRadius: 8,
    background: 'var(--ui-surface-soft)',
  },
  quizAnswerBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    background: 'var(--colour-primary)',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.86rem',
  },
  quizAnswerEditorBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 0,
  },
  quizAnswerLabel: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.76rem',
    color: 'var(--colour-primary)',
  },
  matchPairEditorRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 20px minmax(0, 1fr)',
    gap: 10,
    alignItems: 'start',
  },
  matchArrow: {
    alignSelf: 'center',
    justifySelf: 'center',
    width: 18,
    height: 2,
    borderRadius: 999,
    background: 'var(--ui-border-strong)',
    color: 'transparent',
    userSelect: 'none',
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
    display: 'flex',
    gridTemplateColumns: '1fr 1fr',
    gap: 4,
    alignSelf: 'stretch',
    width: '100%',
    border: '1px solid #e5e7eb',
    borderBottom: 0,
    borderRadius: '8px 8px 0 0',
    padding: '4px 4px 0',
    background: '#e5e7eb',
  },
  workspaceTab: {
    border: 0,
    borderRadius: '6px 6px 0 0',
    background: 'transparent',
    color: '#4b5563',
    padding: '8px 12px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  workspaceTabActive: {
    background: '#fafafa',
    color: 'var(--colour-primary)',
  },
  workspaceTabActions: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: 8,
  },
  codeWorkspaceStack: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    gap: 0,
  },
  pythonEditor: {
    height: 300,
    border: '1px solid #e5e7eb',
    borderRadius: '0 0 8px 8px',
    overflow: 'hidden',
  },
  attachedCodeEditor: {
    borderRadius: '0 0 8px 8px',
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
  infoNotice: {
    border: '1px solid #d8b4fe',
    borderRadius: 8,
    background: '#f5f3ff',
    color: 'var(--colour-primary)',
    padding: '12px 14px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    fontWeight: 600,
    lineHeight: 1.5,
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
    gap: 0,
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
    borderRadius: '0 0 8px 8px',
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
  carryRadioGroup: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: 10,
  },
  carryRadioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
    cursor: 'pointer',
  },
  carryRadioLabelDisabled: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: '#9ca3af',
    cursor: 'not-allowed',
  },
  carryNote: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: '#9ca3af',
  },
  optionChoiceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: 10,
  },
  optionChoiceCard: {
    minHeight: 76,
    display: 'grid',
    gridTemplateColumns: '18px minmax(0, 1fr)',
    columnGap: 10,
    rowGap: 3,
    alignItems: 'start',
    padding: '12px 14px',
    border: '2px solid #e5e7eb',
    borderRadius: 10,
    background: '#fff',
    color: 'var(--colour-text)',
    cursor: 'pointer',
    transition: 'border-color 0.12s, background 0.12s, color 0.12s',
  },
  optionChoiceCardActive: {
    borderColor: 'var(--colour-primary)',
    background: 'var(--colour-primary)',
    color: '#fff',
  },
  optionChoiceCardDisabled: {
    opacity: 0.52,
    cursor: 'not-allowed',
  },
  optionChoiceInput: {
    gridRow: '1 / span 2',
    marginTop: 2,
    accentColor: 'var(--colour-primary)',
  },
  optionChoiceTitle: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.86rem',
    lineHeight: 1.2,
  },
  optionChoiceText: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.76rem',
    lineHeight: 1.35,
    color: '#6b7280',
  },
  optionChoiceTextActive: {
    color: 'rgba(255, 255, 255, 0.82)',
  },
  optionToggleCard: {
    minHeight: 68,
    display: 'grid',
    gridTemplateColumns: '18px minmax(0, 1fr)',
    columnGap: 10,
    rowGap: 3,
    alignItems: 'start',
    padding: '12px 14px',
    border: '2px solid #e5e7eb',
    borderRadius: 10,
    background: '#fff',
    color: 'var(--colour-text)',
    cursor: 'pointer',
    transition: 'border-color 0.12s, background 0.12s, color 0.12s',
  },
  optionToggleCardActive: {
    borderColor: 'var(--colour-primary)',
    background: 'var(--colour-primary)',
    color: '#fff',
  },
  optionNote: {
    margin: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: '#6b7280',
    lineHeight: 1.5,
    padding: '0 2px',
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
  taskFormatGrid: {
    display: 'flex',
    gap: 10,
  },
  infoTypeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 10,
  },
  infoTypeBtn: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    color: 'var(--colour-text)',
    padding: '10px 12px',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  infoTypeBtnActive: {
    borderColor: 'var(--colour-primary)',
    background: '#f7f2ff',
    color: 'var(--colour-primary)',
  },
  infoTypeLabel: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.9rem',
  },
  infoTypeHint: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    color: '#6b7280',
    lineHeight: 1.3,
  },
  infoPreview: {
    minHeight: 340,
    maxHeight: 520,
    display: 'flex',
    overflow: 'hidden',
    padding: 12,
    background: '#f5f5f5',
  },
  taskFormatBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '14px 8px',
    border: '2px solid #e5e7eb',
    borderRadius: 10,
    background: '#fff',
    color: 'var(--colour-primary)',
    cursor: 'pointer',
    transition: 'border-color 0.12s, background 0.12s, color 0.12s',
  },
  taskFormatBtnActive: {
    borderColor: 'var(--colour-primary)',
    background: 'var(--colour-primary)',
    color: '#fff',
  },
  taskFormatLabel: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.82rem',
    lineHeight: 1,
  },
}
