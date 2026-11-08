import { common, createLowlight } from 'lowlight'
import type { Root, RootContent, Text } from 'hast'

const lowlight = createLowlight(common)

const ALIASES: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  tsx: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  md: 'markdown',
  html: 'xml',
  vue: 'xml',
}

export interface HighlightSpan {
  text: string
  className: string
}

export function languageName(lang: string | null | undefined): string | null {
  if (!lang) return null
  const name = lang.trim().toLowerCase()
  const candidates = [ALIASES[name], name].filter((item): item is string => Boolean(item))
  return candidates.find((candidate) => lowlight.registered(candidate)) ?? null
}

export function highlightSpans(text: string, lang: string | null | undefined): HighlightSpan[] | null {
  const name = languageName(lang)
  if (!name || text.length === 0) return null
  let tree: Root
  try {
    tree = lowlight.highlight(name, text)
  } catch {
    return null
  }
  const spans: HighlightSpan[] = []
  let size = 0
  const visit = (node: Root | RootContent, className: string) => {
    if (node.type === 'text') {
      const value = (node as Text).value
      spans.push({ text: value, className })
      size += value.length
      return
    }
    if (node.type === 'element') {
      const next = classNameOf(node.properties.className) || className
      node.children.forEach((child) => visit(child, next))
      return
    }
    if (node.type === 'root') node.children.forEach((child) => visit(child, className))
  }
  visit(tree, '')
  return size === text.length ? spans : null
}

function classNameOf(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string').join(' ')
  return ''
}
