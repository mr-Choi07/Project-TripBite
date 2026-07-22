import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, LogOut, Phone, ShieldCheck } from 'lucide-react'
import type { ConfirmationResult } from 'firebase/auth'
import { useApp } from '../context/AppContext'
import { ownerSignOut } from '../lib/ownerAuth'
import { markPhoneVerified, tryVerifyTrustedDevice } from '../lib/otp'
import { requestPhoneLink, requestPhoneReverify, resetVerifier } from '../lib/phoneAuth'
import { auth } from '../lib/firebase'

const CODE_LENGTH = 6
const RESEND_COOLDOWN_S = 60
const POP_DURATION_MS = 280
const BOX_PITCH = 52 // 44px box (w-11) + 8px gap (gap-2)
const CENTER_INDEX = (CODE_LENGTH - 1) / 2
const RECAPTCHA_CONTAINER_ID = 'phone-verify-recaptcha'

type Phase = 'checking-device' | 'device-trusted' | 'phone-entry' | 'otp'
type VerifyPhase = 'idle' | 'loading' | 'merging' | 'done'

function mapPhoneError(code: string): string {
  const base = (() => {
    switch (code) {
      case 'auth/invalid-phone-number':
        return '휴대폰 번호 형식이 올바르지 않습니다.'
      case 'auth/too-many-requests':
        return '시도 횟수가 많아 일시적으로 제한되었습니다. 잠시 후 다시 시도해주세요.'
      case 'auth/credential-already-in-use':
      case 'auth/provider-already-linked':
        return '이미 다른 계정에 등록된 휴대폰 번호입니다.'
      case 'auth/invalid-verification-code':
        return '인증번호가 올바르지 않습니다.'
      case 'auth/code-expired':
        return '인증번호가 만료되었습니다. 다시 요청해주세요.'
      case 'auth/operation-not-allowed':
        return 'Firebase 콘솔에서 전화(Phone) 로그인 제공업체가 아직 켜져있지 않아요. 관리자에게 문의해주세요.'
      case 'auth/captcha-check-failed':
      case 'auth/invalid-app-credential':
        return 'reCAPTCHA 인증에 실패했어요. 페이지를 새로고침한 뒤 다시 시도해주세요.'
      case 'auth/quota-exceeded':
        return '오늘 발송 가능한 문자 인증 한도를 초과했어요. 잠시 후 다시 시도해주세요.'
      case 'auth/unauthorized-domain':
        return '이 도메인은 Firebase 콘솔의 승인된 도메인 목록에 등록되어 있지 않아요.'
      default:
        return '오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    }
  })()
  // Always append the raw code, even for recognized cases — matching a
  // known case means we're *guessing* what's wrong, not confirming it, and
  // the friendly text has been wrong before despite a confident-looking
  // match. Seeing the real code makes that immediately verifiable.
  return code ? `${base} (${code})` : base
}

export default function PhoneVerifyGate() {
  const { firebaseUser, refreshFirebaseUser } = useApp()
  const navigate = useNavigate()

  const [phase, setPhase] = useState<Phase>('checking-device')
  const [phoneInput, setPhoneInput] = useState('')
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null)
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [verifyPhase, setVerifyPhase] = useState<VerifyPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const [poppedIndex, setPoppedIndex] = useState<number | null>(null)
  const [trustDevice, setTrustDevice] = useState(true)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const deviceCheckOnce = useRef(false)
  const autoSendOnce = useRef(false)

  // Before ever showing verification UI, try to silently re-pass 2FA using a
  // trusted-device token this browser may already hold — a recognized device
  // shouldn't have to verify a phone code on every login.
  useEffect(() => {
    if (deviceCheckOnce.current || !firebaseUser?.uid) return
    deviceCheckOnce.current = true

    tryVerifyTrustedDevice(firebaseUser.uid).then((trusted) => {
      if (trusted) {
        setPhase('device-trusted')
        setTimeout(() => refreshFirebaseUser(), 500)
      } else {
        setPhase(firebaseUser.phoneNumber ? 'otp' : 'phone-entry')
      }
    })
  }, [firebaseUser?.uid, firebaseUser?.phoneNumber, refreshFirebaseUser])

  const sendReverifyCode = useCallback(async () => {
    if (!auth.currentUser || sendState === 'sending') return
    setError(null)
    setSendState('sending')
    try {
      const result = await requestPhoneReverify(auth.currentUser, RECAPTCHA_CONTAINER_ID)
      setConfirmation(result)
      setSendState('sent')
      setCooldown(RESEND_COOLDOWN_S)
    } catch (err) {
      console.error('[PhoneVerifyGate] reverify send failed', err)
      resetVerifier()
      setSendState('error')
      const code = (err as { code?: string }).code ?? ''
      setError(code ? mapPhoneError(code) : '코드 발송에 실패했습니다.')
    }
  }, [sendState])

  // A returning owner already has a phone number on file — auto-send the
  // re-verify code instead of making them retype a number they already gave.
  useEffect(() => {
    if (phase !== 'otp' || confirmation || autoSendOnce.current || !firebaseUser?.phoneNumber) return
    autoSendOnce.current = true
    sendReverifyCode()
  }, [phase, confirmation, firebaseUser?.phoneNumber, sendReverifyCode])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function sendLinkCode() {
    if (!firebaseUser || sendState === 'sending') return
    setError(null)
    setSendState('sending')
    try {
      const result = await requestPhoneLink(firebaseUser, phoneInput, RECAPTCHA_CONTAINER_ID)
      setConfirmation(result)
      setSendState('sent')
      setCooldown(RESEND_COOLDOWN_S)
      setPhase('otp')
    } catch (err) {
      console.error('[PhoneVerifyGate] link send failed', err)
      resetVerifier()
      setSendState('error')
      const code = (err as { code?: string }).code ?? ''
      setError(code ? mapPhoneError(code) : (err as Error).message)
    }
  }

  function handleRequestLink(e: React.FormEvent) {
    e.preventDefault()
    sendLinkCode()
  }

  // First-time linking resends the code to the number just typed in;
  // returning owners with an already-linked number resend via reauth
  // instead — same button, different underlying call depending on which
  // flow got them here.
  const resendCode = firebaseUser?.phoneNumber ? sendReverifyCode : sendLinkCode

  function focusInput(index: number) {
    inputRefs.current[index]?.focus()
  }

  function setDigitAt(index: number, value: string) {
    setDigits((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  function popIndex(index: number) {
    setPoppedIndex(index)
    setTimeout(() => setPoppedIndex((cur) => (cur === index ? null : cur)), POP_DURATION_MS)
  }

  async function handleVerify(code: string) {
    if (!confirmation || !firebaseUser?.uid) return
    setVerifyPhase('loading')
    setError(null)
    try {
      await confirmation.confirm(code)
      await auth.currentUser?.getIdToken(true)
      await markPhoneVerified(firebaseUser.uid, trustDevice)
      setVerifyPhase('merging')
      setTimeout(() => setVerifyPhase('done'), 420)
      setTimeout(() => refreshFirebaseUser(), 1450)
    } catch (err) {
      console.error('[PhoneVerifyGate] code verification failed', err)
      const c = (err as { code?: string }).code ?? ''
      setError(mapPhoneError(c))
      setVerifyPhase('idle')
      setShake(true)
      setTimeout(() => setShake(false), 400)
      setDigits(Array(CODE_LENGTH).fill(''))
      focusInput(0)
    }
  }

  function handleChange(index: number, raw: string) {
    const value = raw.replace(/\D/g, '')
    if (!value) {
      setDigitAt(index, '')
      return
    }

    const chars = value.split('')
    setDigits((prev) => {
      const next = [...prev]
      let cursor = index
      for (const ch of chars) {
        if (cursor >= CODE_LENGTH) break
        next[cursor] = ch
        popIndex(cursor)
        cursor += 1
      }
      const nextEmpty = next.findIndex((d) => !d)
      focusInput(nextEmpty === -1 ? CODE_LENGTH - 1 : nextEmpty)
      if (next.every((d) => d)) handleVerify(next.join(''))
      return next
    })
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      focusInput(index - 1)
      setDigitAt(index - 1, '')
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH)
    if (!pasted) return
    e.preventDefault()
    handleChange(0, pasted)
  }

  async function handleLogout() {
    await ownerSignOut()
    navigate('/owner/login')
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-tb-ink px-6 text-white">
      <div id={RECAPTCHA_CONTAINER_ID} />

      <div
        className="tb-orb-drift pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(31,138,130,0.55), transparent 70%)' }}
      />
      <div
        className="tb-orb-drift pointer-events-none absolute -bottom-28 -right-16 h-80 w-80 rounded-full opacity-50 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(243,89,46,0.5), transparent 70%)', animationDelay: '-4s' }}
      />

      <div className="tb-otp-in relative z-10 w-full max-w-xs rounded-3xl border border-white/10 bg-white/[0.04] p-7 text-center shadow-tb-float backdrop-blur">
        {phase === 'checking-device' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <ShieldCheck size={32} className="animate-pulse text-tb-teal-400" />
            <p className="text-sm font-medium text-white/60">기기 확인 중...</p>
          </div>
        )}

        {phase === 'device-trusted' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="relative flex items-center justify-center">
              <span className="tb-pulse-ring absolute h-14 w-14 rounded-full bg-tb-teal-400/40" />
              <motion.div
                initial={{ scale: 0, rotate: -15, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                className="relative flex h-11 w-11 items-center justify-center rounded-full bg-tb-teal-400"
              >
                <Check size={24} strokeWidth={3} className="text-tb-ink" />
              </motion.div>
            </div>
            <p className="tb-fade-up text-sm font-semibold text-white/90">신뢰된 기기예요. 이동 중...</p>
          </div>
        )}

        {phase === 'phone-entry' && (
          <>
            <h1 className="text-2xl font-black">
              휴대폰 <span className="text-tb-coral-500">인증</span>
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              가짜 사장님 계정을 막기 위해
              <br />
              휴대폰 번호 인증이 필요해요.
            </p>

            <form onSubmit={handleRequestLink} className="mt-6 space-y-3">
              <div className="flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/5 px-4 py-3">
                <Phone size={16} className="text-white/50" />
                <input
                  type="tel"
                  required
                  inputMode="numeric"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="010-1234-5678"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                />
              </div>
              {error && <p className="tb-shake text-xs font-medium text-tb-coral-400">{error}</p>}
              <button
                type="submit"
                disabled={sendState === 'sending'}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-tb-teal-500 py-3.5 text-sm font-bold text-white disabled:opacity-50"
              >
                <ShieldCheck size={16} />
                {sendState === 'sending' ? '전송 중...' : '인증번호 받기'}
              </button>
            </form>
          </>
        )}

        {phase === 'otp' && (
          <>
            <h1 className="text-2xl font-black">
              휴대폰 인증 <span className="text-tb-coral-500">코드</span>
            </h1>

            <p className="mt-2 text-sm leading-relaxed text-white/60">
              <span className="font-semibold text-white/85">{firebaseUser?.phoneNumber ?? phoneInput}</span>로 보낸
              <br />
              6자리 코드를 입력하면 자동으로 인증됩니다.
            </p>

            <div className="relative mt-8 flex h-14 items-center justify-center">
              <AnimatePresence>
                {verifyPhase !== 'done' && (
                  <div className={`absolute flex justify-center gap-2 ${shake ? 'tb-shake' : ''}`}>
                    {digits.map((digit, i) => (
                      <motion.input
                        key={i}
                        ref={(el: HTMLInputElement | null) => {
                          inputRefs.current[i] = el
                        }}
                        value={digit}
                        onChange={(e) => handleChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        onPaste={handlePaste}
                        onFocus={() => setFocusedIndex(i)}
                        onBlur={() => setFocusedIndex((cur) => (cur === i ? null : cur))}
                        disabled={verifyPhase !== 'idle' || !confirmation}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={CODE_LENGTH}
                        animate={
                          verifyPhase === 'merging'
                            ? { x: (CENTER_INDEX - i) * BOX_PITCH, scale: 0, opacity: 0 }
                            : { x: 0, scale: 1, opacity: 1 }
                        }
                        transition={
                          verifyPhase === 'merging'
                            ? { duration: 0.38, delay: Math.abs(CENTER_INDEX - i) * 0.035, ease: 'easeIn' }
                            : { duration: 0.2 }
                        }
                        style={{ animationDelay: `${i * 50}ms` }}
                        className={`tb-otp-in h-14 w-11 rounded-2xl border bg-white/5 text-center text-2xl font-bold text-white outline-none transition-colors duration-200 ${
                          digit ? 'border-tb-coral-500 bg-white/10' : 'border-white/15'
                        } ${focusedIndex === i && verifyPhase === 'idle' ? 'tb-glow-pulse border-tb-coral-500' : ''} ${
                          poppedIndex === i ? 'tb-otp-pop' : ''
                        } ${verifyPhase === 'loading' ? 'tb-otp-shimmer' : ''}`}
                      />
                    ))}
                  </div>
                )}
              </AnimatePresence>

              {verifyPhase === 'done' && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 16 }}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-tb-teal-400"
                >
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.12, type: 'spring', stiffness: 400, damping: 14 }}
                  >
                    <Check size={28} strokeWidth={3} className="text-tb-ink" />
                  </motion.div>
                </motion.div>
              )}
            </div>

            {verifyPhase === 'done' ? (
              <p className="tb-fade-up mt-5 text-sm font-semibold text-white/90">인증 완료! 이동 중...</p>
            ) : (
              <>
                <label className="mt-5 flex items-center justify-center gap-2 text-xs font-medium text-white/60">
                  <input
                    type="checkbox"
                    checked={trustDevice}
                    onChange={(e) => setTrustDevice(e.target.checked)}
                    disabled={verifyPhase !== 'idle'}
                    className="h-3.5 w-3.5 rounded border-white/30 accent-tb-coral-500"
                  />
                  이 기기를 90일 동안 신뢰하기 (다음부터 코드 생략)
                </label>

                {sendState === 'error' && (
                  <p className="mt-4 text-xs font-medium text-tb-coral-400">코드 발송에 실패했습니다.</p>
                )}
                {error && <p className="tb-shake mt-4 text-xs font-medium text-tb-coral-400">{error}</p>}
                {verifyPhase === 'loading' && <p className="mt-4 text-xs font-medium text-white/50">확인 중...</p>}

                <button
                  type="button"
                  onClick={resendCode}
                  disabled={cooldown > 0 || sendState === 'sending'}
                  className="mt-6 flex items-center justify-center gap-1.5 text-xs font-semibold text-white/60 disabled:opacity-40 mx-auto"
                >
                  <ShieldCheck size={13} />
                  {cooldown > 0 ? `코드 재전송 (${cooldown}s)` : '코드 재전송'}
                </button>
              </>
            )}
          </>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className="mt-4 flex items-center justify-center gap-1 text-xs font-semibold text-white/40 mx-auto"
        >
          <LogOut size={13} />
          로그아웃
        </button>
      </div>
    </div>
  )
}
