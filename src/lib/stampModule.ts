import type { Coupon, StampEntry, TourSpot } from '../types'
import { trackEvent } from './analyticsStore'

const STAMP_KEY = 'tripbite_stamps_v1'
const COUPON_KEY = 'tripbite_coupon_v1'
const STAMP_GOAL = 3

function readStamps(): StampEntry[] {
  try {
    const raw = localStorage.getItem(STAMP_KEY)
    return raw ? (JSON.parse(raw) as StampEntry[]) : []
  } catch {
    return []
  }
}

function writeStamps(stamps: StampEntry[]) {
  localStorage.setItem(STAMP_KEY, JSON.stringify(stamps))
}

function readCoupon(): Coupon | undefined {
  try {
    const raw = localStorage.getItem(COUPON_KEY)
    return raw ? (JSON.parse(raw) as Coupon) : undefined
  } catch {
    return undefined
  }
}

function writeCoupon(coupon: Coupon) {
  localStorage.setItem(COUPON_KEY, JSON.stringify(coupon))
}

function generateCouponCode() {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `TRIPBITE-${suffix}`
}

export function getStamps(): StampEntry[] {
  return readStamps()
}

export function getStampGoal() {
  return STAMP_GOAL
}

export function getCoupon(): Coupon | undefined {
  return readCoupon()
}

export function addStamp(spot: TourSpot): { stamps: StampEntry[]; isNew: boolean; coupon?: Coupon } {
  const stamps = readStamps()
  if (stamps.some((s) => s.spotId === spot.id)) {
    return { stamps, isNew: false, coupon: readCoupon() }
  }

  const nextStamps = [...stamps, { spotId: spot.id, spotTitle: spot.title, visitedAt: Date.now() }]
  writeStamps(nextStamps)

  let coupon = readCoupon()
  if (nextStamps.length >= STAMP_GOAL && !coupon) {
    trackEvent('stamp_completed')
    coupon = issueCoupon()
  }

  return { stamps: nextStamps, isNew: true, coupon }
}

export function issueCoupon(): Coupon {
  const existing = readCoupon()
  if (existing) return existing

  const coupon: Coupon = {
    code: generateCouponCode(),
    issuedAt: Date.now(),
    used: false,
    discountLabel: {
      ko: '선라이즈볼 20% 할인',
      en: '20% off at Sunrise Bowl',
      ja: 'サンライズボウル20%割引',
      zh: '日出碗9折优惠',
    },
  }
  writeCoupon(coupon)
  trackEvent('coupon_issued')
  return coupon
}

export function redeemCoupon(): Coupon | undefined {
  const coupon = readCoupon()
  if (!coupon || coupon.used) return coupon
  const updated: Coupon = { ...coupon, used: true, usedAt: Date.now() }
  writeCoupon(updated)
  trackEvent('coupon_used')
  return updated
}

export function resetDemoProgress() {
  localStorage.removeItem(STAMP_KEY)
  localStorage.removeItem(COUPON_KEY)
}
