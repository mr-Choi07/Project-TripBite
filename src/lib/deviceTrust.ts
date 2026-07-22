/** Per-owner, per-browser trusted-device record. `deviceId` is just a lookup
 * key (not secret); `token` is the secret the server hashes and compares —
 * see functions/src/index.ts's `verifyTrustedDevice`. Keyed by uid so a
 * shared browser with multiple owner accounts keeps separate trust. */

function storageKey(uid: string) {
  return `tripbite_device_trust_${uid}`
}

interface DeviceTrust {
  deviceId: string
  token: string
}

export function getDeviceTrust(uid: string): DeviceTrust | null {
  try {
    const raw = localStorage.getItem(storageKey(uid))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DeviceTrust>
    if (!parsed.deviceId || !parsed.token) return null
    return { deviceId: parsed.deviceId, token: parsed.token }
  } catch {
    return null
  }
}

/** Returns this browser's device id for the given owner, generating and
 * persisting a fresh one on first use (before any token exists yet). */
export function getOrCreateDeviceId(uid: string): string {
  const existing = getDeviceTrust(uid)
  if (existing) return existing.deviceId
  return crypto.randomUUID()
}

export function storeDeviceTrust(uid: string, deviceId: string, token: string): void {
  localStorage.setItem(storageKey(uid), JSON.stringify({ deviceId, token }))
}

export function clearDeviceTrust(uid: string): void {
  localStorage.removeItem(storageKey(uid))
}
