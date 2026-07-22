import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Mail, ArrowRight, ArrowLeft, User as UserIcon } from 'lucide-react'
import { ownerSignIn, ownerSignUp, passwordStrengthError } from '../lib/ownerAuth'
import { GoogleNotLinkedError, signInWithGoogleLinked } from '../lib/googleAuth'
import OwnerOnboarding, { hasSeenOwnerOnboarding } from './OwnerOnboarding'

function mapFirebaseError(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return '이미 가입된 이메일입니다.'
    case 'auth/invalid-email':
      return '이메일 형식이 올바르지 않습니다.'
    case 'auth/weak-password':
      return '비밀번호가 너무 약합니다. 더 길고 복잡한 비밀번호를 사용해주세요.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return '이메일 또는 비밀번호가 올바르지 않습니다.'
    case 'auth/too-many-requests':
      return '시도 횟수가 많아 일시적으로 제한되었습니다. 잠시 후 다시 시도해주세요.'
    default:
      return '오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
  }
}

export default function OwnerLoginScreen() {
  const navigate = useNavigate()
  const [showOnboarding, setShowOnboarding] = useState(() => !hasSeenOwnerOnboarding())
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleGoogleSignIn() {
    setError(null)
    setGoogleLoading(true)
    try {
      await signInWithGoogleLinked()
      navigate('/stats')
    } catch (err) {
      console.error('[OwnerLoginScreen] Google sign-in failed', err)
      if (err instanceof GoogleNotLinkedError) {
        setError(err.message)
      } else {
        const code = (err as { code?: string }).code ?? ''
        if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
          setError(code ? `구글 로그인에 실패했습니다. (${code})` : '구글 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.')
        }
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'signup') {
      if (!name.trim()) {
        setError('이름을 입력해주세요.')
        return
      }
      const strengthError = passwordStrengthError(password)
      if (strengthError) {
        setError(strengthError)
        return
      }
      if (password !== passwordConfirm) {
        setError('비밀번호가 일치하지 않습니다.')
        return
      }
    }

    setLoading(true)
    try {
      if (mode === 'signin') {
        await ownerSignIn(email, password)
      } else {
        await ownerSignUp(email, password, name.trim())
      }
      navigate('/stats')
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      setError(mapFirebaseError(code))
    } finally {
      setLoading(false)
    }
  }

  if (showOnboarding) {
    return <OwnerOnboarding onDone={() => setShowOnboarding(false)} />
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center bg-tb-paper px-6">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="mb-8 flex items-center gap-1.5 self-start text-xs font-semibold text-tb-ink-soft"
      >
        <ArrowLeft size={14} />
        관광객 화면으로
      </button>

      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-tb-coral-500 text-sm font-black text-white">T</div>
        <span className="text-lg font-extrabold tracking-tight text-tb-teal-600">TripBite</span>
      </div>
      <h1 className="mt-3 text-2xl font-black text-tb-ink">사장님 로그인</h1>
      <p className="mt-1 text-sm text-tb-ink-soft">매장 통계 대시보드는 인증된 점주만 볼 수 있습니다.</p>

      <div className="mt-6 flex rounded-full bg-tb-sand-100 p-1">
        <button
          type="button"
          onClick={() => setMode('signin')}
          className={`flex-1 rounded-full py-2 text-sm font-bold transition-colors ${
            mode === 'signin' ? 'bg-white text-tb-ink shadow-tb-card' : 'text-tb-ink-soft'
          }`}
        >
          로그인
        </button>
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={`flex-1 rounded-full py-2 text-sm font-bold transition-colors ${
            mode === 'signup' ? 'bg-white text-tb-ink shadow-tb-card' : 'text-tb-ink-soft'
          }`}
        >
          회원가입
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        {mode === 'signup' && (
          <div className="flex items-center gap-2.5 rounded-xl border border-tb-line bg-tb-paper-raised px-4 py-3">
            <UserIcon size={16} className="text-tb-ink-soft" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름"
              autoComplete="name"
              className="w-full bg-transparent text-sm text-tb-ink outline-none"
            />
          </div>
        )}
        <div className="flex items-center gap-2.5 rounded-xl border border-tb-line bg-tb-paper-raised px-4 py-3">
          <Mail size={16} className="text-tb-ink-soft" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일"
            className="w-full bg-transparent text-sm text-tb-ink outline-none"
          />
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-tb-line bg-tb-paper-raised px-4 py-3">
          <Lock size={16} className="text-tb-ink-soft" />
          <input
            type="password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? '비밀번호 (영문+숫자 포함 10자 이상)' : '비밀번호'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            className="w-full bg-transparent text-sm text-tb-ink outline-none"
          />
        </div>
        {mode === 'signup' && (
          <div className="flex items-center gap-2.5 rounded-xl border border-tb-line bg-tb-paper-raised px-4 py-3">
            <Lock size={16} className="text-tb-ink-soft" />
            <input
              type="password"
              required
              minLength={10}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="비밀번호 확인"
              autoComplete="new-password"
              className="w-full bg-transparent text-sm text-tb-ink outline-none"
            />
          </div>
        )}

        {mode === 'signup' && !error && (
          <p className="text-[11px] text-tb-ink-soft">
            가입 후 휴대폰 번호 인증(SMS)을 진행해요. 인증을 완료해야 매장을 등록할 수 있습니다.
          </p>
        )}
        {error && <p className="text-xs font-medium text-tb-coral-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-tb-teal-500 py-3.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {loading ? '처리 중...' : mode === 'signin' ? '로그인' : '회원가입'}
          {!loading && <ArrowRight size={16} />}
        </button>
      </form>

      {mode === 'signin' && (
        <>
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-tb-line" />
            <span className="text-[11px] font-medium text-tb-ink-soft">또는</span>
            <div className="h-px flex-1 bg-tb-line" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-tb-line bg-white py-3.5 text-sm font-bold text-tb-ink disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34 5.1 29.3 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34 5.1 29.3 3 24 3 16.1 3 9.3 7.5 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 36.4 26.7 37 24 37c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.2 40.4 16 45 24 45z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.7l6.2 5.2C40.6 36 44 30.6 44 24c0-1.4-.1-2.4-.4-3.5z" />
            </svg>
            구글로 간편 로그인
          </button>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-tb-ink-soft">
            구글 계정 연동은 로그인 후 [매장 관리]에서 설정할 수 있어요.
          </p>
        </>
      )}
    </div>
  )
}
