import {
  RecaptchaVerifier,
  linkWithPhoneNumber,
  reauthenticateWithPhoneNumber,
  unlink,
  type ConfirmationResult,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'

/** Accepts common Korean mobile input shapes (010-1234-5678, 01012345678,
 * +821012345678) and normalizes to E.164 for Firebase Phone Auth. Returns
 * null if the digits don't look like a Korean mobile number. */
export function toE164Kr(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  const local = digits.startsWith('82') ? `0${digits.slice(2)}` : digits
  if (!/^01[0-9]{8,9}$/.test(local)) return null
  return `+82${local.slice(1)}`
}

let verifier: RecaptchaVerifier | null = null
/** The actual DOM node the current `verifier` is rendered into — tracked
 * separately from `verifier` so `resetVerifier` can remove *this exact
 * node* from the DOM. */
let verifierNode: HTMLElement | null = null
/** Guards against a second `new RecaptchaVerifier(...)` firing while one is
 * already mid-construction — e.g. a fast double-tap on the submit button
 * beating React's `disabled` state update. */
let creating = false

/** Lazily creates an invisible reCAPTCHA inside `rootId` (a stable element
 * that must already be mounted — see PhoneVerifyGate). Google's grecaptcha
 * tracks "has this widget already been rendered" per *DOM node identity*,
 * not by content — so simply clearing a reused container's innerHTML isn't
 * enough to let a second RecaptchaVerifier render into it; it still throws
 * "reCAPTCHA has already been rendered in this element". Instead, every
 * fresh verifier gets its own brand-new child node that grecaptcha has never
 * seen before, appended into `rootId`. */
function getVerifier(rootId: string): RecaptchaVerifier {
  if (verifier) return verifier
  if (creating) throw new Error('인증을 준비하는 중이에요. 잠시 후 다시 시도해주세요.')
  creating = true
  try {
    const root = document.getElementById(rootId)
    if (!root) throw new Error('reCAPTCHA 컨테이너를 찾을 수 없습니다.')
    const node = document.createElement('div')
    root.appendChild(node)
    verifier = new RecaptchaVerifier(auth, node, { size: 'invisible' })
    verifierNode = node
    return verifier
  } finally {
    creating = false
  }
}

/** Tears down the current verifier and removes its DOM node entirely (not
 * just its contents), so the *next* `getVerifier` call always renders into a
 * node grecaptcha has never touched. Call this on every verification error
 * before the owner retries. */
export function resetVerifier(): void {
  verifier?.clear()
  verifier = null
  verifierNode?.remove()
  verifierNode = null
}

/** Links a phone credential to the currently signed-in owner account (rather
 * than signing in with phone as a separate identity) — this is purely an
 * identity-strengthening step at signup, so the phone number ends up
 * attached to the same account that already owns the email/password. Only
 * valid the *first* time — a number can't be linked twice, so returning
 * owners re-verify via `requestPhoneReverify` instead. */
export async function requestPhoneLink(user: User, phoneNumber: string, rootId: string): Promise<ConfirmationResult> {
  const e164 = toE164Kr(phoneNumber)
  if (!e164) throw new Error('올바른 휴대폰 번호를 입력해주세요.')
  return linkWithPhoneNumber(user, e164, getVerifier(rootId))
}

/** Re-sends a code to a phone number *already* linked to this account —
 * used when a returning owner's session has gone stale (new device, expired
 * trust) and they just need to re-prove they still hold the same number,
 * without re-typing it. */
export async function requestPhoneReverify(user: User, rootId: string): Promise<ConfirmationResult> {
  if (!user.phoneNumber) throw new Error('연동된 휴대폰 번호가 없습니다.')
  return reauthenticateWithPhoneNumber(user, user.phoneNumber, getVerifier(rootId))
}

/** Removes the phone credential from the current account so a *different*
 * number can be linked in its place via `requestPhoneLink` — a phone number
 * can only ever be linked once, so changing numbers means unlinking the old
 * one first rather than linking on top of it. */
export async function unlinkPhone(user: User): Promise<void> {
  await unlink(user, 'phone')
}
