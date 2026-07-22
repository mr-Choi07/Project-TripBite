import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, CheckCircle2, RotateCcw } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { parseQrUrl } from '../../lib/qr'
import QrScanner from './QrScanner'

interface Props {
  onClose: () => void
}

type Phase = 'scanning' | 'invalid' | 'success'

/** Full-screen live-camera QR scan UI, shared between the entry screen's
 * "Scan QR" button and the bottom-nav scan shortcut. A detected code is
 * validated with `parseQrUrl` (same parser real printed TripBite QR codes
 * and `lib/qr.ts`'s `buildQrUrl` output use) before it's trusted — a QR for
 * some unrelated URL just gets rejected with a retry, not treated as a
 * store. */
export default function QrScanOverlay({ onClose }: Props) {
  const { t, enterWithQr } = useApp()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('scanning')
  const [scanKey, setScanKey] = useState(0)

  function handleDetected(text: string) {
    const payload = parseQrUrl(text)
    if (!payload) {
      setPhase('invalid')
      return
    }
    setPhase('success')
    enterWithQr(payload)
    setTimeout(() => navigate('/landing'), 500)
  }

  function handleRetry() {
    setPhase('scanning')
    setScanKey((k) => k + 1)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black">
      {phase !== 'success' && <QrScanner key={scanKey} active={phase === 'scanning'} onDetected={handleDetected} />}

      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-[calc(env(safe-area-inset-top)+16px)] z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm active:scale-95"
      >
        <X size={18} />
      </button>

      {phase === 'scanning' && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-7 px-6">
          <p className="text-center text-[13px] font-medium text-white/80">테이블의 TripBite QR 코드를 프레임 안에 맞춰주세요</p>

          <div className="relative">
            {/* Darkens everything outside the frame, leaving the frame itself
               as a clear "spotlight" cutout onto the live camera feed. */}
            <div
              className="h-60 w-60 rounded-[28px]"
              style={{ boxShadow: '0 0 0 2000px rgba(0,0,0,0.55)' }}
            />
            {/* Animated glow sits on its own layer so it doesn't fight the
               spotlight cutout above for the box-shadow property. */}
            <div className="tb-glow-pulse absolute inset-0 rounded-[28px] border-2 border-tb-teal-300/80" />
            <div className="absolute inset-0 overflow-hidden rounded-[28px]">
              <div className="tb-scan-line absolute inset-x-6 top-1/2 h-px rounded-full bg-gradient-to-r from-transparent via-tb-coral-400 to-transparent shadow-[0_0_12px_2px_rgba(243,89,46,0.7)]" />
            </div>
            <span className="absolute -left-px -top-px h-7 w-7 rounded-tl-[28px] border-l-[3px] border-t-[3px] border-white" />
            <span className="absolute -right-px -top-px h-7 w-7 rounded-tr-[28px] border-r-[3px] border-t-[3px] border-white" />
            <span className="absolute -bottom-px -left-px h-7 w-7 rounded-bl-[28px] border-b-[3px] border-l-[3px] border-white" />
            <span className="absolute -bottom-px -right-px h-7 w-7 rounded-br-[28px] border-b-[3px] border-r-[3px] border-white" />
          </div>

          <div className="relative flex items-center gap-1.5 rounded-full bg-black/45 px-3.5 py-1.5 backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="tb-pulse-ring absolute h-1.5 w-1.5 rounded-full bg-tb-teal-400/70" />
              <span className="h-1.5 w-1.5 rounded-full bg-tb-teal-400" />
            </span>
            <span className="text-xs font-medium text-white/90">{t('scanning')}</span>
          </div>
        </div>
      )}

      {phase === 'invalid' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center backdrop-blur-sm">
          <p className="text-sm font-semibold text-white">TripBite QR 코드가 아니에요</p>
          <p className="text-xs text-white/60">매장에 비치된 TripBite QR 코드를 스캔해주세요.</p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-2 flex items-center gap-1.5 rounded-xl bg-tb-coral-500 px-4 py-2.5 text-sm font-bold text-white"
          >
            <RotateCcw size={15} />
            다시 스캔
          </button>
        </div>
      )}

      {phase === 'success' && (
        <div className="flex h-full flex-col items-center justify-center gap-3 bg-tb-ink">
          <div className="relative flex items-center justify-center">
            <span className="tb-pulse-ring absolute h-14 w-14 rounded-full bg-tb-teal-400/40" />
            <CheckCircle2 size={44} className="tb-success-pop relative text-tb-teal-400" />
          </div>
          <p className="tb-fade-up text-sm font-semibold text-white/90">{t('scanDetected')}</p>
        </div>
      )}
    </div>
  )
}
