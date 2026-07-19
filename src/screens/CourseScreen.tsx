import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Clock, Footprints, Check, Sparkles, Bed, ArrowRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import AppShell from '../components/layout/AppShell'
import Tag from '../components/ui/Tag'
import CourseMap from '../components/course/CourseMap'
import { SUNRISE_BOWL } from '../data/place'
import { pickLocalized } from '../i18n'
import { fetchNearbySpots } from '../lib/tourApi'
import { buildCourse, pickBonusStay, weatherReason, INTEREST_OPTIONS, INTEREST_LABEL, formatCourseDistance } from '../lib/recommendationEngine'
import { addStamp, getStampGoal, getStamps } from '../lib/stampModule'
import { trackEvent } from '../lib/analyticsStore'
import type { Course, CourseDuration, TourApiSource, TourSpot } from '../types'

const DURATIONS: CourseDuration[] = [30, 60, 120]
const DURATION_KEY: Record<CourseDuration, 'course30' | 'course60' | 'course120'> = {
  30: 'course30',
  60: 'course60',
  120: 'course120',
}
const CATEGORY_KEY = {
  attraction: 'categoryAttraction',
  festival: 'categoryFestival',
  stay: 'categoryStay',
  shopping: 'categoryShopping',
  restaurant: 'categoryRestaurant',
} as const

export default function CourseScreen() {
  const { t, lang, weather, showToast, session, uid } = useApp()
  const navigate = useNavigate()

  const [spots, setSpots] = useState<TourSpot[]>([])
  const [source, setSource] = useState<TourApiSource>('mock')
  const [loading, setLoading] = useState(true)
  const [duration, setDuration] = useState<CourseDuration>(60)
  const [interests, setInterests] = useState<Set<string>>(new Set(['바다', '레트로']))
  const [visited, setVisited] = useState<Set<string>>(new Set())

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchNearbySpots({ lat: SUNRISE_BOWL.lat, lng: SUNRISE_BOWL.lng }).then((res) => {
      if (!active) return
      setSpots(res.spots)
      setSource(res.source)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!uid) return
    getStamps(session.storeId, uid).then((stamps) => setVisited(new Set(stamps.map((s) => s.spotId))))
  }, [session.storeId, uid])

  const course: Course = useMemo(() => buildCourse(duration, spots, Array.from(interests)), [duration, spots, interests])
  const bonusStay = useMemo(() => pickBonusStay(spots, course), [spots, course])

  function handleSelectDuration(d: CourseDuration) {
    setDuration(d)
    trackEvent(session.storeId, 'course_click', { duration: d })
  }

  function toggleInterest(tag: string) {
    setInterests((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  async function handleStamp(spot: TourSpot) {
    if (!uid) return
    const res = await addStamp(session.storeId, uid, spot)
    setVisited(new Set(res.stamps.map((s) => s.spotId)))
    if (res.isNew) {
      const justEarnedCoupon = res.stamps.length === getStampGoal() && Boolean(res.coupon)
      showToast(justEarnedCoupon ? t('toastCouponIssued') : t('toastStampCollected'))
    }
  }

  const weatherText = weatherReason(weather)

  return (
    <AppShell title={t('courseTitle')}>
      <div className="px-4 pt-3 pb-6">
        <div className="flex items-center justify-between">
          <p className="text-xs text-tb-ink-soft">{t('courseSubtitle')}</p>
          <span
            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${
              source === 'live' ? 'bg-tb-teal-50 text-tb-teal-600' : 'bg-tb-sand-100 text-tb-ink-soft'
            }`}
          >
            {source === 'live' ? t('courseDataSource') : t('courseDataSourceMock')}
          </span>
        </div>

        <div className="mt-3 flex gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleSelectDuration(d)}
              className={`flex-1 rounded-xl border py-2.5 text-sm font-bold transition-colors ${
                duration === d ? 'border-tb-teal-500 bg-tb-teal-500 text-white' : 'border-tb-line bg-tb-paper-raised text-tb-ink-soft'
              }`}
            >
              {t(DURATION_KEY[d])}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {INTEREST_OPTIONS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleInterest(tag)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                interests.has(tag) ? 'border-tb-coral-400 bg-tb-coral-50 text-tb-coral-600' : 'border-tb-line bg-tb-paper-raised text-tb-ink-soft'
              }`}
            >
              #{pickLocalized(INTEREST_LABEL[tag], lang)}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-2xl bg-tb-teal-50 px-4 py-3 text-xs font-medium text-tb-teal-700">
          {weatherText[lang]}
        </div>

        {loading ? (
          <div className="mt-8 flex flex-col items-center gap-2 py-10 text-tb-ink-soft">
            <Sparkles size={22} className="animate-pulse text-tb-teal-500" />
            <p className="text-xs">{t('aiAnalyzing')}</p>
          </div>
        ) : (
          <>
            <div className="mt-5 flex items-center gap-4 rounded-2xl border border-tb-line bg-tb-paper-raised px-4 py-3">
              <div>
                <p className="text-[10px] font-medium text-tb-ink-soft">{t('courseTotalTime')}</p>
                <p className="text-sm font-bold text-tb-ink">~{course.totalMinutes}{t('minutesShort')}</p>
              </div>
              <div className="h-8 w-px bg-tb-line" />
              <div>
                <p className="text-[10px] font-medium text-tb-ink-soft">{t('courseTotalDistance')}</p>
                <p className="text-sm font-bold text-tb-ink">{formatCourseDistance(course.totalDistanceM)}</p>
              </div>
            </div>

            <div className="mt-4">
              <CourseMap
                origin={{ lat: SUNRISE_BOWL.lat, lng: SUNRISE_BOWL.lng, label: pickLocalized(SUNRISE_BOWL.name, lang) }}
                stops={course.stops.map((stop) => ({
                  lat: stop.spot.lat,
                  lng: stop.spot.lng,
                  label: pickLocalized(stop.spot.title, lang),
                }))}
              />
            </div>

            <ol className="relative mt-6 space-y-6 border-l-2 border-dashed border-tb-line pl-5">
              <li className="relative">
                <span className="absolute -left-[27px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-tb-ink text-white">
                  <MapPin size={11} />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-tb-ink-soft">{t('courseStartFrom')}</p>
                <p className="text-sm font-bold text-tb-ink">{pickLocalized(SUNRISE_BOWL.name, lang)}</p>
              </li>

              {course.stops.map((stop) => (
                <li key={stop.spot.id} className="relative">
                  <span className="absolute -left-[27px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-tb-teal-500 text-[10px] font-bold text-white">
                    {stop.order}
                  </span>

                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-tb-ink-soft">
                    <Footprints size={12} />
                    {t('courseWalk')} {stop.travelMinutesFromPrev}
                    {t('minutesShort')} · {formatCourseDistance(stop.travelDistanceFromPrevM)}
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-tb-line bg-tb-paper-raised">
                    <img src={stop.spot.image} alt="" className="h-32 w-full object-cover" />
                    <div className="p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <Tag tone="neutral">{t(CATEGORY_KEY[stop.spot.category])}</Tag>
                        <span className="flex items-center gap-1 text-[10px] text-tb-ink-soft">
                          <Clock size={11} />
                          {t('courseStay')} {stop.spot.dwellMinutes}
                          {t('minutesShort')}
                        </span>
                      </div>
                      <h3 className="mt-1.5 text-[15px] font-bold text-tb-ink">{pickLocalized(stop.spot.title, lang)}</h3>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-tb-ink-soft">
                        <MapPin size={11} />
                        {stop.spot.addr}
                      </p>

                      <div className="mt-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-tb-ink-soft/70">{t('courseWhyTitle')}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {stop.reasons.map((r, i) => (
                            <Tag key={i} tone="teal">
                              {r.text[lang]}
                            </Tag>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleStamp(stop.spot)}
                        disabled={visited.has(stop.spot.id)}
                        className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold ${
                          visited.has(stop.spot.id) ? 'bg-tb-teal-50 text-tb-teal-600' : 'bg-tb-ink text-white'
                        }`}
                      >
                        <Check size={13} />
                        {visited.has(stop.spot.id) ? t('courseStamped') : t('courseStampCta')}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            {bonusStay && (
              <div className="mt-6 flex gap-3 rounded-2xl border border-tb-sand-300 bg-tb-sand-100/60 p-3">
                <img src={bonusStay.image} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-tb-ink-soft">
                    <Bed size={11} />
                    {t(CATEGORY_KEY.stay)}
                  </span>
                  <p className="truncate text-sm font-bold text-tb-ink">{pickLocalized(bonusStay.title, lang)}</p>
                  <p className="text-[11px] text-tb-ink-soft">{formatCourseDistance(bonusStay.distanceM)}</p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate('/stamp')}
              className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-tb-coral-500 py-3.5 text-sm font-bold text-white active:scale-[0.99]"
            >
              {t('courseViewStamp')}
              <ArrowRight size={16} />
            </button>
          </>
        )}
      </div>
    </AppShell>
  )
}
