import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import type { CartLine, Lang, MenuItem, QrPayload, StorePlace, WeatherContext } from '../types'
import dict from '../i18n/translations'
import { trackEvent } from '../lib/analyticsStore'
import { getMenu, getStore } from '../lib/storeData'
import { auth } from '../lib/firebase'
import { isOwnerUser, isVerifiedOwner } from '../lib/ownerAuth'

const LANG_KEY = 'tripbite_lang'
const SESSION_KEY = 'tripbite_session'
const CART_KEY = 'tripbite_cart_v1'

interface SessionState {
  entered: boolean
  storeId: string
  campaignId: string
  /** 'preview' is an owner viewing their own store's tourist screens (see
   * StatsScreen's "관광객 화면 보기") — behaves exactly like a real 'qr' entry
   * except it never counts toward that store's own analytics (see
   * `lib/analyticsStore.ts`'s `trackEvent`, which checks this via
   * localStorage since it has no React context access). */
  entryMethod: 'qr' | 'preview' | null
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
  if (raw === 'ko' || raw === 'en' || raw === 'ja' || raw === 'zh' || raw === 'fr' || raw === 'es') return raw
  return 'en'
}

function readCartRaw(): { itemId: string; qty: number }[] {
  try {
    const raw = localStorage.getItem(CART_KEY)
    if (!raw) return []
    return JSON.parse(raw) as { itemId: string; qty: number }[]
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
  enterAsPreview: (payload: QrPayload) => void
  weather: WeatherContext
  store: StorePlace | null
  menu: MenuItem[]
  storeLoading: boolean
  cart: CartLine[]
  addToCart: (item: MenuItem) => void
  removeFromCart: (itemId: string) => void
  clearCart: () => void
  cartTotal: number
  cartCount: number
  toast: string | null
  showToast: (message: string) => void
  authReady: boolean
  firebaseUser: User | null
  uid: string | null
  isOwner: boolean
  isVerifiedOwner: boolean
  otpVerifiedAt: number | null
  authTime: number | null
  refreshFirebaseUser: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang)
  const [session, setSession] = useState<SessionState>(readSession)
  const [weather] = useState<WeatherContext>(() => WEATHER_POOL[Math.floor(Math.random() * WEATHER_POOL.length)])
  const [store, setStore] = useState<StorePlace | null>(null)
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [storeLoading, setStoreLoading] = useState(true)
  const [cart, setCart] = useState<CartLine[]>([])
  const cartHydrated = useRef(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [otpVerifiedAt, setOtpVerifiedAt] = useState<number | null>(null)
  const [authTime, setAuthTime] = useState<number | null>(null)

  useEffect(() => {
    writeCart(cart)
  }, [cart])

  useEffect(() => {
    let active = true
    setStoreLoading(true)
    Promise.all([getStore(session.storeId), getMenu(session.storeId)]).then(([s, m]) => {
      if (!active) return
      setStore(s)
      setMenu(m)
      setStoreLoading(false)
    })
    return () => {
      active = false
    }
  }, [session.storeId])

  // Cart is persisted as { itemId, qty } pairs, so it can only be resolved
  // into full CartLine[] once the store's menu has loaded. Runs once per
  // menu load rather than on every menu change, so it doesn't clobber cart
  // edits made after the initial hydration.
  useEffect(() => {
    if (cartHydrated.current || menu.length === 0) return
    cartHydrated.current = true
    const stored = readCartRaw()
    const hydrated = stored
      .map((line) => {
        const item = menu.find((m) => m.id === line.itemId)
        return item ? { item, qty: line.qty } : null
      })
      .filter((line): line is CartLine => line !== null)
    if (hydrated.length > 0) setCart(hydrated)
  }, [menu])

  useEffect(() => {
    // lib/firebase.ts owns triggering the anonymous sign-in itself (see
    // `authReady`); this listener just mirrors the resulting auth state.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return
      setFirebaseUser(user)
      setAuthReady(true)
      user.getIdTokenResult().then((result) => {
        const claim = result.claims.otpVerifiedAt
        setOtpVerifiedAt(typeof claim === 'number' ? claim : null)
        setAuthTime(new Date(result.authTime).getTime())
      })
    })
    return unsubscribe
  }, [])

  // After a fresh OTP/trusted-device verification (or the owner clicking an
  // email link in another tab), the SDK's cached user object and ID token
  // still reflect the old state until we force a refresh — this re-fetches
  // both so isVerifiedOwner reflects reality both client-side (React state)
  // and server-side (the token Firestore rules and Cloud Functions see).
  const refreshFirebaseUser = useCallback(async () => {
    if (!auth.currentUser) return
    await auth.currentUser.reload()
    const result = await auth.currentUser.getIdTokenResult(true)
    const claim = result.claims.otpVerifiedAt
    setOtpVerifiedAt(typeof claim === 'number' ? claim : null)
    setAuthTime(new Date(result.authTime).getTime())
    // NOT `{ ...auth.currentUser }` — spreading a Firebase User instance
    // copies only its own data properties and drops everything on its
    // prototype (getIdToken, reload, delete, ...), leaving a method-less
    // impostor that throws "x.getIdToken is not a function" the next time
    // any lib call (phone re-link, password change, etc.) receives this
    // `firebaseUser` from context and tries to call a method on it. The real
    // object is mutated in place by `.reload()` above, and the otpVerifiedAt/
    // authTime state changes just below already guarantee this component
    // re-renders — so passing the live reference through is both correct
    // and sufficient for consumers to see the refreshed fields.
    setFirebaseUser(auth.currentUser)
  }, [])

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(null), 2000)
  }, [])

  const setLang = useCallback((next: Lang, opts?: { silent?: boolean }) => {
    setLangState(next)
    localStorage.setItem(LANG_KEY, next)
    if (!opts?.silent) trackEvent(session.storeId, 'language_selected', { lang: next })
  }, [session.storeId])

  const enterWithQr = useCallback((payload: QrPayload) => {
    const next: SessionState = {
      entered: true,
      storeId: payload.storeId,
      campaignId: payload.campaignId,
      entryMethod: 'qr',
    }
    setSession(next)
    localStorage.setItem(SESSION_KEY, JSON.stringify(next))

    // The QR's encoded language is only a *default suggestion* for a visitor
    // who's never chosen one — if they've already picked a language (even
    // by just using the app once before), scanning a different store's QR
    // must never silently overwrite that explicit choice back to whatever
    // language happened to be baked into this particular code.
    const hasExistingLangPreference = localStorage.getItem(LANG_KEY) !== null
    if (!hasExistingLangPreference) {
      setLang(payload.lang, { silent: true })
    }
    trackEvent(payload.storeId, 'qr_scan')
    trackEvent(payload.storeId, 'language_selected', { lang: hasExistingLangPreference ? lang : payload.lang })
  }, [setLang, lang])

  // Owner previewing their own store's tourist screens (StatsScreen's
  // "관광객 화면 보기") — identical to enterWithQr except entryMethod is
  // 'preview' instead of 'qr', which `trackEvent` checks to skip writing
  // analytics for the rest of this session (see lib/analyticsStore.ts).
  const enterAsPreview = useCallback((payload: QrPayload) => {
    const next: SessionState = {
      entered: true,
      storeId: payload.storeId,
      campaignId: payload.campaignId,
      entryMethod: 'preview',
    }
    setSession(next)
    localStorage.setItem(SESSION_KEY, JSON.stringify(next))
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
    enterAsPreview,
    weather,
    store,
    menu,
    storeLoading,
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    cartTotal,
    cartCount,
    toast,
    showToast,
    authReady,
    firebaseUser,
    uid: firebaseUser?.uid ?? null,
    isOwner: isOwnerUser(firebaseUser),
    isVerifiedOwner: isVerifiedOwner(firebaseUser, otpVerifiedAt, authTime),
    otpVerifiedAt,
    authTime,
    refreshFirebaseUser,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
