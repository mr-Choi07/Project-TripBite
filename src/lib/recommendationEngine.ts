import dict from '../i18n/translations'
import type {
  Allergen,
  Course,
  CourseDuration,
  CourseStop,
  Lang,
  LocalizedText,
  MenuAdviceResult,
  MenuFilterInput,
  MenuItem,
  MenuRecommendation,
  ReasonTag,
  TourSpot,
  WeatherContext,
} from '../types'

// ---------------------------------------------------------------------------
// AI menu advisor: keyword intent parsing + allergy/diet-aware filtering
// ---------------------------------------------------------------------------

const ALLERGY_KEYWORDS: Record<Allergen, string[]> = {
  seafood: ['해산물', 'seafood', 'fish', '魚介', '魚介類', '海鲜'],
  shellfish: ['갑각류', '조개', 'shellfish', '甲殻類', '貝', '甲壳'],
  nuts: ['견과', 'nut', 'ナッツ', '坚果'],
  dairy: ['유제품', '우유', 'dairy', 'milk', '乳製品', '乳制品'],
  egg: ['계란', '달걀', 'egg', '卵', '鸡蛋'],
  gluten: ['글루텐', '밀가루', 'gluten', 'wheat', 'グルテン', '麸质'],
  pork: ['돼지', 'pork', '豚肉', '猪肉'],
}

const VEGAN_KEYWORDS = ['비건', 'vegan', 'ビーガン', '纯素', '素食']
const HALAL_KEYWORDS = ['할랄', 'halal', 'ハラール', '清真']
const LIGHT_KEYWORDS = ['가벼운', '가볍게', 'light', '軽め', '軽い', '清淡']

const LANG_SWITCH_KEYWORDS: Record<Lang, string[]> = {
  ko: ['한국어로', '한국말로'],
  en: ['in english', 'english please'],
  ja: ['일본어로', 'japanese please', '日本語で', '日本語'],
  zh: ['중국어로', 'chinese please', '中文', '用中文'],
  fr: ['프랑스어로', 'french please', 'en français', 'français'],
  es: ['스페인어로', 'spanish please', 'en español', 'español'],
}

export function parseMenuIntent(rawText: string): Partial<MenuFilterInput> & { detectedLang?: Lang } {
  const text = rawText.toLowerCase()
  const allergies: Allergen[] = []

  for (const [allergen, keywords] of Object.entries(ALLERGY_KEYWORDS) as [Allergen, string[]][]) {
    if (keywords.some((kw) => text.includes(kw.toLowerCase()))) allergies.push(allergen)
  }

  const vegan = VEGAN_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()))
  const halal = HALAL_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()))
  const light = LIGHT_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()))

  let detectedLang: Lang | undefined
  for (const [lang, keywords] of Object.entries(LANG_SWITCH_KEYWORDS) as [Lang, string[]][]) {
    if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      detectedLang = lang
      break
    }
  }

  return { allergies, vegan, halal, light, detectedLang }
}

function allergenLabel(lang: Lang, allergen: Allergen): string {
  const key = `allergen${allergen.charAt(0).toUpperCase()}${allergen.slice(1)}` as keyof typeof dict.ko
  return dict[lang][key] as string
}

function buildLocalized(build: (lang: Lang) => string): LocalizedText {
  return { ko: build('ko'), en: build('en'), ja: build('ja'), zh: build('zh'), fr: build('fr'), es: build('es') }
}

export function recommendMenu(menu: MenuItem[], input: MenuFilterInput): MenuAdviceResult {
  const hasConditions = input.allergies.length > 0 || input.vegan || input.halal || input.light

  const recommended: MenuRecommendation[] = []
  const avoid: MenuRecommendation[] = []

  for (const item of menu) {
    const conflictAllergens = input.allergies.filter((a) => item.allergens.includes(a))
    const veganConflict = input.vegan && !item.tags.includes('vegan')
    const halalConflict = input.halal && !item.tags.includes('halal')

    if (conflictAllergens.length > 0 || veganConflict || halalConflict) {
      const reason = buildLocalized((lang) =>
        conflictAllergens.length > 0
          ? avoidAllergyText(lang, conflictAllergens)
          : veganConflict
          ? avoidVeganText(lang)
          : avoidHalalText(lang),
      )
      avoid.push({ item, reason })
      continue
    }

    const matchNotes: string[] = []
    if (input.allergies.length > 0) matchNotes.push('allergy-free')
    if (input.vegan && item.tags.includes('vegan')) matchNotes.push('vegan')
    if (input.halal && item.tags.includes('halal')) matchNotes.push('halal')
    if (input.light && item.calorie === 'light') matchNotes.push('light')

    if (input.light && item.calorie !== 'light') continue

    const reason = buildLocalized((lang) => matchReasonText(lang, item, input, matchNotes))
    recommended.push({ item, reason })
  }

  if (!hasConditions) {
    return {
      recommended: menu
        .filter((item) => item.signature)
        .map((item) => ({ item, reason: buildLocalized((lang) => signatureText(lang)) })),
      avoid: [],
    }
  }

  recommended.sort((a, b) => Number(b.item.signature) - Number(a.item.signature))

  return { recommended, avoid }
}

function avoidAllergyText(lang: Lang, allergens: Allergen[]) {
  const labels = allergens.map((a) => allergenLabel(lang, a)).join(', ')
  switch (lang) {
    case 'ko':
      return `${labels} 포함 — 알레르기 주의`
    case 'ja':
      return `${labels}を含む — アレルギー注意`
    case 'zh':
      return `含有${labels} — 请注意过敏`
    case 'fr':
      return `Contient ${labels} — risque d'allergie`
    case 'es':
      return `Contiene ${labels} — riesgo de alergia`
    default:
      return `Contains ${labels} — allergy risk`
  }
}
function avoidVeganText(lang: Lang) {
  switch (lang) {
    case 'ko':
      return '비건 조건에 맞지 않음'
    case 'ja':
      return 'ビーガン条件に合いません'
    case 'zh':
      return '不符合纯素需求'
    case 'fr':
      return 'Ne convient pas aux régimes végans'
    case 'es':
      return 'No apto para dietas veganas'
    default:
      return 'Not suitable for vegan diets'
  }
}
function avoidHalalText(lang: Lang) {
  switch (lang) {
    case 'ko':
      return '할랄 인증 메뉴가 아님'
    case 'ja':
      return 'ハラール認証メニューではありません'
    case 'zh':
      return '非清真认证菜品'
    case 'fr':
      return 'Pas certifié halal'
    case 'es':
      return 'No certificado halal'
    default:
      return 'Not halal-certified'
  }
}
function signatureText(lang: Lang) {
  switch (lang) {
    case 'ko':
      return '매장 시그니처 메뉴'
    case 'ja':
      return '店のシグネチャーメニュー'
    case 'zh':
      return '本店招牌菜'
    case 'fr':
      return 'Plat signature de la maison'
    case 'es':
      return 'Plato insignia de la casa'
    default:
      return 'House signature dish'
  }
}
function matchReasonText(lang: Lang, item: MenuItem, input: MenuFilterInput, notes: string[]) {
  const parts: string[] = []
  if (notes.includes('allergy-free')) {
    const labels = input.allergies.map((a) => allergenLabel(lang, a)).join(', ')
    parts.push(
      lang === 'ko'
        ? `${labels} 미포함`
        : lang === 'ja'
        ? `${labels}不使用`
        : lang === 'zh'
        ? `不含${labels}`
        : lang === 'fr'
        ? `Sans ${labels}`
        : lang === 'es'
        ? `Sin ${labels}`
        : `Free of ${labels}`,
    )
  }
  if (notes.includes('vegan')) {
    parts.push(
      lang === 'ko' ? '비건' : lang === 'ja' ? 'ビーガン対応' : lang === 'zh' ? '纯素' : lang === 'fr' ? 'Végan' : lang === 'es' ? 'Vegano' : 'Vegan',
    )
  }
  if (notes.includes('halal')) {
    parts.push(
      lang === 'ko'
        ? '할랄 인증'
        : lang === 'ja'
        ? 'ハラール認証'
        : lang === 'zh'
        ? '清真认证'
        : lang === 'fr'
        ? 'Certifié halal'
        : lang === 'es'
        ? 'Certificado halal'
        : 'Halal-certified',
    )
  }
  if (notes.includes('light')) {
    parts.push(
      lang === 'ko'
        ? '가벼운 한 끼'
        : lang === 'ja'
        ? '軽めの一食'
        : lang === 'zh'
        ? '清淡一餐'
        : lang === 'fr'
        ? 'Un repas léger'
        : lang === 'es'
        ? 'Una comida ligera'
        : 'A lighter meal',
    )
  }
  if (item.signature) {
    parts.push(signatureText(lang))
  }
  if (parts.length === 0) parts.push(signatureText(lang))
  return parts.join(' · ')
}

// ---------------------------------------------------------------------------
// Course engine: turns nearby TourAPI spots into a time-boxed walking route
// ---------------------------------------------------------------------------

const WALK_PACE_M_PER_MIN = 100
const BUDGET_TOLERANCE_MIN: Record<CourseDuration, number> = { 30: 5, 60: 10, 120: 15 }
const INTEREST_TOLERANCE_MIN = 10
const CATEGORY_CAP_PER_COURSE = 2
const COURSE_EXCLUDED_CATEGORIES = ['stay'] as const

/** Without this, a course reads as "just a string of restaurants" once
 * enough TripBite-registered stores (all category 'restaurant') get folded
 * into the spot pool alongside TourAPI data — the flat per-category cap of
 * 2 doesn't stop restaurants from being 2 of e.g. only 3 total stops. Caps
 * are tightened outside meal hours so the route actually varies with the
 * time someone is walking it, and loosened right at lunch/dinner. */
type TimeSlot = 'morning' | 'lunch' | 'afternoon' | 'dinner' | 'night'

function currentTimeSlot(): TimeSlot {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 14) return 'lunch'
  if (hour >= 14 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'dinner'
  return 'night'
}

const RESTAURANT_CAP_BY_TIME_SLOT: Record<TimeSlot, number> = {
  morning: 1,
  lunch: 2,
  afternoon: 1,
  dinner: 2,
  night: 1,
}

function categoryCapFor(category: TourSpot['category'], timeSlot: TimeSlot): number {
  if (category === 'restaurant') return RESTAURANT_CAP_BY_TIME_SLOT[timeSlot]
  return CATEGORY_CAP_PER_COURSE
}

const INTEREST_LABEL: Record<string, LocalizedText> = {
  바다: { ko: '바다', en: 'ocean views', ja: '海の景色', zh: '海景', fr: 'vue sur mer', es: 'vistas al mar' },
  산책: { ko: '산책', en: 'walking', ja: '散歩', zh: '散步', fr: 'promenade', es: 'paseo' },
  사진: { ko: '사진 명소', en: 'photo spots', ja: '写真スポット', zh: '拍照打卡', fr: 'spots photo', es: 'lugares para fotos' },
  자연: { ko: '자연', en: 'nature', ja: '自然', zh: '自然风光', fr: 'nature', es: 'naturaleza' },
  전망: { ko: '전망', en: 'scenic views', ja: '眺望', zh: '观景', fr: 'vues panoramiques', es: 'vistas panorámicas' },
  로컬맛집: { ko: '로컬 맛집', en: 'local food', ja: '地元グルメ', zh: '本地美食', fr: 'cuisine locale', es: 'comida local' },
  전통시장: { ko: '전통시장', en: 'traditional markets', ja: '伝統市場', zh: '传统市场', fr: 'marchés traditionnels', es: 'mercados tradicionales' },
  쇼핑: { ko: '쇼핑', en: 'shopping', ja: 'ショッピング', zh: '购物', fr: 'shopping', es: 'compras' },
  축제: { ko: '축제', en: 'festivals', ja: '祭り', zh: '节庆', fr: 'festivals', es: 'festivales' },
  로컬푸드: { ko: '로컬 푸드', en: 'local food', ja: 'ローカルフード', zh: '本地美食', fr: 'cuisine locale', es: 'comida local' },
  해산물: { ko: '해산물', en: 'seafood', ja: '海鮮', zh: '海鲜', fr: 'fruits de mer', es: 'mariscos' },
  레트로: { ko: '레트로', en: 'retro spots', ja: 'レトロ', zh: '复古怀旧', fr: 'lieux rétro', es: 'lugares retro' },
  기차: { ko: '기차역', en: 'train station', ja: '駅', zh: '火车站', fr: 'gare', es: 'estación de tren' },
}

export const INTEREST_OPTIONS = Object.keys(INTEREST_LABEL)
export { INTEREST_LABEL }

function formatMinutes(lang: Lang, n: number) {
  switch (lang) {
    case 'ko':
      return `${n}분`
    case 'ja':
      return `${n}分`
    case 'zh':
      return `${n}分钟`
    default:
      return `${n} min`
  }
}

function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`
}

function buildStopReasons(spot: TourSpot, travelMinutes: number, interests: string[]): ReasonTag[] {
  const reasons: ReasonTag[] = []

  reasons.push({
    kind: 'distance',
    text: buildLocalized((lang) => dict[lang].reasonDistance(formatMinutes(lang, travelMinutes))),
  })

  reasons.push({
    kind: 'dwell',
    text: buildLocalized((lang) => dict[lang].reasonDwell(formatMinutes(lang, spot.dwellMinutes))),
  })

  if (spot.crowd === 'low') {
    reasons.push({ kind: 'crowd', text: buildLocalized((lang) => dict[lang].reasonCrowdLow) })
  } else if (spot.crowd === 'high') {
    reasons.push({ kind: 'crowd', text: buildLocalized((lang) => dict[lang].reasonCrowdHigh) })
  } else {
    reasons.push({ kind: 'crowd', text: buildLocalized((lang) => dict[lang].reasonCrowdMedium) })
  }

  const matchedInterest = spot.interestTags.find((tag) => interests.includes(tag))
  if (matchedInterest && INTEREST_LABEL[matchedInterest]) {
    reasons.push({
      kind: 'interest',
      text: buildLocalized((lang) => dict[lang].reasonInterest(INTEREST_LABEL[matchedInterest][lang])),
    })
  }

  return reasons
}

export function buildCourse(
  duration: CourseDuration,
  spots: TourSpot[],
  interests: string[] = [],
): Course {
  // Selection is decided in two passes — interest-matched spots (closest
  // first) get first claim on the budget, then the closest remaining spots
  // fill whatever's left — so toggling an interest tag actually changes
  // which stops win a slot, not just how much budget slack they get.
  const eligible = spots
    .filter((s) => !COURSE_EXCLUDED_CATEGORIES.includes(s.category as (typeof COURSE_EXCLUDED_CATEGORIES)[number]))
    .sort((a, b) => a.distanceM - b.distanceM)

  const matched = interests.length > 0 ? eligible.filter((s) => s.interestTags.some((tag) => interests.includes(tag))) : []
  const unmatched = eligible.filter((s) => !matched.includes(s))

  const budget = duration + BUDGET_TOLERANCE_MIN[duration]
  const selected: TourSpot[] = []
  let elapsedMinutes = 0
  let prevDistanceM = 0
  const categoryCounts: Partial<Record<TourSpot['category'], number>> = {}
  const timeSlot = currentTimeSlot()

  function tryAdmit(spot: TourSpot, matchesInterest: boolean) {
    if ((categoryCounts[spot.category] ?? 0) >= categoryCapFor(spot.category, timeSlot)) return

    const travelDistance = Math.max(0, spot.distanceM - prevDistanceM)
    const travelMinutes = Math.round(travelDistance / WALK_PACE_M_PER_MIN)
    const projected = elapsedMinutes + travelMinutes + spot.dwellMinutes

    // A spot matching the traveler's selected interests earns extra budget
    // leniency. The 30-minute tier stays strict so it remains a meaningfully
    // smaller option than 60/120.
    const effectiveBudget = duration !== 30 && matchesInterest ? budget + INTEREST_TOLERANCE_MIN : budget

    if (projected > effectiveBudget) {
      if (selected.length === 0 && duration === 120) {
        // guarantee at least one stop even on a tight mock dataset
      } else {
        return
      }
    }

    selected.push(spot)
    categoryCounts[spot.category] = (categoryCounts[spot.category] ?? 0) + 1
    elapsedMinutes = projected
    prevDistanceM = spot.distanceM
  }

  for (const spot of matched) tryAdmit(spot, true)
  for (const spot of unmatched) tryAdmit(spot, false)

  // Walk the selected spots back in distance order so the route itself
  // stays a coherent, ever-outward path rather than jumping around based on
  // selection order.
  selected.sort((a, b) => a.distanceM - b.distanceM)

  const stops: CourseStop[] = []
  let walkedMinutes = 0
  let walkedDistanceM = 0

  for (const spot of selected) {
    const travelDistance = Math.max(0, spot.distanceM - walkedDistanceM)
    const travelMinutes = Math.round(travelDistance / WALK_PACE_M_PER_MIN)

    stops.push({
      spot,
      order: stops.length + 1,
      travelMinutesFromPrev: travelMinutes,
      travelDistanceFromPrevM: travelDistance,
      arrivalMinuteOffset: walkedMinutes + travelMinutes,
      reasons: buildStopReasons(spot, travelMinutes, interests),
    })

    walkedMinutes += travelMinutes + spot.dwellMinutes
    walkedDistanceM = spot.distanceM
  }

  return {
    duration,
    stops,
    totalMinutes: walkedMinutes,
    totalDistanceM: walkedDistanceM,
  }
}

export function pickBonusStay(spots: TourSpot[], course: Course): TourSpot | undefined {
  if (course.duration !== 120) return undefined
  return spots.find((s) => s.category === 'stay')
}

export { formatMinutes as formatCourseMinutes, formatDistance as formatCourseDistance }

// weather reason banner shown once per course
export function weatherReason(weather: WeatherContext): LocalizedText {
  return buildLocalized((lang) => {
    const condition =
      weather.condition === 'sunny' ? dict[lang].weatherSunny : weather.condition === 'cloudy' ? dict[lang].weatherCloudy : dict[lang].weatherRainy
    return dict[lang].reasonWeather(condition, `${weather.tempC}°C`)
  })
}
