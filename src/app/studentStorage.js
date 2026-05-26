export const studentTaskStorageKey = (lessonId, taskId, anonymousId) =>
  `headstart_${lessonId}_${taskId}_${anonymousId}`

export const studentFileStorageKey = (lessonId, taskId, filename, anonymousId) =>
  `headstart_${lessonId}_${taskId}_${filename}_${anonymousId}`

export function loadSavedCode(lessonId, taskId, anonymousId) {
  const raw = localStorage.getItem(studentTaskStorageKey(lessonId, taskId, anonymousId))
  return raw ? JSON.parse(raw) : null
}

export function saveCode(lessonId, taskId, anonymousId, data) {
  localStorage.setItem(studentTaskStorageKey(lessonId, taskId, anonymousId), JSON.stringify(data))
}

export function loadSavedFile(lessonId, taskId, filename, anonymousId) {
  const raw = localStorage.getItem(studentFileStorageKey(lessonId, taskId, filename, anonymousId))
  return raw ? JSON.parse(raw).content : null
}

export function saveFile(lessonId, taskId, filename, anonymousId, content) {
  localStorage.setItem(studentFileStorageKey(lessonId, taskId, filename, anonymousId), JSON.stringify({ content }))
}
