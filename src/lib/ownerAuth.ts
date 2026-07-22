import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth'
import { auth, authReady } from './firebase'

/** Minimum bar for an owner password: 10+ chars with at least one letter and
 * one digit. Firebase Auth's own password policy (configured in the console)
 * is the server-enforced backstop — this just gives the owner a clear,
 * friendly error before the request round-trip. */
const PASSWORD_MIN_LENGTH = 10

export function passwordStrengthError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return '비밀번호는 영문과 숫자를 함께 포함해야 합니다.'
  return null
}

/** Must match OTP_SESSION_TTL_MS in functions/src/index.ts — this is only
 * the client-side mirror used to decide what to render; the actual access
 * control is enforced server-side (Firestore rules, Cloud Functions) against
 * the same claim, so a stale client value here just means a Firestore write
 * gets rejected, not a security gap. */
const OTP_SESSION_TTL_MS = 24 * 60 * 60 * 1000

export function isOwnerUser(user: User | null): boolean {
  return Boolean(user && !user.isAnonymous)
}

/** A real owner account whose current session has passed OTP 2FA recently
 * (typed a code, or silently re-confirmed via a trusted device) — not just
 * "verified their email once, ever". Store registration/management is gated
 * on this, not just `isOwnerUser`, so a stolen password alone doesn't grant
 * access. `otpVerifiedAt`/`authTime` come from the ID token (see AppContext,
 * which reads them via `getIdTokenResult()`).
 *
 * The `otpVerifiedAt >= authTime` check matters: `otpVerifiedAt` lives on
 * the account, not the current sign-in, so without it a brand-new sign-in
 * (possibly on an untrusted device, with just a stolen password) would
 * inherit an older session's leftover freshness for up to 24h instead of
 * being forced through OTP/trusted-device verification again. */
export function isVerifiedOwner(user: User | null, otpVerifiedAt: number | null, authTime: number | null): boolean {
  return (
    isOwnerUser(user) &&
    otpVerifiedAt != null &&
    authTime != null &&
    otpVerifiedAt >= authTime &&
    Date.now() - otpVerifiedAt < OTP_SESSION_TTL_MS
  )
}

/** Creates the account only — the caller is responsible for routing the
 * owner through phone verification (see screens/PhoneVerifyGate.tsx) right
 * after, so a failure there doesn't leave the account in a confusing
 * half-verified state either way.
 *
 * Waits for the app's initial anonymous sign-in to finish first: that call
 * kicks off on page load and races this one otherwise — if it resolves
 * *after* the owner's real sign-in, it silently overwrites the session back
 * to anonymous. Awaiting `authReady` sequences them instead of racing. */
export async function ownerSignUp(email: string, password: string, name: string) {
  await authReady
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(cred.user, { displayName: name })
  return cred.user
}

export async function ownerSignIn(email: string, password: string) {
  await authReady
  const cred = await signInWithEmailAndPassword(auth, email, password)
  return cred.user
}

export async function ownerSignOut() {
  await signOut(auth)
}

export class ChangePasswordError extends Error {}

/** Changes the signed-in owner's password — re-authenticates with the
 * current password first (Firebase requires a "recent login" for sensitive
 * account changes like this; without it, `updatePassword` throws
 * `auth/requires-recent-login`), so the current password doubles as proof
 * of intent rather than just relying on the existing session. */
export async function changeOwnerPassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser
  if (!user?.email) throw new ChangePasswordError('로그인 정보를 확인할 수 없습니다.')

  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword))
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      throw new ChangePasswordError('현재 비밀번호가 올바르지 않습니다.')
    }
    throw new ChangePasswordError('본인 확인에 실패했습니다. 잠시 후 다시 시도해주세요.')
  }

  try {
    await updatePassword(user, newPassword)
  } catch {
    throw new ChangePasswordError('비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해주세요.')
  }
}
