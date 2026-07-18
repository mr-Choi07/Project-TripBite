import { useState } from 'react'
import { Globe, Check } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { LANGS, LANG_LABEL, LANG_FLAG_LABEL } from '../../i18n'

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useApp()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-tb-line bg-tb-paper-raised px-3 py-1.5 text-xs font-semibold text-tb-ink shadow-tb-card"
      >
        <Globe size={14} className="text-tb-teal-500" />
        {compact ? LANG_FLAG_LABEL[lang] : LANG_LABEL[lang]}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-40 overflow-hidden rounded-2xl border border-tb-line bg-tb-paper-raised shadow-tb-float">
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setLang(l)
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm hover:bg-tb-teal-50"
              >
                <span className={l === lang ? 'font-semibold text-tb-teal-600' : 'text-tb-ink'}>{LANG_LABEL[l]}</span>
                {l === lang && <Check size={15} className="text-tb-teal-500" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
