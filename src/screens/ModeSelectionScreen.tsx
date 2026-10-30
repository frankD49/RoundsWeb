import { useAuthStore } from '@/stores/auth'
import { useClinicalStore } from '@/stores/clinical'
import { Stethoscope, Calendar, ArrowRight, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ModeSelectionScreen() {
  const clinicalMode = useAuthStore((s) => s.clinicalMode)
  const setClinicalMode = useAuthStore((s) => s.setClinicalMode)
  const setDeviceAuthStatus = useAuthStore((s) => s.setDeviceAuthStatus)
  const units = useClinicalStore((s) => s.units)
  const activeUnitId = useClinicalStore((s) => s.activeUnitId)

  const activeUnit = units.find((u) => u.id === activeUnitId)

  const handleSelect = (mode: 'inpatient' | 'outpatient') => {
    setClinicalMode(mode)
    // Hand off to the device-authorization gate — any non-'unknown',
    // non-'ready' status routes there and the screen self-drives the
    // real readiness check.
    setDeviceAuthStatus('awaiting-authorization')
  }

  return (
    <div className="min-h-screen bg-clinical-background flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-2xl">
        {/* Unit context */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-clinical-primary/10 flex items-center justify-center mb-3">
            <Building2 className="w-7 h-7 text-clinical-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{activeUnit?.name ?? 'Unit'}</h1>
          <p className="text-sm text-gray-500 mt-1">Choose your workflow mode</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Outpatient / ER */}
          <button
            onClick={() => handleSelect('outpatient')}
            className={cn(
              'group relative flex flex-col items-center justify-center p-10 rounded-3xl border-2 transition-all min-h-[280px]',
              clinicalMode === 'outpatient'
                ? 'border-clinical-primary bg-clinical-primary/5 shadow-sm'
                : 'border-clinical-border bg-clinical-surface hover:border-clinical-primary/30'
            )}
          >
            <div className={cn(
              'w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-colors',
              clinicalMode === 'outpatient'
                ? 'bg-clinical-primary/20'
                : 'bg-clinical-primary/10 group-hover:bg-clinical-primary/15'
            )}>
              <Calendar className="w-8 h-8 text-clinical-primary" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Outpatient / ER</h2>
            <p className="text-sm text-gray-500 mt-2 text-center">
              Appointments, encounters, prescriptions, care plans, and investigations
            </p>
            <div className="mt-4 flex items-center gap-1 text-sm font-medium text-clinical-primary">
              <span>Enter</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Inpatient */}
          <button
            onClick={() => handleSelect('inpatient')}
            className={cn(
              'group relative flex flex-col items-center justify-center p-10 rounded-3xl border-2 transition-all min-h-[280px]',
              clinicalMode === 'inpatient'
                ? 'border-clinical-primary bg-clinical-primary/5 shadow-sm'
                : 'border-clinical-border bg-clinical-surface hover:border-clinical-primary/30'
            )}
          >
            <div className={cn(
              'w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-colors',
              clinicalMode === 'inpatient'
                ? 'bg-clinical-primary/20'
                : 'bg-clinical-primary/10 group-hover:bg-clinical-primary/15'
            )}>
              <Stethoscope className="w-8 h-8 text-clinical-primary" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Inpatient</h2>
            <p className="text-sm text-gray-500 mt-2 text-center">
              Ward rounds, census, clinical records, results, and handover
            </p>
            <div className="mt-4 flex items-center gap-1 text-sm font-medium text-clinical-primary">
              <span>Enter</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          You can switch between modes at any time from the sidebar
        </p>
      </div>
    </div>
  )
}
