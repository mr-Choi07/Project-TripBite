import type { StorePlace } from '../types'

export const SUNRISE_BOWL: StorePlace = {
  storeId: 'sunrise-bowl',
  campaignId: 'songjeong-2026',
  // Bundled seed store has no real owner account; a real owner can claim it
  // later by registering with storeId 'sunrise-bowl'.
  ownerUid: 'demo-seed',
  name: {
    ko: '선라이즈볼',
    en: 'Sunrise Bowl',
    ja: 'サンライズボウル',
    zh: '日出碗',
    fr: 'Sunrise Bowl',
    es: 'Sunrise Bowl',
  },
  areaName: {
    ko: '부산 송정해수욕장 인근',
    en: 'Near Songjeong Beach, Busan',
    ja: '釜山 松亭海水浴場付近',
    zh: '釜山松亭海水浴场附近',
    fr: 'Près de la plage de Songjeong, Busan',
    es: 'Cerca de la playa de Songjeong, Busan',
  },
  address: '부산광역시 해운대구 송정중앙로 48 1층 2호',
  lat: 35.18299,
  lng: 129.20284,
  heroImage: '/menu/pink-aloha.jpg',
  logoImage: '/menu/logo.jpg',
  hours: '09:00 – 21:00',
  phone: '051-123-4567',
  // Demo seed store — not a real registered business, so this isn't a
  // genuine NTS-verified number. Never read/validated since this object is
  // only ever used as a fallback for reads, never written through the
  // verification-gated registration form.
  businessNumber: '0000000000',
  representativeName: '',
  businessOpenDate: '',
  tagline: {
    ko: '송정 바다를 마주한 로컬 볼 식당',
    en: 'A local bowl kitchen facing Songjeong Beach',
    ja: '松亭の海に面したローカルボウル食堂',
    zh: '面朝松亭海滩的本地碗餐厅',
    fr: 'Un restaurant de bowls local face à la plage de Songjeong',
    es: 'Un restaurante local de bowls frente a la playa de Songjeong',
  },
}
