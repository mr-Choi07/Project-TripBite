import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from './firebase'

const MAX_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export class ImageUploadError extends Error {}

function extensionFor(file: File): string {
  return file.type.split('/')[1] || 'jpg'
}

/** Uploads an image to `ownerUploads/{uid}/{path}-{timestamp}.<ext>` and
 * returns its public download URL. `path` identifies the slot (e.g. `hero`,
 * `logo`, or `menu/{itemId}`) — each upload gets a fresh, unique filename
 * (rather than always overwriting the same one) so the returned URL is
 * always new too. Re-using the same filename would mean re-uploading a
 * changed image keeps the exact same URL, and browsers (and any CDN in
 * front of Storage) would keep serving the old cached image at that URL
 * indefinitely. Storage rules restrict writes to this exact uid and to
 * fresh 2FA sessions, mirroring firestore.rules' isVerifiedOwner(). */
export async function uploadOwnerImage(uid: string, path: string, file: File): Promise<string> {
  if (file.size > MAX_SIZE_BYTES) throw new ImageUploadError('이미지 크기는 5MB 이하여야 합니다.')
  if (!ALLOWED_TYPES.includes(file.type)) throw new ImageUploadError('JPG, PNG, WEBP, GIF 이미지만 업로드할 수 있습니다.')

  const fileRef = ref(storage, `ownerUploads/${uid}/${path}-${Date.now()}.${extensionFor(file)}`)
  await uploadBytes(fileRef, file, { contentType: file.type })
  return getDownloadURL(fileRef)
}
