import { useEffect, useState } from 'react'
import { Stamp as StampIcon, Ticket, Check, QrCode, Sparkles } from 'lucide-react'
import { useApp } from '../context/AppContext'
import AppShell from '../components/layout/AppShell'
import { pickLocalized } from '../i18n'
import { MOCK_TOUR_SPOTS } from '../data/attractions'
import { addStamp, getCoupon, getStampGoal, getStamps, redeemCoupon } from '../lib/stampModule'
import type { Coupon, StampEntry } from '../types'

export default function StampScreen() {
  const { t, lang, showToast, session, uid } = useApp()
  const [stamps, setStamps] = useState<StampEntry[]>([])
  const [coupon, setCoupon] = useState<Coupon | undefined>(undefined)

  const goal = getStampGoal()
  const visitedIds = new Set(stamps.map((s) => s.spotId))
  const nextUnvisited = MOCK_TOUR_SPOTS.filter((s) => s.category !== 'stay').find((s) => !visitedIds.has(s.id))

  useEffect(() => {
    if (!uid) return
    getStamps(session.storeId, uid).then(setStamps)
    getCoupon(session.storeId, uid).then(setCoupon)
  }, [session.storeId, uid])

  async function handleSimulateVisit() {
    if (!nextUnvisited || !uid) return
    const res = await addStamp(session.storeId, uid, nextUnvisited)
    setStamps(res.stamps)
    if (res.coupon) setCoupon(res.coupon)
    const justEarnedCoupon = res.stamps.length === goal && Boolean(res.coupon)
    showToast(justEarnedCoupon ? t('toastCouponIssued') : t('toastStampCollected'))
  }

  async function handleRedeem() {
    if (!uid) return
    const updated = await redeemCoupon(session.storeId, uid)
    if (updated) setCoupon(updated)
  }

  return (
    <AppShell title={t('stampTitle')}>
      <div className="px-4 pt-3 pb-8">
        <p className="text-xs text-tb-ink-soft">{t('stampSubtitle')}</p>

        <div className="mt-4 rounded-2xl border border-tb-line bg-tb-paper-raised p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-tb-ink">{t('stampProgress', stamps.length)}</span>
            <StampIcon size={16} className="text-tb-teal-500" />
          </div>
          <div className="mt-3 flex gap-2">
            {Array.from({ length: goal }).map((_, i) => (
              <div
                key={i}
                className={`flex h-14 flex-1 items-center justify-center rounded-xl border-2 border-dashed text-lg font-black ${
                  i < stamps.length ? 'border-tb-teal-500 bg-tb-teal-50 text-tb-teal-500' : 'border-tb-line text-tb-line'
                }`}
              >
                {i < stamps.length ? <Check size={20} /> : i + 1}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-tb-ink-soft">{t('stampCouponRule')}</p>
        </div>

        {coupon ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-tb-coral-200 bg-gradient-to-br from-tb-coral-500 to-tb-coral-600 p-4 text-white shadow-tb-card">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white/85">
              <Ticket size={14} />
              {t('stampCouponReady')}
            </div>
            <p className="mt-2 text-lg font-black">{coupon.discountLabel[lang]}</p>
            <div className="mt-2 flex items-center justify-between rounded-xl bg-white/15 px-3 py-2">
              <span className="font-mono text-sm tracking-wider">{coupon.code}</span>
              <span className="text-[10px] font-medium text-white/70">{t('stampCouponCode')}</span>
            </div>
            <button
              type="button"
              onClick={handleRedeem}
              disabled={coupon.used}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-sm font-bold text-tb-coral-600 disabled:opacity-60"
            >
              {coupon.used ? (
                <>
                  <Check size={15} />
                  {t('stampCouponUsed')}
                </>
              ) : (
                t('stampCouponUse')
              )}
            </button>
          </div>
        ) : (
          nextUnvisited && (
            <button
              type="button"
              onClick={handleSimulateVisit}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-tb-line bg-tb-paper-raised py-3.5 text-sm font-bold text-tb-ink active:scale-[0.99]"
            >
              <QrCode size={16} />
              {t('stampSimulateVisit')}
            </button>
          )
        )}

        <div className="mt-5">
          {stamps.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-tb-line px-4 py-8 text-center text-xs leading-relaxed text-tb-ink-soft">
              {t('stampEmpty')}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {stamps.map((s) => (
                <li key={s.spotId} className="flex items-center gap-3 rounded-xl border border-tb-line bg-tb-paper-raised px-3.5 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tb-teal-50 text-tb-teal-500">
                    <Check size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-tb-ink">{pickLocalized(s.spotTitle, lang)}</p>
                    <p className="text-[11px] text-tb-ink-soft">
                      {t('stampVisitedAt')} {new Date(s.visitedAt).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5 flex items-center gap-2.5 rounded-2xl bg-tb-sand-100/70 px-4 py-3 text-xs text-tb-ink-soft">
          <Sparkles size={15} className="shrink-0 text-tb-coral-500" />
          {t('stampLocalImpact')}
        </div>
      </div>
    </AppShell>
  )
}
