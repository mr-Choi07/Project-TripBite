import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

const ONBOARDING_SEEN_KEY = 'tripbite_owner_onboarding_seen'

const SLIDES = [
  {
    video: '/6248973_Person_People_1280x720.mp4',
    title: '테이블 QR 하나로\n매장을 소개하세요',
    body: 'QR 코드를 인쇄해 테이블에 붙여두면, 손님이 스캔하는 순간부터 메뉴 안내가 시작돼요.',
  },
  {
    video: '/7187346_Friends_Women_1280x720.mp4',
    title: 'AI가 다국어로\n손님을 응대해요',
    body: '메뉴와 매장 소개는 자동으로 번역돼, 외국인 관광객도 편하게 주문할 수 있어요.',
  },
  {
    video: '/1477149_People_Business_1280x720.mp4',
    title: '안전한 인증으로\n매장을 보호해요',
    body: '휴대폰 본인 인증을 거친 사장님만 매장 정보를 등록·수정할 수 있어요.',
  },
] as const

/** True once this browser has ever finished or skipped the intro — a
 * one-time, per-device flag rather than tied to any single account, so it
 * doesn't resurface every time an owner signs up on a device that already
 * saw it once. */
export function hasSeenOwnerOnboarding(): boolean {
  return localStorage.getItem(ONBOARDING_SEEN_KEY) === '1'
}

function markOwnerOnboardingSeen(): void {
  localStorage.setItem(ONBOARDING_SEEN_KEY, '1')
}

export default function OwnerOnboarding({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0)
  const isLast = index === SLIDES.length - 1
  const slide = SLIDES[index]

  function finish() {
    markOwnerOnboardingSeen()
    onDone()
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-tb-ink text-tb-paper">
      <button
        type="button"
        onClick={finish}
        className="absolute right-4 top-[calc(env(safe-area-inset-top)+16px)] z-20 rounded-full bg-black/45 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm"
      >
        건너뛰기
      </button>

      {/* Hero visual: real footage instead of a generated illustration —
         each slide gets its own clip, cross-faded on step change. */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.video
            key={slide.video}
            src={slide.video}
            autoPlay
            muted
            loop
            playsInline
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </AnimatePresence>

        {/* Darkens the clip so white text/icons stay legible over any
           footage, and fades smoothly into the bottom sheet below it. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-tb-ink" />
      </div>

      {/* Floating bottom card, overlapping the hero visual — matches the
         reference's "step label + title + body + pill CTA" bottom sheet. */}
      <div className="relative z-10 rounded-t-[32px] border-t border-white/10 bg-white/[0.06] px-6 pb-8 pt-6 backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-tb-coral-400">
            Step {index + 1} / {SLIDES.length}
          </span>
          <div className="flex items-center gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${i + 1}번째 화면으로 이동`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-tb-coral-400' : 'w-1.5 bg-white/25'}`}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <h1 className="whitespace-pre-line text-2xl font-black leading-tight text-white">{slide.title}</h1>
            <p className="mt-2.5 text-sm leading-relaxed text-white/60">{slide.body}</p>
          </motion.div>
        </AnimatePresence>

        <button
          type="button"
          onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
          className="mt-6 flex w-full items-center justify-between rounded-full bg-gradient-to-r from-tb-teal-500 to-tb-coral-500 py-2 pl-6 pr-2 text-[15px] font-bold text-white shadow-tb-float active:scale-[0.99]"
        >
          {isLast ? '시작하기' : '다음'}
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
            <ArrowRight size={17} />
          </span>
        </button>
      </div>
    </div>
  )
}
