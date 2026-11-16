export const THEME_IDS = ['paper', 'github', 'nord', 'tokyo-night', 'catppuccin'] as const

export type ThemeId = (typeof THEME_IDS)[number]

export const DEFAULT_THEME: ThemeId = 'paper'

export function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as readonly string[]).includes(value)
}

export function normalizeTheme(theme?: string | null): ThemeId {
  if (theme && isThemeId(theme)) return theme
  return DEFAULT_THEME
}
