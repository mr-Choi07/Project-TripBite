import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, ShieldAlert, ShieldCheck, RotateCcw, ArrowRight, Fish, Leaf, Ban, Feather } from 'lucide-react'
import { useApp } from '../context/AppContext'
import AppShell from '../components/layout/AppShell'
import { pickLocalized } from '../i18n'
import { parseMenuIntent, recommendMenu } from '../lib/recommendationEngine'
import type { Allergen, MenuAdviceResult } from '../types'

type Stage = 'input' | 'analyzing' | 'result'

export default function AIRecommendScreen() {
  const { t, lang, setLang, menu } = useApp()
  const navigate = useNavigate()

  const [allergies, setAllergies] = useState<Set<Allergen>>(new Set())
  const [vegan, setVegan] = useState(false)
  const [halal, setHalal] = useState(false)
  const [light, setLight] = useState(false)
  const [rawText, setRawText] = useState('')
  const [stage, setStage] = useState<Stage>('input')
  const [result, setResult] = useState<MenuAdviceResult | null>(null)
  const [langNotice, setLangNotice] = useState(false)

  const quickChips = [
    { key: 'seafood', label: t('aiQuickAllergySeafood'), icon: Fish, active: allergies.has('seafood'), onToggle: () => toggleAllergy('seafood') },
    { key: 'vegan', label: t('aiQuickVegan'), icon: Leaf, active: vegan, onToggle: () => setVegan((v) => !v) },
    { key: 'halal', label: t('aiQuickHalal'), icon: Ban, active: halal, onToggle: () => setHalal((v) => !v) },
    { key: 'light', label: t('aiQuickLight'), icon: Feather, active: light, onToggle: () => setLight((v) => !v) },
  ]

  function toggleAllergy(a: Allergen) {
    setAllergies((prev) => {
      const next = new Set(prev)
      if (next.has(a)) next.delete(a)
      else next.add(a)
      return next
    })
  }

  const hasAnyCondition = allergies.size > 0 || vegan || halal || light || rawText.trim().length > 0

  function runAnalysis() {
    const parsed = rawText.trim() ? parseMenuIntent(rawText) : {}
    const mergedAllergies = new Set(allergies)
    parsed.allergies?.forEach((a) => mergedAllergies.add(a))

    if (parsed.detectedLang && parsed.detectedLang !== lang) {
      setLang(parsed.detectedLang)
      setLangNotice(true)
    } else {
      setLangNotice(false)
    }

    setAllergies(mergedAllergies)
    if (parsed.vegan) setVegan(true)
    if (parsed.halal) setHalal(true)
    if (parsed.light) setLight(true)

    setStage('analyzing')
    setTimeout(() => {
      const advice = recommendMenu(menu, {
        allergies: Array.from(mergedAllergies),
        vegan: vegan || Boolean(parsed.vegan),
        halal: halal || Boolean(parsed.halal),
        light: light || Boolean(parsed.light),
      })
      setResult(advice)
      setStage('result')
    }, 850)
  }

  function reset() {
    setAllergies(new Set())
    setVegan(false)
    setHalal(false)
    setLight(false)
    setRawText('')
    setResult(null)
    setStage('input')
    setLangNotice(false)
  }

  return (
    <AppShell title={t('aiTitle')} showBack showNav={false}>
      <div className="px-4 pt-3 pb-8">
        <p className="text-xs text-tb-ink-soft">{t('aiSubtitle')}</p>

        {stage !== 'result' && (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {quickChips.map(({ key, label, icon: Icon, active, onToggle }) => (
                <button
                  key={key}
                  type="button"
                  onClick={onToggle}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    active ? 'border-tb-teal-500 bg-tb-teal-500 text-white' : 'border-tb-line bg-tb-paper-raised text-tb-ink-soft'
                  }`}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>

            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={t('aiPromptPlaceholder')}
              rows={3}
              className="mt-3 w-full resize-none rounded-2xl border border-tb-line bg-tb-paper-raised px-4 py-3 text-sm text-tb-ink outline-none focus:border-tb-teal-400"
            />

            <button
              type="button"
              disabled={!hasAnyCondition || stage === 'analyzing'}
              onClick={runAnalysis}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-tb-ink py-3.5 text-sm font-bold text-white disabled:opacity-40"
            >
              <Sparkles size={16} className={stage === 'analyzing' ? 'animate-pulse' : ''} />
              {stage === 'analyzing' ? t('aiAnalyzing') : t('aiAnalyze')}
            </button>
          </>
        )}

        {stage === 'result' && result && (
          <div className="mt-4 space-y-5">
            {langNotice && (
              <div className="rounded-xl bg-tb-teal-50 px-3.5 py-2.5 text-xs font-medium text-tb-teal-600">
                {t('aiLangSwitchedNotice')}
              </div>
            )}

            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-tb-ink">
                <ShieldCheck size={16} className="text-tb-teal-500" />
                {t('aiRecommended')}
              </h2>
              {result.recommended.length === 0 ? (
                <p className="mt-2 text-xs text-tb-ink-soft">{t('aiNoRecommend')}</p>
              ) : (
                <div className="mt-2 space-y-2.5">
                  {result.recommended.map(({ item, reason }) => (
                    <div key={item.id} className="flex gap-3 rounded-2xl border border-tb-teal-100 bg-tb-teal-50/50 p-3">
                      <img src={item.image} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-tb-ink">{pickLocalized(item.name, lang)}</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-tb-teal-600">
                          {t('aiReasonLabel')}: {reason[lang]}
                        </p>
                        <p className="mt-0.5 text-xs font-medium text-tb-ink-soft">₩{item.price.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-tb-ink">
                <ShieldAlert size={16} className="text-tb-coral-500" />
                {t('aiAvoid')}
              </h2>
              {result.avoid.length === 0 ? (
                <p className="mt-2 text-xs text-tb-ink-soft">{t('aiNoAvoid')}</p>
              ) : (
                <div className="mt-2 space-y-2.5">
                  {result.avoid.map(({ item, reason }) => (
                    <div key={item.id} className="flex gap-3 rounded-2xl border border-tb-coral-100 bg-tb-coral-50/50 p-3 opacity-90">
                      <img src={item.image} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover grayscale" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-tb-ink">{pickLocalized(item.name, lang)}</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-tb-coral-600">{reason[lang]}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={reset}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-tb-line py-3 text-xs font-semibold text-tb-ink-soft"
              >
                <RotateCcw size={14} />
                {t('aiResetConditions')}
              </button>
              <button
                type="button"
                onClick={() => navigate('/course')}
                className="flex flex-[1.4] items-center justify-center gap-1.5 rounded-xl bg-tb-coral-500 py-3 text-xs font-bold text-white"
              >
                {t('aiToCourse')}
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
