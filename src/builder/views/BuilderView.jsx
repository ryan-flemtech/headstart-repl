import React, { useState } from 'react'
import LessonMetaPanel from '../components/LessonMetaPanel'
import TaskList from '../components/TaskList'
import TaskEditor from '../components/TaskEditor'
import PreviewView from './PreviewView'
import { checkAllowedForSubmit, normalizeChecks } from '../../shared/checks'
import { HTML_ONLY } from '../components/FileManager'

function validateLesson(lesson) {
  const errors = []
  const warnings = []
  const { id, title, type, tasks } = lesson

  if (!id)    errors.push('Lesson ID is required')
  else if (!/^[a-z0-9-]+$/.test(id)) errors.push('Lesson ID must be lowercase with hyphens only')
  if (!title) errors.push('Lesson title is required')
  if (!tasks || tasks.length === 0) errors.push('Lesson must have at least one task')

  tasks.forEach((task, i) => {
    const n = i + 1
    if (!task.title)    errors.push(`Task ${n} is missing a title`)
    if (task.taskType === 'information' && !task.explainer?.trim()) {
      errors.push(`Task ${n} is an information task but has no explainer`)
    }

    if (task.taskType === 'information') {
      // Information tasks only render explainer markdown.
    } else if (task.taskType === 'quiz') {
      if (!task.options || task.options.length < 2) {
        errors.push(`Task ${n} is a quiz but has fewer than 2 options.`)
      }
      if (task.options?.some(option => !option.text?.trim())) {
        errors.push(`Task ${n} is a quiz but has an empty option text field.`)
      }
      if (task.check?.type !== 'answer_equals' || !task.check.value) {
        errors.push(`Task ${n} is a quiz but no correct answer has been selected.`)
      }
    } else if (type === 'html') {
      if (!task.starterFiles || task.starterFiles.length === 0) errors.push(`Task ${n} has no files`)
      else {
        const names = task.starterFiles.map(f => f.name)
        if (new Set(names).size !== names.length) errors.push(`Task ${n} has duplicate filenames`)
        if (!task.starterFiles.some(f => f.type === 'html' || f.name.endsWith('.html')))
          errors.push(`Task ${n} has no HTML file to use as entry point`)
      }
    }

    if (task.taskType === 'information') {
      // Information tasks have no checks.
    } else if (task.taskType === 'quiz') {
      // Quiz checks are validated above.
    } else if (type === 'scratch') {
      if (task.toolbox) {
        try {
          const parsed = new DOMParser().parseFromString(task.toolbox, 'text/xml')
          if (parsed.querySelector('parsererror')) errors.push(`Task ${n} has invalid toolbox XML`)
        } catch {
          errors.push(`Task ${n} has invalid toolbox XML`)
        }
      }

      if (task.check?.type === 'sprite_property') {
        if (!task.check.property) errors.push(`Task ${n} sprite check is missing a property`)
        if (!task.check.operator) errors.push(`Task ${n} sprite check is missing an operator`)
        if (task.check.value == null || task.check.value === '') errors.push(`Task ${n} sprite check is missing a value`)
      }

      if (task.check?.type === 'block_used' && !task.check.opcode) {
        errors.push(`Task ${n} block-used check is missing a block opcode`)
      }
    } else if (task.check) {
      const checksArr = normalizeChecks(task.check)
      if (task.interactionMode === 'submit' && checksArr.some(c => !checkAllowedForSubmit(c))) {
        errors.push(`Task ${n} uses submit mode but has a check that requires running the code`)
      }
      if (checksArr.some(c => ['element_exists', 'element_count', 'element_value'].includes(c.type) && !c.selector?.trim())) {
        errors.push(`Task ${n} has an element check but no CSS selector`)
      }
      if (checksArr.some(c => !['code_no_error', 'output_not_empty', 'element_exists'].includes(c.type) && !c.value && c.value !== 0)) {
        errors.push(`Task ${n} has a check enabled but no check value`)
      }
    }

    const carryFrom = task.taskType === 'quiz' || task.taskType === 'information' ? null : type === 'scratch' ? task.carryBlocksFrom : task.carryCodeFrom
    if (carryFrom != null) {
      const exists = tasks.some(t => t.id === carryFrom)
      if (!exists) errors.push(`Task ${n} references task ${carryFrom} for carry-through but that task does not exist`)
    }

    // Warnings
    const hasStarter = task.taskType === 'information'
      ? true
      : task.taskType === 'quiz'
      ? task.options?.some(option => option.text?.trim())
      : type === 'python'
      ? !!task.starterCode
      : type === 'scratch'
        ? !!task.starterBlocks
        : task.starterFiles?.some(f => f.content.trim())
    if (!hasStarter) warnings.push(`Task ${n} has no starter code — students will start with an empty editor`)
    const checkHasValue = task.taskType === 'information'
      ? false
      : task.taskType === 'quiz'
      ? !!task.check?.value
      : type === 'scratch'
      ? !!task.check
      : normalizeChecks(task.check).some(c => c.type === 'code_no_error' || c.type === 'output_not_empty' || c.type === 'element_exists' || c.value)
    if (checkHasValue && !task._checkTested)
      warnings.push(`Task ${n} has a completion check that hasn't been tested — run the task to verify it`)
  })

  return { errors, warnings }
}

function normalizeTaskForExport(task, index) {
  const hints = Array.isArray(task.hints) ? task.hints.map(h => String(h ?? '').trim()).filter(Boolean) : []

  if (task.taskType !== 'information') {
    const { hints: _hints, ...rest } = task
    return hints.length > 0 ? { ...rest, id: index + 1, hints } : { ...rest, id: index + 1 }
  }

  const exported = {
    id: index + 1,
    taskType: 'information',
    title: task.title,
    explainer: task.explainer ?? '',
  }
  if (hints.length > 0) exported.hints = hints
  return exported
}

export default function BuilderView({ lesson, dirty, onUpdate, onNew, onMarkSaved }) {
  const [selectedTaskId, setSelectedTaskId] = useState(lesson.tasks[0]?.id ?? null)
  const [previewing, setPreviewing] = useState(false)
  const [metaOpen, setMetaOpen] = useState(false)

  if (previewing) {
    return <PreviewView lesson={lesson} onClose={() => setPreviewing(false)} />
  }

  function handleDownload() {
    const { errors, warnings } = validateLesson(lesson)
    if (errors.length) {
      alert('Cannot download — please fix these errors:\n\n' + errors.join('\n'))
      return
    }
    if (warnings.length) {
      const ok = confirm('Warnings:\n\n' + warnings.join('\n') + '\n\nDownload anyway?')
      if (!ok) return
    }

    // Renumber task IDs sequentially
    const exported = {
      ...lesson,
      tasks: lesson.tasks.map(normalizeTaskForExport),
    }
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${lesson.id || 'lesson'}.json`
    a.click()
    URL.revokeObjectURL(url)
    onMarkSaved()
  }

  function handleUpload() {
    if (dirty && !confirm('You have unsaved changes — download your lesson first.\n\nContinue?')) return
    const input = document.createElement('input')
    input.type   = 'file'
    input.accept = '.json'
    input.onchange = e => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = ev => {
        try {
          const parsed = JSON.parse(ev.target.result)
          if (!parsed.id || !parsed.tasks) throw new Error('Unrecognised format')
          onUpdate(parsed)
          setSelectedTaskId(parsed.tasks[0]?.id ?? null)
        } catch (err) {
          alert('Could not load file: ' + err.message)
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  function handleAddTask() {
    const maxId = lesson.tasks.reduce((m, t) => Math.max(m, t.id), 0)
    const newId = maxId + 1
    const prevTask = lesson.tasks[lesson.tasks.length - 1] ?? null

    let typeFields
    if (lesson.type === 'python') {
      typeFields = {
        starterCode: prevTask ? (prevTask.completeCode ?? prevTask.starterCode ?? '') : '',
        carryCodeFrom: prevTask?.id ?? null,
      }
    } else if (lesson.type === 'scratch') {
      typeFields = {
        toolbox: '',
        starterBlocks: prevTask ? (prevTask.completeBlocks ?? prevTask.starterBlocks ?? null) : null,
        carryBlocksFrom: prevTask?.id ?? null,
      }
    } else {
      typeFields = {
        starterFiles: prevTask
          ? (prevTask.completeFiles ?? prevTask.starterFiles ?? []).map(f => ({ ...f }))
          : [{ name: 'index.html', type: 'html', content: HTML_ONLY }],
        entryFile: prevTask ? (prevTask.completeEntryFile ?? prevTask.entryFile ?? 'index.html') : 'index.html',
        carryCodeFrom: prevTask?.id ?? null,
      }
    }

    const newTask = { id: newId, title: '', explainer: '', ...typeFields }
    onUpdate(prev => ({ ...prev, tasks: [...prev.tasks, newTask] }))
    setSelectedTaskId(newId)
  }

  const { errors, warnings } = validateLesson(lesson)
  const selectedTask = lesson.tasks.find(t => t.id === selectedTaskId)

  return (
    <div style={s.page}>
      {/* Top bar */}
      <header style={s.topBar}>
        <span style={s.logo}>Headstart Coding - LaunchPad | Lesson Builder</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {dirty && <span style={s.dirtyDot} title="Unsaved changes" />}
          <button className="btn-ghost" style={{ fontSize: 13, padding: '5px 12px' }} onClick={onNew}>New</button>
          <button className="btn-ghost" style={{ fontSize: 13, padding: '5px 12px' }} onClick={handleUpload}>Upload</button>
          <button
            className="btn-ghost"
            style={{ fontSize: 13, padding: '5px 12px' }}
            onClick={() => setPreviewing(true)}
            disabled={lesson.tasks.length === 0}
            title={lesson.tasks.length === 0 ? 'Add at least one task to preview' : 'Preview as student'}
          >
            Preview
          </button>
          <button
            className="btn-primary"
            style={{ fontSize: 13, padding: '5px 14px' }}
            onClick={handleDownload}
            disabled={errors.length > 0}
          >
            Download JSON
          </button>
        </div>
      </header>

      <div style={{ ...s.body, gridTemplateColumns: metaOpen ? '320px 280px minmax(0, 1fr)' : '40px 280px minmax(0, 1fr)' }}>
        <aside style={metaOpen ? s.metaPane : s.metaPaneCollapsed}>
          {metaOpen ? (
            <LessonMetaPanel lesson={lesson} onUpdate={onUpdate} onCollapse={() => setMetaOpen(false)} />
          ) : (
            <div style={s.collapsedMetaStrip}>
              <button
                type="button"
                style={s.expandMetaBtn}
                onClick={() => setMetaOpen(true)}
                title="Expand lesson details"
              >
                ›
              </button>
            </div>
          )}
        </aside>

        <aside style={s.taskPane}>
          <TaskList
            tasks={lesson.tasks}
            selectedTaskId={selectedTaskId}
            onSelect={setSelectedTaskId}
            onAdd={handleAddTask}
            onDuplicate={task => {
              const maxId = lesson.tasks.reduce((m, t) => Math.max(m, t.id), 0)
              const dup = { ...task, id: maxId + 1, title: task.title + ' (copy)' }
              onUpdate(prev => ({ ...prev, tasks: [...prev.tasks, dup] }))
              setSelectedTaskId(dup.id)
            }}
            onDelete={taskId => {
              if (!confirm('Delete this task?')) return
              onUpdate(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== taskId) }))
              const remaining = lesson.tasks.filter(t => t.id !== taskId)
              setSelectedTaskId(remaining[0]?.id ?? null)
            }}
            onReorder={reorderedTasks => {
              const renumbered = reorderedTasks.map((t, i) => ({ ...t, id: i + 1 }))
              onUpdate(prev => ({ ...prev, tasks: renumbered }))
            }}
          />
          <ValidationPanel errors={errors} warnings={warnings} />
        </aside>

        <main style={s.main}>
          {selectedTask ? (
            <TaskEditor
              key={selectedTask.id}
              task={selectedTask}
              lesson={lesson}
              onUpdate={updated => {
                onUpdate(prev => ({
                  ...prev,
                  tasks: prev.tasks.map(t => t.id === updated.id ? updated : t),
                }))
              }}
            />
          ) : (
            <div style={s.empty}>
              <p>Select a task from the left panel, or add a new one to get started.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function ValidationPanel({ errors, warnings }) {
  const [open, setOpen] = useState(errors.length > 0)
  const [activeTab, setActiveTab] = useState(errors.length ? 'errors' : 'warnings')

  const total = errors.length + warnings.length
  const summaryParts = []
  if (errors.length) summaryParts.push(`${errors.length} error${errors.length !== 1 ? 's' : ''}`)
  if (warnings.length) summaryParts.push(`${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`)
  const summary = summaryParts.join(', ') || 'No issues'

  const items = activeTab === 'errors' ? errors : warnings
  const count = activeTab === 'errors' ? errors.length : warnings.length

  return (
    <section style={s.validation}>
      <button
        type="button"
        style={s.validationHeader}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span style={s.validationHeaderTitle}>Validation</span>
        <span style={{ ...s.validationSummary, color: errors.length ? '#ef4444' : warnings.length ? '#f59e0b' : '#22c55e' }}>
          {summary}
        </span>
        <span style={{ ...s.optionsChevron, transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>

      {open && (
        <>
          <div style={s.validationTabs}>
            <button
              style={{ ...s.validationTab, ...(activeTab === 'errors' ? s.validationTabActive : {}) }}
              onClick={() => setActiveTab('errors')}
            >
              Errors <span style={s.countBadge}>{errors.length}</span>
            </button>
            <button
              style={{ ...s.validationTab, ...(activeTab === 'warnings' ? s.validationTabActive : {}) }}
              onClick={() => setActiveTab('warnings')}
            >
              Warnings <span style={s.countBadge}>{warnings.length}</span>
            </button>
          </div>

          <div style={s.validationBody}>
            {count === 0 ? (
              <p style={s.validationEmpty}>
                No {activeTab === 'errors' ? 'errors' : 'warnings'} found.
              </p>
            ) : (
              items.map((item, i) => (
                <div key={`${activeTab}-${i}`} style={activeTab === 'errors' ? s.errorItem : s.warningItem}>
                  {item}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </section>
  )
}

const s = {
  page: { display: 'flex', flexDirection: 'column', height: '100%' },
  topBar: {
    background: 'var(--colour-primary)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    height: 52,
    flexShrink: 0,
  },
  logo: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1rem',
    color: '#ffffff',
  },
  dirtyDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--colour-secondary)',
    display: 'inline-block',
  },
  body: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '320px 280px minmax(0, 1fr)',
    overflow: 'hidden',
  },
  metaPane: {
    background: '#fff',
    borderRight: '1px solid #e5e7eb',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  metaPaneCollapsed: {
    background: '#fff',
    borderRight: '1px solid #e5e7eb',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  collapsedMetaStrip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    width: '100%',
  },
  expandMetaBtn: {
    width: 28,
    height: 28,
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    background: '#fff',
    color: 'var(--colour-primary)',
    cursor: 'pointer',
    fontSize: '1.15rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    padding: 0,
  },
  collapsedErrorDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#ef4444',
    display: 'block',
    flexShrink: 0,
  },
  collapsedWarningDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#f59e0b',
    display: 'block',
    flexShrink: 0,
  },
  taskPane: {
    background: '#fff',
    borderRight: '1px solid #e5e7eb',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  main: {
    overflow: 'auto',
    background: '#f5f5f5',
    padding: 20,
    minWidth: 0,
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#9ca3af',
    fontFamily: 'var(--font-body)',
    fontSize: '0.95rem',
  },
  validation: {
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  validationHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    background: '#fafafa',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  validationHeaderTitle: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.82rem',
    color: 'var(--colour-text)',
    flexShrink: 0,
  },
  validationSummary: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  optionsChevron: {
    marginLeft: 'auto',
    color: '#6b7280',
    fontSize: '1rem',
    lineHeight: 1,
    flexShrink: 0,
  },
  validationTabs: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    padding: 10,
    gap: 6,
    borderBottom: '1px solid #e5e7eb',
    background: '#fafafa',
  },
  validationTab: {
    border: '1px solid #e5e7eb',
    background: '#fff',
    color: 'var(--colour-text)',
    borderRadius: 6,
    padding: '7px 8px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  validationTabActive: {
    borderColor: 'var(--colour-primary)',
    color: 'var(--colour-primary)',
    background: '#f7f2ff',
  },
  countBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
    height: 20,
    marginLeft: 6,
    padding: '0 6px',
    borderRadius: 999,
    background: '#eef2ff',
    color: 'var(--colour-primary)',
    fontSize: '0.72rem',
  },
  validationBody: {
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  validationEmpty: {
    margin: 0,
    color: '#6b7280',
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
  },
  errorItem: {
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#991b1b',
    borderRadius: 6,
    padding: '8px 10px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.84rem',
    lineHeight: 1.45,
  },
  warningItem: {
    border: '1px solid #fde68a',
    background: '#fffbeb',
    color: '#92400e',
    borderRadius: 6,
    padding: '8px 10px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.84rem',
    lineHeight: 1.45,
  },
}
