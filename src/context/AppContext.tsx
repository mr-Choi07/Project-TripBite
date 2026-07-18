import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CartLine, Lang, MenuItem, QrPayload, WeatherContext } from '../types'
import dict from '../i18n/translations'
import { trackEvent } from '../lib/analyticsStore'
import { MENU } from '../data/menu'

const LANG_KEY = 'tripbite_lang'
const SESSION_KEY = 'tripbite_session'
const CART_KEY = 'tripbite_cart_v1'

interface SessionState {
  entered: boolean
  storeId: string
  campaignId: string
  entryMethod: 'qr' | 'demo' | null
}

const DEFAULT_SESSION: SessionState = {
  entered: false,
  storeId: 'sunrise-bowl',
  campaignId: 'songjeong-2026',
  entryMethod: null,
}

const WEATHER_POOL: WeatherContext[] = [
  { tempC: 27, condition: 'sunny', crowd: 'low' },
  { tempC: 24, condition: 'cloudy', crowd: 'medium' },
  { tempC: 29, condition: 'sunny', crowd: 'medium' },
]

function readSession(): SessionState {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return DEFAULT_SESSION
    return { ...DEFAULT_SESSION, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SESSION
  }
}

function readLang(): Lang {
  const raw = localStorage.getItem(LANG_KEY)
  if (raw === 'ko' || raw === 'en' || raw === 'ja' || raw === 'zh') return raw
  return 'en'
}

function readCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_KEY)
    if (!raw) return []
    const stored = JSON.parse(raw) as { itemId: string; qty: number }[]
    return stored
      .map((line) => {
        const item = MENU.find((m) => m.id === line.itemId)
        return item ? { item, qty: line.qty } : null
      })
      .filter((line): line is CartLine => line !== null)
  } catch {
    return []
  }
}

function writeCart(cart: CartLine[]) {
  const stored = cart.map((line) => ({ itemId: line.item.id, qty: line.qty }))
  localStorage.setItem(CART_KEY, JSON.stringify(stored))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TFn = (key: keyof typeof dict.ko, ...args: any[]) => string

interface AppContextValue {
  lang: Lang
  setLang: (lang: Lang, opts?: { silent?: boolean }) => void
  t: TFn
  session: SessionState
  enterWithQr: (payload: QrPayload) => void
  enterAsDemo: () => void
  weather: WeatherContext
  cart: CartLine[]
  addToCart: (item: MenuItem) => void
  removeFromCart: (itemId: string) => void
  clearCart: () => void
  cartTotal: number
  cartCount: number
  toast: string | null
  showToast: (message: string) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang)
  const [session, setSession] = useState<SessionState>(readSession)
  const [weather] = useState<WeatherContext>(() => WEATHER_POOL[Math.floor(Math.random() * WEATHER_POOL.length)])
  const [cart, setCart] = useState<CartLine[]>(readCart)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    writeCart(cart)
  }, [cart])

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(null), 2000)
  }, [])

  const setLang = useCallback((next: Lang, opts?: { silent?: boolean }) => {
    setLangState(next)
    localStorage.setItem(LANG_KEY, next)
    if (!opts?.silent) trackEvent('language_selected', { lang: next })
  }, [])

  const enterWithQr = useCallback((payload: QrPayload) => {
    const next: SessionState = {
      entered: true,
      storeId: payload.storeId,
      campaignId: payload.campaignId,
      entryMethod: 'qr',
    }
    setSession(next)
    localStorage.setItem(SESSION_KEY, JSON.stringify(next))
    setLang(payload.lang, { silent: true })
    trackEvent('qr_scan', { storeId: payload.storeId, campaignId: payload.campaignId })
    trackEvent('language_selected', { lang: payload.lang })
  }, [setLang])

  const enterAsDemo = useCallback(() => {
    const next: SessionState = { ...DEFAULT_SESSION, entered: true, entryMethod: 'demo' }
    setSession(next)
    localStorage.setItem(SESSION_KEY, JSON.stringify(next))
    trackEvent('qr_scan', { storeId: next.storeId, campaignId: next.campaignId, demo: true })
  }, [])

  const addToCart = useCallback((item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((line) => line.item.id === item.id)
      if (existing) {
        return prev.map((line) => (line.item.id === item.id ? { ...line, qty: line.qty + 1 } : line))
      }
      return [...prev, { item, qty: 1 }]
    })
    showToast(dict[lang].toastAddedToCart)
  }, [lang, showToast])

  const removeFromCart = useCallback((itemId: string) => {
    setCart((prev) => prev.filter((line) => line.item.id !== itemId))
  }, [])

  const clearCart = useCallback(() => setCart([]), [])

  const t: TFn = useCallback((key, ...args) => {
    const entry = dict[lang][key]
    if (typeof entry === 'function') {
      return (entry as (...a: unknown[]) => string)(...args)
    }
    return entry as string
  }, [lang])

  const cartTotal = useMemo(() => cart.reduce((sum, line) => sum + line.item.price * line.qty, 0), [cart])
  const cartCount = useMemo(() => cart.reduce((sum, line) => sum + line.qty, 0), [cart])

  const value: AppContextValue = {
    lang,
    setLang,
    t,
    session,
    enterWithQr,
    enterAsDemo,
    weather,
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    cartTotal,
    cartCount,
    toast,
    showToast,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
