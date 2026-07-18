import type { Lang, QrPayload } from '../types'
import { SUNRISE_BOWL } from '../data/place'

/** A real deployment would encode this query string into the printed QR
 * at the table. Scanning it (or the simulated scan on the entry screen)
 * carries the store, geolocation, language and campaign straight into the app. */
export function buildQrUrl(payload: QrPayload): string {
  const params = new URLSearchParams({
    store: payload.storeId,
    lat: String(payload.lat),
    lng: String(payload.lng),
    lang: payload.lang,
    campaign: payload.campaignId,
  })
  return `https://tripbite.app/enter?${params.toString()}`
}

export function parseQrUrl(raw: string): QrPayload | null {
  try {
    const url = new URL(raw)
    const lang = url.searchParams.get('lang')
    const storeId = url.searchParams.get('store')
    const lat = Number(url.searchParams.get('lat'))
    const lng = Number(url.searchParams.get('lng'))
    const campaignId = url.searchParams.get('campaign')
    if (!storeId || !campaignId || Number.isNaN(lat) || Number.isNaN(lng)) return null
    const validLang: Lang = lang === 'ko' || lang === 'en' || lang === 'ja' || lang === 'zh' ? lang : 'en'
    return { storeId, lat, lng, lang: validLang, campaignId }
  } catch {
    return null
  }
}

export function demoQrPayload(lang: Lang = 'ja'): QrPayload {
  return {
    storeId: SUNRISE_BOWL.storeId,
    lat: SUNRISE_BOWL.lat,
    lng: SUNRISE_BOWL.lng,
    lang,
    campaignId: SUNRISE_BOWL.campaignId,
  }
}
