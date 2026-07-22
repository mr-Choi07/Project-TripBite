import {
  GoogleAuthProvider,
  getAdditionalUserInfo,
  linkWithPopup,
  signInWithPopup,
  signOut,
  unlink,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'

const googleProvider = new GoogleAuthProvider()

/** Thrown when someone tries "Google 로그인" with a Google account that was
 * never explicitly linked to a TripBite owner account. We deliberately don't
 * let Google sign-in stand alone as its own identity (see class comment on
 * `signInWithGoogleLinked`), so this is the caller's cue to send them to the
 * email sign-up/link flow instead of treating them as authenticated. */
export class GoogleNotLinkedError extends Error {
  constructor() {
    super('이 구글 계정은 아직 연동되지 않았습니다. 먼저 이메일로 회원가입 후 계정을 연동해주세요.')
    this.name = 'GoogleNotLinkedError'
  }
}

/** Attaches a Google credential to the *currently signed-in* owner account,
 * enabling "Google로 로그인" as a convenience shortcut for that same account
 * going forward — this is the only way a Google identity is allowed to
 * become usable for sign-in (see signInWithGoogleLinked). */
export async function linkGoogleAccount(user: User): Promise<void> {
  await linkWithPopup(user, googleProvider)
}

/** Removes the Google credential from the account — the owner can still
 * sign in with email/password afterward (every owner account is created
 * that way to begin with; Google is always an addition, never the only
 * provider), so this can't lock anyone out. */
export async function unlinkGoogleAccount(user: User): Promise<void> {
  await unlink(user, GoogleAuthProvider.PROVIDER_ID)
}

/** Google sign-in that only succeeds for an account explicitly linked via
 * `linkGoogleAccount` beforehand — intentionally NOT a standalone "sign in
 * with Google creates/owns an account" flow. If this Google identity has
 * never signed in before (`additionalUserInfo.isNewUser`), Firebase would
 * otherwise silently create a brand-new bare account for it; instead we
 * delete that just-created account, sign out, and surface
 * `GoogleNotLinkedError` so the UI can redirect to email sign-up + linking. */
export async function signInWithGoogleLinked(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider)
    const isNewUser = getAdditionalUserInfo(result)?.isNewUser ?? false
    if (isNewUser) {
      await result.user.delete()
      throw new GoogleNotLinkedError()
    }
    return result.user
  } catch (err) {
    if ((err as { code?: string }).code === 'auth/account-exists-with-different-credential') {
      await signOut(auth).catch(() => {})
      throw new GoogleNotLinkedError()
    }
    throw err
  }
}
