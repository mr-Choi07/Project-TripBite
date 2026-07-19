import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Mail, ArrowRight, ArrowLeft } from 'lucide-react'
import { ownerSignIn, ownerSignUp } from '../lib/ownerAuth'

function mapFirebaseError(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return '이미 가입된 이메일입니다.'
    case 'auth/invalid-email':
      return '이메일 형식이 올바르지 않습니다.'
    case 'auth/weak-password':
      return '비밀번호는 6자 이상이어야 합니다.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return '이메일 또는 비밀번호가 올바르지 않습니다.'
    default:
      return '오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
  }
}

export default function OwnerLoginScreen() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signin') {
        await ownerSignIn(email, password)
      } else {
        await ownerSignUp(email, password)
      }
      navigate('/stats')
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      setError(mapFirebaseError(code))
    } finally {
      setLoading(false)
    }
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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 (6자 이상)"
            className="w-full bg-transparent text-sm text-tb-ink outline-none"
          />
        </div>

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
    </div>
  )
}
