import { useState, useMemo } from 'react'
import { useClinicalStore } from '@/stores/clinical'
import { CrossIcon, ChevronLeftIcon, ChevronRightIcon, CheckIcon, XIcon } from 'lucide-react'

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function extractScheduledHour(detail: string): number {
  const parts = detail.split(' · ')
  return parseInt(parts[parts.length - 1] ?? '0', 10) || 0
}

export default function RxScreen() {
  const activeUnitId = useClinicalStore((s) => s.activeUnitId)
  const medicationAdministrations = useClinicalStore((s) => s.medicationAdministrations)
  const patients = useClinicalStore((s) => s.patients)
  const generateMarDoses = useClinicalStore((s) => s.generateMarDoses)
  const administerDose = useClinicalStore((s) => s.administerDose)
  const refuseDose = useClinicalStore((s) => s.refuseDose)
  const success = useClinicalStore((s) => s.success)
  const error = useClinicalStore((s) => s.error)
  const info = useClinicalStore((s) => s.info)
  const clearMessages = useClinicalStore((s) => s.clearMessages)

  const [selectedDate, setSelectedDate] = useState(new Date())
  const dateIso = toIsoDate(selectedDate)

  const dayDoses = useMemo(
    () => medicationAdministrations
      .filter((a) => a.detail?.includes(dateIso))
      .sort((a, b) => extractScheduledHour(a.detail ?? '') - extractScheduledHour(b.detail ?? '')),
    [medicationAdministrations, dateIso],
  )

  const groupedByHour = useMemo(() => {
    const groups: Record<number, typeof dayDoses> = {}
    for (const dose of dayDoses) {
      const hour = extractScheduledHour(dose.detail ?? '')
      if (!groups[hour]) groups[hour] = []
      groups[hour].push(dose)
    }
    return Object.entries(groups)
      .map(([hour, doses]) => ({ hour: parseInt(hour, 10), doses }))
      .sort((a, b) => a.hour - b.hour)
  }, [dayDoses])

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(d)
  }

  const patientLabel = (patientId: string) => {
    const p = patients.find((p) => p.id === patientId)
    return p?.initials ?? patientId.slice(-6)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <CrossIcon className="w-6 h-6 text-clinical-primary" />
          <h1 className="text-xl font-bold text-clinical-primary">Rx</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => shiftDate(-1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold min-w-[80px] text-center">
            {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
          <button
            onClick={() => shiftDate(1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => activeUnitId && generateMarDoses(activeUnitId, dateIso)}
            className="px-3 py-1.5 text-xs font-medium bg-clinical-primary text-white rounded-full hover:bg-clinical-primary/90"
          >
            Generate
          </button>
        </div>
      </div>

      {/* Messages */}
      {(success || error || info) && (
        <div className="mb-4 space-y-2">
          {success && (
            <div className="flex items-center justify-between px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm">
              <span>{success}</span>
              <button onClick={clearMessages} className="text-green-400 hover:text-green-600">&times;</button>
            </div>
          )}
          {info && (
            <div className="flex items-center justify-between px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">
              <span>{info}</span>
              <button onClick={clearMessages} className="text-blue-400 hover:text-blue-600">&times;</button>
            </div>
          )}
          {error && (
            <div className="flex items-center justify-between px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm">
              <span>{error}</span>
              <button onClick={clearMessages} className="text-red-400 hover:text-red-600">&times;</button>
            </div>
          )}
        </div>
      )}

      {/* Doses */}
      {groupedByHour.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <CrossIcon className="w-12 h-12 mb-3 opacity-50" />
          <p className="text-sm font-medium">No Scheduled Doses</p>
          <p className="text-xs mt-1">Tap 'Generate' to create doses from active medications.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByHour.map(({ hour, doses }) => (
            <div key={hour}>
              <h2 className="text-xs font-bold text-clinical-primary mb-2 px-1">
                {String(hour).padStart(2, '0')}:00
              </h2>
              <div className="space-y-2">
                {doses.map((dose) => {
                  const parts = (dose.detail ?? '').split(' · ')
                  const doseAmount = parts[1] ?? ''
                  const route = parts[2] ?? ''
                  const frequency = parts[3] ?? ''
                  const isPending = (dose.state ?? 'SCHEDULED').toUpperCase() === 'SCHEDULED'
                  const isAdministered = (dose.state ?? '').toUpperCase() === 'ADMINISTERED'
                  const isRefused = (dose.state ?? '').toUpperCase() === 'REFUSED'

                  return (
                    <div
                      key={dose.id}
                      className={`p-3 rounded-xl border shadow-sm ${
                        isAdministered
                          ? 'bg-gray-50 border-gray-200'
                          : isRefused
                            ? 'bg-red-50/30 border-red-100'
                            : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold">{patientLabel(dose.patientId)}</span>
                        {isAdministered && (
                          <span className="text-xs font-medium px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                            Done
                          </span>
                        )}
                        {isRefused && (
                          <span className="text-xs font-medium px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                            Refused
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {dose.summary} — {doseAmount}, {route} ({frequency})
                      </p>
                      {isPending && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => activeUnitId && administerDose(activeUnitId, dose.id)}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium bg-clinical-primary text-white rounded-lg hover:bg-clinical-primary/90"
                          >
                            <CheckIcon className="w-3.5 h-3.5" />
                            Administer
                          </button>
                          <button
                            onClick={() => activeUnitId && refuseDose(activeUnitId, dose.id)}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                          >
                            <XIcon className="w-3.5 h-3.5" />
                            Refuse
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
