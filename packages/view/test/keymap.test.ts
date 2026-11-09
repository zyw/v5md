import { describe, expect, it } from 'vitest'
import { runShortcut, type KeymapHost } from './internals.ts'

interface Recorder {
  host: KeymapHost
  calls: string[]
  setEditable(value: boolean): void
  setSourceMode(value: boolean): void
}

const recorder = (): Recorder => {
  const calls: string[] = []
  let editable = true
  let sourceMode = false
  const host: KeymapHost = {
    isEditable: () => editable,
    isSourceMode: () => sourceMode,
    requestFind: (kind) => calls.push(`find:${kind}`),
    undo: () => calls.push('undo'),
    redo: () => calls.push('redo'),
    format: (command) => calls.push(`format:${command}`),
    toggleMark: (mark) => calls.push(`mark:${mark}`),
    toggleSourceMode: () => calls.push('source'),
    insertSourceIndent: () => calls.push('indent:source'),
    tab: (shift) => calls.push(`tab:${shift ? 'out' : 'in'}`),
    enter: (shift) => calls.push(`enter:${shift ? 'soft' : 'hard'}`),
  }
  return {
    host,
    calls,
    setEditable(value) {
      editable = value
    },
    setSourceMode(value) {
      sourceMode = value
    },
  }
}

const key = (init: KeyboardEventInit): KeyboardEvent =>
  new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })

const run = (init: KeyboardEventInit, setup?: (recorder: Recorder) => void) => {
  const rec = recorder()
  setup?.(rec)
  const event = key(init)
  const handled = runShortcut(event, rec.host)
  return { handled, calls: rec.calls, prevented: event.defaultPrevented }
}

describe('keymap', () => {
  it('maps find and replace to mod+f and mod+h', () => {
    expect(run({ key: 'f', metaKey: true })).toMatchObject({ handled: true, calls: ['find:find'], prevented: true })
    expect(run({ key: 'h', ctrlKey: true })).toMatchObject({ handled: true, calls: ['find:replace'] })
  })

  it('keeps find available in read only mode', () => {
    const rec = recorder()
    rec.setEditable(false)
    expect(runShortcut(key({ key: 'f', metaKey: true }), rec.host)).toBe(true)
    expect(rec.calls).toEqual(['find:find'])
  })

  it('ignores edit shortcuts in read only mode without swallowing them', () => {
    const rec = recorder()
    rec.setEditable(false)
    const event = key({ key: 'b', metaKey: true })
    expect(runShortcut(event, rec.host)).toBe(false)
    expect(rec.calls).toEqual([])
    expect(event.defaultPrevented).toBe(false)
  })

  it('maps undo and redo', () => {
    expect(run({ key: 'z', metaKey: true }).calls).toEqual(['undo'])
    expect(run({ key: 'z', metaKey: true, shiftKey: true }).calls).toEqual(['redo'])
    expect(run({ key: 'y', ctrlKey: true }).calls).toEqual(['redo'])
  })

  it('maps inline marks', () => {
    expect(run({ key: 'b', metaKey: true }).calls).toEqual(['mark:bold'])
    expect(run({ key: 'i', metaKey: true }).calls).toEqual(['mark:italic'])
    expect(run({ key: '`', metaKey: true }).calls).toEqual(['mark:code'])
    expect(run({ key: 'u', metaKey: true }).calls).toEqual(['mark:underline'])
    expect(run({ key: 'x', metaKey: true, shiftKey: true }).calls).toEqual(['mark:strikethrough'])
    expect(run({ key: 'h', metaKey: true, shiftKey: true }).calls).toEqual(['mark:highlight'])
    expect(run({ key: '~', metaKey: true }).calls).toEqual(['mark:strikethrough'])
    expect(run({ key: '=', metaKey: true }).calls).toEqual(['mark:highlight'])
    expect(run({ key: '+', metaKey: true }).calls).toEqual(['mark:highlight'])
  })

  it('maps block formats', () => {
    expect(run({ key: '1', metaKey: true }).calls).toEqual(['format:heading1'])
    expect(run({ key: '2', metaKey: true }).calls).toEqual(['format:heading2'])
    expect(run({ key: '3', metaKey: true }).calls).toEqual(['format:heading3'])
    expect(run({ key: 'k', metaKey: true }).calls).toEqual(['format:link'])
    expect(run({ key: 'k', metaKey: true, shiftKey: true }).calls).toEqual(['format:code'])
    expect(run({ key: 't', metaKey: true, shiftKey: true }).calls).toEqual(['format:table'])
    expect(run({ key: 'o', metaKey: true, shiftKey: true }).calls).toEqual(['format:taskList'])
    expect(run({ key: 'q', metaKey: true, shiftKey: true }).calls).toEqual(['format:quote'])
    expect(run({ key: '[', code: 'BracketLeft', metaKey: true, shiftKey: true }).calls).toEqual(['format:orderedList'])
    expect(run({ key: ']', code: 'BracketRight', metaKey: true, shiftKey: true }).calls).toEqual(['format:bulletList'])
  })

  it('maps source mode and indentation', () => {
    expect(run({ key: 's', metaKey: true, shiftKey: true }).calls).toEqual(['source'])
    expect(run({ key: 'Tab' }).calls).toEqual(['tab:in'])
    expect(run({ key: 'Tab', shiftKey: true }).calls).toEqual(['tab:out'])
    const rec = recorder()
    rec.setSourceMode(true)
    const event = key({ key: 'Tab' })
    expect(runShortcut(event, rec.host)).toBe(true)
    expect(rec.calls).toEqual(['indent:source'])
  })

  it('maps enter and soft breaks', () => {
    expect(run({ key: 'Enter' }).calls).toEqual(['enter:hard'])
    expect(run({ key: 'Enter', shiftKey: true }).calls).toEqual(['enter:soft'])
  })

  it('leaves unrelated keys alone', () => {
    expect(run({ key: 'a' })).toMatchObject({ handled: false, calls: [], prevented: false })
    expect(run({ key: '1', metaKey: true, shiftKey: true })).toMatchObject({ handled: false, calls: [] })
    expect(run({ key: 'b', metaKey: true, altKey: true })).toMatchObject({ handled: false, calls: [] })
  })
})
