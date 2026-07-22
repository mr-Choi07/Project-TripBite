import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import LanguageSwitcher from '../ui/LanguageSwitcher'

interface TopBarProps {
  title?: string
  showBack?: boolean
  showLang?: boolean
  transparent?: boolean
}

export default function TopBar({ title, showBack = false, showLang = true, transparent = false }: TopBarProps) {
  const navigate = useNavigate()
  const { t } = useApp()

  return (
    <header
      className={`sticky top-0 z-30 flex items-center justify-between px-4 py-3 ${
        transparent ? '' : 'border-b border-tb-line bg-tb-paper/95 backdrop-blur'
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {showBack && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={t('back')}
            className="-ml-1.5 flex h-8 w-8 items-center justify-center rounded-full text-tb-ink hover:bg-tb-teal-50"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {title ? (
          <h1 className="truncate text-[15px] font-bold text-tb-ink">{title}</h1>
        ) : (
          <span className="text-[15px] font-extrabold tracking-tight text-tb-teal-600">TripBite</span>
        )}
      </div>
      {showLang && <LanguageSwitcher compact />}
    </header>
  )
}
