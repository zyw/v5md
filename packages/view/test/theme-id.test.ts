import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, THEME_IDS, isThemeId, normalizeTheme } from '../src/theme/theme.js'

describe('theme ids', () => {
  it('lists the built-in themes', () => {
    expect(THEME_IDS).toEqual(['paper', 'github', 'nord', 'tokyo-night', 'catppuccin'])
    expect(DEFAULT_THEME).toBe('paper')
  })

  it('normalizes unknown values to the default', () => {
    expect(normalizeTheme('github')).toBe('github')
    expect(normalizeTheme('nope')).toBe('paper')
    expect(normalizeTheme(undefined)).toBe('paper')
    expect(isThemeId('nord')).toBe(true)
    expect(isThemeId('solarized')).toBe(false)
  })
})
