import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QrCode } from 'lucide-react'
import { useApp } from '../context/AppContext'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'
import QrScanOverlay from '../components/qr/QrScanOverlay'

export default function EntryScreen() {
  const { t } = useApp()
  const navigate = useNavigate()
  const [scanning, setScanning] = useState(false)

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
            onClick={() => setScanning(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-tb-coral-500 py-4 text-[15px] font-bold text-white shadow-tb-float active:scale-[0.99]"
          >
            <QrCode size={19} />
            {t('scanQr')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/owner/login')}
            className="w-full text-center text-[13px] font-medium text-tb-teal-50/70 underline-offset-4 active:underline"
          >
            {t('ownerLoginPrompt')}
          </button>
        </div>

        {/* 통신판매업자 정보 표시 — legally required business disclosure, kept
           in Korean regardless of the visitor's chosen language. */}
        <div className="mt-8 space-y-0.5 border-t border-white/10 pt-5 text-center text-[9px] leading-relaxed text-tb-teal-50/40">
          <p>리시스토어 대표: 신태준 · 사업자등록번호: 392-42-01359 · 통신판매업신고: 2024-부산해운대-1666</p>
          <p>부산 해운대구 송정중앙로 48 1층 2호 · 전화: 010-6649-6621</p>
          <p>© 리시스토어. All rights reserved.</p>
        </div>
      </div>

      {scanning && <QrScanOverlay onClose={() => setScanning(false)} />}
    </div>
  )
}
