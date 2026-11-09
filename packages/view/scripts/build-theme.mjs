import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const entry = path.join(root, 'src/theme/index.css')
const output = path.join(root, 'dist/theme.css')
const IMPORT = /@import\s+['"]\.\/([^'"]+)['"];?/g

/** Inlines one level of @import so the package publishes a single stylesheet. */
const inline = (file, seen = new Set()) => {
  if (seen.has(file)) return ''
  seen.add(file)
  return readFileSync(file, 'utf8').replace(IMPORT, (_, name) => inline(path.join(path.dirname(file), name), seen))
}

mkdirSync(path.dirname(output), { recursive: true })
writeFileSync(output, inline(entry))
console.log('built dist/theme.css from src/theme/index.css')
