// Test-only surface.
//
// `runFind` is the stateless half of the find module: the editor reaches it
// through the state level helpers exported from the public entry, so the raw
// matcher is kept here for unit tests instead of widening the package API.
export { runFind } from '../src/find.ts'
