import { useRef, useState } from 'react'
import { Upload, Loader2, Crop } from 'lucide-react'
import { uploadOwnerImage, ImageUploadError } from '../../lib/storage'
import ImageCropModal from './ImageCropModal'

interface Props {
  label: string
  value: string
  onChange: (url: string) => void
  uid: string
  /** Storage path slot, e.g. `hero`, `logo`, or `menu/{itemId}`. */
  uploadPath: string
  /** width / height of the crop tool and the final uploaded image. Defaults
   * to a wide banner ratio; pass 1 for square slots like a logo or menu photo. */
  aspectRatio?: number
}

export default function ImageUploadField({ label, value, onChange, uid, uploadPath, aspectRatio = 16 / 9 }: Props) {
  const [uploading, setUploading] = useState(false)
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setPendingFile(file)
  }

  /** Re-opens the crop tool on whatever's already in the URL field —
   * pasted-in links and already-uploaded images alike. Cross-origin URLs
   * without permissive CORS headers can't be read back into a canvas at
   * all (the browser blocks it), so this can fail for some external links;
   * we surface that plainly rather than pretend it's a generic error. */
  async function handleAdjustExisting() {
    if (!value) return
    setFetchingUrl(true)
    setError(null)
    try {
      const res = await fetch(value)
      if (!res.ok) throw new Error('fetch failed')
      const blob = await res.blob()
      setPendingFile(new File([blob], 'existing.jpg', { type: blob.type || 'image/jpeg' }))
    } catch {
      setError('이 이미지는 위치 조정을 위해 다시 불러올 수 없어요 (외부 사이트 제한). 파일로 다시 업로드해주세요.')
    } finally {
      setFetchingUrl(false)
    }
  }

  async function handleCropConfirm(blob: Blob) {
    setPendingFile(null)
    setUploading(true)
    setError(null)
    try {
      const croppedFile = new File([blob], 'crop.jpg', { type: 'image/jpeg' })
      const url = await uploadOwnerImage(uid, uploadPath, croppedFile)
      onChange(url)
    } catch (err) {
      setError(err instanceof ImageUploadError ? err.message : '업로드에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setUploading(false)
    }
  }

  const busy = uploading || fetchingUrl

  return (
    <div>
      <label className="text-xs font-semibold text-tb-ink-soft">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        {value && (
          <img src={value} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-tb-line object-cover" />
        )}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="이미지 URL 붙여넣기 또는 파일 업로드"
          className="min-w-0 flex-1 rounded-xl border border-tb-line bg-tb-paper-raised px-3 py-2.5 text-sm text-tb-ink outline-none focus:border-tb-teal-400"
        />
        {value && (
          <button
            type="button"
            onClick={handleAdjustExisting}
            disabled={busy}
            title="위치 조정"
            className="flex shrink-0 items-center gap-1 rounded-xl border border-tb-line bg-tb-paper-raised px-3 py-2.5 text-xs font-semibold text-tb-ink-soft disabled:opacity-50"
          >
            {fetchingUrl ? <Loader2 size={14} className="animate-spin" /> : <Crop size={14} />}
          </button>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="flex shrink-0 items-center gap-1 rounded-xl border border-tb-line bg-tb-paper-raised px-3 py-2.5 text-xs font-semibold text-tb-ink-soft disabled:opacity-50"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? '업로드 중' : '파일 선택'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelected} className="hidden" />
      </div>
      {error && <p className="mt-1 text-[11px] font-medium text-tb-coral-600">{error}</p>}

      {pendingFile && (
        <ImageCropModal
          file={pendingFile}
          aspectRatio={aspectRatio}
          onCancel={() => setPendingFile(null)}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  )
}
