import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QrCode, MousePointerClick, Stamp as StampIcon, Ticket, ArrowLeft } from 'lucide-react'
import { useApp } from '../context/AppContext'
import AppShell from '../components/layout/AppShell'
import { getStats } from '../lib/analyticsStore'
import { LANG_LABEL } from '../i18n'
import type { CourseDuration, Lang } from '../types'

const LANG_COLOR: Record<Lang, string> = {
  ko: '#1baf7a',
  en: '#eb6834',
  ja: '#4a3aa7',
  zh: '#eda100',
}

const DURATIONS: CourseDuration[] = [30, 60, 120]
const DURATION_LABEL: Record<CourseDuration, string> = { 30: '30min', 60: '1hr', 120: '2hr' }

export default function StatsScreen() {
  const { t } = useApp()
  const navigate = useNavigate()
  const [{ counters, trend }] = useState(() => getStats())

  const maxTrend = Math.max(...trend, 1)
  const langTotal = useMemo(
    () => (Object.values(counters.languageCounts) as number[]).reduce((a, b) => a + b, 0) || 1,
    [counters],
  )
  const maxCoursePop = Math.max(...(Object.values(counters.coursePopularity) as number[]), 1)
  const topCourse = (Object.entries(counters.coursePopularity) as [string, number][]).sort((a, b) => b[1] - a[1])[0]

  const tiles = [
    { label: t('statsQrScans'), value: counters.qrScans, icon: QrCode },
    { label: t('statsCourseClicks'), value: counters.courseClicks, icon: MousePointerClick },
    { label: t('statsStampCompletions'), value: counters.stampCompletions, icon: StampIcon },
    { label: t('statsCouponUsed'), value: counters.couponUsed, icon: Ticket },
  ]

  return (
    <AppShell title={t('statsTitle')} showBack showNav={false}>
      <div className="px-4 pt-3 pb-8">
        <p className="text-xs text-tb-ink-soft">{t('statsSubtitle')}</p>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {tiles.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-tb-line bg-tb-paper-raised p-3.5">
              <Icon size={16} className="text-tb-teal-500" />
              <p className="mt-2 text-2xl font-black tabular-nums text-tb-ink">{value.toLocaleString()}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-tb-ink-soft">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-tb-line bg-tb-paper-raised p-4">
          <p className="text-xs font-bold text-tb-ink">{t('statsWeeklyTrend')}</p>
          <div className="mt-4 flex h-28 items-end gap-2">
            {trend.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] font-semibold tabular-nums text-tb-ink-soft">{v}</span>
                <div
                  className="w-full rounded-t-md bg-tb-teal-500"
                  style={{ height: `${Math.max(6, (v / maxTrend) * 72)}px` }}
                />
                <span className="text-[9px] text-tb-ink-soft/60">D-{trend.length - 1 - i}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-tb-line bg-tb-paper-raised p-4">
          <p className="text-xs font-bold text-tb-ink">{t('statsLangRatio')}</p>
          <div className="mt-3 space-y-2.5">
            {(Object.keys(counters.languageCounts) as Lang[]).map((l) => {
              const count = counters.languageCounts[l]
              const pct = Math.round((count / langTotal) * 100)
              return (
                <div key={l}>
                  <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-tb-ink">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: LANG_COLOR[l] }} />
                      {LANG_LABEL[l]}
                    </span>
                    <span className="tabular-nums text-tb-ink-soft">{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-tb-sand-100">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: LANG_COLOR[l] }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-tb-line bg-tb-paper-raised p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-tb-ink">{t('statsPopularCourse')}</p>
            {topCourse && (
              <span className="rounded-full bg-tb-coral-50 px-2 py-0.5 text-[10px] font-bold text-tb-coral-600">
                {DURATION_LABEL[Number(topCourse[0]) as CourseDuration]}
              </span>
            )}
          </div>
          <div className="mt-3 space-y-2.5">
            {DURATIONS.map((d) => {
              const count = counters.coursePopularity[d]
              const pct = Math.max(6, Math.round((count / maxCoursePop) * 100))
              return (
                <div key={d} className="flex items-center gap-3">
                  <span className="w-10 shrink-0 text-[11px] font-semibold text-tb-ink-soft">{DURATION_LABEL[d]}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-tb-sand-100">
                    <div className="h-full rounded-full bg-tb-teal-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 shrink-0 text-right text-[11px] font-bold tabular-nums text-tb-ink">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] text-tb-ink-soft/70">{t('statsFootnote')}</p>

        <button
          type="button"
          onClick={() => navigate('/landing')}
          className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-tb-line py-3 text-sm font-semibold text-tb-ink-soft"
        >
          <ArrowLeft size={15} />
          {t('statsBack')}
        </button>
      </div>
    </AppShell>
  )
}
