export type Lang = 'ko' | 'en' | 'ja' | 'zh'

export type LocalizedText = Record<Lang, string>

export type Allergen = 'seafood' | 'shellfish' | 'nuts' | 'dairy' | 'egg' | 'gluten' | 'pork'

export type DietTag = 'vegan' | 'vegetarian' | 'halal' | 'gluten-free'

export type MenuCategory = 'bowl'

export interface MenuItem {
  id: string
  category: MenuCategory
  name: LocalizedText
  description: LocalizedText
  ingredients: Record<Lang, string[]>
  price: number
  image: string
  tags: DietTag[]
  allergens: Allergen[]
  spicyLevel: 0 | 1 | 2 | 3
  calorie: 'light' | 'regular' | 'hearty'
  signature?: boolean
}

export interface StorePlace {
  storeId: string
  campaignId: string
  name: LocalizedText
  areaName: LocalizedText
  address: string
  lat: number
  lng: number
  heroImage: string
  logoImage: string
  hours: string
  phone: string
  tagline: LocalizedText
}

export interface QrPayload {
  storeId: string
  lat: number
  lng: number
  lang: Lang
  campaignId: string
}

/** Mirrors Korea Tourism Organization TourAPI4.0 field names so the adapter
 *  can swap mock -> live data without changing consumer shape. */
export interface TourApiItem {
  contentid: string
  contenttypeid: TourContentTypeId
  title: string
  addr1: string
  mapx: number
  mapy: number
  firstimage: string
  tel: string
  dist: number
}

export type TourContentTypeId = '12' | '15' | '32' | '38' | '39'

export type TourCategory = 'attraction' | 'festival' | 'stay' | 'shopping' | 'restaurant'

export interface TourSpot {
  id: string
  category: TourCategory
  title: LocalizedText
  addr: string
  lat: number
  lng: number
  image: string
  tel: string
  distanceM: number
  crowd: 'low' | 'medium' | 'high'
  interestTags: string[]
  dwellMinutes: number
  eventDate?: string
}

export type TourApiSource = 'live' | 'mock'

export interface TourApiResult {
  spots: TourSpot[]
  source: TourApiSource
}

export type CourseDuration = 30 | 60 | 120

export interface CourseStop {
  spot: TourSpot
  order: number
  travelMinutesFromPrev: number
  travelDistanceFromPrevM: number
  arrivalMinuteOffset: number
  reasons: ReasonTag[]
}

export interface ReasonTag {
  kind: 'distance' | 'weather' | 'crowd' | 'interest' | 'dwell'
  text: LocalizedText
}

export interface WeatherContext {
  tempC: number
  condition: 'sunny' | 'cloudy' | 'rainy'
  crowd: 'low' | 'medium' | 'high'
}

export interface Course {
  duration: CourseDuration
  stops: CourseStop[]
  totalMinutes: number
  totalDistanceM: number
}

export interface CartLine {
  item: MenuItem
  qty: number
}

export interface MenuFilterInput {
  allergies: Allergen[]
  vegan: boolean
  halal: boolean
  light: boolean
  rawText?: string
}

export interface MenuRecommendation {
  item: MenuItem
  reason: LocalizedText
}

export interface MenuAdviceResult {
  recommended: MenuRecommendation[]
  avoid: MenuRecommendation[]
  detectedLang?: Lang
}

export interface StampEntry {
  spotId: string
  spotTitle: LocalizedText
  visitedAt: number
}

export interface Coupon {
  code: string
  issuedAt: number
  used: boolean
  usedAt?: number
  discountLabel: LocalizedText
}

export interface AnalyticsCounters {
  qrScans: number
  courseClicks: number
  stampCompletions: number
  couponIssued: number
  couponUsed: number
  languageCounts: Record<Lang, number>
  coursePopularity: Record<CourseDuration, number>
}
