import QRCode from 'qrcode'
import type { Lang, QrPayload } from '../types'
import { SUNRISE_BOWL } from '../data/place'

/** Encoded into the printed QR at the table. Scanning it — whether through
 * the in-app scanner (parseQrUrl) or a phone's plain camera app — must land
 * on a real, live URL: the `/enter` route (see App.tsx) reads these same
 * query params and carries the store, geolocation, language and campaign
 * straight into the app, same as the in-app scan path does. */
export function buildQrUrl(payload: QrPayload): string {
  const params = new URLSearchParams({
    store: payload.storeId,
    lat: String(payload.lat),
    lng: String(payload.lng),
    lang: payload.lang,
    campaign: payload.campaignId,
  })
  return `https://tripbite.kr/enter?${params.toString()}`
}

export function parseQrUrl(raw: string): QrPayload | null {
  try {
    const url = new URL(raw)
    const lang = url.searchParams.get('lang')
    const storeId = url.searchParams.get('store')
    const lat = Number(url.searchParams.get('lat'))
    const lng = Number(url.searchParams.get('lng'))
    const campaignId = url.searchParams.get('campaign')
    if (!storeId || !campaignId || Number.isNaN(lat) || Number.isNaN(lng)) return null
    const validLang: Lang =
      lang === 'ko' || lang === 'en' || lang === 'ja' || lang === 'zh' || lang === 'fr' || lang === 'es' ? lang : 'en'
    return { storeId, lat, lng, lang: validLang, campaignId }
  } catch {
    return null
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Renders a QR code with the store's logo composited into the center —
 * the same pattern Starbucks/KakaoPay-style branded QR codes use. Always
 * uses error-correction level 'H' (~30% tolerance); the *entire* white plate
 * (logo + its padding) is capped at ~26% of the code's width, safely under
 * that tolerance so covering the center never breaks scannability. Falls
 * back to a plain QR if there's no logo or the logo image fails to load
 * (e.g. a transient network hiccup — a working QR matters far more than
 * the branding). */
export async function generateQrWithLogo(url: string, logoImageUrl?: string, size = 512): Promise<string> {
  const qrDataUrl = await QRCode.toDataURL(url, { width: size, margin: 2, errorCorrectionLevel: 'H' })
  if (!logoImageUrl) return qrDataUrl

  try {
    const [qrImg, logoImg] = await Promise.all([loadImage(qrDataUrl), loadImage(logoImageUrl)])

    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return qrDataUrl

    ctx.drawImage(qrImg, 0, 0, size, size)

    // `boxSize` (the whole white plate) is the safety-bounded number — kept
    // well under the ~30% tolerance of error-correction level 'H'. The logo
    // only fills 70% of that plate, so there's a generous, clearly visible
    // margin around it instead of a thin sliver — that's what makes this
    // read as "clean badge" rather than "square sticker slapped on top".
    const boxSize = size * 0.26
    const logoSize = boxSize * 0.7
    const boxPos = (size - boxSize) / 2
    const logoPos = (size - logoSize) / 2

    function roundedRectPath(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
      c.beginPath()
      c.moveTo(x + r, y)
      c.arcTo(x + w, y, x + w, y + h, r)
      c.arcTo(x + w, y + h, x, y + h, r)
      c.arcTo(x, y + h, x, y, r)
      c.arcTo(x, y, x + w, y, r)
      c.closePath()
    }

    // White backing plate behind the logo so it reads cleanly against the
    // QR's black modules instead of blending into them, with a faint border
    // for definition against light logo backgrounds.
    roundedRectPath(ctx, boxPos, boxPos, boxSize, boxSize, boxSize * 0.22)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = '#e6e1d6'
    ctx.lineWidth = size * 0.004
    ctx.stroke()

    // Clip the logo itself to a rounded square too, rather than pasting a
    // hard-cornered image straight onto a rounded plate.
    ctx.save()
    roundedRectPath(ctx, logoPos, logoPos, logoSize, logoSize, logoSize * 0.22)
    ctx.clip()
    ctx.drawImage(logoImg, logoPos, logoPos, logoSize, logoSize)
    ctx.restore()

    return canvas.toDataURL('image/png')
  } catch (err) {
    console.error('[qr] failed to composite logo onto QR, falling back to plain QR', err)
    return qrDataUrl
  }
}

export function demoQrPayload(lang: Lang = 'ja'): QrPayload {
  return {
    storeId: SUNRISE_BOWL.storeId,
    lat: SUNRISE_BOWL.lat,
    lng: SUNRISE_BOWL.lng,
    lang,
    campaignId: SUNRISE_BOWL.campaignId,
  }
}
