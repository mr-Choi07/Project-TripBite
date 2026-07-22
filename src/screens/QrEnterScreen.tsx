import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { parseQrUrl } from '../lib/qr'

/** Landing target for the URL actually printed into the QR code (see
 * `lib/qr.ts`'s `buildQrUrl`) — this is what runs when a visitor scans the
 * table QR with their phone's plain camera app instead of TripBite's own
 * in-app scanner, so it has to work as a real, standalone page load, not
 * just as text handed to `QrScanOverlay`. Parses the same query params
 * in-app scanning does, then hands off to the normal entered-session flow.
 *
 * Waits for `enterWithQr` to actually finish before rendering the redirect
 * to `/landing` — that route requires `session.entered`, and navigating
 * there in the same tick as a child component's own mount effect isn't
 * guaranteed to run after this component's effect that sets it. */
export default function QrEnterScreen() {
  const { enterWithQr } = useApp()
  const location = useLocation()
  const [entered, setEntered] = useState(false)
  const enteredOnce = useRef(false)

  // Memoized on the actual query string, not recomputed as a fresh object
  // every render — `payload` was a new object literal each render before,
  // which as a `useEffect` dependency retriggered the effect every time,
  // calling `enterWithQr` (and its `setSession`) in an infinite loop.
  const payload = useMemo(
    () => parseQrUrl(`${window.location.origin}${location.pathname}${location.search}`),
    [location.pathname, location.search],
  )

  useEffect(() => {
    // `enterWithQr`'s identity can itself change (it depends on `lang`,
    // which it may update as a side effect of entering) — the ref guard
    // makes sure that re-triggering this effect never calls it a second
    // time, on top of `payload` now being stable.
    if (!payload || enteredOnce.current) return
    enteredOnce.current = true
    enterWithQr(payload)
    setEntered(true)
  }, [payload, enterWithQr])

  if (!payload) return <Navigate to="/" replace />
  if (!entered) return null
  return <Navigate to="/landing" replace />
}
