import { AlertCircle, CheckCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type BannerType = 'error' | 'success' | 'info'

const config = {
  error: { icon: AlertCircle, bg: 'bg-clinical-error/10', text: 'text-clinical-error' },
  success: { icon: CheckCircle, bg: 'bg-clinical-primary/10', text: 'text-clinical-primary' },
  info: { icon: Info, bg: 'bg-clinical-info/10', text: 'text-clinical-info' },
}

export function Banner({ type, message, onDismiss }: { type: BannerType; message: string; onDismiss?: () => void }) {
  const c = config[type]
  return (
    <div className={cn('flex items-center gap-3 px-4 py-3 rounded-lg', c.bg)}>
      <c.icon className={cn('w-5 h-5 flex-shrink-0', c.text)} />
      <p className="text-sm flex-1">{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

export function MessageBanners({
  error,
  success,
  info,
  onDismissError,
  onDismissSuccess,
  onDismissInfo,
}: {
  error: string | null
  success: string | null
  info: string | null
  onDismissError?: () => void
  onDismissSuccess?: () => void
  onDismissInfo?: () => void
}) {
  return (
    <div className="space-y-2">
      {error && <Banner type="error" message={error} onDismiss={onDismissError} />}
      {success && <Banner type="success" message={success} onDismiss={onDismissSuccess} />}
      {info && <Banner type="info" message={info} onDismiss={onDismissInfo} />}
    </div>
  )
}
