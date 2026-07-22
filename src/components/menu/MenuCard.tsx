import { Flame, Plus, Check } from 'lucide-react'
import type { MenuItem } from '../../types'
import { useApp } from '../../context/AppContext'
import { pickLocalized } from '../../i18n'
import Tag from '../ui/Tag'

const DIET_TAG_KEY = { vegan: 'tagVegan', vegetarian: 'tagVegetarian', halal: 'tagHalal', 'gluten-free': 'tagGlutenFree' } as const
const ALLERGEN_KEY = {
  seafood: 'allergenSeafood',
  shellfish: 'allergenShellfish',
  nuts: 'allergenNuts',
  dairy: 'allergenDairy',
  egg: 'allergenEgg',
  gluten: 'allergenGluten',
  pork: 'allergenPork',
} as const

export default function MenuCard({ item, inCart, onAdd }: { item: MenuItem; inCart: boolean; onAdd: () => void }) {
  const { t, lang } = useApp()

  return (
    <div className="flex gap-3 rounded-2xl border border-tb-line bg-tb-paper-raised p-3 shadow-tb-card">
      <img src={item.image} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-[15px] font-bold text-tb-ink">{pickLocalized(item.name, lang)}</h3>
              {item.signature && (
                <span className="shrink-0 rounded-full bg-tb-coral-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  {t('signatureLabel')}
                </span>
              )}
            </div>
            <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-tb-ink-soft">{pickLocalized(item.description, lang)}</p>
          </div>
        </div>

        <p className="mt-1.5 text-[11px] leading-snug text-tb-ink-soft/80">
          {t('menuIngredients')}: {item.ingredients[lang].join(', ')}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {item.tags.map((tag) => (
            <Tag key={tag} tone="teal">
              {t(DIET_TAG_KEY[tag])}
            </Tag>
          ))}
          {item.allergens.map((a) => (
            <Tag key={a} tone="warn">
              {t(ALLERGEN_KEY[a])}
            </Tag>
          ))}
          {item.spicyLevel > 0 && (
            <Tag tone="coral" icon={<Flame size={10} />}>
              {t('spicyLabel')} {item.spicyLevel}
            </Tag>
          )}
        </div>

        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[15px] font-extrabold text-tb-ink">₩{item.price.toLocaleString()}</span>
          <button
            type="button"
            onClick={onAdd}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              inCart ? 'bg-tb-teal-50 text-tb-teal-600' : 'bg-tb-ink text-white'
            }`}
          >
            {inCart ? <Check size={13} /> : <Plus size={13} />}
            {inCart ? t('menuAdded') : t('menuAddToCart')}
          </button>
        </div>
      </div>
    </div>
  )
}
