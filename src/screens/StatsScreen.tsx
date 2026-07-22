import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  QrCode,
  MousePointerClick,
  Stamp as StampIcon,
  Ticket,
  LogOut,
  Compass,
  Store as StoreIcon,
  Receipt,
  Wallet,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import OwnerDashboardShell from '../components/layout/OwnerDashboardShell'
import { getStats } from '../lib/analyticsStore'
import { getRevenueSummary, type RevenueSummary } from '../lib/orders'
import { ownerSignOut } from '../lib/ownerAuth'
import { findStoreByOwner } from '../lib/storeData'
import { LANG_LABEL } from '../i18n'
import type { AnalyticsCounters, CourseDuration, Lang, StorePlace } from '../types'

const LANG_COLOR: Record<Lang, string> = {
  ko: '#1baf7a',
  en: '#eb6834',
  ja: '#4a3aa7',
  zh: '#eda100',
  fr: '#3a7ca7',
  es: '#c73659',
}

const DURATIONS: CourseDuration[] = [30, 60, 120]
const DURATION_LABEL: Record<CourseDuration, string> = { 30: '30min', 60: '1hr', 120: '2hr' }

export default function StatsScreen() {
  const { t, firebaseUser, uid, lang, enterAsPreview } = useApp()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [myStore, setMyStore] = useState<StorePlace | null>(null)
  const [counters, setCounters] = useState<AnalyticsCounters | null>(null)
  const [trend, setTrend] = useState<number[]>([])
  const [revenue, setRevenue] = useState<RevenueSummary | null>(null)

  useEffect(() => {
    if (!uid) return
    let active = true
    findStoreByOwner(uid).then((s) => {
      if (!active) return
      setMyStore(s)
      if (!s) {
        setLoading(false)
        return
      }
      Promise.all([getStats(s.storeId), getRevenueSummary(s.storeId)]).then(([stats, rev]) => {
        if (!active) return
        setCounters(stats.counters)
        setTrend(stats.trend)
        setRevenue(rev)
        setLoading(false)
      })
    })
    return () => {
      active = false
    }
  }, [uid])

  async function handleLogout() {
    await ownerSignOut()
    navigate('/owner/login')
  }

  function handlePreviewAsTourist() {
    if (!myStore) {
      navigate('/')
      return
    }
    // Jump straight into this store's tourist landing page, rather than
    // sending the owner back through the QR-scan/demo entry flow just to
    // see their own storefront. Uses enterAsPreview (not enterWithQr) so
    // clicking around doesn't inflate this store's own analytics.
    enterAsPreview({
      storeId: myStore.storeId,
      campaignId: myStore.campaignId,
      lat: myStore.lat,
      lng: myStore.lng,
      lang,
    })
    navigate('/landing')
  }

  const langTotal = useMemo(
    () => (counters ? (Object.values(counters.languageCounts) as number[]).reduce((a, b) => a + b, 0) : 0) || 1,
    [counters],
  )
  const maxTrend = Math.max(...trend, 1)
  const maxCoursePop = Math.max(...(counters ? (Object.values(counters.coursePopularity) as number[]) : [0]), 1)
  const topCourse = counters
    ? (Object.entries(counters.coursePopularity) as [string, number][]).sort((a, b) => b[1] - a[1])[0]
    : undefined

  if (!loading && !myStore) {
    return (
      <OwnerDashboardShell title={t('statsTitle')}>
        <div className="flex flex-col items-center gap-3 px-4 py-24 text-center">
          <StoreIcon size={28} className="text-tb-ink-soft" />
          <p className="text-sm font-semibold text-tb-ink">아직 등록된 매장이 없습니다</p>
          <p className="text-xs text-tb-ink-soft">매장을 등록하면 통계를 볼 수 있어요</p>
          <button
            type="button"
            onClick={() => navigate('/owner/manage')}
            className="mt-2 rounded-2xl bg-tb-ink px-5 py-3 text-sm font-bold text-white"
          >
            매장 등록하기
          </button>
          <button type="button" onClick={handleLogout} className="mt-1 text-xs font-semibold text-tb-ink-soft lg:hidden">
            로그아웃
          </button>
        </div>
      </OwnerDashboardShell>
    )
  }

  if (loading || !counters || !revenue) {
    return (
      <OwnerDashboardShell title={t('statsTitle')}>
        <div className="flex flex-col items-center gap-2 py-24 text-tb-ink-soft">
          <StampIcon size={22} className="animate-pulse text-tb-teal-500" />
          <p className="text-xs">불러오는 중...</p>
        </div>
      </OwnerDashboardShell>
    )
  }

  const tiles = [
    { label: t('statsQrScans'), value: counters.qrScans, icon: QrCode },
    { label: t('statsCourseClicks'), value: counters.courseClicks, icon: MousePointerClick },
    { label: t('statsStampCompletions'), value: counters.stampCompletions, icon: StampIcon },
    { label: t('statsCouponUsed'), value: counters.couponUsed, icon: Ticket },
  ]

  return (
    <OwnerDashboardShell title={t('statsTitle')}>
      <div className="pt-3 pb-8 lg:pt-0">
        <div className="flex items-center justify-between">
          <p className="text-xs text-tb-ink-soft">{t('statsSubtitle')}</p>
          {firebaseUser?.email && (
            <span className="text-[10px] font-medium text-tb-ink-soft/70 lg:hidden">{firebaseUser.email}</span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
          {tiles.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-tb-line bg-tb-paper-raised p-3.5 lg:p-5">
              <Icon size={16} className="text-tb-teal-500" />
              <p className="mt-2 text-2xl font-black tabular-nums text-tb-ink lg:text-3xl">{value.toLocaleString()}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-tb-ink-soft">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-tb-teal-100 bg-tb-teal-50 p-4 lg:p-5">
            <div className="flex items-center gap-1.5 text-tb-teal-700">
              <Wallet size={15} />
              <p className="text-xs font-bold">누적 매출</p>
            </div>
            <p className="mt-1.5 text-2xl font-black tabular-nums text-tb-teal-700 lg:text-3xl">
              ₩{revenue.totalRevenue.toLocaleString()}
            </p>
            <div className="mt-2.5 flex items-center gap-4 text-[11px] font-medium text-tb-teal-700/80">
              <span>오늘 ₩{revenue.todayRevenue.toLocaleString()}</span>
              <span>완료 주문 {revenue.completedCount}건</span>
            </div>
          </div>

          {revenue.topItems.length > 0 && (
            <div className="rounded-2xl border border-tb-line bg-tb-paper-raised p-4 lg:col-span-2 lg:p-5">
              <p className="text-xs font-bold text-tb-ink">인기 메뉴</p>
              <div className="mt-2.5 space-y-2 lg:mt-3 lg:grid lg:grid-cols-3 lg:gap-3 lg:space-y-0">
                {revenue.topItems.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-tb-ink">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-tb-sand-100 text-[10px] font-bold text-tb-ink-soft">
                        {i + 1}
                      </span>
                      {item.name}
                    </span>
                    <span className="text-xs font-semibold text-tb-ink-soft">{item.qty}개 판매</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate('/owner/orders')}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-tb-coral-500 py-3.5 text-sm font-bold text-white lg:hidden"
        >
          <Receipt size={15} />
          주문 관리
        </button>

        <div className="mt-5 grid gap-4 lg:mt-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-tb-line bg-tb-paper-raised p-4 lg:p-5">
            <p className="text-xs font-bold text-tb-ink">{t('statsWeeklyTrend')}</p>
            <div className="mt-4 flex h-28 items-end gap-2 lg:h-36">
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

          <div className="rounded-2xl border border-tb-line bg-tb-paper-raised p-4 lg:p-5">
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

          <div className="rounded-2xl border border-tb-line bg-tb-paper-raised p-4 lg:col-span-2 lg:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-tb-ink">{t('statsPopularCourse')}</p>
              {topCourse && (
                <span className="rounded-full bg-tb-coral-50 px-2 py-0.5 text-[10px] font-bold text-tb-coral-600">
                  {DURATION_LABEL[Number(topCourse[0]) as CourseDuration]}
                </span>
              )}
            </div>
            <div className="mt-3 space-y-2.5 lg:grid lg:grid-cols-3 lg:gap-4 lg:space-y-0">
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
        </div>

        <p className="mt-4 text-center text-[10px] text-tb-ink-soft/70 lg:hidden">{t('statsFootnote')}</p>

        <button
          type="button"
          onClick={() => navigate('/owner/manage')}
          className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-tb-ink py-3.5 text-sm font-bold text-white lg:hidden"
        >
          <StoreIcon size={15} />
          매장·메뉴 관리
        </button>

        <div className="mt-2 flex gap-2 lg:mt-6 lg:w-fit">
          <button
            type="button"
            onClick={handlePreviewAsTourist}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-tb-line py-3 text-sm font-semibold text-tb-ink-soft lg:flex-none lg:px-5"
          >
            <Compass size={15} />
            관광객 화면 보기
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-tb-coral-200 bg-tb-coral-50 py-3 text-sm font-semibold text-tb-coral-600 lg:hidden"
          >
            <LogOut size={15} />
            로그아웃
          </button>
        </div>
      </div>
    </OwnerDashboardShell>
  )
}
