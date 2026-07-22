import { useState } from 'react'
import { Languages, ChevronDown, ChevronUp } from 'lucide-react'
import type { LocalizedText } from '../../types'
import { LANG_LABEL } from '../../i18n'

const OTHER_LANGS = ['en', 'ja', 'zh', 'fr', 'es'] as const

export const EMPTY_LOCALIZED: LocalizedText = { ko: '', en: '', ja: '', zh: '', fr: '', es: '' }

interface Props {
  label: string
  value: LocalizedText
  onChange: (next: LocalizedText) => void
  multiline?: boolean
  /** Proper nouns (menu/store names) shouldn't be machine-translated — the
   * Korean value is mirrored into every language and no translate button
   * is offered. */
  translatable?: boolean
  onTranslate?: () => Promise<void> | void
  translating?: boolean
  translateError?: string | null
}

export default function LocalizedField({
  label,
  value,
  onChange,
  multiline,
  translatable = true,
  onTranslate,
  translating,
  translateError,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const InputTag = multiline ? 'textarea' : 'input'

  function setKo(ko: string) {
    if (translatable) {
      onChange({ ...value, ko })
    } else {
      onChange({ ko, en: ko, ja: ko, zh: ko, fr: ko, es: ko })
    }
  }

  function setLang(lang: (typeof OTHER_LANGS)[number], text: string) {
    onChange({ ...value, [lang]: text })
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-tb-ink-soft">{label} (한국어)</label>
        {translatable && onTranslate && (
          <button
            type="button"
            onClick={() => onTranslate()}
            disabled={translating || !value.ko.trim()}
            className="flex items-center gap-1 text-[11px] font-semibold text-tb-teal-600 disabled:opacity-40"
          >
            <Languages size={12} />
            {translating ? '번역 중...' : '번역 초안 생성'}
          </button>
        )}
      </div>
      <InputTag
        value={value.ko}
        onChange={(e) => setKo(e.target.value)}
        rows={multiline ? 3 : undefined}
        className="mt-1 w-full rounded-xl border border-tb-line bg-tb-paper-raised px-3 py-2.5 text-sm text-tb-ink outline-none focus:border-tb-teal-400"
      />

      {translateError && <p className="mt-1 text-[11px] font-medium text-tb-coral-600">{translateError}</p>}

      {translatable && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-tb-ink-soft"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          언어별 직접 확인/수정
        </button>
      )}

      {translatable && expanded && (
        <div className="mt-2 space-y-1.5 rounded-xl bg-tb-sand-100/60 p-2.5">
          {OTHER_LANGS.map((l) => (
            <div key={l} className="flex items-start gap-2">
              <span className="mt-2 w-8 shrink-0 text-[10px] font-bold text-tb-ink-soft">{LANG_LABEL[l]}</span>
              <InputTag
                value={value[l]}
                onChange={(e) => setLang(l, e.target.value)}
                rows={multiline ? 2 : undefined}
                className="w-full rounded-lg border border-tb-line bg-white px-2.5 py-1.5 text-xs text-tb-ink outline-none focus:border-tb-teal-400"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
