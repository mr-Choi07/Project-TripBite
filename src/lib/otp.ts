import { getFunctions, httpsCallable } from 'firebase/functions'
import { firebaseApp } from './firebase'
import { getOrCreateDeviceId, storeDeviceTrust, getDeviceTrust, clearDeviceTrust } from './deviceTrust'

const functions = getFunctions(firebaseApp, 'asia-northeast3')

/** Marks the current session 2FA-fresh server-side after the client has
 * already confirmed a phone credential via Firebase Auth (linkWithPhoneNumber
 * / reauthenticateWithPhoneNumber). Call `firebaseUser.getIdToken(true)`
 * *before* this so the token the callable sees actually carries the fresh
 * `phone_number` claim the function checks for.
 *
 * Only registers this browser as a trusted device (skipping the code next
 * time, for 90 days) when `trustDevice` is true — the owner opts in via a
 * checkbox on the verification screen rather than every verified device
 * being trusted automatically. */
export async function markPhoneVerified(uid: string, trustDevice: boolean): Promise<void> {
  const call = httpsCallable<{ deviceId?: string }, { verified: boolean; deviceToken?: string }>(
    functions,
    'markPhoneVerified',
  )
  const deviceId = trustDevice ? getOrCreateDeviceId(uid) : undefined
  const res = await call({ deviceId })
  if (deviceId && res.data.deviceToken) storeDeviceTrust(uid, deviceId, res.data.deviceToken)
}

/** Silently re-passes 2FA using a trusted-device token stored from a
 * previous `markPhoneVerified` success, if this browser has one for `uid`.
 * Returns false (without throwing) when there's no local token to try, so
 * callers can distinguish "nothing to attempt" from "attempt failed". A
 * failed/expired/revoked token is cleared locally so it isn't retried. */
export async function tryVerifyTrustedDevice(uid: string): Promise<boolean> {
  const trust = getDeviceTrust(uid)
  if (!trust) return false

  const call = httpsCallable<{ deviceId: string; token: string }, { trusted: boolean }>(functions, 'verifyTrustedDevice')
  try {
    await call({ deviceId: trust.deviceId, token: trust.token })
    return true
  } catch {
    clearDeviceTrust(uid)
    return false
  }
}
