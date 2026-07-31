import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth'
import { registerWebDevice, establishEncryptionReadiness, type DeviceAuthResult } from '@/lib/deviceAuth'
import { Stethoscope, Smartphone, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface Props {
  unitId: string
  unitName: string
  onAuthorized: () => void
  onSignOut: () => void
}

export default function DeviceAuthorizationScreen({ unitId, unitName, onAuthorized, onSignOut }: Props) {
  const signOut = useAuthStore((s) => s.signOut)
  const [phase, setPhase] = useState<'registering' | 'awaiting' | 'authorized' | 'error' | 'no-unit-key'>('registering')
  const [message, setMessage] = useState<string>('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const checkReadiness = useCallback(async () => {
    try {
      const result: DeviceAuthResult = await establishEncryptionReadiness(unitId)
      if (result.state === 'ready') {
        stopPolling()
        setPhase('authorized')
        setMessage('Encryption access granted. Loading clinical data…')
        setTimeout(() => onAuthorized(), 1500)
      } else if (result.state === 'awaiting-authorization') {
        setPhase('awaiting')
        setMessage(result.message ?? 'Approve this web session from your mobile device.')
      } else if (result.state === 'no-unit-key') {
        stopPolling()
        setPhase('no-unit-key')
        setMessage(result.message ?? 'No active encryption key for this unit.')
      }
    } catch (err) {
      stopPolling()
      setPhase('error')
      setMessage(err instanceof Error ? err.message : 'Failed to check authorization status.')
    }
  }, [unitId, onAuthorized, stopPolling])

  const startPolling = useCallback(() => {
    if (pollRef.current) return
    pollRef.current = setInterval(checkReadiness, 4000)
  }, [checkReadiness])

  const handleRegister = useCallback(async () => {
    setPhase('registering')
    setMessage('Registering this browser as a device…')
    try {
      await registerWebDevice()
      setMessage('Device registered. Checking authorization status…')
      await checkReadiness()
      if (phase !== 'authorized' && phase !== 'no-unit-key' && phase !== 'error') {
        startPolling()
      }
    } catch (err) {
      setPhase('error')
      setMessage(err instanceof Error ? err.message : 'Failed to register device.')
    }
  }, [checkReadiness, startPolling, phase])

  useEffect(() => {
    handleRegister()
    return () => stopPolling()
  }, [handleRegister, stopPolling])

  const handleRetry = () => {
    handleRegister()
  }

  const handleSignOut = async () => {
    stopPolling()
    await signOut()
    onSignOut()
  }

  return (
    <div className="min-h-screen bg-clinical-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-clinical-primary/10 flex items-center justify-center mb-3">
            <Stethoscope className="w-7 h-7 text-clinical-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Rounds</h1>
          <p className="text-sm text-gray-500 mt-1">{unitName}</p>
        </div>

        <div className="bg-clinical-surface rounded-2xl shadow-sm border border-clinical-border p-8">
          {phase === 'registering' && (
            <div className="flex flex-col items-center text-center gap-4">
              <Loader2 className="w-10 h-10 text-clinical-primary animate-spin" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Setting up encryption</h2>
                <p className="text-sm text-gray-500">{message}</p>
              </div>
            </div>
          )}

          {phase === 'awaiting' && (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-clinical-info/10 flex items-center justify-center">
                <Smartphone className="w-7 h-7 text-clinical-info" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Approve from your phone</h2>
                <p className="text-sm text-gray-500 mb-3">{message}</p>
                <p className="text-xs text-gray-400">
                  Open the Rounds app on your registered mobile device and approve
                  this web session to grant encryption access.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Waiting for approval…</span>
              </div>
            </div>
          )}

          {phase === 'authorized' && (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-clinical-primary/10 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-clinical-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Authorized</h2>
                <p className="text-sm text-gray-500">{message}</p>
              </div>
            </div>
          )}

          {phase === 'no-unit-key' && (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-clinical-error/10 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-clinical-error" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">No encryption key</h2>
                <p className="text-sm text-gray-500 mb-3">{message}</p>
                <p className="text-xs text-gray-400">
                  A unit owner must set up encryption from the mobile app before
                  the web client can access clinical data.
                </p>
              </div>
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-clinical-primary border border-clinical-primary/30 rounded-lg hover:bg-clinical-primary/5"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-clinical-error/10 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-clinical-error" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Setup failed</h2>
                <p className="text-sm text-gray-500">{message}</p>
              </div>
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-clinical-primary border border-clinical-primary/30 rounded-lg hover:bg-clinical-primary/5"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-clinical-border">
            <button
              onClick={handleSignOut}
              className="w-full py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
