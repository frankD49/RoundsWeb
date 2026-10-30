import { useEffect, useMemo } from 'react'
import { useClinicalStore } from '@/stores/clinical'
import { useNavigate } from 'react-router-dom'
import {
  Calendar, FileText, ClipboardList, Pill, FlaskConical,
  AlertCircle,
} from 'lucide-react'

export default function OutpatientDashboardScreen() {
  const navigate = useNavigate()
  const store = useClinicalStore()

  const {
    activeUnitId, patients,
    appointments, encounters, carePlans, prescriptions, investigations,
    loadAppointments, loadEncounters, loadCarePlans, loadPrescriptions, loadInvestigations,
    loadPatients,
  } = store

  useEffect(() => {
    if (!activeUnitId) return
    loadPatients(activeUnitId)
    loadAppointments(activeUnitId)
    loadEncounters(activeUnitId)
    loadCarePlans(activeUnitId)
    loadPrescriptions(activeUnitId)
    loadInvestigations(activeUnitId)
  }, [activeUnitId])

  const today = new Date().toDateString()
  const todaysAppointments = useMemo(
    () => appointments.filter((a) => new Date(a.startAt).toDateString() === today),
    [appointments, today]
  )
  const encounterQueue = useMemo(
    () => encounters.filter((e) => e.status === 'ACTIVE' || e.status === 'DRAFT'),
    [encounters]
  )
  const unsignedEncounters = useMemo(
    () => encounters.filter((e) => e.status === 'ACTIVE'),
    [encounters]
  )
  const activePrescriptions = useMemo(
    () => prescriptions.filter((p) => p.status === 'ACTIVE'),
    [prescriptions]
  )
  const pendingInvestigations = useMemo(
    () => investigations.filter((i) => i.status === 'ORDERED' || i.status === 'IN_PROGRESS'),
    [investigations]
  )
  const activeCarePlans = useMemo(
    () => carePlans.filter((c) => c.status === 'ACTIVE'),
    [carePlans]
  )

  const patientCode = (patientId: string) =>
    patients.find((p) => p.id === patientId)?.code ?? patientId.slice(0, 8)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Outpatient Dashboard</h1>
        <p className="text-gray-500 mt-1">Today's schedule, encounter queue & pending tasks</p>
      </div>

      {/* Quick Action Cards — aligned with Inpatient StatCard design */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => navigate('/outpatient')}
          className="flex flex-col items-start gap-1 p-5 bg-outpatient-surface rounded-xl border border-black hover:border-outpatient-primary transition-colors text-left"
        >
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-outpatient-primary" />
            <p className="text-sm font-semibold text-gray-700">Start Encounter</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">{encounterQueue.length}</p>
          <p className="text-xs text-gray-500">in queue</p>
        </button>
        <button
          onClick={() => navigate('/outpatient')}
          className="flex flex-col items-start gap-1 p-5 bg-outpatient-surface rounded-xl border border-black hover:border-outpatient-primary transition-colors text-left"
        >
          <div className="flex items-center gap-2 mb-1">
            <Pill className="w-4 h-4 text-outpatient-primary" />
            <p className="text-sm font-semibold text-gray-700">Write Rx</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">{activePrescriptions.length}</p>
          <p className="text-xs text-gray-500">active</p>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <div className="bg-outpatient-surface rounded-xl border border-outpatient-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-outpatient-primary flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Today's Schedule
            </h2>
            <span className="text-xs text-gray-400">{todaysAppointments.length} appointments</span>
          </div>
          {todaysAppointments.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No appointments scheduled today</p>
          ) : (
            <div className="space-y-2">
              {todaysAppointments.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-outpatient-border">
                  <div className="text-xs font-mono text-outpatient-primary font-semibold w-16">
                    {new Date(a.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{patientCode(a.patientId)}</p>
                    <p className="text-xs text-gray-400">{a.kind.replace(/_/g, ' ').toLowerCase()}</p>
                  </div>
                  <StatusPill status={a.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Encounter Queue */}
        <div className="bg-outpatient-surface rounded-xl border border-outpatient-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-outpatient-primary flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Encounter Queue
            </h2>
            <span className="text-xs text-gray-400">{encounterQueue.length} pending</span>
          </div>
          {encounterQueue.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No encounters in progress</p>
          ) : (
            <div className="space-y-2">
              {encounterQueue.slice(0, 5).map((e) => (
                <div key={e.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-outpatient-border">
                  <div className="w-1 h-8 rounded-full bg-outpatient-secondary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{patientCode(e.patientId)}</p>
                    <p className="text-xs text-gray-400">{e.encounterDate}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    e.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>{e.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Tasks */}
        <div className="bg-outpatient-surface rounded-xl border border-outpatient-border p-5">
          <h2 className="text-sm font-semibold text-outpatient-primary flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4" />
            Pending Tasks
          </h2>
          <div className="space-y-2">
            {unsignedEncounters.length > 0 && (
              <TaskItem count={unsignedEncounters.length} label="Unsigned encounters" icon={FileText} />
            )}
            {pendingInvestigations.length > 0 && (
              <TaskItem count={pendingInvestigations.length} label="Pending investigations" icon={FlaskConical} />
            )}
            {activeCarePlans.length > 0 && (
              <TaskItem count={activeCarePlans.length} label="Active care plans" icon={ClipboardList} />
            )}
            {unsignedEncounters.length === 0 && pendingInvestigations.length === 0 && activeCarePlans.length === 0 && (
              <p className="text-sm text-gray-400 py-8 text-center">All caught up!</p>
            )}
          </div>
        </div>

        {/* Active Prescriptions */}
        <div className="bg-outpatient-surface rounded-xl border border-outpatient-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-outpatient-primary flex items-center gap-2">
              <Pill className="w-4 h-4" />
              Active Prescriptions
            </h2>
            <span className="text-xs text-gray-400">{activePrescriptions.length} active</span>
          </div>
          {activePrescriptions.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No active prescriptions</p>
          ) : (
            <div className="space-y-2">
              {activePrescriptions.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-outpatient-border">
                  <Pill className="w-4 h-4 text-outpatient-secondary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{p.medicationName} — {p.dose}</p>
                    <p className="text-xs text-gray-400">{patientCode(p.patientId)} · {p.frequency}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TaskItem({ count, label, icon: Icon }: { count: number; label: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-outpatient-border">
      <div className="w-8 h-8 rounded-lg bg-outpatient-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-outpatient-primary" />
      </div>
      <span className="text-sm text-gray-700 flex-1">{label}</span>
      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-outpatient-primary text-white">{count}</span>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    SCHEDULED: 'bg-blue-100 text-blue-700',
    CHECKED_IN: 'bg-amber-100 text-amber-700',
    COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
    NO_SHOW: 'bg-red-100 text-red-700',
  }
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>{status.replace(/_/g, ' ')}</span>
}
