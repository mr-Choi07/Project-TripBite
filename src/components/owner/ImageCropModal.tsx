import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, X, ZoomIn } from 'lucide-react'

interface Props {
  file: File
  /** width / height of both the crop viewport and the final output. */
  aspectRatio: number
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}

const VIEWPORT_WIDTH = 300
const MAX_ZOOM = 3

/** Output resolution is a fixed multiple of the viewport, not tied to the
 * source image's native size — cropping a huge source photo shouldn't
 * upload it at full resolution, and a small source shouldn't visibly
 * upscale beyond what the crop UI already showed. */
const OUTPUT_SCALE = 3

export default function ImageCropModal({ file, aspectRatio, onCancel, onConfirm }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const viewportHeight = VIEWPORT_WIDTH / aspectRatio

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const baseScale = useMemo(() => {
    if (!natural) return 1
    return Math.max(VIEWPORT_WIDTH / natural.w, viewportHeight / natural.h)
  }, [natural, viewportHeight])

  const displayScale = baseScale * zoom
  const dispW = natural ? natural.w * displayScale : 0
  const dispH = natural ? natural.h * displayScale : 0

  function clamp(next: { x: number; y: number }, w: number, h: number) {
    const minX = Math.min(0, VIEWPORT_WIDTH - w)
    const minY = Math.min(0, viewportHeight - h)
    return { x: Math.min(0, Math.max(minX, next.x)), y: Math.min(0, Math.max(minY, next.y)) }
  }

  function handleImageLoad() {
    const el = imgRef.current
    if (!el) return
    const w = el.naturalWidth
    const h = el.naturalHeight
    setNatural({ w, h })
    const scale = Math.max(VIEWPORT_WIDTH / w, viewportHeight / h)
    setPos({ x: (VIEWPORT_WIDTH - w * scale) / 2, y: (viewportHeight - h * scale) / 2 })
  }

  function handlePointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current || !natural) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setPos(clamp({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy }, dispW, dispH))
  }

  function handlePointerUp() {
    dragRef.current = null
  }

  function handleZoomChange(next: number) {
    if (!natural) return
    const nextDispW = natural.w * baseScale * next
    const nextDispH = natural.h * baseScale * next
    // Keep the same viewport-center point anchored while zooming, instead
    // of re-centering on the whole image.
    const centerX = pos.x - VIEWPORT_WIDTH / 2
    const centerY = pos.y - viewportHeight / 2
    const ratio = next / zoom
    setZoom(next)
    setPos(
      clamp(
        { x: centerX * ratio + VIEWPORT_WIDTH / 2, y: centerY * ratio + viewportHeight / 2 },
        nextDispW,
        nextDispH,
      ),
    )
  }

  function handleConfirm() {
    const el = imgRef.current
    if (!el || !natural) return

    const canvas = document.createElement('canvas')
    canvas.width = VIEWPORT_WIDTH * OUTPUT_SCALE
    canvas.height = viewportHeight * OUTPUT_SCALE
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(
      el,
      0,
      0,
      natural.w,
      natural.h,
      pos.x * OUTPUT_SCALE,
      pos.y * OUTPUT_SCALE,
      dispW * OUTPUT_SCALE,
      dispH * OUTPUT_SCALE,
    )

    // JPEG has no alpha channel — cropping a background-removed (transparent)
    // PNG/WEBP through it would flatten the transparent areas to black. Keep
    // JPEG (smaller output) for opaque source photos, but preserve the
    // source format's transparency support when it might have any.
    const preserveAlpha = file.type === 'image/png' || file.type === 'image/webp'
    if (preserveAlpha) {
      canvas.toBlob((blob) => {
        if (blob) onConfirm(blob)
      }, 'image/png')
    } else {
      canvas.toBlob(
        (blob) => {
          if (blob) onConfirm(blob)
        },
        'image/jpeg',
        0.92,
      )
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-tb-ink/90 px-6">
      <div className="w-full max-w-xs rounded-3xl bg-tb-paper-raised p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-tb-ink">이미지 위치 조정</p>
          <button type="button" onClick={onCancel} className="text-tb-ink-soft">
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-[11px] text-tb-ink-soft">드래그해서 위치를 옮기고, 슬라이더로 확대/축소하세요</p>

        <div
          className="relative mt-3 touch-none select-none overflow-hidden rounded-2xl border border-tb-line bg-tb-ink"
          style={{ width: VIEWPORT_WIDTH, height: viewportHeight }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {imageUrl && (
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
            <img
              ref={imgRef}
              src={imageUrl}
              alt=""
              draggable={false}
              onLoad={handleImageLoad}
              className="absolute max-w-none cursor-grab active:cursor-grabbing"
              style={{ left: pos.x, top: pos.y, width: dispW, height: dispH }}
            />
          )}
        </div>

        <div className="mt-4 flex items-center gap-2.5">
          <ZoomIn size={15} className="text-tb-ink-soft" />
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => handleZoomChange(Number(e.target.value))}
            className="w-full accent-tb-teal-500"
          />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-tb-line py-2.5 text-sm font-semibold text-tb-ink-soft"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!natural}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-tb-teal-500 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            <Check size={15} />
            적용
          </button>
        </div>
      </div>
    </div>,
    // Portals into the app frame (see App.tsx) rather than document.body —
    // on a wide desktop viewport the frame is a fixed-width column with its
    // own containing block, so a plain document.body portal would render
    // this "fixed inset-0" full real-viewport-wide instead of staying
    // confined to the frame like the rest of the UI.
    document.getElementById('tb-app-frame') ?? document.body,
  )
}
