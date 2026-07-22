import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Link2, Lock, Phone, ShieldAlert, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import OwnerDashboardShell from '../components/layout/OwnerDashboardShell'
import { findStoreByOwner } from '../lib/storeData'
import { ChangePasswordError, changeOwnerPassword, ownerSignOut, passwordStrengthError } from '../lib/ownerAuth'
import { requestPhoneLink, resetVerifier, unlinkPhone } from '../lib/phoneAuth'
import { markPhoneVerified } from '../lib/otp'
import { linkGoogleAccount, unlinkGoogleAccount } from '../lib/googleAuth'
import { deleteOwnerAccount, deleteStore, AccountAdminError } from '../lib/accountAdmin'
import { auth } from '../lib/firebase'
import type { StorePlace } from '../types'

const PHONE_ROOT_ID = 'account-phone-recaptcha'

function maskPhone(phoneNumber: string): string {
  // Firebase phone numbers are E.164 (+821012345678) — show a Korean-shaped
  // masked form (010-****-5678) rather than the raw international format.
  const digits = phoneNumber.replace(/\D/g, '')
  const local = digits.startsWith('82') ? `0${digits.slice(2)}` : digits
  if (local.length < 8) return phoneNumber
  return `${local.slice(0, 3)}-****-${local.slice(-4)}`
}

export default function OwnerAccountScreen() {
  const { uid, firebaseUser, showToast, refreshFirebaseUser } = useApp()
  const navigate = useNavigate()
  const [myStore, setMyStore] = useState<StorePlace | null>(null)
  const [storeLoaded, setStoreLoaded] = useState(false)

  useEffect(() => {
    if (!uid) return
    let active = true
    findStoreByOwner(uid).then((s) => {
      if (active) {
        setMyStore(s)
        setStoreLoaded(true)
      }
    })
    return () => {
      active = false
    }
  }, [uid])

  const isGoogleLinked = Boolean(firebaseUser?.providerData.some((p) => p.providerId === 'google.com'))

  // --- Google linking ---
  const [googleLinking, setGoogleLinking] = useState(false)
  const [googleLinkError, setGoogleLinkError] = useState<string | null>(null)

  async function handleLinkGoogle() {
    if (!firebaseUser) return
    setGoogleLinkError(null)
    setGoogleLinking(true)
    try {
      await linkGoogleAccount(firebaseUser)
      await refreshFirebaseUser()
      showToast('구글 계정이 연동되었습니다.')
    } catch (err) {
      console.error('[OwnerAccountScreen] Google link failed', err)
      const code = (err as { code?: string }).code ?? ''
      if (code === 'auth/credential-already-in-use') {
        setGoogleLinkError('이미 다른 계정에 연동된 구글 계정입니다.')
      } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setGoogleLinkError(code ? `연동에 실패했습니다. (${code})` : '연동에 실패했습니다. 잠시 후 다시 시도해주세요.')
      }
    } finally {
      setGoogleLinking(false)
    }
  }

  async function handleUnlinkGoogle() {
    if (!firebaseUser) return
    setGoogleLinkError(null)
    setGoogleLinking(true)
    try {
      await unlinkGoogleAccount(firebaseUser)
      await refreshFirebaseUser()
      showToast('구글 계정 연동이 해제되었습니다.')
    } catch (err) {
      console.error('[OwnerAccountScreen] Google unlink failed', err)
      const code = (err as { code?: string }).code ?? ''
      setGoogleLinkError(code ? `연동 해제에 실패했습니다. (${code})` : '연동 해제에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setGoogleLinking(false)
    }
  }

  // --- Password change ---
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordDone, setPasswordDone] = useState(false)

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    setPasswordDone(false)

    const strengthError = passwordStrengthError(newPassword)
    if (strengthError) {
      setPasswordError(strengthError)
      return
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordError('새 비밀번호가 일치하지 않습니다.')
      return
    }

    setPasswordSaving(true)
    try {
      await changeOwnerPassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setNewPasswordConfirm('')
      setPasswordDone(true)
    } catch (err) {
      setPasswordError(err instanceof ChangePasswordError ? err.message : '비밀번호 변경에 실패했습니다.')
    } finally {
      setPasswordSaving(false)
    }
  }

  // --- Phone number change ---
  const [phoneChanging, setPhoneChanging] = useState(false)
  const [newPhoneInput, setNewPhoneInput] = useState('')
  const [phoneConfirmation, setPhoneConfirmation] = useState<Awaited<ReturnType<typeof requestPhoneLink>> | null>(null)
  const [phoneCode, setPhoneCode] = useState('')
  const [phoneSending, setPhoneSending] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  function cancelPhoneChange() {
    setPhoneChanging(false)
    setNewPhoneInput('')
    setPhoneConfirmation(null)
    setPhoneCode('')
    setPhoneError(null)
    resetVerifier()
  }

  async function handleSendNewPhoneCode(e: React.FormEvent) {
    e.preventDefault()
    if (!firebaseUser) return
    setPhoneError(null)
    setPhoneSending(true)
    try {
      // Only unlink if there's actually a phone credential to remove — an
      // account that reached this screen via a trusted-device token issued
      // back when email OTP was still the 2FA method (before phone
      // verification was required) may have no phone provider at all yet,
      // and calling unlink() with nothing linked throws
      // `auth/no-such-provider`.
      if (firebaseUser.phoneNumber) {
        await unlinkPhone(firebaseUser)
      }
      const result = await requestPhoneLink(firebaseUser, newPhoneInput, PHONE_ROOT_ID)
      setPhoneConfirmation(result)
    } catch (err) {
      console.error('[OwnerAccountScreen] phone code send failed', err)
      resetVerifier()
      const code = (err as { code?: string }).code
      setPhoneError(code ? `인증번호 발송에 실패했습니다. (${code})` : '인증번호 발송에 실패했습니다.')
    } finally {
      setPhoneSending(false)
    }
  }

  async function handleConfirmNewPhone(e: React.FormEvent) {
    e.preventDefault()
    if (!phoneConfirmation || !uid) return
    setPhoneError(null)
    setPhoneSending(true)
    try {
      await phoneConfirmation.confirm(phoneCode)
      await auth.currentUser?.getIdToken(true)
      await markPhoneVerified(uid, false)
      await refreshFirebaseUser()
      showToast('휴대폰 번호가 변경되었습니다.')
      cancelPhoneChange()
    } catch (err) {
      const code = (err as { code?: string }).code
      setPhoneError(code === 'auth/invalid-verification-code' ? '인증번호가 올바르지 않습니다.' : '인증에 실패했습니다.')
    } finally {
      setPhoneSending(false)
    }
  }

  // --- Danger zone: delete store ---
  const [deleteStoreConfirm, setDeleteStoreConfirm] = useState('')
  const [deletingStore, setDeletingStore] = useState(false)
  const [deleteStoreError, setDeleteStoreError] = useState<string | null>(null)

  async function handleDeleteStore() {
    if (!myStore || deleteStoreConfirm !== myStore.storeId) return
    setDeletingStore(true)
    setDeleteStoreError(null)
    try {
      await deleteStore(myStore.storeId)
      setMyStore(null)
      setDeleteStoreConfirm('')
      showToast('가게가 삭제되었습니다.')
    } catch (err) {
      setDeleteStoreError(err instanceof AccountAdminError ? err.message : '가게 삭제에 실패했습니다.')
    } finally {
      setDeletingStore(false)
    }
  }

  // --- Danger zone: delete account ---
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null)

  async function handleDeleteAccount() {
    if (deleteAccountConfirm !== '삭제') return
    setDeletingAccount(true)
    setDeleteAccountError(null)
    try {
      await deleteOwnerAccount()
      navigate('/')
    } catch (err) {
      setDeleteAccountError(err instanceof AccountAdminError ? err.message : '계정 삭제에 실패했습니다.')
    } finally {
      setDeletingAccount(false)
    }
  }

  async function handleLogout() {
    await ownerSignOut()
    navigate('/owner/login')
  }

  return (
    <OwnerDashboardShell title="계정">
      <div id={PHONE_ROOT_ID} />
      <div className="max-w-2xl space-y-5 pt-3 lg:pt-0">
        {/* Account info */}
        <div className="rounded-2xl border border-tb-line bg-tb-paper-raised p-5">
          <p className="text-sm font-bold text-tb-ink">계정 정보</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-tb-ink-soft">이메일</span>
              <span className="font-medium text-tb-ink">{firebaseUser?.email}</span>
            </div>
            {firebaseUser?.displayName && (
              <div className="flex items-center justify-between">
                <span className="text-tb-ink-soft">이름</span>
                <span className="font-medium text-tb-ink">{firebaseUser.displayName}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-tb-ink-soft">휴대폰</span>
              <span className="font-medium text-tb-ink">
                {firebaseUser?.phoneNumber ? maskPhone(firebaseUser.phoneNumber) : '-'}
              </span>
            </div>
          </div>

          <div className="mt-4 border-t border-tb-line pt-4">
            {isGoogleLinked ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-tb-teal-50 px-4 py-3">
                <span className="flex items-center gap-1.5 text-xs font-bold text-tb-teal-700">
                  <Check size={14} />
                  구글 계정 연동됨
                </span>
                <button
                  type="button"
                  onClick={handleUnlinkGoogle}
                  disabled={googleLinking}
                  className="text-xs font-semibold text-tb-ink-soft underline-offset-2 hover:underline disabled:opacity-50"
                >
                  {googleLinking ? '해제 중...' : '연동 해제'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleLinkGoogle}
                disabled={googleLinking}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-tb-line py-3 text-sm font-bold text-tb-ink disabled:opacity-50"
              >
                <Link2 size={15} />
                {googleLinking ? '연동 중...' : '구글 계정 연동하기'}
              </button>
            )}
            {googleLinkError && <p className="mt-2 text-xs font-medium text-tb-coral-600">{googleLinkError}</p>}
          </div>
        </div>

        {/* Password change */}
        <div className="rounded-2xl border border-tb-line bg-tb-paper-raised p-5">
          <p className="flex items-center gap-1.5 text-sm font-bold text-tb-ink">
            <Lock size={14} />
            비밀번호 변경
          </p>
          <form onSubmit={handleChangePassword} className="mt-3 space-y-2.5">
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="현재 비밀번호"
              autoComplete="current-password"
              className="w-full rounded-xl border border-tb-line bg-tb-paper px-3 py-2.5 text-sm text-tb-ink outline-none focus:border-tb-teal-400"
            />
            <input
              type="password"
              required
              minLength={10}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="새 비밀번호 (영문+숫자 포함 10자 이상)"
              autoComplete="new-password"
              className="w-full rounded-xl border border-tb-line bg-tb-paper px-3 py-2.5 text-sm text-tb-ink outline-none focus:border-tb-teal-400"
            />
            <input
              type="password"
              required
              minLength={10}
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              placeholder="새 비밀번호 확인"
              autoComplete="new-password"
              className="w-full rounded-xl border border-tb-line bg-tb-paper px-3 py-2.5 text-sm text-tb-ink outline-none focus:border-tb-teal-400"
            />
            {passwordError && <p className="text-xs font-medium text-tb-coral-600">{passwordError}</p>}
            {passwordDone && <p className="text-xs font-medium text-tb-teal-600">비밀번호가 변경되었습니다.</p>}
            <button
              type="submit"
              disabled={passwordSaving}
              className="rounded-xl bg-tb-ink px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {passwordSaving ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>
        </div>

        {/* Phone number change */}
        <div className="rounded-2xl border border-tb-line bg-tb-paper-raised p-5">
          <p className="flex items-center gap-1.5 text-sm font-bold text-tb-ink">
            <Phone size={14} />
            휴대폰 번호 변경
          </p>

          {!phoneChanging ? (
            <button
              type="button"
              onClick={() => setPhoneChanging(true)}
              className="mt-3 rounded-xl border border-tb-line px-5 py-2.5 text-sm font-bold text-tb-ink"
            >
              번호 변경하기
            </button>
          ) : !phoneConfirmation ? (
            <form onSubmit={handleSendNewPhoneCode} className="mt-3 space-y-2.5">
              <input
                type="tel"
                required
                inputMode="numeric"
                value={newPhoneInput}
                onChange={(e) => setNewPhoneInput(e.target.value)}
                placeholder="새 휴대폰 번호 (010-1234-5678)"
                className="w-full rounded-xl border border-tb-line bg-tb-paper px-3 py-2.5 text-sm text-tb-ink outline-none focus:border-tb-teal-400"
              />
              {phoneError && <p className="text-xs font-medium text-tb-coral-600">{phoneError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cancelPhoneChange}
                  className="rounded-xl border border-tb-line px-5 py-2.5 text-sm font-semibold text-tb-ink-soft"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={phoneSending}
                  className="rounded-xl bg-tb-teal-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {phoneSending ? '전송 중...' : '인증번호 받기'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleConfirmNewPhone} className="mt-3 space-y-2.5">
              <input
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                value={phoneCode}
                onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ''))}
                placeholder="인증번호 6자리"
                className="w-full rounded-xl border border-tb-line bg-tb-paper px-3 py-2.5 text-center text-sm font-bold tracking-widest text-tb-ink outline-none focus:border-tb-teal-400"
              />
              {phoneError && <p className="text-xs font-medium text-tb-coral-600">{phoneError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cancelPhoneChange}
                  className="rounded-xl border border-tb-line px-5 py-2.5 text-sm font-semibold text-tb-ink-soft"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={phoneSending || phoneCode.length < 6}
                  className="rounded-xl bg-tb-teal-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {phoneSending ? '확인 중...' : '인증 완료'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Danger zone */}
        <div className="rounded-2xl border border-tb-coral-200 bg-tb-coral-50/40 p-5">
          <p className="flex items-center gap-1.5 text-sm font-bold text-tb-coral-700">
            <ShieldAlert size={14} />
            위험 구역
          </p>

          {storeLoaded && myStore && (
            <div className="mt-4 border-t border-tb-coral-100 pt-4">
              <p className="text-xs font-semibold text-tb-ink">가게 삭제</p>
              <p className="mt-1 text-[11px] leading-relaxed text-tb-ink-soft">
                <span className="font-bold text-tb-coral-600">{myStore.storeId}</span> 가게와 등록된 메뉴·주문 내역이 전부
                삭제됩니다. 되돌릴 수 없습니다.
              </p>
              <input
                value={deleteStoreConfirm}
                onChange={(e) => setDeleteStoreConfirm(e.target.value)}
                placeholder={`확인을 위해 "${myStore.storeId}" 입력`}
                className="mt-2 w-full rounded-xl border border-tb-coral-200 bg-white px-3 py-2.5 text-sm text-tb-ink outline-none focus:border-tb-coral-400"
              />
              {deleteStoreError && <p className="mt-1 text-xs font-medium text-tb-coral-600">{deleteStoreError}</p>}
              <button
                type="button"
                onClick={handleDeleteStore}
                disabled={deletingStore || deleteStoreConfirm !== myStore.storeId}
                className="mt-2 flex items-center gap-1.5 rounded-xl bg-tb-coral-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
              >
                <Trash2 size={14} />
                {deletingStore ? '삭제 중...' : '가게 영구 삭제'}
              </button>
            </div>
          )}

          <div className="mt-4 border-t border-tb-coral-100 pt-4">
            <p className="text-xs font-semibold text-tb-ink">계정 삭제</p>
            <p className="mt-1 text-[11px] leading-relaxed text-tb-ink-soft">
              {myStore
                ? '등록된 가게가 있으면 계정을 삭제할 수 없어요. 먼저 위에서 가게를 삭제해주세요.'
                : '계정이 영구 삭제되며 다시 복구할 수 없습니다.'}
            </p>
            {!myStore && (
              <>
                <input
                  value={deleteAccountConfirm}
                  onChange={(e) => setDeleteAccountConfirm(e.target.value)}
                  placeholder='확인을 위해 "삭제" 입력'
                  className="mt-2 w-full rounded-xl border border-tb-coral-200 bg-white px-3 py-2.5 text-sm text-tb-ink outline-none focus:border-tb-coral-400"
                />
                {deleteAccountError && <p className="mt-1 text-xs font-medium text-tb-coral-600">{deleteAccountError}</p>}
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount || deleteAccountConfirm !== '삭제'}
                  className="mt-2 flex items-center gap-1.5 rounded-xl bg-tb-coral-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                >
                  <Trash2 size={14} />
                  {deletingAccount ? '삭제 중...' : '계정 영구 삭제'}
                </button>
              </>
            )}
          </div>
        </div>

        <button type="button" onClick={handleLogout} className="text-xs font-semibold text-tb-ink-soft lg:hidden">
          로그아웃
        </button>
      </div>
    </OwnerDashboardShell>
  )
}
