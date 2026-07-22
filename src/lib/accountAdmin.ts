import { getFunctions, httpsCallable } from 'firebase/functions'
import { firebaseApp } from './firebase'

const functions = getFunctions(firebaseApp, 'asia-northeast3')

export class AccountAdminError extends Error {}

/** Permanently deletes a store and everything under it (menu, orders,
 * events, visitors). No undo — confirm with the owner before calling. */
export async function deleteStore(storeId: string): Promise<void> {
  const call = httpsCallable<{ storeId: string }, { deleted: boolean }>(functions, 'deleteStore')
  try {
    await call({ storeId })
  } catch (err) {
    throw new AccountAdminError((err as { message?: string }).message || '가게 삭제에 실패했습니다.')
  }
}

/** Permanently deletes the caller's own owner account. Throws
 * `AccountAdminError` (with a user-facing message) if a store still exists
 * under this account — delete that first. */
export async function deleteOwnerAccount(): Promise<void> {
  const call = httpsCallable(functions, 'deleteOwnerAccount')
  try {
    await call({})
  } catch (err) {
    throw new AccountAdminError((err as { message?: string }).message || '계정 삭제에 실패했습니다.')
  }
}
