import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, THEME_IDS, isThemeId, normalizeTheme, resolveTheme } from '../src/theme/theme.js'

describe('theme ids', () => {
  it('lists the built-in themes', () => {
    expect(THEME_IDS).toEqual([
      'paper',
      'github',
      'nord',
      'tokyo-night',
      'catppuccin',
      'one-dark',
      'dracula',
      'solarized-light',
      'solarized-dark',
      'catppuccin-latte',
      'rose-pine-dawn',
    ])
    expect(DEFAULT_THEME).toBe('paper')
  })

  it('normalizes unknown values to the default', () => {
    expect(normalizeTheme('github')).toBe('github')
    expect(normalizeTheme('nope')).toBe('paper')
    expect(normalizeTheme(undefined)).toBe('paper')
    expect(isThemeId('nord')).toBe(true)
    expect(isThemeId('solarized')).toBe(false)
  })

  it('keeps custom ids for hosts that ship their own CSS theme', () => {
    expect(resolveTheme('my-theme')).toBe('my-theme')
    expect(resolveTheme('  custom  ')).toBe('custom')
    expect(resolveTheme('')).toBe('paper')
    expect(resolveTheme('   ')).toBe('paper')
    expect(resolveTheme(undefined)).toBe('paper')
    expect(resolveTheme('github')).toBe('github')
  })
})
