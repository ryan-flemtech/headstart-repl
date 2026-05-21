import React, { useState } from 'react'
import LessonMetaPanel from '../components/LessonMetaPanel'
import TaskList from '../components/TaskList'
import TaskEditor from '../components/TaskEditor'
import { normalizeChecks } from '../../shared/checks'

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
    if (!task.explainer) errors.push(`Task ${n} is missing an explainer`)

    if (type === 'html') {
      if (!task.starterFiles || task.starterFiles.length === 0) errors.push(`Task ${n} has no files`)
      else {
        const names = task.starterFiles.map(f => f.name)
        if (new Set(names).size !== names.length) errors.push(`Task ${n} has duplicate filenames`)
        if (!task.starterFiles.some(f => f.type === 'html' || f.name.endsWith('.html')))
          errors.push(`Task ${n} has no HTML file to use as entry point`)
      }
    }

    if (type === 'scratch') {
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
      if (checksArr.some(c => !c.value && c.value !== 0)) {
        errors.push(`Task ${n} has a check enabled but no check value`)
      }
    }

    const carryFrom = type === 'scratch' ? task.carryBlocksFrom : task.carryCodeFrom
    if (carryFrom != null) {
      const exists = tasks.some(t => t.id === carryFrom)
      if (!exists) errors.push(`Task ${n} references task ${carryFrom} for carry-through but that task does not exist`)
    }

    // Warnings
    const hasStarter = type === 'python'
      ? !!task.starterCode
      : type === 'scratch'
        ? !!task.starterBlocks
        : task.starterFiles?.some(f => f.content.trim())
    if (!hasStarter) warnings.push(`Task ${n} has no starter code — students will start with an empty editor`)
    const checkHasValue = type === 'scratch'
      ? !!task.check
      : normalizeChecks(task.check).some(c => c.value)
    if (checkHasValue && !task._checkTested)
      warnings.push(`Task ${n} has a completion check that hasn't been tested — run the task to verify it`)
  })

  return { errors, warnings }
}

export default function BuilderView({ lesson, dirty, onUpdate, onNew, onMarkSaved }) {
  const [selectedTaskId, setSelectedTaskId] = useState(lesson.tasks[0]?.id ?? null)

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
      tasks: lesson.tasks.map((t, i) => ({ ...t, id: i + 1 })),
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
    const newTask = {
      id: newId,
      title: '',
      explainer: '',
      ...(lesson.type === 'python'
        ? { starterCode: '', carryCodeFrom: null }
        : lesson.type === 'scratch'
          ? { toolbox: '', starterBlocks: null, carryBlocksFrom: null }
          : { starterFiles: [{ name: 'index.html', type: 'html', content: '<!DOCTYPE html>\n<html>\n<body>\n\n</body>\n</html>\n' }], entryFile: 'index.html', carryCodeFrom: null }
      ),
    }
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
            className="btn-primary"
            style={{ fontSize: 13, padding: '5px 14px' }}
            onClick={handleDownload}
            disabled={errors.length > 0}
          >
            Download JSON
          </button>
        </div>
      </header>

      <div style={s.body}>
        <aside style={s.metaPane}>
          <LessonMetaPanel lesson={lesson} onUpdate={onUpdate} />
          <ValidationPanel errors={errors} warnings={warnings} />
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
  const [activeTab, setActiveTab] = useState(errors.length ? 'errors' : 'warnings')
  const items = activeTab === 'errors' ? errors : warnings
  const count = activeTab === 'errors' ? errors.length : warnings.length

  return (
    <section style={s.validation}>
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
    minHeight: 180,
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
