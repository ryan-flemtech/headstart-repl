import React, { useState } from 'react'
import LessonMetaPanel from '../components/LessonMetaPanel'
import TaskList from '../components/TaskList'
import TaskEditor from '../components/TaskEditor'
import PreviewView from './PreviewView'
import { checkAllowedForSubmit, normalizeChecks } from '../../shared/checks'
import { HTML_ONLY } from '../components/FileManager'
import { flattenTasks, findGroupForTask, updateTaskInTasks, updateSubtaskTitles } from '../../shared/taskUtils'

// ─── Validation ───────────────────────────────────────────────────────────────

function validateLesson(lesson) {
  const errors = []
  const warnings = []
  const { id, title, type, tasks } = lesson

  if (!id)    errors.push('Lesson ID is required')
  else if (!/^[a-z0-9-]+$/.test(id)) errors.push('Lesson ID must be lowercase with hyphens only')
  if (!title) errors.push('Lesson title is required')
  if (!tasks || tasks.length === 0) errors.push('Lesson must have at least one task')

  // Group structure checks
  tasks.forEach((item, i) => {
    if (item.type === 'group') {
      if (!item.title) errors.push(`Group ${i + 1} is missing a title`)
      if (!item.subtasks || item.subtasks.length === 0)
        errors.push(`Group "${item.title || (i + 1)}" has no subtasks — add at least one subtask`)
    }
  })

  // Task content checks (flat)
  const flat = flattenTasks(tasks)
  flat.forEach((task, i) => {
    const n = i + 1
    if (!task.title)    errors.push(`Task ${n} is missing a title`)
    if (task.taskType === 'information' && task.informationType !== 'introduction' && !task.explainer?.trim()) {
      errors.push(`Task ${n} is an information task but has no explainer`)
    }

    if (task.taskType === 'information') {
      // Information tasks only render explainer markdown.
    } else if (task.taskType === 'quiz') {
      const quizType = task.quizType ?? 'multiple_choice'
      if (quizType === 'multiple_choice') {
        if (!task.options || task.options.length < 2) {
          errors.push(`Task ${n} is a quiz but has fewer than 2 options.`)
        }
        if (task.options?.some(option => !option.text?.trim())) {
          errors.push(`Task ${n} is a quiz but has an empty option text field.`)
        }
        if (task.check?.type !== 'answer_equals' || !task.check.value) {
          errors.push(`Task ${n} is a quiz but no correct answer has been selected.`)
        }
      } else if (quizType === 'match') {
        if (!task.pairs || task.pairs.length < 2) {
          errors.push(`Task ${n} is a match quiz but has fewer than 2 pairs.`)
        }
        if (task.pairs?.some(pair => !pair.prompt?.trim() || !pair.answer?.trim())) {
          errors.push(`Task ${n} is a match quiz but has an empty prompt or answer.`)
        }
      } else if (quizType === 'fill_blank') {
        if (!task.text?.includes('___')) {
          errors.push(`Task ${n} is a fill-in-the-blank quiz but has no blanks in the text.`)
        }
        if (!task.blanks || task.blanks.length === 0) {
          errors.push(`Task ${n} is a fill-in-the-blank quiz but has no blank answers.`)
        }
        if (task.blanks?.some(blank => !blank.answer?.trim())) {
          errors.push(`Task ${n} is a fill-in-the-blank quiz but has an empty answer.`)
        }
      } else if (quizType === 'short_answer') {
        if (!task.check?.type?.startsWith('answer_') || !task.check.value?.trim()) {
          errors.push(`Task ${n} is a short-answer quiz but has no completion check value.`)
        }
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
      // No checks.
    } else if (task.taskType === 'quiz') {
      // Validated above.
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
      if (checksArr.some(c => c.type?.startsWith('element_') && !c.selector?.trim())) {
        errors.push(`Task ${n} has an element check but no CSS selector`)
      }
      if (checksArr.some(c => c.type === 'element_attribute' && !c.attribute?.trim())) {
        errors.push(`Task ${n} has an element attribute check but no attribute name`)
      }
      if (checksArr.some(c => c.type === 'element_style_property' && !c.property?.trim())) {
        errors.push(`Task ${n} has an element style check but no CSS property`)
      }
      if (checksArr.some(c => c.type?.startsWith('variable_') && !c.name?.trim())) {
        errors.push(`Task ${n} has a variable check but no variable name`)
      }
      if (checksArr.some(c => c.type === 'variable_dict_key_value' && !c.key?.trim())) {
        errors.push(`Task ${n} has a dictionary key-value check but no key`)
      }
      if (checksArr.some(c => c.type === 'variable_array_nth_item' && (c.index == null || c.index === '' || Number(c.index) < 0))) {
        errors.push(`Task ${n} has an array N-th item check but no valid index`)
      }
      if (checksArr.some(c => !['code_no_error', 'output_not_empty', 'element_exists', 'element_attribute', 'element_style_property', 'variable_exists'].includes(c.type) && !c.value && c.value !== 0)) {
        errors.push(`Task ${n} has a check enabled but no check value`)
      }
    }

    const carryFrom = task.taskType === 'quiz' || task.taskType === 'information' ? null : type === 'scratch' ? task.carryBlocksFrom : task.carryCodeFrom
    if (carryFrom != null) {
      const exists = flat.some(t => t.id === carryFrom)
      if (!exists) errors.push(`Task ${n} references task ${carryFrom} for carry-through but that task does not exist`)
    }

    // Warnings
    const hasStarter = task.taskType === 'information'
      ? true
      : task.taskType === 'quiz'
      ? quizHasStarter(task)
      : type === 'python'
      ? !!task.starterCode
      : type === 'scratch'
        ? !!task.starterBlocks
        : task.starterFiles?.some(f => f.content.trim())
    if (!hasStarter) warnings.push(`Task ${n} has no starter code — students will start with an empty editor`)
    const checkHasValue = task.taskType === 'information'
      ? false
      : task.taskType === 'quiz'
      ? quizHasCheckValue(task)
      : type === 'scratch'
      ? !!task.check
      : normalizeChecks(task.check).some(c => c.type === 'code_no_error' || c.type === 'output_not_empty' || c.type === 'element_exists' || c.type === 'element_attribute' || c.type === 'element_style_property' || c.type === 'variable_exists' || c.value)
    if (checkHasValue && !task._checkTested)
      warnings.push(`Task ${n} has a completion check that hasn't been tested — run the task to verify it`)
  })

  return { errors, warnings }
}

function quizHasStarter(task) {
  const quizType = task.quizType ?? 'multiple_choice'
  if (quizType === 'multiple_choice') return task.options?.some(option => option.text?.trim())
  if (quizType === 'match') return task.pairs?.some(pair => pair.prompt?.trim() || pair.answer?.trim())
  if (quizType === 'fill_blank') return !!task.text?.trim() || task.blanks?.some(blank => blank.answer?.trim())
  if (quizType === 'short_answer') return !!task.explainer?.trim()
  return false
}

function quizHasCheckValue(task) {
  const quizType = task.quizType ?? 'multiple_choice'
  if (quizType === 'match') return task.pairs?.length > 0 && task.pairs.every(pair => pair.prompt?.trim() && pair.answer?.trim())
  if (quizType === 'fill_blank') return task.blanks?.length > 0 && task.blanks.every(blank => blank.answer?.trim())
  return !!task.check?.value
}

// ─── Export normalisation ─────────────────────────────────────────────────────

function normalizeTasksForExport(tasks) {
  // Build ID remap table — assign sequential IDs across all tasks (incl. inside groups)
  let counter = 0
  const idMap = {}
  function assignIds(items) {
    for (const item of items) {
      if (item.type === 'group') assignIds(item.subtasks ?? [])
      else idMap[item.id] = ++counter
    }
  }
  assignIds(tasks)

  function normalizeTask(task) {
    if (task.taskType === 'information') {
      const informationType = task.informationType ?? 'standard'
      const exported = {
        id: idMap[task.id],
        taskType: 'information',
        title: task.title,
        explainer: task.explainer ?? '',
      }
      if (informationType !== 'standard') exported.informationType = informationType
      return exported
    }

    const { _checkTested, hints: _hints, ...rest } = task
    const exported = { ...rest, id: idMap[task.id] }

    if (exported.carryCodeFrom != null) exported.carryCodeFrom = idMap[exported.carryCodeFrom] ?? exported.carryCodeFrom
    if (exported.carryBlocksFrom != null) exported.carryBlocksFrom = idMap[exported.carryBlocksFrom] ?? exported.carryBlocksFrom

    if (Array.isArray(exported.check)) {
      exported.check = exported.check.map(normalizeCheckForExport)
    } else if (exported.check) {
      exported.check = normalizeCheckForExport(exported.check)
    }
    if (Array.isArray(exported.options)) {
      exported.options = exported.options.map(option => {
        const next = { ...option }
        if (next.feedback != null) {
          const feedback = String(next.feedback).trim()
          if (feedback) next.feedback = feedback
          else delete next.feedback
        }
        return next
      })
    }
    return exported
  }

  function normalizeCheckForExport(check) {
    const next = { ...check }
    if (next.hint != null) {
      const hint = String(next.hint).trim()
      if (hint) next.hint = hint
      else delete next.hint
    }
    return next
  }

  function normalizeItem(item) {
    if (item.type === 'group') {
      return {
        id: item.id,
        type: 'group',
        title: item.title,
        subtasks: (item.subtasks ?? []).map(normalizeTask),
      }
    }
    return normalizeTask(item)
  }

  return tasks.map(normalizeItem)
}

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
                const retitled = {
                  ...updatedGroup,
                  subtasks: (updatedGroup.subtasks ?? []).map((t, i) => ({
                    ...t,
                    title: updatedGroup.title ? `${updatedGroup.title} - ${i + 1}` : t.title,
                  })),
                }
                onUpdate(prev => ({
                  ...prev,
                  tasks: prev.tasks.map(t =>
                    t.type === 'group' && t.id === retitled.id ? retitled : t
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
                onUpdate(prev => ({
                  ...prev,
                  tasks: updateTaskInTasks(prev.tasks, updated),
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
