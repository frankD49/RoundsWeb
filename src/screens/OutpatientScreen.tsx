import { useEffect, useState } from 'react'
import { useClinicalStore } from '@/stores/clinical'
import { useAuthStore } from '@/stores/auth'
import { MessageBanners } from '@/components/Banner'
import {
  Calendar, FileText, ClipboardList, Pill, FlaskConical,
  Plus, X, CheckCircle, Ban,
} from 'lucide-react'
import type {
  AppointmentRow, EncounterRow, CarePlanRow, PrescriptionRow, InvestigationOrderRow,
  PatientRow,
} from '@/types'

type Tab = 'appointments' | 'encounters' | 'careplans' | 'prescriptions' | 'investigations'

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'appointments', label: 'Appointments', icon: Calendar },
  { key: 'encounters', label: 'Encounters', icon: FileText },
  { key: 'careplans', label: 'Care Plans', icon: ClipboardList },
  { key: 'prescriptions', label: 'Prescriptions', icon: Pill },
  { key: 'investigations', label: 'Investigations', icon: FlaskConical },
]

export default function OutpatientScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('appointments')
  const [showForm, setShowForm] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState<string>('')

  const store = useClinicalStore()
  const session = useAuthStore((s) => s.session)
  const clinicianId = session?.user?.id ?? ''

  const {
    activeUnitId, patients,
    appointments, isLoadingAppointments,
    encounters, isLoadingEncounters,
    carePlans, isLoadingCarePlans,
    prescriptions, isLoadingPrescriptions,
    investigations, isLoadingInvestigations,
    error, success, dismissError, dismissSuccess,
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

  const currentTab = tabs.find((t) => t.key === activeTab)!

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Outpatient</h1>
          <p className="text-gray-500">Clinic appointments, encounters & care plans</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-outpatient-primary text-white rounded-lg text-sm font-medium hover:bg-outpatient-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New {currentTab.label.replace(/s$/, '')}
        </button>
      </div>

      <MessageBanners
        error={error} success={success} info={null}
        onDismissError={dismissError} onDismissSuccess={dismissSuccess}
      />

      {/* Patient filter */}
      <div className="mb-4">
        <select
          value={selectedPatientId}
          onChange={(e) => setSelectedPatientId(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
        >
          <option value="">All patients</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>{patientLabel(p)}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-outpatient-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setShowForm(false) }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-outpatient-primary text-outpatient-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {showForm && activeTab === 'appointments' && (
        <AppointmentForm
          unitId={activeUnitId!}
          patients={patients}
          clinicianId={clinicianId}
          onSubmit={async (params) => {
            const id = await store.createAppointment(params)
            if (id) setShowForm(false)
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
      {showForm && activeTab === 'encounters' && (
        <EncounterForm
          unitId={activeUnitId!}
          patients={patients}
          clinicianId={clinicianId}
          onSubmit={async (params) => {
            const id = await store.createEncounter(params)
            if (id) setShowForm(false)
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
      {showForm && activeTab === 'careplans' && (
        <CarePlanForm
          unitId={activeUnitId!}
          patients={patients}
          onSubmit={async (params) => {
            const id = await store.createCarePlan(params)
            if (id) setShowForm(false)
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
      {showForm && activeTab === 'prescriptions' && (
        <PrescriptionForm
          unitId={activeUnitId!}
          patients={patients}
          onSubmit={async (params) => {
            const id = await store.createPrescription(params)
            if (id) setShowForm(false)
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
      {showForm && activeTab === 'investigations' && (
        <InvestigationForm
          unitId={activeUnitId!}
          patients={patients}
          onSubmit={async (params) => {
            const id = await store.createInvestigationOrder(params)
            if (id) setShowForm(false)
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {!showForm && activeTab === 'appointments' && (
        <AppointmentList
          items={filterByPatient(appointments, selectedPatientId)}
          loading={isLoadingAppointments}
          patients={patients}
          onCancel={(id) => activeUnitId && store.cancelAppointment(activeUnitId, id)}
          onCheckIn={(id) => activeUnitId && store.checkInAppointment(activeUnitId, id)}
          onCheckOut={(id) => activeUnitId && store.checkOutAppointment(activeUnitId, id)}
        />
      )}
      {!showForm && activeTab === 'encounters' && (
        <EncounterList
          items={filterByPatient(encounters, selectedPatientId)}
          loading={isLoadingEncounters}
          patients={patients}
          onSign={(id) => activeUnitId && store.signEncounter(activeUnitId, id)}
        />
      )}
      {!showForm && activeTab === 'careplans' && (
        <CarePlanList
          items={filterByPatient(carePlans, selectedPatientId)}
          loading={isLoadingCarePlans}
          patients={patients}
          onUpdateStatus={(id, status) => activeUnitId && store.updateCarePlanStatus(activeUnitId, id, status)}
        />
      )}
      {!showForm && activeTab === 'prescriptions' && (
        <PrescriptionList
          items={filterByPatient(prescriptions, selectedPatientId)}
          loading={isLoadingPrescriptions}
          patients={patients}
          onDiscontinue={(id) => activeUnitId && store.discontinuePrescription(activeUnitId, id)}
        />
      )}
      {!showForm && activeTab === 'investigations' && (
        <InvestigationList
          items={filterByPatient(investigations, selectedPatientId)}
          loading={isLoadingInvestigations}
          patients={patients}
          onAcknowledge={(id) => activeUnitId && store.acknowledgeInvestigation(activeUnitId, id)}
        />
      )}
    </div>
  )
}

function filterByPatient<T extends { patientId: string }>(items: T[], patientId: string): T[] {
  if (!patientId) return items
  return items.filter((i) => i.patientId === patientId)
}

function patientCode(patients: PatientRow[], patientId: string): string {
  const p = patients.find((p) => p.id === patientId)
  return p ? patientLabel(p) : patientId.slice(0, 8)
}

// --- Appointment List ---

function AppointmentList({ items, loading, patients, onCancel, onCheckIn, onCheckOut }: {
  items: AppointmentRow[]
  loading: boolean
  patients: PatientRow[]
  onCancel: (id: string) => void
  onCheckIn: (id: string) => void
  onCheckOut: (id: string) => void
}) {
  const [weekOffset, setWeekOffset] = useState(0)

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>
  if (items.length === 0) return <p className="text-sm text-gray-400">No appointments.</p>

  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay() + weekOffset * 7)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  const dayAppts = (day: Date) => items
    .filter((a) => {
      const ad = new Date(a.startAt)
      return ad >= day && ad < new Date(day.getTime() + 86400000)
    })
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())

  const isToday = (day: Date) => {
    const t = new Date()
    return day.getDate() === t.getDate() && day.getMonth() === t.getMonth() && day.getFullYear() === t.getFullYear()
  }

  const weekLabel = `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(weekEnd.getTime() - 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setWeekOffset(weekOffset - 1)} className="px-3 py-1.5 rounded-lg border border-outpatient-border text-sm text-outpatient-primary hover:bg-outpatient-surface transition-colors">← Prev</button>
        <span className="text-sm font-semibold text-gray-700">{weekLabel}</span>
        <button onClick={() => setWeekOffset(weekOffset + 1)} className="px-3 py-1.5 rounded-lg border border-outpatient-border text-sm text-outpatient-primary hover:bg-outpatient-surface transition-colors">Next →</button>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const appts = dayAppts(day)
          return (
            <div key={day.toISOString()} className={`rounded-lg border min-h-[200px] ${isToday(day) ? 'border-outpatient-primary bg-outpatient-surface' : 'border-outpatient-border bg-white'}`}>
              <div className={`px-2 py-1.5 border-b ${isToday(day) ? 'border-outpatient-primary bg-outpatient-primary/10' : 'border-outpatient-border'}`}>
                <p className="text-xs font-semibold text-gray-700">{day.toLocaleDateString(undefined, { weekday: 'short' })}</p>
                <p className="text-xs text-gray-400">{day.getDate()}</p>
              </div>
              <div className="p-1.5 space-y-1.5">
                {appts.map((a) => (
                  <div key={a.id} className="rounded-md bg-outpatient-surface border border-outpatient-border px-2 py-1.5">
                    <p className="text-xs font-semibold text-outpatient-primary">{new Date(a.startAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="text-xs font-medium text-gray-700">{patientCode(patients, a.patientId)}</p>
                    <p className="text-[10px] text-gray-400">{a.kind.replace(/_/g, ' ')}</p>
                    <div className="flex gap-1 mt-1">
                      {a.status === 'SCHEDULED' && (
                        <>
                          <button onClick={() => onCheckIn(a.id)} className="text-[10px] text-outpatient-primary hover:underline">Check In</button>
                          <button onClick={() => onCancel(a.id)} className="text-[10px] text-red-500 hover:underline">Cancel</button>
                        </>
                      )}
                      {a.status === 'CHECKED_IN' && (
                        <button onClick={() => onCheckOut(a.id)} className="text-[10px] text-outpatient-primary hover:underline">Complete</button>
                      )}
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                ))}
                {appts.length === 0 && <p className="text-[10px] text-gray-300 text-center py-4">—</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- Encounter List ---

function EncounterList({ items, loading, patients, onSign }: {
  items: EncounterRow[]
  loading: boolean
  patients: PatientRow[]
  onSign: (id: string) => void
}) {
  if (loading) return <p className="text-sm text-gray-400">Loading…</p>
  if (items.length === 0) return <p className="text-sm text-gray-400">No encounters.</p>
  return (
    <div className="space-y-3">
      {items.map((e) => (
        <div key={e.id} className="bg-white rounded-xl border border-outpatient-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-outpatient-surface border-b border-outpatient-border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">{patientCode(patients, e.patientId)}</span>
              <StatusBadge status={e.status} />
              <span className="text-xs text-gray-400">{e.encounterDate}</span>
            </div>
            {e.status === 'ACTIVE' && (
              <ActionButton icon={CheckCircle} label="Sign" onClick={() => onSign(e.id)} />
            )}
          </div>
          {e.summary && <p className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border-b border-outpatient-border">{e.summary}</p>}
          <div className="grid grid-cols-2 gap-px bg-outpatient-border">
            <SoapSection label="S" title="Subjective" value={e.subjective ?? undefined} color="bg-blue-50" textColor="text-blue-700" />
            <SoapSection label="O" title="Objective" value={e.objective ?? undefined} color="bg-amber-50" textColor="text-amber-700" />
            <SoapSection label="A" title="Assessment" value={e.assessment ?? undefined} color="bg-outpatient-surface" textColor="text-outpatient-primary" />
            <SoapSection label="P" title="Plan" value={e.plan ?? undefined} color="bg-emerald-50" textColor="text-emerald-700" />
          </div>
        </div>
      ))}
    </div>
  )
}

function SoapSection({ label, title, value, color, textColor }: { label: string; title: string; value?: string; color: string; textColor: string }) {
  return (
    <div className={`${color} px-4 py-3`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-5 h-5 rounded-full ${textColor} bg-white/60 flex items-center justify-center text-xs font-bold`}>{label}</span>
        <span className="text-xs font-semibold text-gray-600">{title}</span>
      </div>
      {value ? <p className="text-xs text-gray-700">{value}</p> : <p className="text-xs text-gray-400 italic">Not documented</p>}
    </div>
  )
}

// --- Care Plan List ---

function CarePlanList({ items, loading, patients, onUpdateStatus }: {
  items: CarePlanRow[]
  loading: boolean
  patients: PatientRow[]
  onUpdateStatus: (id: string, status: string) => void
}) {
  if (loading) return <p className="text-sm text-gray-400">Loading…</p>
  if (items.length === 0) return <p className="text-sm text-gray-400">No care plans.</p>
  return (
    <div className="space-y-4">
      {items.map((c) => (
        <div key={c.id} className="bg-white rounded-xl border border-outpatient-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-outpatient-surface border-b border-outpatient-border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">{patientCode(patients, c.patientId)}</span>
              <StatusBadge status={c.status} />
            </div>
            {c.status === 'ACTIVE' && (
              <div className="flex gap-2">
                <ActionButton icon={Ban} label="Pause" onClick={() => onUpdateStatus(c.id, 'PAUSED')} />
                <ActionButton icon={CheckCircle} label="Complete" onClick={() => onUpdateStatus(c.id, 'COMPLETED')} />
              </div>
            )}
            {c.status === 'PAUSED' && (
              <ActionButton icon={CheckCircle} label="Resume" onClick={() => onUpdateStatus(c.id, 'ACTIVE')} />
            )}
          </div>
          <div className="px-4 py-3">
            <p className="text-sm font-medium text-gray-700 mb-2">{c.title}</p>
            {c.description && <p className="text-xs text-gray-500 mb-2">{c.description}</p>}
            {c.goals && <p className="text-xs text-gray-500 mb-3"><b>Goals:</b> {c.goals}</p>}
            <div className="relative pl-6">
              <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-outpatient-border" />
              <TimelineNode label="Plan Started" date={c.startedAt} color="bg-outpatient-primary" done />
              <TimelineNode label="Next Review" date={c.nextReviewDate ?? `Every ${c.reviewIntervalDays} days`} color="bg-outpatient-secondary" done={c.status === 'ACTIVE'} />
              {c.status === 'COMPLETED' && <TimelineNode label="Completed" date={c.completedAt ?? 'N/A'} color="bg-green-500" done />}
              {c.status === 'PAUSED' && <TimelineNode label="Paused" date="Current" color="bg-amber-500" done />}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function TimelineNode({ label, date, color, done }: { label: string; date: string; color: string; done: boolean }) {
  return (
    <div className="relative pb-4 last:pb-0">
      <div className={`absolute -left-4 top-0.5 w-3 h-3 rounded-full ${done ? color : 'bg-gray-300'} ring-2 ring-white`} />
      <p className="text-xs font-semibold text-gray-700">{label}</p>
      <p className="text-xs text-gray-400">{date}</p>
    </div>
  )
}

// --- Prescription List ---

function PrescriptionList({ items, loading, patients, onDiscontinue }: {
  items: PrescriptionRow[]
  loading: boolean
  patients: PatientRow[]
  onDiscontinue: (id: string) => void
}) {
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [search, setSearch] = useState('')

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>
  if (items.length === 0) return <p className="text-sm text-gray-400">No prescriptions.</p>

  const statuses = ['ALL', 'ACTIVE', 'DISCONTINUED', 'EXPIRED']
  const filtered = items
    .filter((p) => statusFilter === 'ALL' || p.status === statusFilter)
    .filter((p) => !search || p.medicationName.toLowerCase().includes(search.toLowerCase()) || patientCode(patients, p.patientId).toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search medication or patient…"
          className="flex-1 px-3 py-2 rounded-lg border border-outpatient-border text-sm bg-white"
        />
      </div>
      <div className="flex gap-2 mb-4">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-outpatient-primary text-white'
                : 'bg-outpatient-surface text-outpatient-primary border border-outpatient-border hover:bg-outpatient-primary/10'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.map((p) => (
          <div key={p.id} className="bg-white rounded-lg border border-outpatient-border p-4 flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-gray-800">{patientCode(patients, p.patientId)}</span>
                <StatusBadge status={p.status} />
              </div>
              <p className="text-sm font-medium text-gray-700">{p.medicationName} — {p.dose}</p>
              <p className="text-xs text-gray-500">{p.frequency}{p.route ? ` · ${p.route}` : ''}</p>
              {p.instructions && <p className="text-xs text-gray-400 mt-1">{p.instructions}</p>}
              <p className="text-xs text-gray-400">From {p.startsOn}{p.endsOn ? ` to ${p.endsOn}` : ''}</p>
            </div>
            {p.status === 'ACTIVE' && (
              <ActionButton icon={Ban} label="Discontinue" danger onClick={() => onDiscontinue(p.id)} />
            )}
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No prescriptions match your filters.</p>}
      </div>
    </div>
  )
}

// --- Investigation List ---

function InvestigationList({ items, loading, patients, onAcknowledge }: {
  items: InvestigationOrderRow[]
  loading: boolean
  patients: PatientRow[]
  onAcknowledge: (id: string) => void
}) {
  if (loading) return <p className="text-sm text-gray-400">Loading…</p>
  if (items.length === 0) return <p className="text-sm text-gray-400">No investigations.</p>

  const columns: { status: string; label: string; color: string }[] = [
    { status: 'ORDERED', label: 'Ordered', color: 'border-l-blue-400' },
    { status: 'IN_PROGRESS', label: 'In Progress', color: 'border-l-amber-400' },
    { status: 'RESULTED', label: 'Resulted', color: 'border-l-purple-400' },
    { status: 'ACKNOWLEDGED', label: 'Acknowledged', color: 'border-l-green-400' },
  ]

  return (
    <div className="grid grid-cols-4 gap-3">
      {columns.map((col) => {
        const colItems = items.filter((i) => i.status === col.status)
        return (
          <div key={col.status} className="space-y-2">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-xs font-semibold text-gray-700">{col.label}</span>
              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 rounded">{colItems.length}</span>
            </div>
            {colItems.map((i) => (
              <div key={i.id} className={`bg-white rounded-lg border border-outpatient-border border-l-4 ${col.color} p-3`}>
                <p className="text-sm font-semibold text-gray-800">{patientCode(patients, i.patientId)}</p>
                <p className="text-xs font-medium text-gray-700 mt-1">{i.testName}</p>
                {i.clinicalIndication && <p className="text-[10px] text-gray-500 mt-1">{i.clinicalIndication}</p>}
                <p className="text-[10px] text-gray-400 mt-1">Ordered {new Date(i.orderedAt).toLocaleDateString()}</p>
                {i.status === 'RESULTED' && (
                  <button onClick={() => onAcknowledge(i.id)} className="mt-2 text-[10px] text-outpatient-primary hover:underline">Acknowledge →</button>
                )}
              </div>
            ))}
            {colItems.length === 0 && <p className="text-[10px] text-gray-300 text-center py-4">—</p>}
          </div>
        )
      })}
    </div>
  )
}

// --- Forms ---

function FormShell({ title, onCancel, children }: { title: string; onCancel: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-outpatient-surface rounded-xl border border-outpatient-border p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>
      {children}
    </div>
  )
}

function patientLabel(p: { code: string; initials?: string | null; hospitalNumber?: string | null }): string {
  const parts = [p.code]
  if (p.initials) parts.push(p.initials)
  if (p.hospitalNumber) parts.push(`(${p.hospitalNumber})`)
  return parts.join(' — ')
}

function PatientSelect({ patients, value, onChange }: { patients: PatientRow[]; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-3">
      <option value="">Select patient…</option>
      {patients.map((p) => <option key={p.id} value={p.id}>{patientLabel(p)}</option>)}
    </select>
  )
}

const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-3'

function AppointmentForm({ unitId, patients, clinicianId, onSubmit, onCancel }: {
  unitId: string
  patients: PatientRow[]
  clinicianId: string
  onSubmit: (params: { unitId: string; patientId: string; clinicianId: string; kind: string; reason: string; startAt: string; endAt: string; notes: string }) => Promise<void>
  onCancel: () => void
}) {
  const [patientId, setPatientId] = useState('')
  const [kind, setKind] = useState('NEW_CONSULT')
  const [reason, setReason] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [notes, setNotes] = useState('')

  return (
    <FormShell title="New Appointment" onCancel={onCancel}>
      <PatientSelect patients={patients} value={patientId} onChange={setPatientId} />
      <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
        {['NEW_CONSULT', 'FOLLOW_UP', 'PROCEDURE', 'TELEHEALTH', 'URGENT_REVIEW', 'ANNUAL_REVIEW', 'VACCINATION'].map((k) => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
      </select>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for visit" className={inputClass} />
      <div className="grid grid-cols-2 gap-3 mb-3">
        <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={inputClass} />
        <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className={inputClass} />
      </div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={2} className={inputClass} />
      <button
        onClick={() => patientId && startAt && endAt && onSubmit({ unitId, patientId, clinicianId, kind, reason, startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString(), notes })}
        disabled={!patientId || !startAt || !endAt}
        className="px-4 py-2 bg-outpatient-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        Schedule
      </button>
    </FormShell>
  )
}

function EncounterForm({ unitId, patients, clinicianId, onSubmit, onCancel }: {
  unitId: string
  patients: PatientRow[]
  clinicianId: string
  onSubmit: (params: { unitId: string; patientId: string; clinicianId: string; subjective: string; objective: string; assessment: string; plan: string; diagnosisCodes?: string }) => Promise<void>
  onCancel: () => void
}) {
  const [patientId, setPatientId] = useState('')
  const [subjective, setSubjective] = useState('')
  const [objective, setObjective] = useState('')
  const [assessment, setAssessment] = useState('')
  const [plan, setPlan] = useState('')
  const [diagnosisCodes, setDiagnosisCodes] = useState('')

  return (
    <FormShell title="New Encounter" onCancel={onCancel}>
      <PatientSelect patients={patients} value={patientId} onChange={setPatientId} />
      <textarea value={subjective} onChange={(e) => setSubjective(e.target.value)} placeholder="Subjective (S)" rows={2} className={inputClass} />
      <textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Objective (O)" rows={2} className={inputClass} />
      <textarea value={assessment} onChange={(e) => setAssessment(e.target.value)} placeholder="Assessment (A)" rows={2} className={inputClass} />
      <textarea value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="Plan (P)" rows={2} className={inputClass} />
      <input value={diagnosisCodes} onChange={(e) => setDiagnosisCodes(e.target.value)} placeholder="Diagnosis codes (optional, comma-separated)" className={inputClass} />
      <button
        onClick={() => patientId && assessment && onSubmit({ unitId, patientId, clinicianId, subjective, objective, assessment, plan, diagnosisCodes: diagnosisCodes || undefined })}
        disabled={!patientId || !assessment}
        className="px-4 py-2 bg-outpatient-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        Create Encounter
      </button>
    </FormShell>
  )
}

function CarePlanForm({ unitId, patients, onSubmit, onCancel }: {
  unitId: string
  patients: PatientRow[]
  onSubmit: (params: { unitId: string; patientId: string; title: string; description: string; goals: string; reviewIntervalDays: number }) => Promise<void>
  onCancel: () => void
}) {
  const [patientId, setPatientId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [goals, setGoals] = useState('')
  const [reviewIntervalDays, setReviewIntervalDays] = useState(90)

  return (
    <FormShell title="New Care Plan" onCancel={onCancel}>
      <PatientSelect patients={patients} value={patientId} onChange={setPatientId} />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Plan title" className={inputClass} />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={2} className={inputClass} />
      <textarea value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="Goals" rows={2} className={inputClass} />
      <input type="number" value={reviewIntervalDays} onChange={(e) => setReviewIntervalDays(Number(e.target.value))} placeholder="Review interval (days)" className={inputClass} />
      <button
        onClick={() => patientId && title && onSubmit({ unitId, patientId, title, description, goals, reviewIntervalDays })}
        disabled={!patientId || !title}
        className="px-4 py-2 bg-outpatient-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        Create Plan
      </button>
    </FormShell>
  )
}

function PrescriptionForm({ unitId, patients, onSubmit, onCancel }: {
  unitId: string
  patients: PatientRow[]
  onSubmit: (params: { unitId: string; patientId: string; medicationName: string; dose: string; frequency: string; route?: string; instructions?: string }) => Promise<void>
  onCancel: () => void
}) {
  const [patientId, setPatientId] = useState('')
  const [medicationName, setMedicationName] = useState('')
  const [dose, setDose] = useState('')
  const [frequency, setFrequency] = useState('')
  const [route, setRoute] = useState('PO')
  const [instructions, setInstructions] = useState('')
  const routes = ['PO', 'IV', 'IM', 'SC', 'PR', 'SL', 'Topical', 'Inhaled', 'NG']

  return (
    <FormShell title="New Prescription" onCancel={onCancel}>
      <PatientSelect patients={patients} value={patientId} onChange={setPatientId} />
      <input value={medicationName} onChange={(e) => setMedicationName(e.target.value)} placeholder="Medication name" className={inputClass} />
      <div className="grid grid-cols-2 gap-3 mb-3">
        <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="Dose (e.g. 500mg)" className={inputClass} />
        <input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="Frequency (e.g. BD)" className={inputClass} />
      </div>
      <select value={route} onChange={(e) => setRoute(e.target.value)} className={inputClass}>
        {routes.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Instructions" rows={2} className={inputClass} />
      <button
        onClick={() => patientId && medicationName && dose && frequency && onSubmit({ unitId, patientId, medicationName, dose, frequency, route: route || undefined, instructions: instructions || undefined })}
        disabled={!patientId || !medicationName || !dose || !frequency}
        className="px-4 py-2 bg-outpatient-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        Prescribe
      </button>
    </FormShell>
  )
}

function InvestigationForm({ unitId, patients, onSubmit, onCancel }: {
  unitId: string
  patients: PatientRow[]
  onSubmit: (params: { unitId: string; patientId: string; testName: string; clinicalIndication?: string; notes?: string }) => Promise<void>
  onCancel: () => void
}) {
  const [patientId, setPatientId] = useState('')
  const [orderType, setOrderType] = useState('Lab')
  const [priority, setPriority] = useState('Routine')
  const [testName, setTestName] = useState('')
  const [clinicalIndication, setClinicalIndication] = useState('')
  const [notes, setNotes] = useState('')
  const orderTypes = ['Lab', 'Imaging', 'Consult', 'Transfusion', 'Procedure', 'Nursing', 'Diet', 'Other']
  const priorities = ['Routine', 'Urgent', 'STAT']

  return (
    <FormShell title="New Investigation Order" onCancel={onCancel}>
      <PatientSelect patients={patients} value={patientId} onChange={setPatientId} />
      <div className="grid grid-cols-2 gap-3 mb-3">
        <select value={orderType} onChange={(e) => setOrderType(e.target.value)} className={inputClass}>
          {orderTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}>
          {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <input value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="Test / Order name" className={inputClass} />
      <textarea value={clinicalIndication} onChange={(e) => setClinicalIndication(e.target.value)} placeholder="Clinical indication" rows={2} className={inputClass} />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={2} className={inputClass} />
      <button
        onClick={() => {
          if (!patientId || !testName) return
          const fullTestName = orderType !== 'Lab' ? `[${orderType}] ${testName}`.trim() : testName
          const fullNotes = notes || (priority !== 'Routine' ? `Priority: ${priority}` : undefined)
          onSubmit({ unitId, patientId, testName: fullTestName, clinicalIndication: clinicalIndication || undefined, notes: fullNotes })
        }}
        disabled={!patientId || !testName}
        className="px-4 py-2 bg-outpatient-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        Order
      </button>
    </FormShell>
  )
}

// --- Shared UI ---

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    SCHEDULED: 'bg-blue-100 text-blue-700',
    CHECKED_IN: 'bg-amber-100 text-amber-700',
    IN_ROOM: 'bg-amber-100 text-amber-700',
    COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
    NO_SHOW: 'bg-red-100 text-red-700',
    RESCHEDULED: 'bg-blue-100 text-blue-700',
    DRAFT: 'bg-gray-100 text-gray-600',
    ACTIVE: 'bg-green-100 text-green-700',
    SIGNED: 'bg-emerald-100 text-emerald-700',
    AMENDED: 'bg-amber-100 text-amber-700',
    ARCHIVED: 'bg-gray-100 text-gray-500',
    PAUSED: 'bg-amber-100 text-amber-700',
    DISCONTINUED: 'bg-red-100 text-red-700',
    EXPIRED: 'bg-gray-100 text-gray-500',
    ORDERED: 'bg-blue-100 text-blue-700',
    IN_PROGRESS: 'bg-amber-100 text-amber-700',
    RESULTED: 'bg-purple-100 text-purple-700',
    ACKNOWLEDGED: 'bg-green-100 text-green-700',
  }
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>{status.replace(/_/g, ' ')}</span>
}

function ActionButton({ icon: Icon, label, onClick, danger }: { icon: React.ElementType; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-outpatient-primary hover:bg-outpatient-primary/10'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  )
}
