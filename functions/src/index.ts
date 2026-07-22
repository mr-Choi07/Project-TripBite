import { randomBytes, createHash } from 'node:crypto'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

if (getApps().length === 0) initializeApp()

/** How long a login session counts as "2FA-fresh" before Firestore rules and
 * translateFields require another OTP (typed or silently re-confirmed via a
 * trusted device). Set via a custom claim at verification time, not at token
 * refresh, so it doesn't silently extend itself just because the SDK
 * refreshes the underlying ID token every hour. */
const OTP_SESSION_TTL_MS = 24 * 60 * 60 * 1000

/**
 * `otpVerifiedAt` is a claim on the *account*, not the current sign-in — it
 * doesn't automatically clear just because a new sign-in happens (possibly
 * from an untrusted device/attacker with a stolen password). Without the
 * `auth_time` check below, that stale claim would still read as "fresh" for
 * up to 24h and let a brand-new, never-verified sign-in through on its own.
 * `auth_time` is a standard token claim marking when *this* sign-in actually
 * happened (unlike `iat`, it doesn't advance on silent hourly token
 * refreshes), so requiring `otpVerifiedAt >= auth_time` forces every new
 * sign-in to pass OTP or trusted-device verification again before it
 * inherits an old session's freshness.
 */
function hasFreshOtpSession(request: CallableRequest): boolean {
  const token = request.auth?.token
  const otpVerifiedAt = token?.otpVerifiedAt
  const authTimeMs = typeof token?.auth_time === 'number' ? token.auth_time * 1000 : null
  return (
    typeof otpVerifiedAt === 'number' &&
    authTimeMs !== null &&
    otpVerifiedAt >= authTimeMs &&
    Date.now() - otpVerifiedAt < OTP_SESSION_TTL_MS
  )
}

const deeplApiKey = defineSecret('DEEPL_API_KEY')
const ntsApiKey = defineSecret('NTS_API_KEY')
const vworldApiKey = defineSecret('VWORLD_API_KEY')

const MAX_FIELDS = 20
const MAX_FIELD_LENGTH = 3000
const TRANSLATE_RATE_LIMIT_PER_HOUR = 30
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

/** Best-effort per-key throttle (e.g. one owner's translate or OTP requests)
 * so a compromised or scripted client can't run up usage/cost on this
 * project. Firestore transaction keeps it correct under concurrent calls;
 * failing "open" (allow) on a Firestore hiccup so a backend blip never
 * blocks a legitimate request. */
async function checkRateLimit(key: string, limitPerHour: number): Promise<void> {
  const db = getFirestore()
  const ref = db.collection('rateLimits').doc(key)

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const now = Date.now()
      const data = snap.data() as { windowStart?: number; count?: number } | undefined

      if (!data || !data.windowStart || now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
        tx.set(ref, { windowStart: now, count: 1, updatedAt: FieldValue.serverTimestamp() })
        return
      }

      if (data.count! >= limitPerHour) {
        throw new HttpsError('resource-exhausted', '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.')
      }

      tx.update(ref, { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() })
    })
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error(`[rateLimit:${key}] check failed, allowing request`, err)
  }
}

function requireNonAnonymousAuth(request: { auth?: { token: { firebase?: { sign_in_provider?: string } } } | null }) {
  if (!request.auth || request.auth.token.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('permission-denied', 'Only signed-in accounts can do this.')
  }
}

/** TripBite's app-side Lang codes that DeepL can translate into, mapped to
 * DeepL's own target_lang codes. `ko` is always the source and never a
 * target here. */
const DEEPL_TARGET_LANG = {
  en: 'EN-US',
  ja: 'JA',
  zh: 'ZH',
  fr: 'FR',
  es: 'ES',
} as const

type TargetLang = keyof typeof DEEPL_TARGET_LANG

interface TranslateFieldsRequest {
  /** Field name -> Korean source text, e.g. { name: '핑크 알로하', description: '...' } */
  fields: Record<string, string>
  /** Which languages to translate into. Defaults to all supported targets. */
  targetLangs?: TargetLang[]
}

interface DeepLResponse {
  translations: { text: string }[]
}

/**
 * Callable Cloud Function: takes Korean field values and returns a draft
 * translation for each requested language via DeepL. Restricted to signed-in
 * store owners (non-anonymous accounts) since it costs DeepL usage per call.
 *
 * Until the DEEPL_API_KEY secret is set (`firebase functions:secrets:set
 * DEEPL_API_KEY`), this throws `failed-precondition` — callers should catch
 * that and fall back to manual multi-language entry rather than failing the
 * whole save.
 */
export const translateFields = onCall<TranslateFieldsRequest>(
  { secrets: [deeplApiKey], region: 'asia-northeast3' },
  async (request) => {
    requireNonAnonymousAuth(request)
    if (!hasFreshOtpSession(request)) {
      throw new HttpsError('permission-denied', 'Please verify your phone number before requesting translations.')
    }

    const apiKey = deeplApiKey.value()
    if (!apiKey) {
      throw new HttpsError(
        'failed-precondition',
        'DEEPL_API_KEY secret is not configured yet. Run `firebase functions:secrets:set DEEPL_API_KEY` and redeploy.',
      )
    }

    const fields = request.data?.fields ?? {}
    const entries = Object.entries(fields)
    if (entries.length === 0) {
      throw new HttpsError('invalid-argument', 'fields must contain at least one { key: koreanText } entry.')
    }
    if (entries.length > MAX_FIELDS) {
      throw new HttpsError('invalid-argument', `Too many fields (max ${MAX_FIELDS}).`)
    }
    for (const [key, value] of entries) {
      if (typeof value !== 'string' || value.length > MAX_FIELD_LENGTH) {
        throw new HttpsError('invalid-argument', `Field "${key}" must be a string of at most ${MAX_FIELD_LENGTH} characters.`)
      }
    }

    await checkRateLimit(`translateFields_${request.auth!.uid}`, TRANSLATE_RATE_LIMIT_PER_HOUR)

    const targetLangs = request.data?.targetLangs?.length
      ? request.data.targetLangs
      : (Object.keys(DEEPL_TARGET_LANG) as TargetLang[])

    const translations: Partial<Record<TargetLang, Record<string, string>>> = {}

    for (const lang of targetLangs) {
      const deeplLang = DEEPL_TARGET_LANG[lang]
      if (!deeplLang) continue

      const res = await fetch('https://api-free.deepl.com/v2/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `DeepL-Auth-Key ${apiKey}`,
        },
        body: JSON.stringify({
          text: entries.map(([, value]) => value),
          source_lang: 'KO',
          target_lang: deeplLang,
        }),
      })

      if (!res.ok) {
        throw new HttpsError('internal', `DeepL request failed for ${lang}: ${res.status} ${await res.text()}`)
      }

      const json = (await res.json()) as DeepLResponse
      translations[lang] = Object.fromEntries(entries.map(([key], i) => [key, json.translations[i]?.text ?? '']))
    }

    return { translations }
  },
)

// ---------------------------------------------------------------------------
// Phone 2FA session: the actual SMS code send/verify is handled entirely by
// Firebase Auth's native Phone Auth on the client (linkWithPhoneNumber /
// reauthenticateWithPhoneNumber + ConfirmationResult.confirm) — Firebase
// generates and checks the code itself, so there's no custom code storage
// here. This function only runs *after* that succeeds, to mark the session
// 2FA-fresh and optionally issue a trusted-device token, the same way the
// old email-OTP flow used to.
// ---------------------------------------------------------------------------

const DEVICE_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000
const DEVICE_VERIFY_RATE_LIMIT_PER_HOUR = 60
const MARK_PHONE_VERIFIED_RATE_LIMIT_PER_HOUR = 20

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/** Marks this login session as having passed 2FA — set fresh on every
 * successful phone verification *and* every successful silent trusted-device
 * check, so both paths reset the same session clock that Firestore rules and
 * translateFields read via `hasFreshOtpSession`. Merges into any existing
 * custom claims rather than replacing them, since `setCustomUserClaims`
 * otherwise overwrites the whole claims object. */
async function markOtpSessionVerified(uid: string): Promise<void> {
  const user = await getAuth().getUser(uid)
  await getAuth().setCustomUserClaims(uid, { ...user.customClaims, otpVerifiedAt: Date.now() })
}

interface MarkPhoneVerifiedRequest {
  /** Client-generated, non-secret device identifier (persisted in
   * localStorage) — just a lookup key for the trust record created below. */
  deviceId?: string
}

/**
 * Callable Cloud Function: called right after the client successfully links
 * or re-verifies a phone credential via Firebase Auth. Trusts the ID token's
 * standard `phone_number` claim (only present once Firebase itself has
 * confirmed the SMS code) as proof, rather than re-checking a code here —
 * marks the session 2FA-fresh and, if `deviceId` is supplied, issues a
 * 90-day trusted-device token for silent re-verification next time.
 */
export const markPhoneVerified = onCall<MarkPhoneVerifiedRequest>(
  { region: 'asia-northeast3' },
  async (request) => {
    requireNonAnonymousAuth(request)
    const uid = request.auth!.uid

    if (!request.auth!.token.phone_number) {
      throw new HttpsError('failed-precondition', 'This account has no verified phone number on its current session.')
    }

    const deviceId = request.data?.deviceId
    if (deviceId && (typeof deviceId !== 'string' || deviceId.length > 100)) {
      throw new HttpsError('invalid-argument', 'deviceId is invalid.')
    }

    await checkRateLimit(`markPhoneVerified_${uid}`, MARK_PHONE_VERIFIED_RATE_LIMIT_PER_HOUR)

    await markOtpSessionVerified(uid)

    let deviceToken: string | undefined
    if (deviceId) {
      deviceToken = randomBytes(32).toString('hex')
      await getFirestore()
        .collection('trustedDevices')
        .doc(uid)
        .collection('devices')
        .doc(deviceId)
        .set({
          tokenHash: sha256(deviceToken),
          createdAt: FieldValue.serverTimestamp(),
          lastUsedAt: FieldValue.serverTimestamp(),
          expiresAt: Date.now() + DEVICE_TOKEN_TTL_MS,
        })
    }

    return { verified: true, deviceToken }
  },
)

interface VerifyTrustedDeviceRequest {
  deviceId: string
  token: string
}

/**
 * Callable Cloud Function: silently re-passes 2FA for a browser that already
 * holds a valid trusted-device token from a previous `verifyOtpCode` call —
 * called right after password sign-in, before showing the OTP screen, so a
 * recognized device never has to type a code again (until the 90-day trust
 * window lapses or the token is revoked/rotated).
 */
export const verifyTrustedDevice = onCall<VerifyTrustedDeviceRequest>(
  { region: 'asia-northeast3' },
  async (request) => {
    requireNonAnonymousAuth(request)
    const uid = request.auth!.uid

    const { deviceId, token } = request.data ?? {}
    if (!deviceId || !token || typeof deviceId !== 'string' || typeof token !== 'string') {
      throw new HttpsError('invalid-argument', 'deviceId and token are required.')
    }

    await checkRateLimit(`verifyTrustedDevice_${uid}`, DEVICE_VERIFY_RATE_LIMIT_PER_HOUR)

    const ref = getFirestore().collection('trustedDevices').doc(uid).collection('devices').doc(deviceId)
    const snap = await ref.get()
    if (!snap.exists) {
      throw new HttpsError('permission-denied', 'This device is not trusted.')
    }

    const data = snap.data() as { tokenHash: string; expiresAt: number }
    if (Date.now() > data.expiresAt) {
      await ref.delete()
      throw new HttpsError('permission-denied', 'This device is no longer trusted. Please verify again.')
    }
    if (sha256(token) !== data.tokenHash) {
      // Token mismatch for a known deviceId is suspicious (stolen/guessed
      // token) rather than routine expiry — revoke the record instead of
      // just failing, so a stolen token can't keep being retried.
      await ref.delete()
      throw new HttpsError('permission-denied', 'This device is not trusted.')
    }

    // Sliding window: a device in active use stays trusted rather than
    // expiring exactly 90 days after its first verification.
    await ref.update({ lastUsedAt: FieldValue.serverTimestamp(), expiresAt: Date.now() + DEVICE_TOKEN_TTL_MS })
    await markOtpSessionVerified(uid)

    return { trusted: true }
  },
)

// ---------------------------------------------------------------------------
// Business registration verification (국세청 사업자등록정보 진위확인 및
// 상태조회 서비스): before a store can be created, confirm the business
// registration number actually belongs to the named representative as of
// the given opening date, and that the business isn't closed/suspended —
// so a made-up or someone-else's business number can't be used to register
// a storefront.
// ---------------------------------------------------------------------------

const BUSINESS_VERIFY_RATE_LIMIT_PER_HOUR = 10

interface VerifyBusinessRegistrationRequest {
  businessNumber: string
  representativeName: string
  /** 개업일자, YYYYMMDD */
  openDate: string
}

interface NtsValidateResponse {
  data?: {
    b_no: string
    valid: string
    valid_msg?: string
    status?: { b_stt?: string; b_stt_cd?: string }
  }[]
}

/**
 * Callable Cloud Function: checks a 사업자등록번호 + 대표자성명 + 개업일자
 * against the NTS 진위확인 API. Until the NTS_API_KEY secret is set (get one
 * free at data.go.kr — "국세청_사업자등록정보 진위확인 및 상태조회 서비스"),
 * this throws `failed-precondition`.
 */
export const verifyBusinessRegistration = onCall<VerifyBusinessRegistrationRequest>(
  { secrets: [ntsApiKey], region: 'asia-northeast3' },
  async (request) => {
    requireNonAnonymousAuth(request)
    if (!hasFreshOtpSession(request)) {
      throw new HttpsError('permission-denied', 'Please verify your phone number before registering a store.')
    }

    const businessNumber = (request.data?.businessNumber ?? '').replace(/\D/g, '')
    const representativeName = (request.data?.representativeName ?? '').trim()
    const openDate = (request.data?.openDate ?? '').replace(/\D/g, '')

    if (!/^\d{10}$/.test(businessNumber)) {
      throw new HttpsError('invalid-argument', '사업자등록번호는 숫자 10자리여야 합니다.')
    }
    if (!representativeName || representativeName.length > 50) {
      throw new HttpsError('invalid-argument', '대표자성명을 입력해주세요.')
    }
    if (!/^\d{8}$/.test(openDate)) {
      throw new HttpsError('invalid-argument', '개업일자는 YYYYMMDD 형식 8자리여야 합니다.')
    }

    await checkRateLimit(`verifyBusinessRegistration_${request.auth!.uid}`, BUSINESS_VERIFY_RATE_LIMIT_PER_HOUR)

    const apiKey = ntsApiKey.value()
    if (!apiKey) {
      throw new HttpsError(
        'failed-precondition',
        'NTS_API_KEY secret is not configured yet. Run `firebase functions:secrets:set NTS_API_KEY` and redeploy.',
      )
    }

    const res = await fetch(`https://api.odcloud.kr/api/nts-businessman/v1/validate?serviceKey=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businesses: [
          {
            b_no: businessNumber,
            start_dt: openDate,
            p_nm: representativeName,
            p_nm2: '',
            b_nm: '',
            corp_no: '',
            b_sector: '',
            b_type: '',
            b_adr: '',
          },
        ],
      }),
    })

    if (!res.ok) {
      throw new HttpsError('internal', `NTS API request failed: ${res.status} ${await res.text()}`)
    }

    const json = (await res.json()) as NtsValidateResponse
    const result = json.data?.[0]

    if (!result || result.valid !== '01') {
      throw new HttpsError(
        'failed-precondition',
        result?.valid_msg || '사업자등록정보를 확인할 수 없습니다. 사업자등록번호·대표자성명·개업일자를 다시 확인해주세요.',
      )
    }

    const status = result.status?.b_stt
    if (status && status !== '계속사업자') {
      throw new HttpsError('failed-precondition', `현재 정상 영업 중인 사업자가 아닙니다 (${status}).`)
    }

    return { verified: true }
  },
)

// ---------------------------------------------------------------------------
// Address geocoding (국토교통부_지오코더 API via VWorld): converts a store's
// street address into lat/lng so the owner doesn't have to look up and type
// coordinates by hand when registering a store.
// ---------------------------------------------------------------------------

const GEOCODE_RATE_LIMIT_PER_HOUR = 30

interface GeocodeAddressRequest {
  address: string
}

interface VWorldGeocodeResponse {
  response?: {
    status?: string
    result?: { point?: { x?: string; y?: string } }
  }
}

async function vworldGeocode(address: string, type: 'ROAD' | 'PARCEL', apiKey: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://api.vworld.kr/req/address?service=address&request=GetCoord&version=2.0&format=json&type=${type}&address=${encodeURIComponent(address)}&key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url)
  if (!res.ok) return null

  const json = (await res.json()) as VWorldGeocodeResponse
  const point = json.response?.result?.point
  if (json.response?.status !== 'OK' || !point?.x || !point?.y) return null

  return { lat: Number(point.y), lng: Number(point.x) }
}

/**
 * Callable Cloud Function: looks up lat/lng for a Korean street address via
 * VWorld's geocoder. Tries road-name address format first, then falls back
 * to the older parcel/지번 format, since owners may type either. Until the
 * VWORLD_API_KEY secret is set (`firebase functions:secrets:set
 * VWORLD_API_KEY`), this throws `failed-precondition`.
 */
export const geocodeAddress = onCall<GeocodeAddressRequest>(
  { secrets: [vworldApiKey], region: 'asia-northeast3' },
  async (request) => {
    requireNonAnonymousAuth(request)
    if (!hasFreshOtpSession(request)) {
      throw new HttpsError('permission-denied', 'Please verify your phone number before looking up coordinates.')
    }

    const address = (request.data?.address ?? '').trim()
    if (!address || address.length > 300) {
      throw new HttpsError('invalid-argument', '주소를 입력해주세요.')
    }

    await checkRateLimit(`geocodeAddress_${request.auth!.uid}`, GEOCODE_RATE_LIMIT_PER_HOUR)

    const apiKey = vworldApiKey.value()
    if (!apiKey) {
      throw new HttpsError(
        'failed-precondition',
        'VWORLD_API_KEY secret is not configured yet. Run `firebase functions:secrets:set VWORLD_API_KEY` and redeploy.',
      )
    }

    const result = (await vworldGeocode(address, 'ROAD', apiKey)) ?? (await vworldGeocode(address, 'PARCEL', apiKey))
    if (!result) {
      throw new HttpsError('failed-precondition', '주소로 좌표를 찾을 수 없습니다. 주소를 다시 확인해주세요.')
    }

    return result
  },
)

// ---------------------------------------------------------------------------
// Account management: store deletion and account deletion are irreversible,
// so both require a fresh phone-verified session (same bar as store writes)
// and are only ever done server-side — Firestore rules already hard-deny
// client deletes on `stores/{storeId}` (`allow delete: if false`), so this
// Admin-SDK path is the only way either can happen at all.
// ---------------------------------------------------------------------------

interface DeleteStoreRequest {
  storeId: string
}

/**
 * Callable Cloud Function: permanently deletes a store and everything under
 * it (menu, orders, events, visitors — via Firestore's recursive delete),
 * after confirming the caller actually owns it. There is no undo, and no
 * soft-delete/deactivate path — once called, the storeId and all its order
 * history are gone.
 */
export const deleteStore = onCall<DeleteStoreRequest>({ region: 'asia-northeast3' }, async (request) => {
  requireNonAnonymousAuth(request)
  if (!hasFreshOtpSession(request)) {
    throw new HttpsError('permission-denied', 'Please verify your phone number before deleting a store.')
  }

  const storeId = request.data?.storeId
  if (!storeId || typeof storeId !== 'string') {
    throw new HttpsError('invalid-argument', 'storeId is required.')
  }

  const db = getFirestore()
  const storeRef = db.collection('stores').doc(storeId)
  const snap = await storeRef.get()
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Store not found.')
  }
  if (snap.data()?.ownerUid !== request.auth!.uid) {
    throw new HttpsError('permission-denied', 'You do not own this store.')
  }

  await db.recursiveDelete(storeRef)

  return { deleted: true }
})

/**
 * Callable Cloud Function: permanently deletes the caller's own owner
 * account. Refuses if the account still owns a store — the owner must
 * delete (or transfer) that first via `deleteStore`, so a store never ends
 * up orphaned with a `ownerUid` that no longer exists.
 */
export const deleteOwnerAccount = onCall({ region: 'asia-northeast3' }, async (request) => {
  requireNonAnonymousAuth(request)
  if (!hasFreshOtpSession(request)) {
    throw new HttpsError('permission-denied', 'Please verify your phone number before deleting your account.')
  }

  const uid = request.auth!.uid
  const db = getFirestore()

  const ownedStores = await db.collection('stores').where('ownerUid', '==', uid).limit(1).get()
  if (!ownedStores.empty) {
    throw new HttpsError('failed-precondition', '먼저 등록된 가게를 삭제해주세요.')
  }

  await getAuth().deleteUser(uid)

  return { deleted: true }
})

// ---------------------------------------------------------------------------
// Order submission: moved server-side (rather than a direct client Firestore
// write) specifically to rate-limit it. Firestore rules alone can validate
// shape but can't throttle *how many* writes happen — an anonymous visitor
// session costs nothing to create, so without a rate limit a scripted client
// could flood a store's order list with junk orders for free.
// ---------------------------------------------------------------------------

const SUBMIT_ORDER_RATE_LIMIT_PER_HOUR = 20
const ORDER_LANGS = ['ko', 'en', 'ja', 'zh', 'fr', 'es']
/** Generous enough to absorb typical phone-GPS drift (often 20-100m indoors)
 * without letting someone order from clearly outside the store. */
const MAX_ORDER_DISTANCE_M = 300

interface SubmitOrderLine {
  itemId: string
  name: Record<string, string>
  price: number
  qty: number
}

interface SubmitOrderRequest {
  storeId: string
  lines: SubmitOrderLine[]
  total: number
  lang: string
  lat: number
  lng: number
}

function isValidOrderLine(line: unknown): line is SubmitOrderLine {
  if (typeof line !== 'object' || line === null) return false
  const l = line as Record<string, unknown>
  return (
    typeof l.itemId === 'string' &&
    l.itemId.length <= 100 &&
    typeof l.name === 'object' &&
    l.name !== null &&
    typeof l.price === 'number' &&
    l.price >= 0 &&
    l.price <= 10_000_000 &&
    typeof l.qty === 'number' &&
    l.qty >= 1 &&
    l.qty <= 100
  )
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Assigns the next daily queue number for a store (resets each day) via a
 * transaction on a small counter doc, so concurrent orders never collide on
 * the same number — this is what lets the owner say "3번 고객님" instead of
 * having to identify orders by a random Firestore doc id. */
async function nextDailyOrderNumber(storeId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  const counterRef = getFirestore().collection('stores').doc(storeId).collection('counters').doc(today)

  return getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(counterRef)
    const next = ((snap.data()?.count as number | undefined) ?? 0) + 1
    tx.set(counterRef, { count: next }, { merge: true })
    return next
  })
}

/**
 * Callable Cloud Function: places an order for a store on behalf of the
 * (usually anonymous) visitor session calling it. Rate-limited per uid so a
 * scripted client can't spam a store's order list for free — a real visitor
 * placing more than 20 orders in an hour is not a case this app needs to
 * support. Also rejects orders placed from clearly outside the store (see
 * `lat`/`lng`), so it isn't trivial to place a "joke" order from across town.
 */
export const submitOrder = onCall<SubmitOrderRequest>({ region: 'asia-northeast3' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('permission-denied', 'Sign-in is required to place an order.')
  }

  const storeId = request.data?.storeId
  const lines = request.data?.lines
  const total = request.data?.total
  const lang = request.data?.lang
  const lat = request.data?.lat
  const lng = request.data?.lng

  if (!storeId || typeof storeId !== 'string' || storeId.length > 100) {
    throw new HttpsError('invalid-argument', 'storeId is required.')
  }
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 50 || !lines.every(isValidOrderLine)) {
    throw new HttpsError('invalid-argument', 'lines is invalid.')
  }
  if (typeof total !== 'number' || total < 0 || total > 100_000_000) {
    throw new HttpsError('invalid-argument', 'total is invalid.')
  }
  if (typeof lang !== 'string' || !ORDER_LANGS.includes(lang)) {
    throw new HttpsError('invalid-argument', 'lang is invalid.')
  }
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new HttpsError('invalid-argument', '위치 정보가 필요합니다.')
  }

  await checkRateLimit(`submitOrder_${request.auth.uid}`, SUBMIT_ORDER_RATE_LIMIT_PER_HOUR)

  // The bundled demo store (sunrise-bowl) may have no Firestore doc at all
  // (the client falls back to seed data for it) — skip the distance check
  // rather than reject the order outright when there's no registered
  // location to check against.
  const storeSnap = await getFirestore().collection('stores').doc(storeId).get()
  if (storeSnap.exists) {
    const storeData = storeSnap.data() as { lat: number; lng: number }
    const distanceM = haversineM(lat, lng, storeData.lat, storeData.lng)
    if (distanceM > MAX_ORDER_DISTANCE_M) {
      throw new HttpsError('failed-precondition', '매장 근처에서만 주문할 수 있어요.')
    }
  }

  const orderNumber = await nextDailyOrderNumber(storeId)

  const ref = await getFirestore()
    .collection('stores')
    .doc(storeId)
    .collection('orders')
    .add({
      storeId,
      orderNumber,
      lines,
      total,
      status: 'placed',
      lang,
      createdAt: FieldValue.serverTimestamp(),
    })

  return { orderId: ref.id, orderNumber }
})
