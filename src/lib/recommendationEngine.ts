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
  return { ko: build('ko'), en: build('en'), ja: build('ja'), zh: build('zh') }
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
        : `Free of ${labels}`,
    )
  }
  if (notes.includes('vegan')) {
    parts.push(lang === 'ko' ? '비건' : lang === 'ja' ? 'ビーガン対応' : lang === 'zh' ? '纯素' : 'Vegan')
  }
  if (notes.includes('halal')) {
    parts.push(lang === 'ko' ? '할랄 인증' : lang === 'ja' ? 'ハラール認証' : lang === 'zh' ? '清真认证' : 'Halal-certified')
  }
  if (notes.includes('light')) {
    parts.push(lang === 'ko' ? '가벼운 한 끼' : lang === 'ja' ? '軽めの一食' : lang === 'zh' ? '清淡一餐' : 'A lighter meal')
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
const COURSE_EXCLUDED_CATEGORIES = ['stay'] as const

const INTEREST_LABEL: Record<string, LocalizedText> = {
  바다: { ko: '바다', en: 'ocean views', ja: '海の景色', zh: '海景' },
  산책: { ko: '산책', en: 'walking', ja: '散歩', zh: '散步' },
  사진: { ko: '사진 명소', en: 'photo spots', ja: '写真スポット', zh: '拍照打卡' },
  자연: { ko: '자연', en: 'nature', ja: '自然', zh: '自然风光' },
  전망: { ko: '전망', en: 'scenic views', ja: '眺望', zh: '观景' },
  로컬맛집: { ko: '로컬 맛집', en: 'local food', ja: '地元グルメ', zh: '本地美食' },
  전통시장: { ko: '전통시장', en: 'traditional markets', ja: '伝統市場', zh: '传统市场' },
  쇼핑: { ko: '쇼핑', en: 'shopping', ja: 'ショッピング', zh: '购物' },
  축제: { ko: '축제', en: 'festivals', ja: '祭り', zh: '节庆' },
  로컬푸드: { ko: '로컬 푸드', en: 'local food', ja: 'ローカルフード', zh: '本地美食' },
  해산물: { ko: '해산물', en: 'seafood', ja: '海鮮', zh: '海鲜' },
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
  const candidates = spots
    .filter((s) => !COURSE_EXCLUDED_CATEGORIES.includes(s.category as (typeof COURSE_EXCLUDED_CATEGORIES)[number]))
    .sort((a, b) => a.distanceM - b.distanceM)

  const budget = duration + BUDGET_TOLERANCE_MIN[duration]
  const stops: CourseStop[] = []
  let elapsedMinutes = 0
  let prevDistanceM = 0

  for (const spot of candidates) {
    const travelDistance = Math.max(0, spot.distanceM - prevDistanceM)
    const travelMinutes = Math.round(travelDistance / WALK_PACE_M_PER_MIN)
    const projected = elapsedMinutes + travelMinutes + spot.dwellMinutes

    // A spot matching the traveler's selected interests earns extra budget
    // leniency, so toggling interest chips can actually change which stops
    // make the cut — not just decorate the reason tags.
    const matchesInterest = spot.interestTags.some((tag) => interests.includes(tag))
    const effectiveBudget = matchesInterest ? budget + INTEREST_TOLERANCE_MIN : budget

    if (projected > effectiveBudget) {
      if (stops.length === 0 && duration === 120) {
        // guarantee at least one stop even on a tight mock dataset
      } else {
        continue
      }
    }

    stops.push({
      spot,
      order: stops.length + 1,
      travelMinutesFromPrev: travelMinutes,
      travelDistanceFromPrevM: travelDistance,
      arrivalMinuteOffset: elapsedMinutes + travelMinutes,
      reasons: buildStopReasons(spot, travelMinutes, interests),
    })

    elapsedMinutes = projected
    prevDistanceM = spot.distanceM
  }

  return {
    duration,
    stops,
    totalMinutes: elapsedMinutes,
    totalDistanceM: prevDistanceM,
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
