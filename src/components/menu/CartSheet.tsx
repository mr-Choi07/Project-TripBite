import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Trash2, CheckCircle2 } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { pickLocalized } from '../../i18n'

export default function CartSheet({ onClose }: { onClose: () => void }) {
  const { t, lang, cart, removeFromCart, cartTotal, clearCart } = useApp()
  const navigate = useNavigate()
  const [ordered, setOrdered] = useState(false)

  function handleCheckout() {
    setOrdered(true)
  }

  function handleDone() {
    clearCart()
    onClose()
  }

  function handleGoCourse() {
    clearCart()
    onClose()
    navigate('/course')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-tb-ink/50" onClick={onClose} />
      <div className="tb-fade-up relative w-full max-w-md rounded-t-3xl bg-tb-paper-raised p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        {ordered ? (
          <div className="flex flex-col items-center py-4 text-center">
            <CheckCircle2 size={40} className="text-tb-teal-500" />
            <h2 className="mt-3 text-lg font-bold text-tb-ink">{t('cartOrderedTitle')}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-tb-ink-soft">{t('cartOrderedBody')}</p>
            <div className="mt-5 w-full rounded-2xl border border-tb-coral-200 bg-tb-coral-50 px-4 py-3 text-sm font-medium text-tb-coral-600">
              {t('cartAfterOrder')}
            </div>
            <div className="mt-4 flex w-full gap-2">
              <button
                type="button"
                onClick={handleDone}
                className="flex-1 rounded-xl border border-tb-line py-3 text-sm font-semibold text-tb-ink-soft"
              >
                {t('cartClose')}
              </button>
              <button
                type="button"
                onClick={handleGoCourse}
                className="flex-1 rounded-xl bg-tb-coral-500 py-3 text-sm font-bold text-white"
              >
                {t('cartGoCourse')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-tb-ink">{t('cartTitle')}</h2>
              <button type="button" onClick={onClose} className="rounded-full p-1 text-tb-ink-soft">
                <X size={20} />
              </button>
            </div>

            {cart.length === 0 ? (
              <p className="py-10 text-center text-sm text-tb-ink-soft">{t('cartEmpty')}</p>
            ) : (
              <div className="mt-3 max-h-64 space-y-2.5 overflow-y-auto no-scrollbar">
                {cart.map((line) => (
                  <div key={line.item.id} className="flex items-center gap-3">
                    <img src={line.item.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-tb-ink">{pickLocalized(line.item.name, lang)}</p>
                      <p className="text-xs text-tb-ink-soft">
                        {line.qty} × ₩{line.item.price.toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(line.item.id)}
                      className="rounded-full p-1.5 text-tb-ink-soft/60 hover:text-tb-coral-500"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-tb-line pt-3">
              <span className="text-sm font-medium text-tb-ink-soft">{t('cartTotal')}</span>
              <span className="text-lg font-extrabold text-tb-ink">₩{cartTotal.toLocaleString()}</span>
            </div>

            <button
              type="button"
              disabled={cart.length === 0}
              onClick={handleCheckout}
              className="mt-3 w-full rounded-xl bg-tb-ink py-3.5 text-sm font-bold text-white disabled:opacity-40"
            >
              {t('cartCheckout')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
