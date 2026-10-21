export function htmlToMarkdown(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html')
  return renderChildren(document.body).replace(/\n{3,}/g, '\n\n').trim()
}

function renderChildren(node: ParentNode): string {
  return [...node.childNodes].map(renderNode).join('')
}

function renderNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (!(node instanceof HTMLElement)) return ''
  const tag = node.tagName.toLowerCase()
  if (tag === 'br') return '\n'
  if (/^h[1-6]$/.test(tag)) return `\n\n${'#'.repeat(Number(tag[1]))} ${renderChildren(node).trim()}\n\n`
  if (tag === 'blockquote') {
    const text = renderChildren(node).trim()
    if (!text) return ''
    return `\n\n${text
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')}\n\n`
  }
  if (tag === 'pre') return `\n\n\`\`\`\n${(node.textContent ?? '').replace(/\n$/, '')}\n\`\`\`\n\n`
  if (tag === 'ul' || tag === 'ol') return renderList(node, tag === 'ol')
  if (tag === 'table') return renderTable(node)
  if (tag === 'input' && node.getAttribute('type') === 'checkbox') {
    return node.hasAttribute('checked') ? '[x] ' : '[ ] '
  }
  if (tag === 'hr') return '\n\n---\n\n'
  if (tag === 'img') return imageMarkdown(node)
  if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article') {
    const text = renderChildren(node).trim()
    return text ? `\n\n${text}\n\n` : ''
  }
  return formatInline(node)
}

function renderList(node: HTMLElement, ordered: boolean): string {
  const items = [...node.children].filter((child) => child.tagName.toLowerCase() === 'li')
  const body = items
    .map((item, index) => {
      const marker = ordered ? `${index + 1}. ` : '- '
      const text = renderChildren(item).trim().replace(/\n/g, '\n  ')
      return `${marker}${text}`
    })
    .join('\n')
  return body ? `\n\n${body}\n\n` : ''
}

function formatInline(node: HTMLElement): string {
  const tag = node.tagName.toLowerCase()
  const text = renderChildren(node)
  if (tag === 'strong' || tag === 'b') return `**${text}**`
  if (tag === 'em' || tag === 'i') return `*${text}*`
  if (tag === 'del' || tag === 's' || tag === 'strike') return `~~${text}~~`
  if (tag === 'mark') return `==${text}==`
  if (tag === 'code') return `\`${text}\``
  if (tag === 'a') {
    const href = node.getAttribute('href') ?? ''
    return href ? `[${text}](${href})` : text
  }
  return text
}

function renderTable(node: HTMLElement): string {
  const rows = [...node.children]
    .flatMap((child) => {
      const tag = child.tagName.toLowerCase()
      if (tag === 'tr') return [child]
      if (tag === 'thead' || tag === 'tbody' || tag === 'tfoot') {
        return [...child.children].filter((row) => row.tagName.toLowerCase() === 'tr')
      }
      return []
    })
  if (rows.length === 0) return ''
  const lines = rows.map((row) => {
    const cells = [...row.children]
      .filter((cell) => {
        const tag = cell.tagName.toLowerCase()
        return tag === 'th' || tag === 'td'
      })
      .map((cell) => renderChildren(cell).trim().replace(/\|/g, '\\|').replace(/\n/g, ' '))
    return `| ${cells.join(' | ')} |`
  })
  const columns = Math.max(...lines.map((line) => line.split('|').length - 2), 1)
  const divider = `| ${Array.from({ length: columns }, () => '---').join(' | ')} |`
  return `\n\n${lines[0]}\n${divider}\n${lines.slice(1).join('\n')}\n\n`
}

function imageMarkdown(node: HTMLElement): string {
  const alt = node.getAttribute('alt') ?? ''
  const src = node.getAttribute('src') ?? ''
  return src ? `![${alt}](${src})` : ''
}
