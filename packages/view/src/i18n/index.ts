import { en } from './en.js'
import type { LocaleCode, LocaleMessages } from './types.js'
import { zhCN } from './zh-CN.js'

export type { LocaleCode, LocaleMessages } from './types.js'

const CATALOG: Record<LocaleCode, LocaleMessages> = {
  'zh-CN': zhCN,
  en,
}

/** Default locale keeps existing Chinese UI for hosts that omit `locale`. */
export const DEFAULT_LOCALE: LocaleCode = 'zh-CN'

export function normalizeLocale(value: string | undefined | null): LocaleCode {
  if (!value) return DEFAULT_LOCALE
  const raw = value.trim().toLowerCase()
  if (raw === 'en' || raw === 'en-us' || raw === 'en-gb' || raw.startsWith('en-')) return 'en'
  if (raw === 'zh' || raw === 'zh-cn' || raw === 'zh-hans' || raw.startsWith('zh-')) return 'zh-CN'
  return DEFAULT_LOCALE
}

export function getMessages(locale: LocaleCode = DEFAULT_LOCALE): LocaleMessages {
  return CATALOG[locale] ?? zhCN
}

export function resolveLocale(input?: LocaleCode | string): LocaleCode {
  if (input === 'zh-CN' || input === 'en') return input
  return normalizeLocale(typeof input === 'string' ? input : undefined)
}

export function formatLinkHint(messages: LocaleMessages, modifier: string, systemBrowser: boolean): string {
  const where = systemBrowser ? messages.link.openSystem : messages.link.openTab
  return messages.link.hint.replaceAll('{modifier}', modifier).replaceAll('{where}', where)
}
