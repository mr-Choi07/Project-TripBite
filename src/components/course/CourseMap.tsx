import { useEffect, useRef, useState } from 'react'
import { MapPinned } from 'lucide-react'
import { loadNaverMaps, type NaverMap, type NaverOverlay } from '../../lib/naverMap'

export interface MapPoint {
  lat: number
  lng: number
  label: string
}

type Status = 'loading' | 'ready' | 'error'

export default function CourseMap({ origin, stops }: { origin: MapPoint; stops: MapPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<NaverMap | null>(null)
  const overlaysRef = useRef<NaverOverlay[]>([])
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    let cancelled = false
    loadNaverMaps()
      .then((nv) => {
        if (cancelled || !containerRef.current || mapRef.current) return
        mapRef.current = new nv.maps.Map(containerRef.current, {
          center: new nv.maps.LatLng(origin.lat, origin.lng),
          zoom: 15,
          scaleControl: false,
          mapDataControl: false,
          logoControlOptions: { position: 11 },
        })
        setStatus('ready')
      })
      .catch((err) => {
        console.warn('[CourseMap] failed to load Naver Maps', err)
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || !window.naver) return
    const nv = window.naver
    const map = mapRef.current

    overlaysRef.current.forEach((overlay) => overlay.setMap(null))
    overlaysRef.current = []

    const points = [{ ...origin, isOrigin: true }, ...stops.map((s) => ({ ...s, isOrigin: false }))]
    const bounds = new nv.maps.LatLngBounds()

    points.forEach((p, i) => {
      const position = new nv.maps.LatLng(p.lat, p.lng)
      bounds.extend(position)
      const badge = p.isOrigin ? 'S' : String(i)
      const bg = p.isOrigin ? '#f3592e' : '#0f6e68'
      const marker = new nv.maps.Marker({
        position,
        map,
        title: p.label,
        icon: {
          content: `<div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:${bg};color:#fff;font:700 12px system-ui;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.25)">${badge}</div>`,
          anchor: new nv.maps.Point(13, 13),
        },
      })
      overlaysRef.current.push(marker)
    })

    if (points.length > 1) {
      const path = points.map((p) => new nv.maps.LatLng(p.lat, p.lng))
      const polyline = new nv.maps.Polyline({
        map,
        path,
        strokeColor: '#0f6e68',
        strokeWeight: 3,
        strokeOpacity: 0.75,
        strokeStyle: 'shortdash',
      })
      overlaysRef.current.push(polyline)
    }

    map.fitBounds(bounds, 48)
  }, [status, origin, stops])

  if (status === 'error') {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-tb-line bg-tb-sand-100/40 text-tb-ink-soft">
        <MapPinned size={18} />
        <p className="text-[11px]">지도를 불러오지 못했습니다</p>
      </div>
    )
  }

  return (
    <div className="relative h-40 overflow-hidden rounded-2xl border border-tb-line">
      <div ref={containerRef} className="h-full w-full" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-tb-sand-100/60">
          <MapPinned size={18} className="animate-pulse text-tb-teal-500" />
        </div>
      )}
    </div>
  )
}
