import type { ReactNode } from 'react'

type TagTone = 'teal' | 'coral' | 'neutral' | 'warn'

const TONE_CLASSES: Record<TagTone, string> = {
  teal: 'bg-tb-teal-50 text-tb-teal-600 border-tb-teal-100',
  coral: 'bg-tb-coral-50 text-tb-coral-600 border-tb-coral-100',
  neutral: 'bg-tb-sand-100 text-tb-ink-soft border-tb-sand-300',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
}

export default function Tag({
  children,
  tone = 'neutral',
  icon,
}: {
  children: ReactNode
  tone?: TagTone
  icon?: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none ${TONE_CLASSES[tone]}`}
    >
      {icon}
      {children}
    </span>
  )
}
