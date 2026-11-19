export const THEME_IDS = [
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
] as const

export type ThemeId = (typeof THEME_IDS)[number]

/** Any theme id: a built-in `ThemeId`, or a custom id backed by your own CSS. */
export type ThemeName = ThemeId | string

export const DEFAULT_THEME: ThemeId = 'paper'

export function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as readonly string[]).includes(value)
}

export function normalizeTheme(theme?: string | null): ThemeId {
  if (theme && isThemeId(theme)) return theme
  return DEFAULT_THEME
}

/**
 * Resolves the theme kept on the editor. Unlike `normalizeTheme`, any
 * non-empty id is preserved so hosts can ship a custom theme through CSS
 * (`.v5md[data-theme='my-theme'] { … }`) and pass `theme: 'my-theme'`.
 * Empty or blank values fall back to `DEFAULT_THEME`.
 */
export function resolveTheme(theme?: string | null): ThemeName {
  const value = typeof theme === 'string' ? theme.trim() : ''
  return value || DEFAULT_THEME
}
