import { getFunctions, httpsCallable, type HttpsCallableResult } from 'firebase/functions'
import { firebaseApp } from './firebase'
import type { Lang } from '../types'

const functions = getFunctions(firebaseApp, 'asia-northeast3')

export type TranslatableLang = Exclude<Lang, 'ko'>

interface TranslateFieldsRequest {
  fields: Record<string, string>
  targetLangs?: TranslatableLang[]
}

interface TranslateFieldsResponse {
  translations: Partial<Record<TranslatableLang, Record<string, string>>>
}

export class TranslationNotConfiguredError extends Error {}

/**
 * Sends Korean field values (e.g. { name: '핑크 알로하', description: '...' })
 * to the `translateFields` Cloud Function and gets back a draft translation
 * for each other supported language. Meant to prefill an owner-facing form —
 * the result is a starting point, not a final copy.
 *
 * Throws `TranslationNotConfiguredError` if the DEEPL_API_KEY secret hasn't
 * been set on the function yet; callers should catch that specifically and
 * fall back to manual multi-language entry instead of blocking the save.
 */
export async function translateFromKorean(
  fields: Record<string, string>,
  targetLangs?: TranslatableLang[],
): Promise<Partial<Record<TranslatableLang, Record<string, string>>>> {
  const call = httpsCallable<TranslateFieldsRequest, TranslateFieldsResponse>(functions, 'translateFields')

  let res: HttpsCallableResult<TranslateFieldsResponse>
  try {
    res = await call({ fields, targetLangs })
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'functions/failed-precondition') {
      throw new TranslationNotConfiguredError('Translation API key is not configured yet.')
    }
    throw err
  }

  return res.data.translations
}
