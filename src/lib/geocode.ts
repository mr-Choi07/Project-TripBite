import { getFunctions, httpsCallable } from 'firebase/functions'
import { firebaseApp } from './firebase'

const functions = getFunctions(firebaseApp, 'asia-northeast3')

export class GeocodeNotConfiguredError extends Error {}
export class GeocodeError extends Error {}

/** Looks up lat/lng for a Korean street address via the `geocodeAddress`
 * Cloud Function, so an owner registering a store doesn't have to find and
 * type coordinates by hand. */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number }> {
  const call = httpsCallable<{ address: string }, { lat: number; lng: number }>(functions, 'geocodeAddress')
  try {
    const res = await call({ address })
    return res.data
  } catch (err) {
    const code = (err as { code?: string }).code ?? ''
    const message = (err as { message?: string }).message ?? ''
    if (code === 'functions/failed-precondition' && message.includes('VWORLD_API_KEY')) {
      throw new GeocodeNotConfiguredError('주소 좌표 변환 기능이 아직 설정되지 않았습니다.')
    }
    throw new GeocodeError(message || '좌표 변환에 실패했습니다. 잠시 후 다시 시도해주세요.')
  }
}
