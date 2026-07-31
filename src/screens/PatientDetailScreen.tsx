import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useClinicalStore } from '@/stores/clinical'
import { MessageBanners } from '@/components/Banner'
import { ArrowLeft, AlertTriangle, Pill, ClipboardList, FileText, Activity, MessageSquare, Plus, X, CheckCircle } from 'lucide-react'
import type { ClinicalRecordType } from '@/types'

type Tab = 'problems' | 'allergies' | 'medications' | 'orders' | 'notes' | 'timeline'

const tabs: { key: Tab; label: string; icon: React.ElementType; types: ClinicalRecordType[] }[] = [
  { key: 'problems', label: 'Problems', icon: AlertTriangle, types: ['DAILY_PROBLEM', 'COMORBIDITY', 'COMPLICATION', 'PROVISIONAL_DIAGNOSIS', 'CONFIRMED_DIAGNOSIS'] },
  { key: 'allergies', label: 'Allergies', icon: AlertTriangle, types: ['ALLERGY'] },
  { key: 'medications', label: 'Medications', icon: Pill, types: ['MEDICATION'] },
  { key: 'orders', label: 'Orders', icon: ClipboardList, types: ['DAILY_ORDER'] },
  { key: 'notes', label: 'Progress Notes', icon: FileText, types: ['DAILY_UPDATE'] },
  { key: 'timeline', label: 'Timeline', icon: Activity, types: [] },
]

export default function PatientDetailScreen() {
  const { patientId } = useParams<{ patientId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('problems')
  const [showForm, setShowForm] = useState(false)
  const [showEventForm, setShowEventForm] = useState(false)
  const {
    activeUnitId, patients, records, isLoadingRecords, timeline, isLoadingTimeline,
    error, success, dismissError, dismissSuccess,
    loadRecords, loadTimeline,
    saveProblem, saveAllergy, saveMedication, saveOrder, saveDailyUpdate,
    updateRecordState, dischargePatient, saveCoordinationEvent,
  } = useClinicalStore()

  useEffect(() => {
    if (activeUnitId) {
      loadRecords(activeUnitId)
      loadTimeline(activeUnitId)
    }
  }, [activeUnitId, loadRecords, loadTimeline])

  const patient = patients.find((p) => p.id === patientId)
  const patientRecords = records.filter((r) => r.patientId === patientId)
  const patientTimeline = timeline.filter((t) => t.patientId === patientId)
  const currentTab = tabs.find((t) => t.key === activeTab)!
  const tabRecords = currentTab.types.length > 0
    ? patientRecords.filter((r) => currentTab.types.includes(r.type))
    : []

  const handleDischarge = async () => {
    if (!activeUnitId || !patientId) return
    if (!confirm('Discharge this patient? This will archive the patient record.')) return
    await dischargePatient(activeUnitId, patientId)
    navigate('/patients')
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => navigate('/patients')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Patients
        </button>
        <button
          onClick={handleDischarge}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-clinical-error border border-clinical-error/30 rounded-lg hover:bg-clinical-error/5"
        >
          Discharge
        </button>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        {patient ? `${patient.code} · ${patient.initials ?? '—'}` : `Patient ${patientId?.slice(0, 8) ?? 'Unknown'}`}
      </h1>
      <p className="text-gray-500 mb-6">
        {patient
          ? [patient.ageYears && `${patient.ageYears}y`, patient.sex, patient.hospitalNumber && `Hosp No: ${patient.hospitalNumber}`].filter(Boolean).join(' · ') || 'Clinical workspace'
          : 'Clinical workspace'}
      </p>

      <MessageBanners error={error} success={success} info={null} onDismissError={dismissError} onDismissSuccess={dismissSuccess} />

      {/* Tabs */}
      <div className="flex items-center justify-between mb-6 border-b border-clinical-border">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setShowForm(false); setShowEventForm(false) }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-clinical-primary text-clinical-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab !== 'timeline' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-clinical-primary border border-clinical-primary/30 rounded-lg hover:bg-clinical-primary/5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        )}
        {activeTab === 'timeline' && (
          <button
            onClick={() => setShowEventForm(!showEventForm)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-clinical-primary border border-clinical-primary/30 rounded-lg hover:bg-clinical-primary/5"
          >
            <Plus className="w-3.5 h-3.5" />
            Post Event
          </button>
        )}
      </div>

      {/* Forms */}
      {showForm && activeTab !== 'timeline' && activeUnitId && patientId && (
        <RecordForm
          tab={activeTab}
          unitId={activeUnitId}
          patientId={patientId}
          onSave={async (data) => {
            if (activeTab === 'problems') await saveProblem({ ...data, unitId: activeUnitId, patientId, type: data.type ?? 'DAILY_PROBLEM', state: data.state ?? 'ACTIVE' } as any)
            if (activeTab === 'allergies') await saveAllergy({ unitId: activeUnitId, patientId, allergen: data.allergen ?? '', reaction: data.reaction ?? '', severity: data.severity ?? '', state: data.state ?? 'ACTIVE' } as any)
            if (activeTab === 'medications') await saveMedication({ unitId: activeUnitId, patientId, drug: data.drug ?? '', dose: data.dose ?? '', route: data.route ?? '', frequency: data.frequency ?? '', duration: data.duration ?? '', notes: data.notes ?? '', state: data.state ?? 'ACTIVE' } as any)
            if (activeTab === 'orders') await saveOrder({ unitId: activeUnitId, patientId, orderType: data.orderType ?? '', priority: data.priority ?? '', indication: data.indication ?? '', details: data.details ?? '', state: data.state ?? 'ACTIVE' } as any)
            if (activeTab === 'notes') await saveDailyUpdate({ unitId: activeUnitId, patientId, subjective: data.subjective ?? '', objective: data.objective ?? '', assessment: data.assessment ?? '', plan: data.plan ?? '', state: data.state ?? 'ACTIVE' } as any)
            setShowForm(false)
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {showEventForm && activeTab === 'timeline' && activeUnitId && patientId && (
        <EventForm
          onSave={async (kind, body) => {
            await saveCoordinationEvent({ unitId: activeUnitId, patientId, kind, body })
            setShowEventForm(false)
          }}
          onCancel={() => setShowEventForm(false)}
        />
      )}

      {/* Content */}
      {activeTab === 'timeline' ? (
        <div className="bg-clinical-surface rounded-xl border border-clinical-border p-5">
          {isLoadingTimeline ? (
            <p className="text-sm text-gray-400">Loading timeline…</p>
          ) : patientTimeline.length > 0 ? (
            <div className="space-y-4">
              {patientTimeline.map((event) => (
                <div key={event.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-clinical-primary/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-4 h-4 text-clinical-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700">{event.body}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {event.kind} · {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No timeline events for this patient.</p>
          )}
        </div>
      ) : isLoadingRecords ? (
        <div className="bg-clinical-surface rounded-xl border border-clinical-border p-8 text-center">
          <p className="text-gray-400">Loading {currentTab.label.toLowerCase()}…</p>
        </div>
      ) : tabRecords.length > 0 ? (
        <div className="space-y-2">
          {tabRecords.map((record) => (
            <RecordCard
              key={record.id}
              record={record}
              onStateChange={async (state) => {
                if (activeUnitId) await updateRecordState(activeUnitId, record.id, state)
              }}
            />
          ))}
        </div>
      ) : (
        <div className="bg-clinical-surface rounded-xl border border-clinical-border p-8 text-center">
          <p className="text-gray-400">No {currentTab.label.toLowerCase()} found for this patient.</p>
        </div>
      )}
    </div>
  )
}

function RecordCard({ record, onStateChange }: {
  record: { id: string; type: string; summary: string | null; detail: string | null; state: string | null; updatedAt: string }
  onStateChange: (state: string) => Promise<void>
}) {
  const [showActions, setShowActions] = useState(false)
  const isActive = record.state === 'ACTIVE' || record.state === 'DRAFT'

  return (
    <div className="bg-clinical-surface rounded-xl border border-clinical-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">
            {record.summary ?? `Record ${record.id.slice(0, 8)}`}
          </p>
          {record.detail && (
            <p className="text-sm text-gray-500 mt-1">{record.detail}</p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            {record.type} · {new Date(record.updatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {record.state && record.state !== 'ACTIVE' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {record.state}
            </span>
          )}
          {isActive && (
            <button
              onClick={() => setShowActions(!showActions)}
              className="text-xs font-medium text-clinical-primary hover:bg-clinical-primary/5 px-2 py-1 rounded"
            >
              Actions
            </button>
          )}
        </div>
      </div>
      {showActions && isActive && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          <button
            onClick={() => { onStateChange('RESOLVED'); setShowActions(false) }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-clinical-success border border-clinical-success/30 rounded-lg hover:bg-clinical-success/5"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Resolve
          </button>
          <button
            onClick={() => { onStateChange('CANCELLED'); setShowActions(false) }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

function RecordForm({ tab, onSave, onCancel }: {
  tab: Tab
  unitId: string
  patientId: string
  onSave: (data: Record<string, string>) => void
  onCancel: () => void
}) {
  const [data, setData] = useState<Record<string, string>>({})

  const set = (key: string, value: string) => setData((d) => ({ ...d, [key]: value }))

  const handleSubmit = () => {
    onSave(data)
  }

  const isValid = () => {
    if (tab === 'problems') return !!data.summary?.trim()
    if (tab === 'allergies') return !!data.allergen?.trim()
    if (tab === 'medications') return !!data.drug?.trim()
    if (tab === 'orders') return !!data.orderType?.trim()
    if (tab === 'notes') return !!data.assessment?.trim() || !!data.subjective?.trim()
    return false
  }

  return (
    <div className="bg-clinical-surface rounded-xl border border-clinical-border p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Add {tab.slice(0, -1)}</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>

      {tab === 'problems' && (
        <div className="space-y-3">
          <FormField label="Problem Type">
            <select value={data.type ?? 'DAILY_PROBLEM'} onChange={(e) => set('type', e.target.value)} className="form-input">
              <option value="DAILY_PROBLEM">Daily Problem</option>
              <option value="COMORBIDITY">Comorbidity</option>
              <option value="COMPLICATION">Complication</option>
              <option value="CONFIRMED_DIAGNOSIS">Confirmed Diagnosis</option>
            </select>
          </FormField>
          <FormField label="Summary *"><input className="form-input" value={data.summary ?? ''} onChange={(e) => set('summary', e.target.value)} placeholder="e.g. Community-acquired pneumonia" /></FormField>
          <FormField label="Detail"><textarea className="form-input" rows={2} value={data.detail ?? ''} onChange={(e) => set('detail', e.target.value)} placeholder="Clinical detail…" /></FormField>
        </div>
      )}

      {tab === 'allergies' && (
        <div className="space-y-3">
          <FormField label="Allergen *"><input className="form-input" value={data.allergen ?? ''} onChange={(e) => set('allergen', e.target.value)} placeholder="e.g. Penicillin" /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Reaction"><input className="form-input" value={data.reaction ?? ''} onChange={(e) => set('reaction', e.target.value)} placeholder="e.g. Rash" /></FormField>
            <FormField label="Severity">
              <select value={data.severity ?? 'MILD'} onChange={(e) => set('severity', e.target.value)} className="form-input">
                <option value="MILD">Mild</option>
                <option value="MODERATE">Moderate</option>
                <option value="SEVERE">Severe</option>
              </select>
            </FormField>
          </div>
        </div>
      )}

      {tab === 'medications' && (
        <div className="space-y-3">
          <FormField label="Drug *"><input className="form-input" value={data.drug ?? ''} onChange={(e) => set('drug', e.target.value)} placeholder="e.g. Amoxicillin" /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Dose"><input className="form-input" value={data.dose ?? ''} onChange={(e) => set('dose', e.target.value)} placeholder="e.g. 500mg" /></FormField>
            <FormField label="Route"><input className="form-input" value={data.route ?? ''} onChange={(e) => set('route', e.target.value)} placeholder="e.g. PO" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Frequency"><input className="form-input" value={data.frequency ?? ''} onChange={(e) => set('frequency', e.target.value)} placeholder="e.g. TDS" /></FormField>
            <FormField label="Duration"><input className="form-input" value={data.duration ?? ''} onChange={(e) => set('duration', e.target.value)} placeholder="e.g. 7 days" /></FormField>
          </div>
          <FormField label="Notes"><textarea className="form-input" rows={2} value={data.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Additional notes…" /></FormField>
        </div>
      )}

      {tab === 'orders' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Order Type *"><input className="form-input" value={data.orderType ?? ''} onChange={(e) => set('orderType', e.target.value)} placeholder="e.g. Investigation" /></FormField>
            <FormField label="Priority">
              <select value={data.priority ?? 'ROUTINE'} onChange={(e) => set('priority', e.target.value)} className="form-input">
                <option value="ROUTINE">Routine</option>
                <option value="URGENT">Urgent</option>
                <option value="STAT">Stat</option>
              </select>
            </FormField>
          </div>
          <FormField label="Indication"><input className="form-input" value={data.indication ?? ''} onChange={(e) => set('indication', e.target.value)} placeholder="e.g. Rule out PE" /></FormField>
          <FormField label="Details"><textarea className="form-input" rows={2} value={data.details ?? ''} onChange={(e) => set('details', e.target.value)} placeholder="Order details…" /></FormField>
        </div>
      )}

      {tab === 'notes' && (
        <div className="space-y-3">
          <FormField label="Subjective (S)"><textarea className="form-input" rows={2} value={data.subjective ?? ''} onChange={(e) => set('subjective', e.target.value)} placeholder="Patient-reported symptoms…" /></FormField>
          <FormField label="Objective (O)"><textarea className="form-input" rows={2} value={data.objective ?? ''} onChange={(e) => set('objective', e.target.value)} placeholder="Examination findings, vitals…" /></FormField>
          <FormField label="Assessment (A)"><textarea className="form-input" rows={2} value={data.assessment ?? ''} onChange={(e) => set('assessment', e.target.value)} placeholder="Clinical assessment…" /></FormField>
          <FormField label="Plan (P)"><textarea className="form-input" rows={2} value={data.plan ?? ''} onChange={(e) => set('plan', e.target.value)} placeholder="Management plan…" /></FormField>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button onClick={handleSubmit} disabled={!isValid()} className="flex-1 py-2 bg-clinical-primary text-white font-medium rounded-lg hover:bg-clinical-primary/90 disabled:opacity-50">Save</button>
        <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
      </div>
    </div>
  )
}

function EventForm({ onSave, onCancel }: {
  onSave: (kind: string, body: string) => void
  onCancel: () => void
}) {
  const [kind, setKind] = useState('PATIENT_CHAT')
  const [body, setBody] = useState('')

  return (
    <div className="bg-clinical-surface rounded-xl border border-clinical-border p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Post Timeline Event</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>
      <div className="space-y-3">
        <FormField label="Type">
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="form-input">
            <option value="PATIENT_CHAT">Patient Note</option>
            <option value="ALERT">Alert</option>
            <option value="HANDOVER">Handover</option>
          </select>
        </FormField>
        <FormField label="Message"><textarea className="form-input" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Enter message…" /></FormField>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={() => onSave(kind, body)} disabled={!body.trim()} className="flex-1 py-2 bg-clinical-primary text-white font-medium rounded-lg hover:bg-clinical-primary/90 disabled:opacity-50">Post</button>
        <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
