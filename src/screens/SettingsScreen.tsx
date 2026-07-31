import { useAuthStore } from '@/stores/auth'
import { useNavigate } from 'react-router-dom'

export default function SettingsScreen() {
  const signOut = useAuthStore((s) => s.signOut)
  const navigate = useNavigate()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
      <p className="text-gray-500 mb-8">Account and preferences</p>
      <div className="bg-clinical-surface rounded-xl border border-clinical-border p-6 max-w-lg">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Account</h2>
        <button
          onClick={async () => { await signOut(); navigate('/') }}
          className="px-4 py-2 text-sm font-medium text-clinical-error border border-clinical-error/30 rounded-lg hover:bg-clinical-error/5 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
