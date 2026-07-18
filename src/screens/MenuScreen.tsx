import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, ShoppingBag } from 'lucide-react'
import { useApp } from '../context/AppContext'
import AppShell from '../components/layout/AppShell'
import MenuCard from '../components/menu/MenuCard'
import CartSheet from '../components/menu/CartSheet'
import { MENU } from '../data/menu'

export default function MenuScreen() {
  const { t, cart, addToCart, cartCount, cartTotal } = useApp()
  const navigate = useNavigate()
  const [cartOpen, setCartOpen] = useState(false)

  const cartIds = new Set(cart.map((line) => line.item.id))

  return (
    <AppShell title={t('menuTitle')} showBack>
      <div className="px-4 pt-3">
        <p className="text-xs text-tb-ink-soft">{t('menuSubtitle')}</p>

        <button
          type="button"
          onClick={() => navigate('/menu/ai')}
          className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-tb-teal-500 to-tb-teal-600 px-4 py-3.5 text-left text-white shadow-tb-card active:scale-[0.99]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
            <Sparkles size={17} />
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-bold">{t('menuAiCta')}</span>
            <span className="block truncate text-[11px] text-white/80">{t('menuAiCtaSub')}</span>
          </span>
        </button>

        <div className="mt-4 space-y-3 pb-4">
          {MENU.map((item) => (
            <MenuCard key={item.id} item={item} inCart={cartIds.has(item.id)} onAdd={() => addToCart(item)} />
          ))}
        </div>
      </div>

      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-30 mx-auto flex max-w-md justify-center px-4">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-tb-ink px-4 py-3.5 text-white shadow-tb-float active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-sm font-bold">
              <ShoppingBag size={16} />
              {cartCount}
            </span>
            <span className="text-sm font-bold">₩{cartTotal.toLocaleString()}</span>
          </button>
        </div>
      )}

      {cartOpen && <CartSheet onClose={() => setCartOpen(false)} />}
    </AppShell>
  )
}
