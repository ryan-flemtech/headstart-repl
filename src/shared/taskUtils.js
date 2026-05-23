// Returns a flat array of all tasks, expanding groups to their subtasks.
export function flattenTasks(tasks) {
  if (!tasks) return []
  return tasks.flatMap(item =>
    item.type === 'group' ? (item.subtasks ?? []) : [item]
  )
}

// Find a task by ID, searching inside groups.
export function findTaskById(tasks, id) {
  return flattenTasks(tasks).find(t => t.id === id) ?? null
}

// Find the group containing a given task ID. Returns null for standalone tasks.
export function findGroupForTask(tasks, taskId) {
  if (!tasks) return null
  return tasks.find(
    item => item.type === 'group' && (item.subtasks ?? []).some(t => t.id === taskId)
  ) ?? null
}

// Returns display items for the progress indicator.
// Each item is { type, id, title, taskIds }.
export function getProgressItems(tasks) {
  if (!tasks) return []
  return tasks.map(item =>
    item.type === 'group'
      ? { type: 'group', id: item.id, title: item.title, taskIds: (item.subtasks ?? []).map(t => t.id) }
      : { type: 'task', id: item.id, title: item.title, taskIds: [item.id] }
  )
}

// Update a task anywhere in the lesson tasks array (including inside groups).
export function updateTaskInTasks(tasks, updatedTask) {
  return tasks.map(item => {
    if (item.type === 'group') {
      if ((item.subtasks ?? []).some(t => t.id === updatedTask.id)) {
        return { ...item, subtasks: item.subtasks.map(t => t.id === updatedTask.id ? updatedTask : t) }
      }
      return item
    }
    return item.id === updatedTask.id ? updatedTask : item
  })
}
