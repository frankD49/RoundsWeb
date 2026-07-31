import { useEffect } from 'react'
import { useClinicalStore } from '@/stores/clinical'
import { MessageBanners } from '@/components/Banner'
import { Activity, AlertTriangle, ClipboardList } from 'lucide-react'

export default function HomeScreen() {
  const {
    activeUnitId, patients, isLoadingPatients,
    records, isLoadingRecords,
    timeline, isLoadingTimeline,
    error, success, info,
    loadPatients, loadRecords, loadTimeline,
    dismissError, dismissSuccess, dismissInfo,
  } = useClinicalStore()

  useEffect(() => {
    if (!activeUnitId) return
    loadPatients(activeUnitId)
    loadRecords(activeUnitId)
    loadTimeline(activeUnitId)
  }, [activeUnitId, loadPatients, loadRecords, loadTimeline])

  const activeProblems = records.filter((r) =>
    ['DAILY_PROBLEM', 'COMORBIDITY', 'COMPLICATION', 'PROVISIONAL_DIAGNOSIS', 'CONFIRMED_DIAGNOSIS'].includes(r.type) && r.state !== 'RESOLVED' && r.state !== 'CANCELLED'
  )
  const activeAllergies = records.filter((r) => r.type === 'ALLERGY')
  const activeMedications = records.filter((r) => r.type === 'MEDICATION' && r.state !== 'DISCONTINUED' && r.state !== 'CANCELLED')
  const recentTimeline = timeline.slice(0, 5)

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-gray-500 mb-6">Clinical overview</p>

      <MessageBanners
        error={error} success={success} info={info}
        onDismissError={dismissError} onDismissSuccess={dismissSuccess} onDismissInfo={dismissInfo}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Patients" value={isLoadingPatients ? '…' : String(patients.length)} icon={Activity} />
        <StatCard label="Active Problems" value={isLoadingRecords ? '…' : String(activeProblems.length)} icon={AlertTriangle} />
        <StatCard label="Active Allergies" value={isLoadingRecords ? '…' : String(activeAllergies.length)} icon={AlertTriangle} />
        <StatCard label="Active Medications" value={isLoadingRecords ? '…' : String(activeMedications.length)} icon={ClipboardList} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-clinical-surface rounded-xl border border-clinical-border p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Activity</h2>
          {isLoadingTimeline ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : recentTimeline.length > 0 ? (
            <div className="space-y-3">
              {recentTimeline.map((event) => (
                <div key={event.id} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-clinical-secondary mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{event.body}</p>
                    <p className="text-xs text-gray-400">{event.kind} · {new Date(event.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No recent activity.</p>
          )}
        </div>

        <div className="bg-clinical-surface rounded-xl border border-clinical-border p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Patients</h2>
          {isLoadingPatients ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : patients.length > 0 ? (
            <div className="space-y-2">
              {patients.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium text-gray-700">{p.code}</span>
                  <span className="text-xs text-gray-400">{p.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No active patients.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="bg-clinical-surface rounded-xl border border-clinical-border p-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-clinical-secondary" />
        <p className="text-sm text-gray-500">{label}</p>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
