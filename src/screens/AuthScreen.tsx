import { useState } from 'react'
import { useAuthStore } from '@/stores/auth'
import { isSupabaseConfigured } from '@/lib/supabase'
import { Stethoscope, AlertCircle, CheckCircle, Info, X, Smartphone, Apple } from 'lucide-react'

type BannerType = 'error' | 'success' | 'info'

function Banner({ type, message, onDismiss }: { type: BannerType; message: string; onDismiss: () => void }) {
  const config = {
    error: { icon: AlertCircle, bg: 'bg-clinical-error/10', text: 'text-clinical-error' },
    success: { icon: CheckCircle, bg: 'bg-clinical-primary/10', text: 'text-clinical-primary' },
    info: { icon: Info, bg: 'bg-clinical-info/10', text: 'text-clinical-info' },
  }[type]

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${config.bg}`}>
      <config.icon className={`w-5 h-5 flex-shrink-0 ${config.text}`} />
      <p className="text-sm flex-1">{message}</p>
      <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export default function AuthScreen() {
  const { signIn, loading, error, clearError } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const canSubmit = () => {
    return !!email.trim() && !!password
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await signIn(email.trim(), password)
  }

  return (
    <div className="min-h-screen bg-clinical-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-clinical-primary/10 flex items-center justify-center mb-3">
            <Stethoscope className="w-7 h-7 text-clinical-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Rounds</h1>
          <p className="text-sm text-gray-500 mt-1">Clinical Workspace</p>
        </div>

        <div className="bg-clinical-surface rounded-2xl shadow-sm border border-clinical-border p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isSupabaseConfigured && (
              <Banner type="info" message="Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env to enable authentication." onDismiss={() => {}} />
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-clinical-primary/20 focus:border-clinical-primary"
                placeholder="you@hospital.org"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-clinical-primary/20 focus:border-clinical-primary"
              />
            </div>

            {error && <Banner type="error" message={error} onDismiss={clearError} />}
            {successMsg && <Banner type="success" message={successMsg} onDismiss={() => setSuccessMsg(null)} />}

            <button
              type="submit"
              disabled={!canSubmit() || loading}
              className="w-full py-2.5 bg-clinical-primary text-white font-medium rounded-lg hover:bg-clinical-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Please wait…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-clinical-border">
            <p className="text-center text-sm text-gray-500 mb-3">
              Don't have an account?
            </p>
            <div className="flex gap-3">
              <a
                href="https://apps.apple.com/app/rounds-inpatient-manager"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Apple className="w-4 h-4" />
                App Store
              </a>
              <a
                href="https://play.google.com/store/apps/details=com.kosd.roundsinpatientmanager"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Smartphone className="w-4 h-4" />
                Google Play
              </a>
            </div>
            <p className="text-center text-xs text-gray-400 mt-3">
              Account registration is only available through the mobile app.
            </p>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">
          Protected clinical records. Authorized access only.
        </p>
      </div>
    </div>
  )
}
