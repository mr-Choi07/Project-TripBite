import { addDoc, collection, getDocs, Timestamp } from 'firebase/firestore'
import { authReady, db } from './firebase'
import type { AnalyticsCounters, CourseDuration, Lang } from '../types'

type EventType = 'qr_scan' | 'language_selected' | 'course_click' | 'stamp_completed' | 'coupon_issued' | 'coupon_used'

interface TrackedEvent {
  type: EventType
  lang?: Lang
  duration?: CourseDuration
  createdAt: Timestamp
}

function eventsRef(storeId: string) {
  return collection(db, 'stores', storeId, 'events')
}

/** True while the current session is an owner previewing their *own* store's
 * tourist screens (StatsScreen's "관광객 화면 보기") — reads localStorage
 * directly rather than through AppContext since this module has no React
 * context access. Without this, an owner clicking around their own menu/
 * course screens would inflate their own store's stats identically to a
 * real visitor. */
function isPreviewSession(): boolean {
  try {
    const raw = localStorage.getItem('tripbite_session')
    if (!raw) return false
    return JSON.parse(raw)?.entryMethod === 'preview'
  } catch {
    return false
  }
}

export async function trackEvent(
  storeId: string,
  type: EventType,
  payload?: { lang?: Lang; duration?: CourseDuration },
) {
  if (isPreviewSession()) return
  try {
    await authReady
    await addDoc(eventsRef(storeId), {
      type,
      lang: payload?.lang ?? null,
      duration: payload?.duration ?? null,
      createdAt: Timestamp.now(),
    })
  } catch (err) {
    console.error('[analytics] trackEvent failed', err)
  }
}

const EMPTY_COUNTERS: AnalyticsCounters = {
  qrScans: 0,
  courseClicks: 0,
  stampCompletions: 0,
  couponIssued: 0,
  couponUsed: 0,
  languageCounts: { ko: 0, en: 0, ja: 0, zh: 0, fr: 0, es: 0 },
  coursePopularity: { 30: 0, 60: 0, 120: 0 },
}

/** Reads every event doc for the store and aggregates client-side. Fine for
 * a single-store demo's event volume; a production multi-store version
 * would move this to server-side aggregation (Cloud Functions + rollup docs). */
export async function getStats(storeId: string): Promise<{ counters: AnalyticsCounters; trend: number[] }> {
  const snap = await getDocs(eventsRef(storeId))
  const events = snap.docs.map((d) => d.data() as TrackedEvent)

  const counters: AnalyticsCounters = {
    ...EMPTY_COUNTERS,
    languageCounts: { ...EMPTY_COUNTERS.languageCounts },
    coursePopularity: { ...EMPTY_COUNTERS.coursePopularity },
  }

  const trend = new Array(7).fill(0)
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const todayStart = Math.floor(now / dayMs) * dayMs

  for (const event of events) {
    switch (event.type) {
      case 'qr_scan': {
        counters.qrScans += 1
        const createdAtMs = event.createdAt?.toMillis?.() ?? now
        const daysAgo = Math.floor((todayStart - Math.floor(createdAtMs / dayMs) * dayMs) / dayMs)
        if (daysAgo >= 0 && daysAgo < 7) trend[6 - daysAgo] += 1
        break
      }
      case 'course_click':
        counters.courseClicks += 1
        if (event.duration) counters.coursePopularity[event.duration] += 1
        break
      case 'stamp_completed':
        counters.stampCompletions += 1
        break
      case 'coupon_issued':
        counters.couponIssued += 1
        break
      case 'coupon_used':
        counters.couponUsed += 1
        break
      case 'language_selected':
        if (event.lang) counters.languageCounts[event.lang] += 1
        break
    }
  }

  return { counters, trend }
}
