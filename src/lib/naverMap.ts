/** Naver Cloud Platform Maps (Dynamic Map) is script-tag distributed, not an
 * npm package. This loader injects the script once and resolves once
 * `window.naver.maps` is ready, so React components can just `await` it. */

// Minimal shape of the Naver Maps JS SDK v3 surface this app actually uses.
export interface NaverLatLng {
  readonly __brand?: 'LatLng'
}
export interface NaverLatLngBounds {
  extend(latlng: NaverLatLng): void
}
export interface NaverPoint {
  readonly __brand?: 'Point'
}
export interface NaverMap {
  fitBounds(bounds: NaverLatLngBounds, margin?: number): void
  setCenter(latlng: NaverLatLng): void
}
export interface NaverMarker {
  setMap(map: NaverMap | null): void
}
export interface NaverPolyline {
  setMap(map: NaverMap | null): void
}
export type NaverOverlay = NaverMarker | NaverPolyline

export interface NaverMapsNamespace {
  LatLng: new (lat: number, lng: number) => NaverLatLng
  LatLngBounds: new () => NaverLatLngBounds
  Point: new (x: number, y: number) => NaverPoint
  Size: new (width: number, height: number) => NaverPoint
  Map: new (el: HTMLElement, options: Record<string, unknown>) => NaverMap
  Marker: new (options: Record<string, unknown>) => NaverMarker
  Polyline: new (options: Record<string, unknown>) => NaverPolyline
}

export interface NaverGlobal {
  maps: NaverMapsNamespace
}

declare global {
  interface Window {
    naver?: NaverGlobal
  }
}

let loadPromise: Promise<NaverGlobal> | null = null

export function loadNaverMaps(): Promise<NaverGlobal> {
  if (window.naver?.maps) return Promise.resolve(window.naver)
  if (loadPromise) return loadPromise

  const clientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID as string | undefined
  if (!clientId) return Promise.reject(new Error('VITE_NAVER_MAP_CLIENT_ID is not set'))

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`
    script.async = true
    script.onload = () => {
      if (window.naver?.maps) resolve(window.naver)
      else reject(new Error('Naver Maps script loaded but window.naver.maps is missing'))
    }
    script.onerror = () => reject(new Error('Failed to load Naver Maps script'))
    document.head.appendChild(script)
  })

  return loadPromise
}
