import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QrCode, ScanLine, ArrowRight, MapPin } from 'lucide-react'
import { useApp } from '../context/AppContext'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'
import { demoQrPayload } from '../lib/qr'
import { SUNRISE_BOWL } from '../data/place'
import { pickLocalized } from '../i18n'

type ScanState = 'idle' | 'scanning' | 'detected'

export default function EntryScreen() {
  const { t, lang, enterWithQr, enterAsDemo } = useApp()
  const navigate = useNavigate()
  const [scanState, setScanState] = useState<ScanState>('idle')

  useEffect(() => {
    if (scanState !== 'scanning') return
    const timer = setTimeout(() => setScanState('detected'), 1800)
    return () => clearTimeout(timer)
  }, [scanState])

  function handleConfirmEntry() {
    enterWithQr(demoQrPayload(lang))
    navigate('/landing')
  }

  function handleDemoEnter() {
    enterAsDemo()
    navigate('/landing')
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-tb-teal-900 text-tb-paper">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(120% 90% at 15% -10%, rgba(31,138,130,0.75), transparent 55%), radial-gradient(90% 70% at 100% 0%, rgba(243,89,46,0.35), transparent 50%)',
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-8 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-tb-coral-500 text-sm font-black text-white">T</div>
            <span className="text-base font-extrabold tracking-tight">TripBite</span>
          </div>
          <LanguageSwitcher compact />
        </div>

        <div className="mt-10 flex flex-1 flex-col items-center justify-center text-center">
          <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-tb-teal-50">
            {t('brandTagline')}
          </span>

          <h1 className="mt-5 whitespace-pre-line text-[28px] font-black leading-tight text-white">{t('entryHeadline')}</h1>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-tb-teal-50/85">{t('entryBody')}</p>
        </div>

        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={() => setScanState('scanning')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-tb-coral-500 py-4 text-[15px] font-bold text-white shadow-tb-float active:scale-[0.99]"
          >
            <QrCode size={19} />
            {t('scanQr')}
          </button>
          <button
            type="button"
            onClick={handleDemoEnter}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/5 py-3.5 text-sm font-semibold text-white backdrop-blur active:scale-[0.99]"
          >
            {t('demoEnter')}
            <ArrowRight size={16} />
          </button>
          <p className="text-center text-[11px] leading-relaxed text-tb-teal-50/60">{t('demoHint')}</p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-2 border-t border-white/10 pt-5">
          <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-medium text-tb-teal-50/80">
            {t('poweredByTourApi')}
          </span>
          <span className="text-[10px] text-tb-teal-50/45">{t('entryFootnote')}</span>
        </div>
      </div>

      {scanState !== 'idle' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-tb-ink/95 px-6">
          {scanState === 'scanning' && (
            <div className="flex flex-col items-center gap-6 tb-fade-up">
              <div className="relative flex h-56 w-56 items-center justify-center rounded-3xl border-2 border-white/25">
                <div className="absolute inset-0 overflow-hidden rounded-3xl">
                  <div className="tb-scan-line absolute inset-x-4 top-1/2 h-0.5 rounded-full bg-tb-coral-400 shadow-[0_0_16px_4px_rgba(243,89,46,0.6)]" />
                </div>
                <ScanLine size={40} className="text-white/50" />
                <span className="absolute -left-0.5 -top-0.5 h-6 w-6 rounded-tl-2xl border-l-2 border-t-2 border-tb-coral-400" />
                <span className="absolute -right-0.5 -top-0.5 h-6 w-6 rounded-tr-2xl border-r-2 border-t-2 border-tb-coral-400" />
                <span className="absolute -bottom-0.5 -left-0.5 h-6 w-6 rounded-bl-2xl border-b-2 border-l-2 border-tb-coral-400" />
                <span className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-br-2xl border-b-2 border-r-2 border-tb-coral-400" />
              </div>
              <p className="text-sm font-medium text-white/80">{t('scanning')}</p>
            </div>
          )}

          {scanState === 'detected' && (
            <div className="w-full max-w-xs tb-fade-up rounded-3xl border border-white/10 bg-tb-paper-raised p-5 text-tb-ink shadow-tb-float">
              <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-tb-teal-500">
                <span className="h-1.5 w-1.5 rounded-full bg-tb-teal-500" />
                {t('scanDetected')}
              </div>
              <div className="overflow-hidden rounded-2xl">
                <img src={SUNRISE_BOWL.heroImage} alt="" className="h-32 w-full object-cover" />
              </div>
              <h2 className="mt-3 text-lg font-bold">{pickLocalized(SUNRISE_BOWL.name, lang)}</h2>
              <p className="mt-1 flex items-center gap-1 text-xs text-tb-ink-soft">
                <MapPin size={13} />
                {pickLocalized(SUNRISE_BOWL.areaName, lang)}
              </p>
              <span className="mt-3 inline-block rounded-full bg-tb-teal-50 px-2.5 py-1 text-[10px] font-semibold text-tb-teal-600">
                {t('qrEntryBadge')}
              </span>
              <button
                type="button"
                onClick={handleConfirmEntry}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-tb-teal-500 py-3 text-sm font-bold text-white active:scale-[0.99]"
              >
                {t('enterConfirm')}
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
