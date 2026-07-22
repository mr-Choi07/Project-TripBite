import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

interface Props {
  /** Called once per successful decode. The scanner keeps its camera feed
   * running after calling this — callers that only want one shot should
   * stop rendering this component (e.g. flip a `done` flag) once they get
   * a hit they accept, rather than relying on the scanner to stop itself. */
  onDetected: (text: string) => void
  active?: boolean
}

type CameraState = 'starting' | 'ready' | 'denied' | 'unavailable'

/** Reads QR codes from the device camera: grabs frames from a hidden
 * <video> onto a <canvas>, and runs jsQR against the pixel data on every
 * animation frame. No native browser QR API is universal enough (Chrome's
 * BarcodeDetector isn't in Firefox/Safari), so this is a plain, dependency-light
 * decode loop instead. */
export default function QrScanner({ onDetected, active = true }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectedRef = useRef(false)
  const [state, setState] = useState<CameraState>('starting')

  useEffect(() => {
    if (!active) return
    detectedRef.current = false
    let cancelled = false

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unavailable')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setState('ready')
        tick()
      } catch (err) {
        console.error('[QrScanner] camera access failed', err)
        setState('denied')
      }
    }

    function tick() {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || detectedRef.current) return

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height)
          if (code?.data) {
            detectedRef.current = true
            onDetected(code.data)
            return
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    start()

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />

      {state === 'denied' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-tb-ink px-6 text-center text-white">
          <p className="text-sm font-semibold">카메라 접근이 거부됐어요</p>
          <p className="text-xs text-white/60">브라우저 설정에서 카메라 권한을 허용한 뒤 다시 시도해주세요.</p>
        </div>
      )}
      {state === 'unavailable' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-tb-ink px-6 text-center text-white">
          <p className="text-sm font-semibold">이 기기/브라우저에서는 카메라를 사용할 수 없어요</p>
        </div>
      )}
    </div>
  )
}
