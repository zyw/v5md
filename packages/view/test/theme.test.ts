import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const THEME_DIR = path.resolve(process.cwd(), 'packages/view/src/theme')

const IMPORT = /@import\s+['"]\.\/([^'"]+)['"];?/g

const readTheme = (file = 'index.css'): string =>
  readFileSync(path.join(THEME_DIR, file), 'utf8').replace(IMPORT, (_, name: string) => readTheme(name))

const CSS = readTheme()

/** Splits a selector list while keeping commas inside :is()/:not() intact. */
function splitSelectors(head: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of head) {
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (char === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += char
    }
  }
  parts.push(current)
  return parts.map((part) => part.trim()).filter(Boolean)
}

function selectors(css: string): string[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...clean.matchAll(/(?:^|\})([^{}]+)\{/g)].flatMap((match) => splitSelectors(match[1] ?? ''))
}

describe('theme isolation', () => {
  it('scopes every selector to the editor root', () => {
    const heads = selectors(CSS)
    expect(heads.length).toBeGreaterThan(100)
    const unscoped = heads.filter((head) => !head.startsWith('.v5md') && !head.startsWith('::highlight('))
    expect(unscoped).toEqual([])
  })

  it('does not rely on generic class names that a host page could define', () => {
    expect(CSS).not.toMatch(/\.(?:is-(?:active|source|source-mode|preview|composing|selected)|md-marker)(?![\w-])/)
  })

  it('centres task checkboxes so the checked mark cannot move the line', () => {
    // WebKit derives a button's baseline from its content, so baseline alignment
    // pushed the box and the whole line down as soon as the ::after mark appeared.
    const clean = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    const rule = /\.v5md \.v5-doc \.v5-check\s*\{([^}]*)\}/.exec(clean)?.[1] ?? ''
    expect(rule).toContain('vertical-align: middle')
  })

  it('keeps the editor shell square for embedding', () => {
    const clean = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    const shell = /\.v5md \.v5-toolbar\s*\{([^}]*)\}/.exec(clean)?.[1] ?? ''
    expect(shell).toContain('border-radius: 0')
  })

  it('keeps content rules under the document element', () => {
    const heads = selectors(CSS)
    const panels = ['.v5-outline', '.v5-toolbar', '.v5md-find', '.v5-tablebar', '.v5-slash-menu', '.v5-block-menu']
    for (const element of ['h1', 'p', 'a', 'pre', 'code', 'blockquote', 'li', 'th', 'td', 'del', 'mark', 'hr', 'u']) {
      const rules = heads.filter((head) => head.split(/[\s>+~]/).includes(element))
      expect(rules.length).toBeGreaterThan(0)
      for (const rule of rules) {
        const scoped = rule.includes('.v5md .v5-doc') || panels.some((panel) => rule.includes(panel))
        expect(scoped, `${rule} is not scoped to the document or a chrome panel`).toBe(true)
      }
    }
  })
})
