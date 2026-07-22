import { getFunctions, httpsCallable } from 'firebase/functions'
import { firebaseApp } from './firebase'

const functions = getFunctions(firebaseApp, 'asia-northeast3')

export class BusinessVerifyError extends Error {}
export class BusinessVerifyNotConfiguredError extends BusinessVerifyError {}

interface VerifyBusinessRegistrationRequest {
  businessNumber: string
  representativeName: string
  /** YYYYMMDD */
  openDate: string
}

/** Confirms a 사업자등록번호 + 대표자성명 + 개업일자 combination is real and
 * currently active via the NTS 진위확인 API, before a store can be created.
 * Throws `BusinessVerifyNotConfiguredError` if the NTS_API_KEY secret hasn't
 * been set on the function yet, or `BusinessVerifyError` with the NTS
 * rejection reason (wrong info, closed business, etc.) otherwise. */
export async function verifyBusinessRegistration(input: VerifyBusinessRegistrationRequest): Promise<void> {
  const call = httpsCallable<VerifyBusinessRegistrationRequest, { verified: boolean }>(
    functions,
    'verifyBusinessRegistration',
  )
  try {
    await call(input)
  } catch (err) {
    const code = (err as { code?: string }).code
    const message = (err as { message?: string }).message ?? '사업자등록정보를 확인할 수 없습니다.'
    if (code === 'functions/failed-precondition' && message.includes('NTS_API_KEY')) {
      throw new BusinessVerifyNotConfiguredError('Business verification is not configured yet.')
    }
    throw new BusinessVerifyError(message)
  }
}
