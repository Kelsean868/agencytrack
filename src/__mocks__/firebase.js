// Global test stub — aliased from src/firebase.js via vite.config.js test.alias.
// Also acts as the __mocks__ manual mock if a test file calls vi.mock('../firebase').
// Any vi.mock(id, factory) in a test file takes priority over this alias — existing
// return-value service mocks are fully backward-compatible.
export const auth      = {};
export const db        = {};
export const storage   = {};
export const functions = {};
export default {};
