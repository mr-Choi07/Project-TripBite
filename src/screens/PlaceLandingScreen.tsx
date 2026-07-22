import { useNavigate } from 'react-router-dom'
import { MapPin, Clock, Sun, Cloud, CloudRain, Users, UtensilsCrossed, Route as RouteIcon, ChevronRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import AppShell from '../components/layout/AppShell'
import { pickLocalized } from '../i18n'
import { LANG_LABEL } from '../i18n'

const WEATHER_ICON = { sunny: Sun, cloudy: Cloud, rainy: CloudRain }

export default function PlaceLandingScreen() {
  const { t, lang, weather, store, storeLoading } = useApp()
  const navigate = useNavigate()
  const WeatherIcon = WEATHER_ICON[weather.condition]
  const weatherLabel = t(`weather${weather.condition.charAt(0).toUpperCase()}${weather.condition.slice(1)}` as 'weatherSunny')

  const crowdLabel = { low: t('crowdLow'), medium: t('crowdMedium'), high: t('crowdHigh') }[weather.crowd]

  if (storeLoading || !store) {
    return (
      <AppShell showBack={false}>
        <div className="flex flex-col items-center gap-2 py-24 text-tb-ink-soft">
          <p className="text-xs">불러오는 중...</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell showBack={false}>
      <div className="relative">
        <img src={store.heroImage} alt="" className="h-52 w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-tb-ink/70 via-tb-ink/10 to-transparent" />
        <img
          src={store.logoImage}
          alt=""
          className="absolute right-4 top-4 h-12 w-12 rounded-full border-2 border-white/70 object-cover shadow-tb-float"
        />
        <div className="absolute bottom-3 left-4 right-4 text-white">
          <span className="inline-block rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold backdrop-blur">
            {t('qrEntryBadge')}
          </span>
          <h1 className="mt-2 text-2xl font-black leading-tight">{pickLocalized(store.name, lang)}</h1>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-white/85">
            <MapPin size={13} />
            {pickLocalized(store.areaName, lang)}
          </p>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="rounded-2xl border border-tb-teal-100 bg-tb-teal-50 px-4 py-3 text-sm font-medium text-tb-teal-700">
          {t('landingConnectMsg')}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-tb-line bg-tb-paper-raised px-3 py-2.5">
            <p className="text-[10px] font-medium text-tb-ink-soft">{t('landingLang')}</p>
            <p className="mt-0.5 text-sm font-bold text-tb-ink">{LANG_LABEL[lang]}</p>
          </div>
          <div className="rounded-xl border border-tb-line bg-tb-paper-raised px-3 py-2.5">
            <p className="text-[10px] font-medium text-tb-ink-soft">{t('landingWeather')}</p>
            <p className="mt-0.5 flex items-center gap-1 text-sm font-bold text-tb-ink">
              <WeatherIcon size={14} className="text-tb-teal-500" />
              {weather.tempC}°C
            </p>
            <p className="text-[10px] text-tb-ink-soft">{weatherLabel}</p>
          </div>
          <div className="rounded-xl border border-tb-line bg-tb-paper-raised px-3 py-2.5">
            <p className="text-[10px] font-medium text-tb-ink-soft">{t('landingCrowd')}</p>
            <p className="mt-0.5 flex items-center gap-1 text-sm font-bold text-tb-ink">
              <Users size={14} className="text-tb-teal-500" />
              {crowdLabel}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-tb-line bg-tb-paper-raised px-4 py-3 text-xs text-tb-ink-soft">
          <Clock size={15} className="text-tb-teal-500" />
          {store.hours}
        </div>

        <p className="mt-5 text-sm leading-relaxed text-tb-ink-soft">{pickLocalized(store.tagline, lang)}</p>

        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={() => navigate('/menu')}
            className="flex w-full items-center justify-between rounded-2xl bg-tb-teal-500 px-5 py-4 text-left text-white shadow-tb-card active:scale-[0.99]"
          >
            <span className="flex items-center gap-2.5 text-[15px] font-bold">
              <UtensilsCrossed size={19} />
              {t('landingViewMenu')}
            </span>
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            onClick={() => navigate('/course')}
            className="flex w-full items-center justify-between rounded-2xl border border-tb-coral-200 bg-tb-coral-50 px-5 py-4 text-left text-tb-coral-600 active:scale-[0.99]"
          >
            <span className="flex items-center gap-2.5 text-[15px] font-bold">
              <RouteIcon size={19} />
              {t('landingViewCourse')}
            </span>
            <ChevronRight size={18} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => navigate('/stats')}
          className="mt-6 flex w-full items-center justify-center gap-1.5 py-2 text-xs text-tb-ink-soft underline decoration-tb-line underline-offset-4"
        >
          {t('ownerLinkLabel')} · {t('ownerLinkAction')}
        </button>
      </div>
    </AppShell>
  )
}
