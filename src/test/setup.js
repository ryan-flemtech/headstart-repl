import '@testing-library/jest-dom'

// Node can expose an unusable experimental localStorage when its backing-file
// option is empty; keep tests on a normal Storage-compatible implementation.
if (typeof globalThis.localStorage?.clear !== 'function') {
  const values = new Map()
  const storage = {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: key => values.has(String(key)) ? values.get(String(key)) : null,
    key: index => Array.from(values.keys())[index] ?? null,
    removeItem: key => values.delete(String(key)),
    setItem: (key, value) => values.set(String(key), String(value)),
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
}

// matchMedia mock — jsdom does not implement it
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// Blob URL mocks
global.URL.createObjectURL = () => 'blob:mock-url'
global.URL.revokeObjectURL = () => {}

// crypto.randomUUID mock for predictable IDs in tests
if (!global.crypto) {
  global.crypto = {}
}
if (!global.crypto.randomUUID) {
  let counter = 0
  global.crypto.randomUUID = () => `test-uuid-${++counter}`
}
