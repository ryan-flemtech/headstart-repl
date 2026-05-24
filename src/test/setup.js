import '@testing-library/jest-dom'

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
