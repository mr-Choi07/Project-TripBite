import dict, { LANG_LABEL, LANG_FLAG_LABEL } from './translations'
import type { Lang, LocalizedText } from '../types'

export { LANG_LABEL, LANG_FLAG_LABEL }

export const LANGS: Lang[] = ['ko', 'en', 'ja', 'zh', 'fr', 'es']

export function translate(lang: Lang, key: keyof typeof dict.ko) {
  return dict[lang][key]
}

export function pickLocalized(text: LocalizedText, lang: Lang): string {
  return text[lang] ?? text.en
}

export default dict
