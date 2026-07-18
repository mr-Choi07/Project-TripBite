import type { TourApiResult, TourCategory, TourContentTypeId, TourSpot } from '../types'
import { MOCK_TOUR_SPOTS } from '../data/attractions'

/**
 * Adapter around the Korea Tourism Organization TourAPI4.0
 * `locationBasedList2` endpoint. Any deployment without a
 * `VITE_TOUR_API_KEY` (or with a failed request) transparently falls back
 * to curated mock data shaped like the real response, so the rest of the
 * app never has to know which source served a given spot.
 */

const TOUR_API_BASE = 'https://apis.data.go.kr/B551011/KorService2'

const CONTENT_TYPE_BY_CATEGORY: Record<TourCategory, TourContentTypeId> = {
  attraction: '12',
  festival: '15',
  stay: '32',
  restaurant: '39',
}

interface FetchNearbyParams {
  lat: number
  lng: number
  radiusM?: number
  categories?: TourCategory[]
}

function getApiKey(): string | undefined {
  return import.meta.env.VITE_TOUR_API_KEY as string | undefined
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function fetchLiveCategory(
  category: TourCategory,
  lat: number,
  lng: number,
  radiusM: number,
  apiKey: string,
): Promise<TourSpot[]> {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    numOfRows: '10',
    pageNo: '1',
    MobileOS: 'ETC',
    MobileApp: 'TripBite',
    _type: 'json',
    arrange: 'E',
    contentTypeId: CONTENT_TYPE_BY_CATEGORY[category],
    mapX: String(lng),
    mapY: String(lat),
    radius: String(radiusM),
  })

  const res = await fetch(`${TOUR_API_BASE}/locationBasedList2?${params.toString()}`)
  if (!res.ok) throw new Error(`TourAPI ${category} request failed: ${res.status}`)

  const json = await res.json()
  // data.go.kr returns HTTP 200 even on key/parameter errors — the real
  // status is resultCode inside the body ("0000" is success).
  const resultCode = json?.response?.header?.resultCode ?? json?.resultCode
  if (resultCode && resultCode !== '0000') {
    const resultMsg = json?.response?.header?.resultMsg ?? json?.resultMsg
    throw new Error(`TourAPI ${category} error ${resultCode}: ${resultMsg}`)
  }

  const items = json?.response?.body?.items?.item ?? []
  const list = Array.isArray(items) ? items : [items]

  return list.map((raw: Record<string, unknown>): TourSpot => {
    const itemLat = Number(raw.mapy)
    const itemLng = Number(raw.mapx)
    const title = String(raw.title ?? '')
    return {
      id: String(raw.contentid ?? crypto.randomUUID()),
      category,
      title: { ko: title, en: title, ja: title, zh: title },
      addr: String(raw.addr1 ?? ''),
      lat: itemLat,
      lng: itemLng,
      image: String(raw.firstimage ?? ''),
      tel: String(raw.tel ?? ''),
      distanceM: Math.round(haversineM(lat, lng, itemLat, itemLng)),
      crowd: 'medium',
      interestTags: [],
      dwellMinutes: category === 'festival' ? 30 : category === 'restaurant' ? 25 : 20,
    }
  })
}

function mockForCategories(categories: TourCategory[]): TourSpot[] {
  return MOCK_TOUR_SPOTS.filter((spot) => categories.includes(spot.category)).sort(
    (a, b) => a.distanceM - b.distanceM,
  )
}

export async function fetchNearbySpots({
  lat,
  lng,
  radiusM = 3000,
  categories = ['attraction', 'festival', 'stay', 'restaurant'],
}: FetchNearbyParams): Promise<TourApiResult> {
  const apiKey = getApiKey()

  if (!apiKey) {
    return { spots: mockForCategories(categories), source: 'mock' }
  }

  try {
    const results = await Promise.all(
      categories.map((category) => fetchLiveCategory(category, lat, lng, radiusM, apiKey)),
    )
    const spots = results.flat().sort((a, b) => a.distanceM - b.distanceM)
    if (spots.length === 0) throw new Error('TourAPI returned no spots')
    return { spots, source: 'live' }
  } catch (err) {
    console.warn('[tourApi] live TourAPI request failed, falling back to mock data:', err)
    return { spots: mockForCategories(categories), source: 'mock' }
  }
}
