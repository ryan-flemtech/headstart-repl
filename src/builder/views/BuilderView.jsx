import React, { useState } from 'react'
import LessonMetaPanel from '../components/LessonMetaPanel'
import TaskList from '../components/TaskList'
import TaskEditor from '../components/TaskEditor'

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

    if (task.check?.type && !task.check.value) errors.push(`Task ${n} has a check enabled but no check value`)

    if (task.carryCodeFrom != null) {
      const exists = tasks.some(t => t.id === task.carryCodeFrom)
      if (!exists) errors.push(`Task ${n} references task ${task.carryCodeFrom} for carry-through but that task does not exist`)
    }

    // Warnings
    const hasStarter = type === 'python' ? !!task.starterCode : task.starterFiles?.some(f => f.content.trim())
    if (!hasStarter) warnings.push(`Task ${n} has no starter code — students will start with an empty editor`)
    if (task.check?.type && task.check.value && !task._checkTested)
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
      carryCodeFrom: null,
      ...(lesson.type === 'python'
        ? { starterCode: '' }
        : { starterFiles: [{ name: 'index.html', type: 'html', content: '<!DOCTYPE html>\n<html>\n<body>\n\n</body>\n</html>\n' }], entryFile: 'index.html' }
      ),
    }
    onUpdate(prev => ({ ...prev, tasks: [...prev.tasks, newTask] }))
    setSelectedTaskId(newId)
  }

  const { errors } = validateLesson(lesson)
  const selectedTask = lesson.tasks.find(t => t.id === selectedTaskId)

  return (
    <div style={s.page}>
      {/* Top bar */}
      <header style={s.topBar}>
        <span style={s.logo}>Headstart Lesson Builder</span>
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
        {/* Left panel */}
        <aside style={s.left}>
          <LessonMetaPanel lesson={lesson} onUpdate={onUpdate} />
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

        {/* Main panel */}
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
    gridTemplateColumns: '260px 1fr',
    overflow: 'hidden',
  },
  left: {
    background: '#fff',
    borderRight: '1px solid #e5e7eb',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  main: {
    overflow: 'auto',
    background: '#f5f5f5',
    padding: 16,
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
}
