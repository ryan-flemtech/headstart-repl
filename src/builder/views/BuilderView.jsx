import React, { useState } from 'react'
import LessonMetaPanel from '../components/LessonMetaPanel'
import TaskList from '../components/TaskList'
import TaskEditor from '../components/TaskEditor'
import PreviewView from './PreviewView'
import { HTML_ONLY } from '../components/FileManager'
import { flattenTasks, findGroupForTask, updateTaskInTasks, updateSubtaskTitles } from '../../shared/taskUtils'
import { normalizeTasksForExport, validateLesson } from '../lessonUtils'

// ─── Group editor panel ───────────────────────────────────────────────────────

function GroupEditor({ group, onUpdate }) {
  return (
    <div style={ge.wrap}>
      <div style={ge.field}>
        <span style={ge.label}>Group title</span>
        <input
          style={ge.input}
          value={group.title}
          onChange={e => onUpdate({ ...group, title: e.target.value })}
          placeholder="e.g. Functions"
          autoFocus
        />
      </div>
      <p style={ge.hint}>
        This group contains {group.subtasks?.length ?? 0} subtask{(group.subtasks?.length ?? 0) !== 1 ? 's' : ''}.
        Subtasks are shown as a single step in the student progress indicator.
        Use the task list to add, reorder, or delete subtasks.
      </p>
    </div>
  )
}

const ge = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 16, padding: 4 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
  },
  input: {
    border: '1px solid #d1d5db',
    borderRadius: 6,
    padding: '8px 10px',
    fontSize: '0.95rem',
    fontFamily: 'var(--font-body)',
    color: 'var(--colour-text)',
    outline: 'none',
  },
  hint: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
    color: '#6b7280',
    lineHeight: 1.6,
    margin: 0,
  },
}

// ─── BuilderView ──────────────────────────────────────────────────────────────

export default function BuilderView({ lesson, dirty, onUpdate, onNew, onMarkSaved }) {
  const [selectedTaskId, setSelectedTaskId] = useState(() => {
    const first = lesson.tasks[0]
    if (!first) return null
    if (first.type === 'group') return first.subtasks?.[0]?.id ?? null
    return first.id
  })
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [metaOpen, setMetaOpen] = useState(false)

  function handleLessonUpdate(updater) {
    if (typeof updater === 'function') {
      onUpdate(prev => {
        const next = updater(prev)
        return {
          ...next,
          tasks: updateSubtaskTitles(next.tasks),
        }
      })
    } else {
      onUpdate({
        ...updater,
        tasks: updateSubtaskTitles(updater.tasks),
      })
    }
  }

  function selectTask(id) {
    setSelectedTaskId(id)
    setSelectedGroupId(null)
  }

  function selectGroup(id) {
    setSelectedGroupId(id)
    setSelectedTaskId(null)
  }

  if (previewing) {
    return <PreviewView lesson={lesson} onClose={() => setPreviewing(false)} initialTaskId={selectedTaskId} />
  }

  // ── Default type fields for a new task ──────────────────────────────────────

  function defaultTypeFields(prevTask = null) {
    if (lesson.type === 'python') {
      return {
        starterCode: prevTask ? (prevTask.completeCode ?? prevTask.starterCode ?? '') : '',
        carryCodeFrom: prevTask?.id ?? null,
      }
    }
    if (lesson.type === 'scratch') {
      return {
        toolbox: '',
        starterBlocks: prevTask ? (prevTask.completeBlocks ?? prevTask.starterBlocks ?? null) : null,
        carryBlocksFrom: prevTask?.id ?? null,
      }
    }
    return {
      starterFiles: prevTask
        ? (prevTask.completeFiles ?? prevTask.starterFiles ?? []).map(f => ({ ...f }))
        : [{ name: 'index.html', type: 'html', content: HTML_ONLY }],
      entryFile: prevTask ? (prevTask.completeEntryFile ?? prevTask.entryFile ?? 'index.html') : 'index.html',
      carryCodeFrom: prevTask?.id ?? null,
    }
  }

  function nextId() {
    return flattenTasks(lesson.tasks).reduce((m, t) => Math.max(m, t.id), 0) + 1
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

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

    const exported = {
      ...lesson,
      tasks: normalizeTasksForExport(lesson.tasks),
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
          handleLessonUpdate(parsed)
          const firstFlat = flattenTasks(parsed.tasks)
          selectTask(firstFlat[0]?.id ?? null)
        } catch (err) {
          alert('Could not load file: ' + err.message)
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  function topLevelInsertPosition() {
    const flat = flattenTasks(lesson.tasks)
    const defaultPrev = flat[flat.length - 1] ?? null
    if (selectedTaskId != null) {
      const topIdx = lesson.tasks.findIndex(item => item.type !== 'group' && item.id === selectedTaskId)
      if (topIdx >= 0) return { index: topIdx + 1, prevTask: lesson.tasks[topIdx] }
      const groupIdx = lesson.tasks.findIndex(
        item => item.type === 'group' && (item.subtasks ?? []).some(s => s.id === selectedTaskId)
      )
      if (groupIdx >= 0) {
        const group = lesson.tasks[groupIdx]
        return {
          index: groupIdx + 1,
          prevTask: (group.subtasks ?? []).find(s => s.id === selectedTaskId) ?? defaultPrev,
        }
      }
    }
    if (selectedGroupId != null) {
      const groupIdx = lesson.tasks.findIndex(item => item.type === 'group' && item.id === selectedGroupId)
      if (groupIdx >= 0) {
        const group = lesson.tasks[groupIdx]
        return { index: groupIdx + 1, prevTask: (group.subtasks ?? []).at(-1) ?? defaultPrev }
      }
    }
    return { index: lesson.tasks.length, prevTask: defaultPrev }
  }

  function handleAddTask() {
    const { index, prevTask } = topLevelInsertPosition()
    const newId = nextId()
    const newTask = { id: newId, title: '', explainer: '', ...defaultTypeFields(prevTask) }
    handleLessonUpdate(prev => {
      const next = [...prev.tasks]
      next.splice(index, 0, newTask)
      return { ...prev, tasks: next }
    })
    selectTask(newId)
  }

  function handleAddGroup() {
    const { index, prevTask } = topLevelInsertPosition()
    const newId = nextId()
    const groupId = `g-${Date.now()}`
    const firstSubtask = {
      id: newId,
      title: 'New Group - 1',
      explainer: '',
      ...defaultTypeFields(prevTask),
    }
    const newGroup = {
      id: groupId,
      type: 'group',
      title: 'New Group',
      subtasks: [firstSubtask],
    }
    handleLessonUpdate(prev => {
      const next = [...prev.tasks]
      next.splice(index, 0, newGroup)
      return { ...prev, tasks: next }
    })
    selectGroup(groupId)
  }

  function handleAddSubtask(groupId) {
    const group = lesson.tasks.find(t => t.type === 'group' && t.id === groupId)
    if (!group) return
    const newId = nextId()
    const subtasks = group.subtasks ?? []
    const selectedSubtaskIdx = selectedTaskId != null
      ? subtasks.findIndex(s => s.id === selectedTaskId)
      : -1
    const insertIndex = selectedSubtaskIdx >= 0 ? selectedSubtaskIdx + 1 : subtasks.length
    const prevSubtask = selectedSubtaskIdx >= 0 ? subtasks[selectedSubtaskIdx] : (subtasks[subtasks.length - 1] ?? null)
    const newSubtask = {
      id: newId,
      title: `${group.title} - ${subtasks.length + 1}`,
      explainer: '',
      ...defaultTypeFields(prevSubtask),
    }
    handleLessonUpdate(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => {
        if (t.type !== 'group' || t.id !== groupId) return t
        const subs = t.subtasks ?? []
        return { ...t, subtasks: [...subs.slice(0, insertIndex), newSubtask, ...subs.slice(insertIndex)] }
      }),
    }))
    selectTask(newId)
  }

  function handleDuplicate(task, groupId = null) {
    const newId = nextId()

    if (groupId) {
      const group = lesson.tasks.find(t => t.type === 'group' && t.id === groupId)
      const newTitle = group ? `${group.title} - ${(group.subtasks?.length ?? 0) + 1}` : task.title
      const dup = { ...task, id: newId, title: newTitle }
      handleLessonUpdate(prev => ({
        ...prev,
        tasks: prev.tasks.map(t =>
          t.type === 'group' && t.id === groupId
            ? { ...t, subtasks: [...(t.subtasks ?? []), dup] }
            : t
        ),
      }))
    } else {
      const dup = { ...task, id: newId, title: task.title + ' (copy)' }
      handleLessonUpdate(prev => ({ ...prev, tasks: [...prev.tasks, dup] }))
      selectTask(dup.id)
      return
    }
    selectTask(newId)
  }

  function handleDelete(taskId) {
    if (!confirm('Delete this task?')) return
    const group = findGroupForTask(lesson.tasks, taskId)

    if (group) {
      const newSubtasks = (group.subtasks ?? []).filter(t => t.id !== taskId)
      if (newSubtasks.length === 0) {
        // Remove the now-empty group too
        handleLessonUpdate(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== group.id) }))
        const remaining = flattenTasks(lesson.tasks.filter(t => t.id !== group.id))
        selectTask(remaining[0]?.id ?? null)
      } else {
        handleLessonUpdate(prev => ({
          ...prev,
          tasks: prev.tasks.map(t =>
            t.type === 'group' && t.id === group.id ? { ...t, subtasks: newSubtasks } : t
          ),
        }))
        selectTask(newSubtasks[0]?.id ?? null)
      }
    } else {
      handleLessonUpdate(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== taskId) }))
      const remaining = flattenTasks(lesson.tasks.filter(t => !(t.type !== 'group' && t.id === taskId)))
      selectTask(remaining[0]?.id ?? null)
    }
  }

  function handleDeleteGroup(groupId) {
    if (!confirm('Delete this group and all its subtasks?')) return
    handleLessonUpdate(prev => ({ ...prev, tasks: prev.tasks.filter(t => !(t.type === 'group' && t.id === groupId)) }))
    const remaining = flattenTasks(lesson.tasks.filter(t => !(t.type === 'group' && t.id === groupId)))
    selectTask(remaining[0]?.id ?? null)
  }

  function handleReorder(reorderedTasks) {
    onUpdate(prev => ({ ...prev, tasks: reorderedTasks }))
  }

  function handleReorderSubtask(groupId, reorderedSubtasks) {
    const updated = lesson.tasks.map(item => {
      if (item.type === 'group') {
        const subtasks = item.id === groupId ? reorderedSubtasks : (item.subtasks ?? [])
        return {
          ...item,
          subtasks,
        }
      }
      return item
    })
    onUpdate(prev => ({ ...prev, tasks: updated }))
  }

  // ── Derived state ────────────────────────────────────────────────────────────

  const { errors, warnings } = validateLesson(lesson)
  const flatTasks = flattenTasks(lesson.tasks)
  const selectedTask = selectedTaskId != null ? flatTasks.find(t => t.id === selectedTaskId) : null
  const selectedGroup = selectedGroupId != null
    ? lesson.tasks.find(t => t.type === 'group' && t.id === selectedGroupId)
    : null

  // Pass a flat-tasks version of lesson to TaskEditor so its internal pickers work correctly
  const lessonForEditor = selectedTask ? { ...lesson, tasks: flatTasks } : lesson
  const selectedTaskGroup = selectedTask
    ? (lesson.tasks.find(t => t.type === 'group' && (t.subtasks ?? []).some(s => s.id === selectedTask.id)) ?? null)
    : null

  return (
    <div style={s.page}>
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
              <button type="button" style={s.expandMetaBtn} onClick={() => setMetaOpen(true)} title="Expand lesson details">
                ›
              </button>
            </div>
          )}
        </aside>

        <aside style={s.taskPane}>
          <TaskList
            tasks={lesson.tasks}
            selectedTaskId={selectedTaskId}
            selectedGroupId={selectedGroupId}
            onSelect={selectTask}
            onSelectGroup={selectGroup}
            onAdd={handleAddTask}
            onAddGroup={handleAddGroup}
            onAddSubtask={handleAddSubtask}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onDeleteGroup={handleDeleteGroup}
            onReorder={handleReorder}
            onReorderSubtask={handleReorderSubtask}
          />
          <ValidationPanel errors={errors} warnings={warnings} />
        </aside>

        <main style={s.main}>
          {selectedGroup && !selectedTask ? (
            <GroupEditor
              group={selectedGroup}
              onUpdate={updatedGroup => {
                handleLessonUpdate(prev => ({
                  ...prev,
                  tasks: prev.tasks.map(t =>
                    t.type === 'group' && t.id === updatedGroup.id ? updatedGroup : t
                  ),
                }))
              }}
            />
          ) : selectedTask ? (
            <TaskEditor
              key={selectedTask.id}
              task={selectedTask}
              lesson={lessonForEditor}
              parentGroup={selectedTaskGroup}
              onUpdate={updated => {
                let finalUpdated = updated
                if (selectedTaskGroup) {
                  if ('_customTitle' in updated && !updated._customTitle) {
                    // Explicit reset — clear flag so updateSubtaskTitles regenerates title
                    const { _customTitle, ...withoutFlag } = finalUpdated
                    finalUpdated = withoutFlag
                  } else if (updated.title !== selectedTask.title) {
                    finalUpdated = { ...updated, _customTitle: true }
                  }
                }
                handleLessonUpdate(prev => ({
                  ...prev,
                  tasks: updateTaskInTasks(prev.tasks, finalUpdated),
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

// ─── Validation panel ─────────────────────────────────────────────────────────

function ValidationPanel({ errors, warnings }) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(errors.length ? 'errors' : 'warnings')

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
