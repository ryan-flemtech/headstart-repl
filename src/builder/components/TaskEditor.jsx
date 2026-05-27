import React, { useEffect, useState } from 'react'
import SplitPane from '../../shared/SplitPane'
import { CodeEditor } from '../../shared/CodeEditor'
import { initPyodide, runPython, stopPython, provideInput, isPyodideReady } from '../../shared/pyodide'
import { buildIframeSrc, waitForIframeText } from '../../shared/iframe'
import { evaluateSingleCheck, filterChecksForInteraction, normalizeChecks } from '../../shared/checks'
import AssetBrowser from '../../shared/AssetBrowser'
import ExplainerEditor from './ExplainerEditor'
import FileManager from './FileManager'
import BuilderOutputPanel from './BuilderOutputPanel'
import IframePreview from '../../app/components/IframePreview'
import { CollapseTabButton } from '../../app/components/CollapsiblePanelControls'
import ScratchWorkspace from '../../app/components/ScratchWorkspace'
import QuizTask from '../../app/components/QuizTask'
import InformationTask from '../../app/components/InformationTask'
import { DEFAULT_SPRITES } from '../../shared/scratch'
import { resolveAssetsPath } from '../../shared/assetPaths'
import { s } from './task-editor/styles'
import { Field, TaskFormatIcon, QuizTypeIcon, CodeWorkspaceTabs, Modal, CarryThroughPicker, SpriteManager, BackdropManager } from './task-editor/TaskEditorFields'
import { QuizTypePicker, MatchPairsBuilder, FillBlankBuilder, ShortAnswerBuilder, QuizOptionsBuilder } from './task-editor/QuizEditors'
import { CopyButtons, IncorrectCheckResultsDisplay, formatCheckFailure, formatCheckFailureDetail, CheckListEditor } from './task-editor/CheckEditors'
import { ScratchToolboxPicker, ScratchCheckListEditor, VariableManager } from './task-editor/ScratchEditors'

// Re-export for backward compatibility
export { ScratchToolboxPicker, SpriteManager, BackdropManager }

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
  const [modalSelectedSpriteId, setModalSelectedSpriteId] = useState(null)
  const [modalSpritePanelTarget, setModalSpritePanelTarget] = useState(null)
  const [sidebarSections, setSidebarSections] = useState({ toolbox: true, sprites: true, backdrops: false, variables: false })
  const [modalStarterBlocks, setModalStarterBlocks] = useState(null)
  const modalStarterBlocksRef = React.useRef(null)
  const modalCompleteBlocksRef = React.useRef(null)
  const isCompleteTab = codeTab === 'complete'
  const stageTabMatch = codeTab.match(/^stage_(\d+)$/)
  const activeStageIndex = stageTabMatch ? parseInt(stageTabMatch[1], 10) : null
  const isStageTab = activeStageIndex !== null
  const codeStages = task.codeStages ?? []
  const activeStage = isStageTab ? (codeStages[activeStageIndex] ?? null) : null
  const activePythonCode = isCompleteTab
    ? (task.completeCode ?? '')
    : isStageTab
    ? (activeStage?.code ?? '')
    : (task.starterCode ?? '')
  const activeFiles = isCompleteTab
    ? (task.completeFiles ?? [])
    : isStageTab
    ? (activeStage?.files ?? [])
    : (task.starterFiles ?? [])
  const activeSelectedFile = isCompleteTab ? selectedCompleteFile : selectedFile
  const activeEntryFile = isCompleteTab
    ? (task.completeEntryFile ?? task.entryFile ?? 'index.html')
    : isStageTab
    ? (activeStage?.entryFile ?? task.entryFile ?? 'index.html')
    : (task.entryFile ?? 'index.html')
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

    const stageMatch = tab.match(/^stage_(\d+)$/)
    if (stageMatch) {
      const idx = parseInt(stageMatch[1], 10)
      const stage = (task.codeStages ?? [])[idx]
      if (stage && !isPython && !isScratch) {
        setSelectedFile(stage.files?.[0]?.name ?? '')
      }
    }

    setCodeTab(tab)
  }

  function handleAddStage() {
    const existing = task.codeStages ?? []
    const newStage = isPython
      ? { label: `Stage ${existing.length + 1}`, code: task.starterCode ?? '' }
      : { label: `Stage ${existing.length + 1}`, files: (task.starterFiles ?? []).map(f => ({ ...f })), entryFile: task.entryFile ?? 'index.html' }
    const updated = [...existing, newStage]
    onUpdate({ ...task, codeStages: updated })
    setCodeTab(`stage_${updated.length - 1}`)
    if (!isPython && !isScratch) {
      setSelectedFile(newStage.files?.[0]?.name ?? '')
    }
  }

  function handleRemoveStage(idx) {
    const existing = task.codeStages ?? []
    const updated = existing.filter((_, i) => i !== idx)
    onUpdate({ ...task, codeStages: updated.length > 0 ? updated : undefined })
    setCodeTab('starter')
  }

  function updateStage(idx, updates) {
    const existing = task.codeStages ?? []
    const updated = existing.map((s, i) => i === idx ? { ...s, ...updates } : s)
    onUpdate({ ...task, codeStages: updated })
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
    const activeSprites = task.sprites?.length > 0 ? task.sprites : DEFAULT_SPRITES
    setModalSelectedSpriteId(activeSprites[0]?.id ?? null)
  }

  function handleCloseStarterBlocks() {
    setStarterBlocksSyncKey(key => key + 1)
    requestAnimationFrame(() => setStarterBlocksOpen(false))
  }

  function toggleSidebarSection(name) {
    setSidebarSections(prev => ({ ...prev, [name]: !prev[name] }))
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

    setScratchModalTab(tab)
  }

  function handleAddScratchStage() {
    const existing = task.codeStages ?? []
    const srcBlocks = existing.length > 0
      ? cloneBlocks(existing[existing.length - 1].blocks)
      : cloneBlocks(modalStarterBlocksRef.current ?? task.starterBlocks)
    const newStage = { label: `Stage ${existing.length + 1}`, blocks: srcBlocks }
    const updated = [...existing, newStage]
    onUpdate({ ...task, codeStages: updated })
    setScratchModalTab(`stage_${updated.length - 1}`)
  }

  function handleRemoveScratchStage(idx) {
    const existing = task.codeStages ?? []
    const updated = existing.filter((_, i) => i !== idx)
    onUpdate({ ...task, codeStages: updated.length > 0 ? updated : undefined })
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
      onUpdate({ ...task, quizType: 'short_answer', check: existing ?? null })
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              style={{ ...s.input, flex: 1 }}
              value={task.title}
              onChange={e => set('title', e.target.value)}
              placeholder={`${parentGroup.title} - N`}
            />
            {task._customTitle ? (
              <button
                type="button"
                style={s.resetTitleBtn}
                title="Reset to auto-generated name"
                onClick={() => onUpdate({ ...task, title: '', _customTitle: undefined })}
              >
                reset
              </button>
            ) : (
              <span style={s.autoTitleBadge}>auto</span>
            )}
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

      <Field label="Estimated time (minutes)">
        <input
          style={s.input}
          type="number"
          min="1"
          step="1"
          value={task.estimatedMinutes ?? ''}
          onChange={e => {
            const value = e.target.value
            set('estimatedMinutes', value === '' ? undefined : Math.max(1, Number.parseInt(value, 10) || 1))
          }}
          placeholder="e.g. 10"
        />
      </Field>

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
              { value: 'recap', label: 'Two Pane View', hint: 'Two editable markdown panes' },
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

      {isInformation && (task.informationType ?? 'standard') === 'recap' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem', color: 'var(--colour-text)' }}>
            Left pane (Markdown)
          </span>
          <ExplainerEditor
            title={task.title}
            value={task.leftContent ?? ''}
            onChange={v => set('leftContent', v)}
            lessonType={lesson.type}
            inlineCodeLanguages={explainerInlineCodeLanguages}
            assets={lesson.assets ?? []}
            assetsPath={lesson.assetsPath ? resolveAssetsPath(lesson.assetsPath) : ''}
          />
        </div>
      )}

      {(task.informationType ?? 'standard') !== 'introduction' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem', color: 'var(--colour-text)' }}>
              {isInformation && (task.informationType ?? 'standard') === 'recap' ? 'Right pane (Markdown)' : 'Explainer (Markdown)'}
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
              assets={lesson.assets ?? []}
              assetsPath={lesson.assetsPath ? resolveAssetsPath(lesson.assetsPath) : ''}
            />
          )}
        </div>
      )}

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
            <CodeWorkspaceTabs
              activeTab={codeTab}
              onChange={handleCodeTabChange}
              stages={codeStages}
              onAddStage={handleAddStage}
              onRemoveStage={handleRemoveStage}
            />
            {isStageTab && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f5f3ff', border: '1px solid #e5e7eb', borderTop: 0, borderBottom: 0 }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>Stage label:</span>
                <input
                  style={{ ...s.input, width: 200, padding: '4px 8px', fontSize: '0.82rem' }}
                  value={activeStage?.label ?? ''}
                  onChange={e => updateStage(activeStageIndex, { label: e.target.value })}
                  placeholder={`Stage ${activeStageIndex + 1}`}
                />
              </div>
            )}
            <div style={s.pythonEditor}>
              <CodeEditor
                value={activePythonCode}
                language="python"
                onChange={v => isCompleteTab ? set('completeCode', v) : isStageTab ? updateStage(activeStageIndex, { code: v }) : set('starterCode', v)}
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
                    stages={codeStages}
                    onAddStage={handleAddScratchStage}
                    onRemoveStage={handleRemoveScratchStage}
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
                      {/* Toolbox blocks */}
                      <div style={s.collapsibleField}>
                        <button type="button" style={s.collapsibleHeader} onClick={() => toggleSidebarSection('toolbox')}>
                          <span style={s.collapsibleLabel}>Toolbox blocks</span>
                          <span style={{ ...s.collapsibleChevron, transform: sidebarSections.toolbox ? 'rotate(180deg)' : 'none' }}>▾</span>
                        </button>
                        {sidebarSections.toolbox && (
                          <ScratchToolboxPicker
                            toolbox={task.toolbox ?? ''}
                            onChange={toolbox => set('toolbox', toolbox)}
                          />
                        )}
                      </div>

                      {/* Sprites */}
                      <div style={s.collapsibleField}>
                        <button type="button" style={s.collapsibleHeader} onClick={() => toggleSidebarSection('sprites')}>
                          <span style={s.collapsibleLabel}>Sprites</span>
                          <span style={{ ...s.collapsibleChevron, transform: sidebarSections.sprites ? 'rotate(180deg)' : 'none' }}>▾</span>
                        </button>
                        {sidebarSections.sprites && (() => {
                          const activeSprites = task.sprites?.length > 0 ? task.sprites : DEFAULT_SPRITES
                          return (
                            <>
                              <div ref={setModalSpritePanelTarget} style={s.spritePanelHost} />
                              <div style={{ padding: '10px 12px', borderTop: '1px solid #e5e7eb' }}>
                                <SpriteManager
                                  sprites={activeSprites}
                                  onChange={newSprites => {
                                    set('sprites', newSprites)
                                    const currentIds = new Set(activeSprites.map(sp => sp.id))
                                    const added = newSprites.find(sp => !currentIds.has(sp.id))
                                    if (added) setModalSelectedSpriteId(added.id)
                                    else if (!newSprites.find(sp => sp.id === modalSelectedSpriteId)) {
                                      setModalSelectedSpriteId(newSprites[0]?.id ?? null)
                                    }
                                  }}
                                  assetsPath={lesson.assetsPath ? resolveAssetsPath(lesson.assetsPath) : ''}
                                  lessonId={lesson.id}
                                  lessonType={lesson.type}
                                />
                              </div>
                            </>
                          )
                        })()}
                      </div>

                      {/* Backdrops */}
                      <div style={s.collapsibleField}>
                        <button type="button" style={s.collapsibleHeader} onClick={() => toggleSidebarSection('backdrops')}>
                          <span style={s.collapsibleLabel}>Backdrops</span>
                          <span style={{ ...s.collapsibleChevron, transform: sidebarSections.backdrops ? 'rotate(180deg)' : 'none' }}>▾</span>
                        </button>
                        {sidebarSections.backdrops && (
                          <div style={{ padding: '10px 12px', borderTop: '1px solid #e5e7eb' }}>
                            <BackdropManager
                              backdrops={task.backdrops?.length > 0 ? task.backdrops : [{ id: 'backdrop1', name: 'Backdrop 1', colour: '#ffffff' }]}
                              onChange={backdrops => set('backdrops', backdrops)}
                              assetsPath={lesson.assetsPath ? resolveAssetsPath(lesson.assetsPath) : ''}
                              lessonId={lesson.id}
                              lessonType={lesson.type}
                            />
                          </div>
                        )}
                      </div>

                      {/* Variables */}
                      <div style={s.collapsibleField}>
                        <button type="button" style={s.collapsibleHeader} onClick={() => toggleSidebarSection('variables')}>
                          <span style={s.collapsibleLabel}>Variables</span>
                          <span style={{ ...s.collapsibleChevron, transform: sidebarSections.variables ? 'rotate(180deg)' : 'none' }}>▾</span>
                        </button>
                        {sidebarSections.variables && (
                          <div style={{ padding: '10px 12px', borderTop: '1px solid #e5e7eb' }}>
                            <VariableManager
                              variables={task.variables ?? []}
                              onChange={variables => set('variables', variables.length > 0 ? variables : undefined)}
                            />
                          </div>
                        )}
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
                        selectedSpriteId={modalSelectedSpriteId}
                        onSpriteSelect={setModalSelectedSpriteId}
                        spritePanelTarget={modalSpritePanelTarget}
                      />
                    ) : scratchModalTab === 'complete' ? (
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
                    ) : (() => {
                      const stageMatch = scratchModalTab.match(/^stage_(\d+)$/)
                      if (!stageMatch) return null
                      const stageIdx = parseInt(stageMatch[1], 10)
                      const stage = codeStages[stageIdx]
                      if (!stage) return null
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>Stage label:</span>
                            <input
                              style={{ ...s.input, width: 200, padding: '4px 8px', fontSize: '0.82rem' }}
                              value={stage.label ?? ''}
                              onChange={e => updateStage(stageIdx, { label: e.target.value })}
                              placeholder={`Stage ${stageIdx + 1}`}
                            />
                          </div>
                          <ScratchWorkspace
                            key={`builder-scratch-stage-${task.id}-${stageIdx}-${(task.sprites ?? []).map(sp => sp.id).join(',')}`}
                            task={task}
                            hideStage
                            assetsPath={lesson.assetsPath ? resolveAssetsPath(lesson.assetsPath) : ''}
                            initialStates={stage.blocks ?? null}
                            onStateChange={states => updateStage(stageIdx, { blocks: states })}
                            syncNowKey={starterBlocksSyncKey}
                          />
                        </div>
                      )
                    })()}
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
              stages={codeStages}
              onAddStage={handleAddStage}
              onRemoveStage={handleRemoveStage}
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
            {isStageTab && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f5f3ff', border: '1px solid #e5e7eb', borderTop: 0, borderBottom: 0 }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>Stage label:</span>
                <input
                  style={{ ...s.input, width: 200, padding: '4px 8px', fontSize: '0.82rem' }}
                  value={activeStage?.label ?? ''}
                  onChange={e => updateStage(activeStageIndex, { label: e.target.value })}
                  placeholder={`Stage ${activeStageIndex + 1}`}
                />
              </div>
            )}

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
                      } else if (isStageTab) {
                        updateStage(activeStageIndex, { files: [...(activeStage?.files ?? []), f] })
                        setSelectedFile(f.name)
                      } else {
                        set('starterFiles', [...(task.starterFiles ?? []), f])
                        setSelectedFile(f.name)
                      }
                    }}
                    onSetFiles={(newFiles, newEntry) => {
                      if (isCompleteTab) {
                        onUpdate({ ...task, completeFiles: newFiles, completeEntryFile: newEntry })
                        setSelectedCompleteFile(newFiles[0]?.name ?? '')
                      } else if (isStageTab) {
                        updateStage(activeStageIndex, { files: newFiles, entryFile: newEntry })
                        setSelectedFile(newFiles[0]?.name ?? '')
                      } else {
                        onUpdate({ ...task, starterFiles: newFiles, entryFile: newEntry })
                        setSelectedFile(newFiles[0]?.name ?? '')
                      }
                    }}
                    onDeleteFile={name => {
                      const current = isCompleteTab ? (task.completeFiles ?? []) : isStageTab ? (activeStage?.files ?? []) : (task.starterFiles ?? [])
                      const next = current.filter(f => f.name !== name)
                      if (isCompleteTab) {
                        set('completeFiles', next)
                        setSelectedCompleteFile(next[0]?.name ?? '')
                      } else if (isStageTab) {
                        updateStage(activeStageIndex, { files: next })
                        setSelectedFile(next[0]?.name ?? '')
                      } else {
                        set('starterFiles', next)
                        setSelectedFile(next[0]?.name ?? '')
                      }
                    }}
                    onChangeType={(name, type) => {
                      if (isCompleteTab) set('completeFiles', (task.completeFiles ?? []).map(f => f.name === name ? { ...f, type } : f))
                      else if (isStageTab) updateStage(activeStageIndex, { files: (activeStage?.files ?? []).map(f => f.name === name ? { ...f, type } : f) })
                      else set('starterFiles', (task.starterFiles ?? []).map(f => f.name === name ? { ...f, type } : f))
                    }}
                    onChangeEntryFile={name => {
                      if (isCompleteTab) set('completeEntryFile', name)
                      else if (isStageTab) updateStage(activeStageIndex, { entryFile: name })
                      else set('entryFile', name)
                    }}
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
                            else if (isStageTab) updateStage(activeStageIndex, { files: (activeStage?.files ?? []).map(f => f.name === activeSelectedFile ? { ...f, content: v } : f) })
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
