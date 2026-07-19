import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'

export function isOwnerUser(user: User | null): boolean {
  return Boolean(user && !user.isAnonymous)
}

export async function ownerSignUp(email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  return cred.user
}

export async function ownerSignIn(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  return cred.user
}

export async function ownerSignOut() {
  await signOut(auth)
}
