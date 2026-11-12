// Find and replace: query matching over documents plus the state-level find operations.
import { applyEdit } from './history.js'
import { caret, clamp, sortedRange, type EditorState, type TextSelection } from './types.js'

export interface FindOptions {
  caseSensitive?: boolean
  wholeWord?: boolean
  regexp?: boolean
}

export interface FindHit {
  from: number
  to: number
  index: number
  total: number
}

export interface FindQueryResult {
  hit: FindHit | null
  error: string | null
}

export interface FindListItem {
  from: number
  to: number
  index: number
  text: string
}

interface RawMatch {
  from: number
  to: number
  text: string
  groups: string[]
}

const PATTERN_ERROR = '正则无效'

export function runFind(
  doc: string,
  selection: TextSelection,
  query: string,
  direction: 1 | -1,
  options: FindOptions = {},
  advance = true,
): FindQueryResult {
  if (!query) return { hit: null, error: null }
  const collected = collectMatches(doc, query, options)
  if (collected.error) return { hit: null, error: collected.error }
  const chosen = pickMatch(collected.matches, selection, direction, advance)
  if (!chosen) return { hit: null, error: null }
  return {
    hit: {
      from: chosen.from,
      to: chosen.to,
      index: collected.matches.indexOf(chosen) + 1,
      total: collected.matches.length,
    },
    error: null,
  }
}

export function listMatches(
  doc: string,
  query: string,
  options: FindOptions = {},
): { matches: FindListItem[]; error: string | null } {
  if (!query) return { matches: [], error: null }
  const collected = collectMatches(doc, query, options)
  if (collected.error) return { matches: [], error: collected.error }
  return {
    matches: collected.matches.map((match, index) => ({
      from: match.from,
      to: match.to,
      index: index + 1,
      text: match.text,
    })),
    error: null,
  }
}

export function selectedMatch(
  doc: string,
  selection: TextSelection,
  query: string,
  options: FindOptions = {},
): { match: RawMatch | null; error: string | null } {
  if (!query) return { match: null, error: null }
  const collected = collectMatches(doc, query, options)
  if (collected.error) return { match: null, error: collected.error }
  return {
    match: matchAtSelection(collected.matches, selection),
    error: null,
  }
}

export function replaceQuery(
  doc: string,
  query: string,
  replacement: string,
  options: FindOptions = {},
): { doc: string; error: string | null } {
  if (!query) return { doc, error: null }
  const collected = collectMatches(doc, query, options)
  if (collected.error) return { doc, error: collected.error }
  if (collected.matches.length === 0) return { doc, error: null }
  let next = ''
  let cursor = 0
  let changed = false
  for (const match of collected.matches) {
    if (match.from === match.to || match.from < cursor) continue
    next += doc.slice(cursor, match.from)
    next += options.regexp ? expandReplacement(replacement, match) : replacement
    cursor = match.to
    changed = true
  }
  if (!changed) return { doc, error: null }
  return { doc: next + doc.slice(cursor), error: null }
}

export function replacementFor(
  doc: string,
  match: { from: number; to: number },
  query: string,
  replacement: string,
  options: FindOptions = {},
): { text: string; error: string | null } {
  const collected = collectMatches(doc, query, options)
  if (collected.error) return { text: replacement, error: collected.error }
  const current = collected.matches.find((item) => item.from === match.from && item.to === match.to)
  if (!current || !options.regexp) return { text: replacement, error: null }
  return { text: expandReplacement(replacement, current), error: null }
}

function collectMatches(
  doc: string,
  query: string,
  options: FindOptions,
): { matches: RawMatch[]; error: string | null } {
  const compiled = compileQuery(query, options)
  if ('error' in compiled) return { matches: [], error: compiled.error }
  const regex = compiled.regex
  const matches: RawMatch[] = []
  for (let guard = 0; guard <= doc.length; guard += 1) {
    const found = regex.exec(doc)
    if (!found) break
    const from = found.index
    const text = found[0]
    const to = from + text.length
    if (!options.wholeWord || isWholeWord(doc, from, to)) {
      matches.push({ from, to, text, groups: found.slice(1) })
    }
    if (regex.lastIndex > from) continue
    const next = from + codePointSize(doc, from)
    if (next <= from) break
    regex.lastIndex = next
  }
  return { matches, error: null }
}

function compileQuery(query: string, options: FindOptions): { regex: RegExp } | { error: string } {
  const source = options.regexp ? query : escapeLiteral(query)
  const flags = `gu${options.caseSensitive ? '' : 'i'}`
  try {
    return { regex: new RegExp(source, flags) }
  } catch {
    return { error: PATTERN_ERROR }
  }
}

function pickMatch(
  matches: RawMatch[],
  selection: TextSelection,
  direction: 1 | -1,
  advance: boolean,
): RawMatch | null {
  if (matches.length === 0) return null
  const { from, to } = sortedRange(selection)
  const current = matches.findIndex((match) => match.from === from && match.to === to)
  if (current >= 0) {
    if (!advance) return matches[current]
    const next = current + (direction < 0 ? -1 : 1)
    return matches[(next + matches.length) % matches.length]
  }
  // Caret / partial selection inside a hit: land on that hit first, then Next can advance.
  const covering = matchAtSelection(matches, selection)
  if (covering) return covering
  if (direction < 0) {
    for (let index = matches.length - 1; index >= 0; index -= 1) {
      if (matches[index].to <= from) return matches[index]
    }
    return matches[matches.length - 1]
  }
  return matches.find((match) => match.from >= from) ?? matches[0]
}

/** Exact hit if selected; otherwise the hit that strictly contains / overlaps the selection. */
function matchAtSelection(matches: readonly RawMatch[], selection: TextSelection): RawMatch | null {
  const { from, to } = sortedRange(selection)
  const exact = matches.find((match) => match.from === from && match.to === to)
  if (exact) return exact
  return matches.find((match) => match.from < to && match.to > from) ?? null
}

function expandReplacement(replacement: string, match: RawMatch): string {
  return replacement.replace(/\$(\$|&|[1-9])/g, (_token, kind: string) => {
    if (kind === '$') return '$'
    if (kind === '&') return match.text
    return match.groups[Number(kind) - 1] ?? ''
  })
}

function isWholeWord(doc: string, from: number, to: number): boolean {
  return !isWordChar(codePointBefore(doc, from)) && !isWordChar(codePointAt(doc, to))
}

function isWordChar(char: string): boolean {
  return char !== '' && /[\p{L}\p{N}_]/u.test(char)
}

function codePointBefore(text: string, index: number): string {
  if (index <= 0) return ''
  const start = index >= 2 && isSurrogatePair(text, index - 2) ? index - 2 : index - 1
  return text.slice(start, index)
}

function codePointAt(text: string, index: number): string {
  if (index >= text.length) return ''
  const size = isSurrogatePair(text, index) ? 2 : 1
  return text.slice(index, index + size)
}

function codePointSize(text: string, index: number): number {
  if (index >= text.length) return 1
  return isSurrogatePair(text, index) ? 2 : 1
}

function isSurrogatePair(text: string, index: number): boolean {
  const lead = text.charCodeAt(index)
  const trail = text.charCodeAt(index + 1)
  return lead >= 0xd800 && lead <= 0xdbff && trail >= 0xdc00 && trail <= 0xdfff
}

function escapeLiteral(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
}

export function findInState(
  state: EditorState,
  query: string,
  direction: 1 | -1 = 1,
  options: FindOptions = {},
  advance = true,
): { state: EditorState; result: FindQueryResult } {
  const result = runFind(state.doc, state.selection, query, direction, options, advance)
  if (!result.hit) return { state, result }
  return {
    state: { ...state, selection: { anchor: result.hit.from, head: result.hit.to } },
    result,
  }
}

export function replaceCurrentMatch(
  state: EditorState,
  query: string,
  replacement: string,
  options: FindOptions = {},
): { state: EditorState; result: FindQueryResult } {
  const selected = selectedMatch(state.doc, state.selection, query, options)
  if (selected.error) return { state, result: { hit: null, error: selected.error } }
  let next = state
  if (selected.match) {
    const expanded = replacementFor(state.doc, selected.match, query, replacement, options)
    if (expanded.error) return { state, result: { hit: null, error: expanded.error } }
    const current = state.doc.slice(selected.match.from, selected.match.to)
    if (expanded.text !== current) {
      next = applyEdit(
        state,
        { from: selected.match.from, to: selected.match.to, insert: expanded.text },
        caret(selected.match.from + expanded.text.length),
      )
    } else {
      // Same text (or caret was only inside the hit): move past it so Next/Replace can advance.
      next = { ...state, selection: caret(selected.match.to) }
    }
  }
  return findInState(next, query, 1, options, true)
}

export function replaceAllMatches(
  state: EditorState,
  query: string,
  replacement: string,
  options: FindOptions = {},
): { state: EditorState; result: FindQueryResult } {
  const replaced = replaceQuery(state.doc, query, replacement, options)
  if (replaced.error) return { state, result: { hit: null, error: replaced.error } }
  const edited =
    replaced.doc === state.doc
      ? state
      : applyEdit(state, { from: 0, to: state.doc.length, insert: replaced.doc }, caret(0))
  return findInState(edited, query, 1, options, false)
}

export function findMatch(doc: string, query: string, from: number): { from: number; to: number } | null {
  if (!query) return null
  const start = clamp(from, 0, doc.length)
  let index = doc.indexOf(query, start)
  if (index < 0 && start > 0) index = doc.indexOf(query)
  if (index < 0) return null
  return { from: index, to: index + query.length }
}

export function replaceAllText(state: EditorState, query: string, replacement: string): EditorState {
  if (!query || !state.doc.includes(query)) return state
  const insert = state.doc.split(query).join(replacement)
  return applyEdit(state, { from: 0, to: state.doc.length, insert }, caret(0))
}
