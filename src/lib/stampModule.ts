import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { Coupon, StampEntry, TourSpot } from '../types'
import { trackEvent } from './analyticsStore'

const STAMP_GOAL = 3

interface VisitorDoc {
  stamps: StampEntry[]
  coupon?: Coupon
}

function visitorRef(storeId: string, uid: string) {
  return doc(db, 'stores', storeId, 'visitors', uid)
}

async function readVisitor(storeId: string, uid: string): Promise<VisitorDoc> {
  const snap = await getDoc(visitorRef(storeId, uid))
  if (!snap.exists()) return { stamps: [] }
  const data = snap.data() as VisitorDoc
  return { stamps: data.stamps ?? [], coupon: data.coupon }
}

function generateCouponCode() {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `TRIPBITE-${suffix}`
}

export function getStampGoal() {
  return STAMP_GOAL
}

export async function getStamps(storeId: string, uid: string): Promise<StampEntry[]> {
  const visitor = await readVisitor(storeId, uid)
  return visitor.stamps
}

export async function getCoupon(storeId: string, uid: string): Promise<Coupon | undefined> {
  const visitor = await readVisitor(storeId, uid)
  return visitor.coupon
}

export async function addStamp(
  storeId: string,
  uid: string,
  spot: TourSpot,
): Promise<{ stamps: StampEntry[]; isNew: boolean; coupon?: Coupon }> {
  const visitor = await readVisitor(storeId, uid)

  if (visitor.stamps.some((s) => s.spotId === spot.id)) {
    return { stamps: visitor.stamps, isNew: false, coupon: visitor.coupon }
  }

  const nextStamps = [...visitor.stamps, { spotId: spot.id, spotTitle: spot.title, visitedAt: Date.now() }]
  let coupon = visitor.coupon

  if (nextStamps.length >= STAMP_GOAL && !coupon) {
    coupon = {
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
    trackEvent(storeId, 'stamp_completed')
    trackEvent(storeId, 'coupon_issued')
  }

  await setDoc(visitorRef(storeId, uid), { stamps: nextStamps, coupon: coupon ?? null }, { merge: true })

  return { stamps: nextStamps, isNew: true, coupon }
}

export async function redeemCoupon(storeId: string, uid: string): Promise<Coupon | undefined> {
  const visitor = await readVisitor(storeId, uid)
  if (!visitor.coupon || visitor.coupon.used) return visitor.coupon

  const updated: Coupon = { ...visitor.coupon, used: true, usedAt: Date.now() }
  await setDoc(visitorRef(storeId, uid), { coupon: updated }, { merge: true })
  trackEvent(storeId, 'coupon_used')
  return updated
}
