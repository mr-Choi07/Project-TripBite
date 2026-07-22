import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, Check, X, Store as StoreIcon, Download, QrCode as QrCodeIcon, MapPin } from 'lucide-react'
import { useApp } from '../context/AppContext'
import OwnerDashboardShell from '../components/layout/OwnerDashboardShell'
import LocalizedField, { EMPTY_LOCALIZED } from '../components/owner/LocalizedField'
import ImageUploadField from '../components/owner/ImageUploadField'
import { findStoreByOwner, createStore, saveStore, getMenu, saveMenuItem, deleteMenuItem, storeIdExists } from '../lib/storeData'
import { translateFromKorean } from '../lib/translate'
import { verifyBusinessRegistration, BusinessVerifyError, BusinessVerifyNotConfiguredError } from '../lib/business'
import { geocodeAddress, GeocodeError, GeocodeNotConfiguredError } from '../lib/geocode'
import { buildQrUrl, generateQrWithLogo } from '../lib/qr'
import { pickLocalized } from '../i18n'
import type { Allergen, DietTag, LocalizedText, MenuItem, StorePlace } from '../types'

const ALLERGEN_OPTIONS: Allergen[] = ['seafood', 'shellfish', 'nuts', 'dairy', 'egg', 'gluten', 'pork']
const ALLERGEN_LABEL: Record<Allergen, string> = {
  seafood: '해산물',
  shellfish: '갑각류',
  nuts: '견과류',
  dairy: '유제품',
  egg: '계란',
  gluten: '글루텐',
  pork: '돼지고기',
}
const TAG_OPTIONS: DietTag[] = ['vegan', 'vegetarian', 'halal', 'gluten-free']
const TAG_LABEL: Record<DietTag, string> = { vegan: '비건', vegetarian: '베지테리언', halal: '할랄', 'gluten-free': '글루텐프리' }
const CALORIE_OPTIONS: MenuItem['calorie'][] = ['light', 'regular', 'hearty']
const CALORIE_LABEL: Record<MenuItem['calorie'], string> = { light: '가벼운', regular: '적당한', hearty: '든든한' }

function splitIngredients(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function joinIngredients(list: string[]): string {
  return list.join(', ')
}

interface StoreFormState {
  storeId: string
  campaignId: string
  name: LocalizedText
  areaName: LocalizedText
  tagline: LocalizedText
  address: string
  lat: string
  lng: string
  heroImage: string
  logoImage: string
  hours: string
  phone: string
  businessNumber: string
  representativeName: string
  /** yyyy-mm-dd, as produced by <input type="date"> */
  businessOpenDate: string
}

function emptyStoreForm(): StoreFormState {
  return {
    storeId: '',
    campaignId: '',
    name: { ...EMPTY_LOCALIZED },
    areaName: { ...EMPTY_LOCALIZED },
    tagline: { ...EMPTY_LOCALIZED },
    address: '',
    lat: '',
    lng: '',
    heroImage: '',
    logoImage: '',
    hours: '',
    phone: '',
    businessNumber: '',
    representativeName: '',
    businessOpenDate: '',
  }
}

function storeToForm(s: StorePlace): StoreFormState {
  return {
    storeId: s.storeId,
    campaignId: s.campaignId,
    name: s.name,
    areaName: s.areaName,
    tagline: s.tagline,
    address: s.address,
    lat: String(s.lat),
    lng: String(s.lng),
    heroImage: s.heroImage,
    logoImage: s.logoImage,
    hours: s.hours,
    phone: s.phone,
    businessNumber: s.businessNumber,
    representativeName: s.representativeName,
    businessOpenDate: s.businessOpenDate.length === 8
      ? `${s.businessOpenDate.slice(0, 4)}-${s.businessOpenDate.slice(4, 6)}-${s.businessOpenDate.slice(6, 8)}`
      : '',
  }
}

interface MenuFormState {
  id: string
  isNew: boolean
  name: LocalizedText
  description: LocalizedText
  ingredients: LocalizedText
  price: string
  image: string
  tags: Set<DietTag>
  allergens: Set<Allergen>
  spicyLevel: 0 | 1 | 2 | 3
  calorie: MenuItem['calorie']
  signature: boolean
}

function emptyMenuForm(): MenuFormState {
  return {
    id: crypto.randomUUID(),
    isNew: true,
    name: { ...EMPTY_LOCALIZED },
    description: { ...EMPTY_LOCALIZED },
    ingredients: { ...EMPTY_LOCALIZED },
    price: '',
    image: '',
    tags: new Set(),
    allergens: new Set(),
    spicyLevel: 0,
    calorie: 'regular',
    signature: false,
  }
}

function menuItemToForm(item: MenuItem): MenuFormState {
  return {
    id: item.id,
    isNew: false,
    name: item.name,
    description: item.description,
    ingredients: {
      ko: joinIngredients(item.ingredients.ko),
      en: joinIngredients(item.ingredients.en),
      ja: joinIngredients(item.ingredients.ja),
      zh: joinIngredients(item.ingredients.zh),
      fr: joinIngredients(item.ingredients.fr),
      es: joinIngredients(item.ingredients.es),
    },
    price: String(item.price),
    image: item.image,
    tags: new Set(item.tags),
    allergens: new Set(item.allergens),
    spicyLevel: item.spicyLevel,
    calorie: item.calorie,
    signature: Boolean(item.signature),
  }
}

export default function OwnerManageScreen() {
  const { uid } = useApp()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [myStore, setMyStore] = useState<StorePlace | null>(null)
  const [tab, setTab] = useState<'store' | 'menu' | 'qr'>('store')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  const [storeForm, setStoreForm] = useState<StoreFormState>(emptyStoreForm)
  const [storeIdError, setStoreIdError] = useState<string | null>(null)
  const [storeTranslating, setStoreTranslating] = useState(false)
  const [storeTranslateError, setStoreTranslateError] = useState<string | null>(null)
  const [storeSaving, setStoreSaving] = useState(false)
  const [storeSaveError, setStoreSaveError] = useState<string | null>(null)
  const [businessVerifying, setBusinessVerifying] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeErrorMsg, setGeocodeErrorMsg] = useState<string | null>(null)

  async function handleGeocode() {
    if (!storeForm.address.trim()) {
      setGeocodeErrorMsg('먼저 주소를 입력해주세요.')
      return
    }
    setGeocoding(true)
    setGeocodeErrorMsg(null)
    try {
      const { lat, lng } = await geocodeAddress(storeForm.address)
      setStoreForm((p) => ({ ...p, lat: String(lat), lng: String(lng) }))
    } catch (err) {
      if (err instanceof GeocodeNotConfiguredError || err instanceof GeocodeError) {
        setGeocodeErrorMsg(err.message)
      } else {
        setGeocodeErrorMsg('좌표 변환에 실패했습니다. 잠시 후 다시 시도해주세요.')
      }
    } finally {
      setGeocoding(false)
    }
  }

  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [menuForm, setMenuForm] = useState<MenuFormState | null>(null)
  const [menuTranslating, setMenuTranslating] = useState(false)
  const [menuTranslateError, setMenuTranslateError] = useState<string | null>(null)
  const [menuSaving, setMenuSaving] = useState(false)
  const [menuSaveError, setMenuSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return
    let active = true
    findStoreByOwner(uid).then((s) => {
      if (!active) return
      setMyStore(s)
      if (s) {
        setStoreForm(storeToForm(s))
        getMenu(s.storeId).then((items) => {
          if (active) setMenuItems(items)
        })
      }
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [uid])

  useEffect(() => {
    if (!myStore) {
      setQrDataUrl(null)
      return
    }
    let active = true
    const url = buildQrUrl({
      storeId: myStore.storeId,
      campaignId: myStore.campaignId,
      lat: myStore.lat,
      lng: myStore.lng,
      lang: 'en',
    })
    generateQrWithLogo(url, myStore.logoImage).then((dataUrl) => {
      if (active) setQrDataUrl(dataUrl)
    })
    return () => {
      active = false
    }
  }, [myStore])

  async function handleStoreTranslate() {
    setStoreTranslating(true)
    setStoreTranslateError(null)
    try {
      const res = await translateFromKorean({ areaName: storeForm.areaName.ko, tagline: storeForm.tagline.ko })
      setStoreForm((prev) => ({
        ...prev,
        areaName: { ...prev.areaName, ...(Object.fromEntries(
          (['en', 'ja', 'zh', 'fr', 'es'] as const).map((l) => [l, res[l]?.areaName ?? prev.areaName[l]]),
        )) },
        tagline: { ...prev.tagline, ...(Object.fromEntries(
          (['en', 'ja', 'zh', 'fr', 'es'] as const).map((l) => [l, res[l]?.tagline ?? prev.tagline[l]]),
        )) },
      }))
    } catch {
      setStoreTranslateError('자동 번역을 사용할 수 없어요. 아래에서 언어별로 직접 입력해주세요.')
    } finally {
      setStoreTranslating(false)
    }
  }

  async function handleMenuTranslate() {
    if (!menuForm) return
    setMenuTranslating(true)
    setMenuTranslateError(null)
    try {
      const res = await translateFromKorean({ description: menuForm.description.ko, ingredients: menuForm.ingredients.ko })
      setMenuForm((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          description: { ...prev.description, ...(Object.fromEntries(
            (['en', 'ja', 'zh', 'fr', 'es'] as const).map((l) => [l, res[l]?.description ?? prev.description[l]]),
          )) },
          ingredients: { ...prev.ingredients, ...(Object.fromEntries(
            (['en', 'ja', 'zh', 'fr', 'es'] as const).map((l) => [l, res[l]?.ingredients ?? prev.ingredients[l]]),
          )) },
        }
      })
    } catch {
      setMenuTranslateError('자동 번역을 사용할 수 없어요. 아래에서 언어별로 직접 입력해주세요.')
    } finally {
      setMenuTranslating(false)
    }
  }

  async function handleStoreSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!uid) return
    setStoreIdError(null)
    setStoreSaveError(null)

    const isNew = !myStore
    if (isNew && !/^[a-z0-9-]{3,40}$/.test(storeForm.storeId)) {
      setStoreIdError('매장 ID는 영문 소문자, 숫자, 하이픈(-)만 사용해 3~40자로 입력해주세요.')
      return
    }

    // Once a store exists, its business registration is locked — reuse the
    // already-verified values as-is (the fields are read-only in the UI, but
    // this also guarantees the update never sends a changed value) and skip
    // re-verifying, since re-calling the NTS API on every unrelated edit
    // (address, hours, images, ...) would burn through its rate limit for
    // no reason. Firestore rules enforce this same immutability server-side.
    let businessNumber: string
    let representativeName: string
    let businessOpenDate: string

    if (myStore) {
      businessNumber = myStore.businessNumber
      representativeName = myStore.representativeName
      businessOpenDate = myStore.businessOpenDate
    } else {
      businessNumber = storeForm.businessNumber.replace(/\D/g, '')
      representativeName = storeForm.representativeName.trim()
      businessOpenDate = storeForm.businessOpenDate.replace(/-/g, '')

      if (!/^\d{10}$/.test(businessNumber)) {
        setStoreSaveError('사업자등록번호는 숫자 10자리로 입력해주세요.')
        return
      }
      if (!representativeName) {
        setStoreSaveError('대표자성명을 입력해주세요.')
        return
      }
      if (!/^\d{8}$/.test(businessOpenDate)) {
        setStoreSaveError('개업일자를 입력해주세요.')
        return
      }
    }

    const store: StorePlace = {
      storeId: storeForm.storeId,
      campaignId: storeForm.campaignId || `${storeForm.storeId}-campaign`,
      ownerUid: uid,
      name: storeForm.name,
      areaName: storeForm.areaName,
      tagline: storeForm.tagline,
      address: storeForm.address,
      lat: Number(storeForm.lat),
      lng: Number(storeForm.lng),
      heroImage: storeForm.heroImage,
      logoImage: storeForm.logoImage,
      hours: storeForm.hours,
      phone: storeForm.phone,
      businessNumber,
      representativeName,
      businessOpenDate,
    }

    if (!myStore) {
      setBusinessVerifying(true)
      try {
        await verifyBusinessRegistration({ businessNumber, representativeName, openDate: businessOpenDate })
      } catch (err) {
        if (err instanceof BusinessVerifyNotConfiguredError) {
          setStoreSaveError('사업자등록 확인 기능이 아직 설정되지 않아 매장을 등록할 수 없습니다. 관리자에게 문의해주세요.')
        } else if (err instanceof BusinessVerifyError) {
          setStoreSaveError(err.message)
        } else {
          setStoreSaveError('사업자등록정보를 확인하는 중 오류가 발생했습니다.')
        }
        setBusinessVerifying(false)
        return
      }
      setBusinessVerifying(false)
    }

    setStoreSaving(true)
    try {
      if (isNew) {
        if (await storeIdExists(storeForm.storeId)) {
          setStoreIdError('이미 사용 중인 매장 ID입니다.')
          return
        }
        await createStore(store)
      } else {
        await saveStore(store)
      }
      setMyStore(store)
      setTab('menu')
    } catch (err) {
      console.error('[OwnerManageScreen] store save failed', err)
      setStoreSaveError('저장에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setStoreSaving(false)
    }
  }

  async function handleMenuSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!myStore || !menuForm) return
    setMenuSaveError(null)

    const item: MenuItem = {
      id: menuForm.id,
      category: 'bowl',
      name: menuForm.name,
      description: menuForm.description,
      ingredients: {
        ko: splitIngredients(menuForm.ingredients.ko),
        en: splitIngredients(menuForm.ingredients.en),
        ja: splitIngredients(menuForm.ingredients.ja),
        zh: splitIngredients(menuForm.ingredients.zh),
        fr: splitIngredients(menuForm.ingredients.fr),
        es: splitIngredients(menuForm.ingredients.es),
      },
      price: Number(menuForm.price) || 0,
      image: menuForm.image,
      tags: Array.from(menuForm.tags),
      allergens: Array.from(menuForm.allergens),
      spicyLevel: menuForm.spicyLevel,
      calorie: menuForm.calorie,
      signature: menuForm.signature,
    }

    setMenuSaving(true)
    try {
      await saveMenuItem(myStore.storeId, item)
      setMenuItems((prev) => {
        const exists = prev.some((m) => m.id === item.id)
        return exists ? prev.map((m) => (m.id === item.id ? item : m)) : [...prev, item]
      })
      setMenuForm(null)
    } catch (err) {
      console.error('[OwnerManageScreen] menu item save failed', err)
      setMenuSaveError('저장에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setMenuSaving(false)
    }
  }

  async function handleDeleteMenuItem(itemId: string) {
    if (!myStore) return
    try {
      await deleteMenuItem(myStore.storeId, itemId)
      setMenuItems((prev) => prev.filter((m) => m.id !== itemId))
    } catch (err) {
      console.error('[OwnerManageScreen] menu item delete failed', err)
      setMenuSaveError('삭제에 실패했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  function toggleSetValue<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  }

  if (loading) {
    return (
      <OwnerDashboardShell title="매장·메뉴 관리">
        <div className="flex flex-col items-center gap-2 py-24 text-tb-ink-soft">
          <p className="text-xs">불러오는 중...</p>
        </div>
      </OwnerDashboardShell>
    )
  }

  return (
    <OwnerDashboardShell title="매장·메뉴 관리">
      <div className="pt-3 pb-8 lg:pt-0 lg:max-w-3xl">
        <button
          type="button"
          onClick={() => navigate('/stats')}
          className="flex items-center gap-1 text-xs font-semibold text-tb-ink-soft lg:hidden"
        >
          <ArrowLeft size={13} />
          통계로 돌아가기
        </button>

        {myStore && (
          <div className="mt-4 flex rounded-full bg-tb-sand-100 p-1 lg:mt-0 lg:inline-flex lg:w-auto">
            <button
              type="button"
              onClick={() => setTab('store')}
              className={`flex-1 whitespace-nowrap rounded-full py-2 text-sm font-bold transition-colors lg:flex-none lg:px-6 ${
                tab === 'store' ? 'bg-white text-tb-ink shadow-tb-card' : 'text-tb-ink-soft'
              }`}
            >
              매장 정보
            </button>
            <button
              type="button"
              onClick={() => setTab('menu')}
              className={`flex-1 whitespace-nowrap rounded-full py-2 text-sm font-bold transition-colors lg:flex-none lg:px-6 ${
                tab === 'menu' ? 'bg-white text-tb-ink shadow-tb-card' : 'text-tb-ink-soft'
              }`}
            >
              메뉴 관리
            </button>
            <button
              type="button"
              onClick={() => setTab('qr')}
              className={`flex-1 whitespace-nowrap rounded-full py-2 text-sm font-bold transition-colors lg:flex-none lg:px-6 ${
                tab === 'qr' ? 'bg-white text-tb-ink shadow-tb-card' : 'text-tb-ink-soft'
              }`}
            >
              QR 코드
            </button>
          </div>
        )}

        {!myStore && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-tb-teal-100 bg-tb-teal-50 px-4 py-3 text-xs font-medium text-tb-teal-700">
            <StoreIcon size={15} />
            아직 등록된 매장이 없어요. 아래 정보를 입력해 매장을 등록해주세요.
          </div>
        )}

        {(tab === 'store' || !myStore) && (
          <form onSubmit={handleStoreSubmit} className="mt-4 space-y-4">
            {!myStore && (
              <div>
                <label className="text-xs font-semibold text-tb-ink-soft">매장 ID (영문 소문자, 숫자, 하이픈)</label>
                <input
                  value={storeForm.storeId}
                  onChange={(e) => setStoreForm((p) => ({ ...p, storeId: e.target.value.trim() }))}
                  placeholder="예: sunrise-bowl"
                  className="mt-1 w-full rounded-xl border border-tb-line bg-tb-paper-raised px-3 py-2.5 text-sm text-tb-ink outline-none focus:border-tb-teal-400"
                />
                {storeIdError && <p className="mt-1 text-[11px] font-medium text-tb-coral-600">{storeIdError}</p>}
              </div>
            )}

            <LocalizedField label="매장명 (브랜드명, 번역 안 함)" value={storeForm.name} onChange={(v) => setStoreForm((p) => ({ ...p, name: v }))} translatable={false} />

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-tb-ink-soft">아래 두 항목 번역 초안을 한 번에 생성할 수 있어요</span>
              <button
                type="button"
                onClick={handleStoreTranslate}
                disabled={storeTranslating || !storeForm.areaName.ko.trim()}
                className="rounded-full bg-tb-teal-500 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
              >
                {storeTranslating ? '번역 중...' : '번역 초안 생성'}
              </button>
            </div>
            {storeTranslateError && <p className="text-[11px] font-medium text-tb-coral-600">{storeTranslateError}</p>}

            <LocalizedField label="지역/위치 설명" value={storeForm.areaName} onChange={(v) => setStoreForm((p) => ({ ...p, areaName: v }))} />
            <LocalizedField label="한 줄 소개" value={storeForm.tagline} onChange={(v) => setStoreForm((p) => ({ ...p, tagline: v }))} multiline />

            <div>
              <label className="text-xs font-semibold text-tb-ink-soft">주소</label>
              <div className="mt-1 flex gap-2">
                <input
                  value={storeForm.address}
                  onChange={(e) => setStoreForm((p) => ({ ...p, address: e.target.value }))}
                  placeholder="도로명 주소 (예: 서울특별시 강남구 테헤란로 123)"
                  className="w-full flex-1 rounded-xl border border-tb-line bg-tb-paper-raised px-3 py-2.5 text-sm text-tb-ink outline-none focus:border-tb-teal-400"
                />
                <button
                  type="button"
                  onClick={handleGeocode}
                  disabled={geocoding}
                  className="flex shrink-0 items-center gap-1 rounded-xl bg-tb-teal-500 px-3 text-xs font-bold text-white disabled:opacity-50"
                >
                  <MapPin size={13} />
                  {geocoding ? '찾는 중...' : '좌표 찾기'}
                </button>
              </div>
              {geocodeErrorMsg && <p className="mt-1 text-[11px] font-medium text-tb-coral-600">{geocodeErrorMsg}</p>}
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold text-tb-ink-soft">위도 (lat)</label>
                <input
                  value={storeForm.lat}
                  onChange={(e) => setStoreForm((p) => ({ ...p, lat: e.target.value }))}
                  inputMode="decimal"
                  className="mt-1 w-full rounded-xl border border-tb-line bg-tb-paper-raised px-3 py-2.5 text-sm text-tb-ink outline-none focus:border-tb-teal-400"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-tb-ink-soft">경도 (lng)</label>
                <input
                  value={storeForm.lng}
                  onChange={(e) => setStoreForm((p) => ({ ...p, lng: e.target.value }))}
                  inputMode="decimal"
                  className="mt-1 w-full rounded-xl border border-tb-line bg-tb-paper-raised px-3 py-2.5 text-sm text-tb-ink outline-none focus:border-tb-teal-400"
                />
              </div>
            </div>

            {uid && (
              <ImageUploadField
                label="대표 이미지"
                value={storeForm.heroImage}
                onChange={(url) => setStoreForm((p) => ({ ...p, heroImage: url }))}
                uid={uid}
                uploadPath="hero"
              />
            )}
            {uid && (
              <ImageUploadField
                label="로고 이미지"
                value={storeForm.logoImage}
                onChange={(url) => setStoreForm((p) => ({ ...p, logoImage: url }))}
                uid={uid}
                uploadPath="logo"
                aspectRatio={1}
              />
            )}

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold text-tb-ink-soft">영업시간</label>
                <input
                  value={storeForm.hours}
                  onChange={(e) => setStoreForm((p) => ({ ...p, hours: e.target.value }))}
                  placeholder="09:00 – 21:00"
                  className="mt-1 w-full rounded-xl border border-tb-line bg-tb-paper-raised px-3 py-2.5 text-sm text-tb-ink outline-none focus:border-tb-teal-400"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-tb-ink-soft">전화번호</label>
                <input
                  value={storeForm.phone}
                  onChange={(e) => setStoreForm((p) => ({ ...p, phone: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-tb-line bg-tb-paper-raised px-3 py-2.5 text-sm text-tb-ink outline-none focus:border-tb-teal-400"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-tb-line bg-tb-sand-100/60 p-3.5">
              <p className="text-xs font-bold text-tb-ink">사업자등록 확인</p>
              <p className="mt-0.5 text-[11px] text-tb-ink-soft">
                {myStore
                  ? '한 번 확인된 사업자등록 정보는 변경할 수 없어요. 정보가 바뀌었다면 새 매장으로 등록해주세요.'
                  : '국세청에 등록된 실제 사업자인지 확인하기 위해 필요해요. 이 정보로 진위확인 후에만 매장이 등록됩니다.'}
              </p>

              <div className="mt-3">
                <label className="text-xs font-semibold text-tb-ink-soft">사업자등록번호 (숫자 10자리)</label>
                <input
                  value={storeForm.businessNumber}
                  onChange={(e) => setStoreForm((p) => ({ ...p, businessNumber: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  placeholder="1234567890"
                  inputMode="numeric"
                  readOnly={Boolean(myStore)}
                  className={`mt-1 w-full rounded-xl border border-tb-line px-3 py-2.5 text-sm text-tb-ink outline-none focus:border-tb-teal-400 ${myStore ? 'bg-tb-line/40 text-tb-ink-soft' : 'bg-white'}`}
                />
              </div>
              <div className="mt-3">
                <label className="text-xs font-semibold text-tb-ink-soft">대표자성명</label>
                <input
                  value={storeForm.representativeName}
                  onChange={(e) => setStoreForm((p) => ({ ...p, representativeName: e.target.value }))}
                  readOnly={Boolean(myStore)}
                  className={`mt-1 w-full rounded-xl border border-tb-line px-3 py-2.5 text-sm text-tb-ink outline-none focus:border-tb-teal-400 ${myStore ? 'bg-tb-line/40 text-tb-ink-soft' : 'bg-white'}`}
                />
              </div>
              <div className="mt-3">
                <label className="text-xs font-semibold text-tb-ink-soft">개업일자</label>
                <input
                  type="date"
                  value={storeForm.businessOpenDate}
                  onChange={(e) => setStoreForm((p) => ({ ...p, businessOpenDate: e.target.value }))}
                  readOnly={Boolean(myStore)}
                  disabled={Boolean(myStore)}
                  className={`mt-1 w-full rounded-xl border border-tb-line px-3 py-2.5 text-sm text-tb-ink outline-none focus:border-tb-teal-400 ${myStore ? 'bg-tb-line/40 text-tb-ink-soft' : 'bg-white'}`}
                />
              </div>
            </div>

            {storeSaveError && <p className="text-center text-xs font-medium text-tb-coral-600">{storeSaveError}</p>}

            <button
              type="submit"
              disabled={storeSaving || businessVerifying}
              className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-tb-ink py-3.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {businessVerifying ? '사업자등록 확인 중...' : storeSaving ? '저장 중...' : myStore ? '매장 정보 저장' : '매장 등록하기'}
            </button>
          </form>
        )}

        {tab === 'menu' && myStore && (
          <div className="mt-4">
            {menuSaveError && !menuForm && <p className="mb-3 text-center text-xs font-medium text-tb-coral-600">{menuSaveError}</p>}
            {!menuForm && (
              <button
                type="button"
                onClick={() => setMenuForm(emptyMenuForm())}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-tb-teal-300 bg-tb-teal-50 py-3 text-sm font-bold text-tb-teal-600"
              >
                <Plus size={16} />
                새 메뉴 추가
              </button>
            )}

            {menuForm && (
              <form onSubmit={handleMenuSubmit} className="mt-3 space-y-4 rounded-2xl border border-tb-line bg-tb-paper-raised p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-tb-ink">{menuForm.isNew ? '새 메뉴' : '메뉴 수정'}</p>
                  <button type="button" onClick={() => setMenuForm(null)} className="text-tb-ink-soft">
                    <X size={16} />
                  </button>
                </div>

                <LocalizedField label="메뉴명 (번역 안 함)" value={menuForm.name} onChange={(v) => setMenuForm((p) => (p ? { ...p, name: v } : p))} translatable={false} />

                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-tb-ink-soft">설명·재료 번역 초안을 한 번에 생성할 수 있어요</span>
                  <button
                    type="button"
                    onClick={handleMenuTranslate}
                    disabled={menuTranslating || !menuForm.description.ko.trim()}
                    className="rounded-full bg-tb-teal-500 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
                  >
                    {menuTranslating ? '번역 중...' : '번역 초안 생성'}
                  </button>
                </div>
                {menuTranslateError && <p className="text-[11px] font-medium text-tb-coral-600">{menuTranslateError}</p>}

                <LocalizedField label="설명" value={menuForm.description} onChange={(v) => setMenuForm((p) => (p ? { ...p, description: v } : p))} multiline />
                <LocalizedField
                  label="주요 재료 (쉼표로 구분)"
                  value={menuForm.ingredients}
                  onChange={(v) => setMenuForm((p) => (p ? { ...p, ingredients: v } : p))}
                />

                <div>
                  <label className="text-xs font-semibold text-tb-ink-soft">가격 (원)</label>
                  <input
                    value={menuForm.price}
                    onChange={(e) => setMenuForm((p) => (p ? { ...p, price: e.target.value } : p))}
                    inputMode="numeric"
                    className="mt-1 w-full rounded-xl border border-tb-line bg-white px-3 py-2.5 text-sm text-tb-ink outline-none focus:border-tb-teal-400"
                  />
                </div>

                {uid && (
                  <ImageUploadField
                    label="메뉴 이미지"
                    value={menuForm.image}
                    onChange={(url) => setMenuForm((p) => (p ? { ...p, image: url } : p))}
                    uid={uid}
                    uploadPath={`menu/${menuForm.id}`}
                    aspectRatio={1}
                  />
                )}

                <div>
                  <p className="text-xs font-semibold text-tb-ink-soft">태그</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {TAG_OPTIONS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setMenuForm((p) => (p ? { ...p, tags: toggleSetValue(p.tags, tag) } : p))}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          menuForm.tags.has(tag) ? 'border-tb-teal-400 bg-tb-teal-50 text-tb-teal-600' : 'border-tb-line bg-white text-tb-ink-soft'
                        }`}
                      >
                        {TAG_LABEL[tag]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-tb-ink-soft">알레르기 유발 성분</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {ALLERGEN_OPTIONS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setMenuForm((p) => (p ? { ...p, allergens: toggleSetValue(p.allergens, a) } : p))}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          menuForm.allergens.has(a) ? 'border-tb-coral-300 bg-tb-coral-50 text-tb-coral-600' : 'border-tb-line bg-white text-tb-ink-soft'
                        }`}
                      >
                        {ALLERGEN_LABEL[a]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-tb-ink-soft">맵기 (0~3)</label>
                    <select
                      value={menuForm.spicyLevel}
                      onChange={(e) => setMenuForm((p) => (p ? { ...p, spicyLevel: Number(e.target.value) as 0 | 1 | 2 | 3 } : p))}
                      className="mt-1 w-full rounded-xl border border-tb-line bg-white px-3 py-2.5 text-sm text-tb-ink outline-none focus:border-tb-teal-400"
                    >
                      {[0, 1, 2, 3].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-tb-ink-soft">포만감</label>
                    <select
                      value={menuForm.calorie}
                      onChange={(e) => setMenuForm((p) => (p ? { ...p, calorie: e.target.value as MenuItem['calorie'] } : p))}
                      className="mt-1 w-full rounded-xl border border-tb-line bg-white px-3 py-2.5 text-sm text-tb-ink outline-none focus:border-tb-teal-400"
                    >
                      {CALORIE_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {CALORIE_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMenuForm((p) => (p ? { ...p, signature: !p.signature } : p))}
                  className={`flex w-full items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold ${
                    menuForm.signature ? 'border-tb-coral-300 bg-tb-coral-50 text-tb-coral-600' : 'border-tb-line bg-white text-tb-ink-soft'
                  }`}
                >
                  {menuForm.signature && <Check size={14} />}
                  시그니처 메뉴로 표시
                </button>

                {menuSaveError && <p className="text-center text-xs font-medium text-tb-coral-600">{menuSaveError}</p>}

                <button
                  type="submit"
                  disabled={menuSaving}
                  className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-tb-ink py-3.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {menuSaving ? '저장 중...' : '메뉴 저장'}
                </button>
              </form>
            )}

            <div className="mt-4 space-y-2.5">
              {menuItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-tb-line bg-tb-paper-raised p-3">
                  <img src={item.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-tb-ink">{pickLocalized(item.name, 'ko')}</p>
                    <p className="text-xs text-tb-ink-soft">₩{item.price.toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMenuForm(menuItemToForm(item))}
                    className="rounded-full p-1.5 text-tb-ink-soft hover:text-tb-teal-600"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMenuItem(item.id)}
                    className="rounded-full p-1.5 text-tb-ink-soft hover:text-tb-coral-500"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {menuItems.length === 0 && !menuForm && (
                <p className="py-6 text-center text-xs text-tb-ink-soft">등록된 메뉴가 없습니다</p>
              )}
            </div>
          </div>
        )}

        {tab === 'qr' && myStore && (
          <div className="mt-4 flex flex-col items-center rounded-2xl border border-tb-line bg-tb-paper-raised p-5 text-center">
            <p className="text-sm font-bold text-tb-ink">테이블에 붙여둘 QR 코드</p>
            <p className="mt-1 text-xs text-tb-ink-soft">
              손님이 이 QR을 스캔하면 매장·언어 정보가 자동으로 인식돼요.
            </p>

            {qrDataUrl ? (
              <>
                <img src={qrDataUrl} alt="매장 QR 코드" className="mt-4 h-56 w-56 rounded-2xl border border-tb-line" />
                <a
                  href={qrDataUrl}
                  download={`tripbite-${myStore.storeId}-qr.png`}
                  className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-tb-ink py-3 text-sm font-bold text-white"
                >
                  <Download size={15} />
                  QR 이미지 다운로드
                </a>
              </>
            ) : (
              <div className="mt-4 flex h-56 w-56 items-center justify-center rounded-2xl border border-dashed border-tb-line text-tb-ink-soft">
                <QrCodeIcon size={28} className="animate-pulse" />
              </div>
            )}
          </div>
        )}

      </div>
    </OwnerDashboardShell>
  )
}
