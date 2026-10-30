import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useClinicalStore } from '@/stores/clinical'
import { MessageBanners } from '@/components/Banner'
import { DictationField } from '@/components/DictationField'
import { searchDrugs, learnDrug, checkDrugInteractions, checkCriticalBody } from '@/lib/formulary'
import { ArrowLeft, AlertTriangle, Pill, ClipboardList, Activity, MessageSquare, Plus, X, CheckCircle, ClipboardCheck, Stethoscope, Download, FileText, FlaskConical, Image, Wind, Paperclip } from 'lucide-react'
import type { ClinicalRecordType, ClinicalRecordRow } from '@/types'

type Tab = 'overview' | 'consultation' | 'notes' | 'problems' | 'allergies' | 'medications' | 'vitals' | 'labs' | 'radiology' | 'ventilator' | 'media' | 'orders' | 'clinical-records' | 'discharge' | 'timeline'

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: ClipboardCheck },
  { key: 'consultation', label: 'Consultation', icon: Stethoscope },
  { key: 'notes', label: 'Notes', icon: FileText },
  { key: 'problems', label: 'Problems', icon: AlertTriangle },
  { key: 'allergies', label: 'Allergies', icon: AlertTriangle },
  { key: 'medications', label: 'Drug History', icon: Pill },
  { key: 'vitals', label: 'Vitals', icon: Activity },
  { key: 'labs', label: 'Labs', icon: FlaskConical },
  { key: 'radiology', label: 'Radiology', icon: Image },
  { key: 'ventilator', label: 'Ventilator', icon: Wind },
  { key: 'media', label: 'Media', icon: Paperclip },
  { key: 'orders', label: 'Orders', icon: ClipboardList },
  { key: 'clinical-records', label: 'Clinical Records', icon: ClipboardCheck },
  { key: 'discharge', label: 'Discharge', icon: ClipboardCheck },
  { key: 'timeline', label: 'Timeline', icon: MessageSquare },
]

/** Tab → record filter, matching Android workspace sections. */
const TAB_TYPE_MAP: Partial<Record<Tab, { types: ClinicalRecordType[]; summary?: string }>> = {
  problems: { types: ['DAILY_PROBLEM', 'COMORBIDITY', 'COMPLICATION', 'PROVISIONAL_DIAGNOSIS', 'CONFIRMED_DIAGNOSIS'] },
  allergies: { types: ['ALLERGY'] },
  medications: { types: ['MEDICATION'] },
  orders: { types: ['DAILY_ORDER'] },
  overview: { types: ['CURRENT_STATUS'], summary: 'Overview' },
  notes: { types: ['DAILY_UPDATE'], summary: 'Notes' },
  vitals: { types: ['OBSERVATION_RESULT_MEDIA'], summary: 'Vitals' },
  labs: { types: ['OBSERVATION_RESULT_MEDIA'], summary: 'Labs' },
  radiology: { types: ['OBSERVATION_RESULT_MEDIA'], summary: 'Radiology' },
  ventilator: { types: ['VENTILATOR'] },
  media: { types: ['OBSERVATION_RESULT_MEDIA'], summary: 'Media' },
}

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
    saveProblem, saveAllergy, saveMedication, saveOrder,
    updateRecordState, dischargePatient, saveCoordinationEvent, saveDailyUpdate,
    saveWorkspaceEntry,
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
  const tabFilter = TAB_TYPE_MAP[activeTab]
  const tabRecords = useMemo(() => {
    if (!tabFilter) return []
    return patientRecords.filter(
      (r) => tabFilter.types.includes(r.type) &&
        (!tabFilter.summary || r.summary === tabFilter.summary),
    )
  }, [patientRecords, tabFilter])

  const criticalEntries = useMemo(
    () => (activeTab === 'vitals' || activeTab === 'labs')
      ? tabRecords.filter((r) => r.detail && checkCriticalBody(r.detail).length > 0)
      : [],
    [activeTab, tabRecords],
  )

  const handleDischarge = async () => {
    if (!activeUnitId || !patientId) return
    if (!confirm('Discharge this patient? This will archive the patient record.')) return
    await dischargePatient(activeUnitId, patientId)
    navigate('/patients')
  }

  const handleConsultationSave = async (data: { subjective: string; objective: string; assessment: string; plan: string }) => {
    if (!activeUnitId || !patientId) return
    await saveDailyUpdate({
      unitId: activeUnitId, patientId,
      subjective: data.subjective, objective: data.objective,
      assessment: data.assessment, plan: data.plan, state: 'ACTIVE',
    })
    setShowForm(false)
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
        {activeTab !== 'timeline' && activeTab !== 'clinical-records' && activeTab !== 'consultation' && activeTab !== 'discharge' && (
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
      {showForm && activeTab !== 'timeline' && activeTab !== 'clinical-records' && activeTab !== 'consultation' && activeTab !== 'discharge' && activeUnitId && patientId && (
        <RecordForm
          tab={activeTab}
          unitId={activeUnitId}
          patientId={patientId}
          activeAllergies={patientRecords.filter((r) => r.type === 'ALLERGY' && r.state === 'ACTIVE').map((r) => r.summary ?? '')}
          activeDrugs={patientRecords.filter((r) => r.type === 'MEDICATION' && r.state === 'ACTIVE').map((r) => r.summary ?? '')}
          onSave={async (data) => {
            if (activeTab === 'problems') await saveProblem({ ...data, unitId: activeUnitId, patientId, type: data.type ?? 'DAILY_PROBLEM', state: data.state ?? 'ACTIVE' } as any)
            if (activeTab === 'allergies') await saveAllergy({ unitId: activeUnitId, patientId, allergen: data.allergen ?? '', reaction: data.reaction ?? '', severity: data.severity ?? '', state: data.state ?? 'ACTIVE' } as any)
            if (activeTab === 'medications') {
              learnDrug(data.drug ?? '', data.route ?? '', data.frequency ?? '')
              await saveMedication({ unitId: activeUnitId, patientId, drug: data.drug ?? '', dose: data.dose ?? '', route: data.route ?? '', frequency: data.frequency ?? '', duration: data.duration ?? '', notes: data.notes ?? '', state: data.state ?? 'ACTIVE' } as any)
            }
            if (activeTab === 'orders') await saveOrder({ unitId: activeUnitId, patientId, orderType: data.orderType ?? '', priority: data.priority ?? '', indication: data.indication ?? '', details: data.details ?? '', state: data.state ?? 'ACTIVE' } as any)
            if (activeTab === 'overview') await saveWorkspaceEntry({ unitId: activeUnitId, patientId, type: 'CURRENT_STATUS', summary: 'Overview', detail: data.body ?? '', signed: true })
            if (activeTab === 'notes') await saveWorkspaceEntry({ unitId: activeUnitId, patientId, type: 'DAILY_UPDATE', summary: 'Notes', detail: data.body ?? '', signed: true })
            if (activeTab === 'vitals') await saveWorkspaceEntry({ unitId: activeUnitId, patientId, type: 'OBSERVATION_RESULT_MEDIA', summary: 'Vitals', detail: data.body ?? '' })
            if (activeTab === 'labs') await saveWorkspaceEntry({ unitId: activeUnitId, patientId, type: 'OBSERVATION_RESULT_MEDIA', summary: 'Labs', detail: data.body ?? '' })
            if (activeTab === 'radiology') await saveWorkspaceEntry({ unitId: activeUnitId, patientId, type: 'OBSERVATION_RESULT_MEDIA', summary: 'Radiology', detail: data.body ?? '' })
            if (activeTab === 'ventilator') await saveWorkspaceEntry({ unitId: activeUnitId, patientId, type: 'VENTILATOR', summary: 'Ventilator', detail: data.body ?? '' })
            if (activeTab === 'media') await saveWorkspaceEntry({ unitId: activeUnitId, patientId, type: 'OBSERVATION_RESULT_MEDIA', summary: 'Media', detail: data.body ?? '' })
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
      {activeTab === 'consultation' ? (
        <ConsultationSection patientRecords={patientRecords} onSave={handleConsultationSave} />
      ) : activeTab === 'discharge' ? (
        <DischargeSummarySection patientRecords={patientRecords} patient={patient} patientId={patientId ?? ''} onDischarge={handleDischarge} />
      ) : activeTab === 'clinical-records' ? (
        <ClinicalRecordsSection patientRecords={patientRecords} />
      ) : activeTab === 'timeline' ? (
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
          {criticalEntries.length > 0 && <CriticalFlagsBanner entries={criticalEntries} />}
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
            onClick={() => { onStateChange('SIGNED'); setShowActions(false) }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-clinical-primary border border-clinical-primary/30 rounded-lg hover:bg-clinical-primary/5"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Sign
          </button>
          <button
            onClick={() => { onStateChange('RESOLVED'); setShowActions(false) }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-clinical-success border border-clinical-success/30 rounded-lg hover:bg-clinical-success/5"
          >
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

function RecordForm({ tab, onSave, onCancel, activeAllergies, activeDrugs }: {
  tab: Tab
  unitId: string
  patientId: string
  activeAllergies?: string[]
  activeDrugs?: string[]
  onSave: (data: Record<string, string>) => void
  onCancel: () => void
}) {
  const [data, setData] = useState<Record<string, string>>({})
  const [drugSuggestions, setDrugSuggestions] = useState(false)

  const set = (key: string, value: string) => setData((d) => ({ ...d, [key]: value }))

  const allergyWarning = tab === 'medications' && data.drug
    ? (activeAllergies ?? []).filter((a) => a && (data.drug!.toLowerCase().includes(a.toLowerCase()) || a.toLowerCase().includes(data.drug!.toLowerCase())))
    : []
  const ddiWarnings = tab === 'medications' && data.drug
    ? checkDrugInteractions(data.drug, activeDrugs ?? [])
    : []

  const suggestions = tab === 'medications' ? searchDrugs(data.drug ?? '') : []

  const isValid = () => {
    if (tab === 'problems') return !!data.summary?.trim()
    if (tab === 'allergies') return !!data.allergen?.trim()
    if (tab === 'medications') return !!data.drug?.trim()
    if (tab === 'orders') return !!(data.indication?.trim() || data.details?.trim())
    if (tab === 'overview' || tab === 'notes' || tab === 'media') return !!data.body?.trim()
    if (tab === 'vitals') return ['temperature', 'pulse', 'systolic', 'diastolic', 'respiratoryRate', 'oxygenSaturation', 'notes'].some((k) => !!data[k]?.trim())
    if (tab === 'labs') return !!data.body?.trim() || ['hb', 'pcv', 'wbc', 'platelets', 'urea', 'creatinine', 'potassium', 'sodium', 'chloride', 'bilirubin', 'alt', 'ast', 'alp', 'albumin', 'pt', 'inr', 'aptt', 'ph', 'pco2', 'po2', 'hco3', 'lactate', 'cultureSite', 'organism', 'sensitivity', 'hba1c'].some((k) => !!data[k]?.trim())
    if (tab === 'radiology') return ['region', 'indication', 'findings', 'impression', 'reportedBy'].some((k) => !!data[k]?.trim())
    if (tab === 'ventilator') return ['mode', 'fio2', 'peep', 'rate', 'tidalVolume', 'pressureSupport', 'notes'].some((k) => !!data[k]?.trim())
    return false
  }

  const part = (label: string, v?: string, unit?: string) =>
    v?.trim() ? `${label}: ${v.trim()}${unit ? ` ${unit}` : ''}` : null

  const handleSubmit = () => {
    const d = { ...data }
    if (tab === 'vitals') {
      d.body = [
        part('Temp', d.temperature, 'deg C'),
        part('Pulse', d.pulse, 'bpm'),
        d.systolic?.trim() || d.diastolic?.trim() ? `BP: ${d.systolic}/${d.diastolic} mmHg` : null,
        part('RR', d.respiratoryRate, 'breaths/min'),
        part('SpO2', d.oxygenSaturation, '%'),
        d.notes?.trim() || null,
      ].filter(Boolean).join(' · ')
    }
    if (tab === 'labs') {
      const panel = d.panel ?? 'FBC'
      const fields: [string, string | undefined][] = [
        ['Hb', d.hb], ['PCV', d.pcv], ['WBC', d.wbc], ['Platelets', d.platelets],
        ['HbA1c', d.hba1c], ['Reference', d.hba1cReference],
        ['Urea', d.urea], ['Cr', d.creatinine], ['K', d.potassium], ['Na', d.sodium], ['Cl', d.chloride],
        ['Bilirubin', d.bilirubin], ['ALT', d.alt], ['AST', d.ast], ['ALP', d.alp], ['Albumin', d.albumin],
        ['PT', d.pt], ['INR', d.inr], ['APTT', d.aptt],
        ['pH', d.ph], ['pCO2', d.pco2], ['pO2', d.po2], ['HCO3', d.hco3], ['Lactate', d.lactate],
        ['Specimen', d.cultureSite], ['Organism', d.organism], ['Sensitivity', d.sensitivity],
      ]
      const values = fields.map(([k, v]) => part(k, v)).filter(Boolean).join(' · ')
      d.body = [panel, values || null, d.note?.trim() || null].filter(Boolean).join(' · ')
    }
    if (tab === 'radiology') {
      d.body = [
        d.modality ?? 'X-ray',
        part('Study', d.region),
        part('Indication', d.indication),
        part('Findings', d.findings),
        part('Impression', d.impression),
        part('Reported by', d.reportedBy),
      ].filter(Boolean).join(' · ')
    }
    if (tab === 'ventilator') {
      d.body = [
        part('Mode', d.mode),
        part('FiO2', d.fio2, '%'),
        part('PEEP', d.peep, 'cmH2O'),
        part('Rate', d.rate, 'bpm'),
        part('TV', d.tidalVolume, 'mL'),
        part('PS', d.pressureSupport, 'cmH2O'),
        d.notes?.trim() || null,
      ].filter(Boolean).join(' · ')
    }
    onSave(d)
  }

  const numField = (key: string, label: string) => (
    <FormField label={label}>
      <input className="form-input" inputMode="decimal" value={data[key] ?? ''} onChange={(e) => set(key, e.target.value)} />
    </FormField>
  )

  return (
    <div className="bg-clinical-surface rounded-xl border border-clinical-border p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Add {currentTabLabel(tab)}</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>

      {tab === 'problems' && (
        <div className="space-y-3">
          <FormField label="Problem Type">
            <select value={data.type ?? 'DAILY_PROBLEM'} onChange={(e) => set('type', e.target.value)} className="form-input">
              <option value="DAILY_PROBLEM">Daily Problem</option>
              <option value="PROVISIONAL_DIAGNOSIS">Provisional Diagnosis</option>
              <option value="CONFIRMED_DIAGNOSIS">Confirmed Diagnosis</option>
              <option value="COMORBIDITY">Comorbidity</option>
              <option value="COMPLICATION">Complication</option>
            </select>
          </FormField>
          <FormField label="Problem / diagnosis *"><DictationField value={data.summary ?? ''} onChange={(v) => set('summary', v)} placeholder="e.g. Community-acquired pneumonia" /></FormField>
          <FormField label="Clinical detail"><DictationField rows={2} value={data.detail ?? ''} onChange={(v) => set('detail', v)} placeholder="Clinical detail…" /></FormField>
        </div>
      )}

      {tab === 'allergies' && (
        <div className="space-y-3">
          <FormField label="Allergen *"><input className="form-input" value={data.allergen ?? ''} onChange={(e) => set('allergen', e.target.value)} placeholder="e.g. Penicillin" /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Reaction"><input className="form-input" value={data.reaction ?? ''} onChange={(e) => set('reaction', e.target.value)} placeholder="e.g. Rash" /></FormField>
            <FormField label="Severity">
              <select value={data.severity ?? 'Mild'} onChange={(e) => set('severity', e.target.value)} className="form-input">
                <option value="Mild">Mild</option>
                <option value="Moderate">Moderate</option>
                <option value="Severe">Severe</option>
                <option value="Anaphylaxis">Anaphylaxis</option>
              </select>
            </FormField>
          </div>
        </div>
      )}

      {tab === 'medications' && (
        <div className="space-y-3">
          {(allergyWarning.length > 0 || ddiWarnings.length > 0) && (
            <div className="rounded-lg border border-clinical-warning/40 bg-clinical-warning/10 p-3 space-y-1">
              {allergyWarning.map((a) => <p key={a} className="text-xs text-clinical-warning">⚠ "{data.drug}" may conflict with allergy: {a}</p>)}
              {ddiWarnings.map((w) => <p key={w} className="text-xs text-clinical-warning">💊 {w}</p>)}
            </div>
          )}
          <FormField label="Drug *">
            <div className="relative">
              <input
                className="form-input"
                value={data.drug ?? ''}
                onChange={(e) => { set('drug', e.target.value); setDrugSuggestions(true) }}
                onFocus={() => setDrugSuggestions(true)}
                onBlur={() => setTimeout(() => setDrugSuggestions(false), 150)}
                placeholder="e.g. Amoxicillin"
              />
              {drugSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-clinical-border bg-white shadow-lg">
                  {suggestions.map((s) => (
                    <li key={s.inn}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-clinical-primary/5"
                        onMouseDown={() => {
                          set('drug', s.inn)
                          if (s.routes[0]) set('route', s.routes[0])
                          if (s.frequencies[0]) set('frequency', s.frequencies[0])
                          setDrugSuggestions(false)
                        }}
                      >
                        <span className="block text-sm text-gray-900">{s.inn}</span>
                        <span className="block text-xs text-gray-400">{s.category}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Dose"><input className="form-input" value={data.dose ?? ''} onChange={(e) => set('dose', e.target.value)} placeholder="e.g. 500mg" /></FormField>
            <FormField label="Route">
              <select value={data.route ?? 'PO'} onChange={(e) => set('route', e.target.value)} className="form-input">
                {['PO', 'IV', 'IM', 'SC', 'PR', 'SL', 'Topical', 'Inhaled', 'Nebulised', 'NG', 'PV', 'Transdermal', 'Buccal', 'Spinal', 'Intranasal', 'IUD'].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Frequency"><input className="form-input" value={data.frequency ?? ''} onChange={(e) => set('frequency', e.target.value)} placeholder="e.g. TDS" /></FormField>
            <FormField label="Duration"><input className="form-input" value={data.duration ?? ''} onChange={(e) => set('duration', e.target.value)} placeholder="e.g. 7 days" /></FormField>
          </div>
          <FormField label="Notes"><DictationField rows={2} value={data.notes ?? ''} onChange={(v) => set('notes', v)} placeholder="Additional notes…" /></FormField>
        </div>
      )}

      {tab === 'orders' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Order Type">
              <select value={data.orderType ?? 'Lab'} onChange={(e) => set('orderType', e.target.value)} className="form-input">
                {['Lab', 'Imaging', 'Consult', 'Transfusion', 'Procedure', 'Nursing', 'Diet', 'Other'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Priority">
              <select value={data.priority ?? 'Routine'} onChange={(e) => set('priority', e.target.value)} className="form-input">
                <option value="Routine">Routine</option>
                <option value="Urgent">Urgent</option>
                <option value="STAT">Stat</option>
              </select>
            </FormField>
          </div>
          <FormField label="Indication"><DictationField value={data.indication ?? ''} onChange={(v) => set('indication', v)} placeholder="e.g. Rule out PE" /></FormField>
          <FormField label="Order details"><DictationField rows={2} value={data.details ?? ''} onChange={(v) => set('details', v)} placeholder="Order details…" /></FormField>
        </div>
      )}

      {tab === 'vitals' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">{numField('temperature', 'Temp (°C)')}{numField('pulse', 'Pulse (bpm)')}</div>
          <div className="grid grid-cols-2 gap-3">{numField('systolic', 'SBP (mmHg)')}{numField('diastolic', 'DBP (mmHg)')}</div>
          <div className="grid grid-cols-2 gap-3">{numField('respiratoryRate', 'RR (breaths/min)')}{numField('oxygenSaturation', 'SpO2 (%)')}</div>
          <FormField label="Clinical signs / note"><DictationField rows={2} value={data.notes ?? ''} onChange={(v) => set('notes', v)} /></FormField>
        </div>
      )}

      {tab === 'labs' && (
        <div className="space-y-3">
          <FormField label="Panel">
            <select value={data.panel ?? 'FBC'} onChange={(e) => set('panel', e.target.value)} className="form-input">
              {['FBC', 'HbA1c', 'Kidney function test', 'Liver function test', 'Coagulation', 'ABG', 'Culture / sensitivity'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </FormField>
          {(data.panel ?? 'FBC') === 'FBC' && (
            <div className="grid grid-cols-2 gap-3">{numField('hb', 'Hb')}{numField('pcv', 'PCV')}{numField('wbc', 'WBC')}{numField('platelets', 'Platelets')}</div>
          )}
          {data.panel === 'HbA1c' && (
            <div className="grid grid-cols-2 gap-3">{numField('hba1c', 'HbA1c (%)')}<FormField label="Reference / target"><input className="form-input" value={data.hba1cReference ?? ''} onChange={(e) => set('hba1cReference', e.target.value)} /></FormField></div>
          )}
          {data.panel === 'Kidney function test' && (
            <div className="grid grid-cols-2 gap-3">{numField('urea', 'Urea')}{numField('creatinine', 'Cr')}{numField('potassium', 'K')}{numField('sodium', 'Na')}{numField('chloride', 'Cl')}</div>
          )}
          {data.panel === 'Liver function test' && (
            <div className="grid grid-cols-2 gap-3">{numField('bilirubin', 'Bilirubin')}{numField('alt', 'ALT')}{numField('ast', 'AST')}{numField('alp', 'ALP')}{numField('albumin', 'Albumin')}</div>
          )}
          {data.panel === 'Coagulation' && (
            <div className="grid grid-cols-2 gap-3">{numField('pt', 'PT')}{numField('inr', 'INR')}{numField('aptt', 'APTT')}</div>
          )}
          {data.panel === 'ABG' && (
            <div className="grid grid-cols-2 gap-3">{numField('ph', 'pH')}{numField('pco2', 'pCO2')}{numField('po2', 'pO2')}{numField('hco3', 'HCO3')}{numField('lactate', 'Lactate')}</div>
          )}
          {data.panel === 'Culture / sensitivity' && (
            <div className="space-y-3">
              <FormField label="Specimen / site"><input className="form-input" value={data.cultureSite ?? ''} onChange={(e) => set('cultureSite', e.target.value)} /></FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Organism"><input className="form-input" value={data.organism ?? ''} onChange={(e) => set('organism', e.target.value)} /></FormField>
                <FormField label="Sensitivity"><input className="form-input" value={data.sensitivity ?? ''} onChange={(e) => set('sensitivity', e.target.value)} /></FormField>
              </div>
            </div>
          )}
          <FormField label="Lab note"><DictationField value={data.note ?? ''} onChange={(v) => set('note', v)} /></FormField>
        </div>
      )}

      {tab === 'radiology' && (
        <div className="space-y-3">
          <FormField label="Modality">
            <select value={data.modality ?? 'X-ray'} onChange={(e) => set('modality', e.target.value)} className="form-input">
              {['X-ray', 'Ultrasound', 'CT', 'MRI', 'Fluoroscopy', 'Other'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </FormField>
          <FormField label="Body region / study"><input className="form-input" value={data.region ?? ''} onChange={(e) => set('region', e.target.value)} /></FormField>
          <FormField label="Clinical indication"><DictationField value={data.indication ?? ''} onChange={(v) => set('indication', v)} /></FormField>
          <FormField label="Findings"><DictationField rows={2} value={data.findings ?? ''} onChange={(v) => set('findings', v)} /></FormField>
          <FormField label="Impression / conclusion"><DictationField rows={2} value={data.impression ?? ''} onChange={(v) => set('impression', v)} /></FormField>
          <FormField label="Reported by"><input className="form-input" value={data.reportedBy ?? ''} onChange={(e) => set('reportedBy', e.target.value)} /></FormField>
        </div>
      )}

      {tab === 'ventilator' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">{numField('mode', 'Mode')}{numField('fio2', 'FiO2 (%)')}{numField('peep', 'PEEP (cmH2O)')}{numField('rate', 'Rate (bpm)')}{numField('tidalVolume', 'TV (mL)')}{numField('pressureSupport', 'PS (cmH2O)')}</div>
          <FormField label="Ventilator notes"><DictationField rows={2} value={data.notes ?? ''} onChange={(v) => set('notes', v)} /></FormField>
        </div>
      )}

      {(tab === 'overview' || tab === 'notes' || tab === 'media') && (
        <FormField label={tab === 'overview' ? 'Current status' : tab === 'notes' ? 'Note details' : 'Media description / caption'}>
          <DictationField rows={3} value={data.body ?? ''} onChange={(v) => set('body', v)} />
        </FormField>
      )}

      <div className="flex gap-2 mt-4">
        <button onClick={handleSubmit} disabled={!isValid()} className="flex-1 py-2 bg-clinical-primary text-white font-medium rounded-lg hover:bg-clinical-primary/90 disabled:opacity-50">Save</button>
        <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
      </div>
    </div>
  )
}

function currentTabLabel(tab: Tab): string {
  return tabs.find((t) => t.key === tab)?.label ?? tab
}

function CriticalFlagsBanner({ entries }: { entries: ClinicalRecordRow[] }) {
  const flags = entries.flatMap((e) => checkCriticalBody(e.detail ?? '').map((f) => `${f.message} (${f.metric}: ${f.value})`))
  if (flags.length === 0) return null
  return (
    <div className="rounded-xl border border-clinical-error/40 bg-clinical-error/10 p-4">
      <p className="text-sm font-semibold text-clinical-error mb-1">⚠ Critical values</p>
      <ul className="list-disc list-inside space-y-0.5">
        {[...new Set(flags)].map((f) => <li key={f} className="text-xs text-clinical-error">{f}</li>)}
      </ul>
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
        <FormField label="Message"><DictationField rows={3} value={body} onChange={setBody} placeholder="Enter message…" /></FormField>
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

interface SoapCardData {
  id: string
  timestamp: string
  subjective: string
  objective: string
  assessment: string
  plan: string
  signed: boolean
}

function ClinicalRecordsSection({ patientRecords }: { patientRecords: ClinicalRecordRow[] }) {
  const soapCards = buildSoapCards(patientRecords)

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Clinical Records (SOAP)</h2>
        <p className="text-sm text-gray-500">Auto-populated from rounds entries</p>
      </div>
      {soapCards.length === 0 ? (
        <div className="bg-clinical-surface rounded-xl border border-clinical-border p-8 text-center">
          <p className="text-gray-400">No clinical records yet. Entries will appear here as SOAP cards.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {soapCards.map((card) => (
            <SoapCard key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  )
}

function SoapCard({ card }: { card: SoapCardData }) {
  return (
    <div className="bg-clinical-surface rounded-xl border border-clinical-border p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400">{new Date(card.timestamp).toLocaleString()}</span>
        {card.signed && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-clinical-primary">
            <CheckCircle className="w-3.5 h-3.5" />
            Signed
          </span>
        )}
      </div>
      <div className="space-y-2">
        <SoapSection letter="S" title="Subjective" content={card.subjective} />
        <SoapSection letter="O" title="Objective" content={card.objective} />
        <SoapSection letter="A" title="Assessment" content={card.assessment} />
        <SoapSection letter="P" title="Plan" content={card.plan} />
      </div>
    </div>
  )
}

function SoapSection({ letter, title, content }: { letter: string; title: string; content: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-0.5">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold text-white bg-clinical-primary/30">
          {letter}
        </span>
        <span className="text-sm font-medium text-gray-600">{title}</span>
      </div>
      <p className="text-sm text-gray-700 pl-7 whitespace-pre-line">{content}</p>
    </div>
  )
}

function buildSoapCards(records: ClinicalRecordRow[]): SoapCardData[] {
  const dailyUpdates = records.filter((r) => r.type === 'DAILY_UPDATE' && r.state === 'ACTIVE')
  const problems = records.filter((r) => ['DAILY_PROBLEM', 'COMORBIDITY', 'COMPLICATION'].includes(r.type) && r.state === 'ACTIVE')
  const allergies = records.filter((r) => r.type === 'ALLERGY' && r.state === 'ACTIVE')
  const medications = records.filter((r) => r.type === 'MEDICATION' && r.state === 'ACTIVE')
  const orders = records.filter((r) => r.type === 'DAILY_ORDER' && (r.state === 'ACTIVE' || r.state === 'SIGNED'))
  const vitals = records.filter((r) => r.type === 'OBSERVATION_RESULT_MEDIA' && r.summary?.toLowerCase().includes('vitals'))
  const labs = records.filter((r) => r.type === 'OBSERVATION_RESULT_MEDIA' && r.summary?.toLowerCase().includes('labs'))
  const radiology = records.filter((r) => r.type === 'OBSERVATION_RESULT_MEDIA' && r.summary?.toLowerCase().includes('radiology'))
  const ventilator = records.filter((r) => r.type === 'VENTILATOR')
  const media = records.filter((r) => r.type === 'OBSERVATION_RESULT_MEDIA' && !r.summary?.toLowerCase().includes('vitals') && !r.summary?.toLowerCase().includes('labs') && !r.summary?.toLowerCase().includes('radiology'))
  const diagnoses = records.filter((r) => ['PROVISIONAL_DIAGNOSIS', 'CONFIRMED_DIAGNOSIS'].includes(r.type))

  if (dailyUpdates.length > 0) {
    return dailyUpdates
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((update) => {
        const parts = update.detail?.split('|') || []
        const subjective = update.summary || ''
        const objective = parts[0] || ''
        const assessment = parts[1] || ''
        const plan = parts[2] || ''

        const fullSubjective = [
          subjective,
          problems.length > 0 ? `Problems: ${problems.map((p) => `${p.summary}: ${p.detail}`).join('; ')}` : null,
          allergies.length > 0 ? `Allergies: ${allergies.map((a) => `${a.summary}: ${a.detail}`).join('; ')}` : null,
          medications.length > 0 ? `Drug Hx: ${medications.map((m) => `${m.summary} ${m.detail}`).join('; ')}` : null,
        ].filter(Boolean).join('\n')

        const fullObjective = [
          objective,
          vitals.length > 0 ? `Vitals: ${vitals.map((v) => v.detail).join('; ')}` : null,
          labs.length > 0 ? `Labs: ${labs.map((l) => l.detail).join('; ')}` : null,
          radiology.length > 0 ? `Radiology: ${radiology.map((r) => r.detail).join('; ')}` : null,
          ventilator.length > 0 ? `Ventilator: ${ventilator.map((v) => v.detail).join('; ')}` : null,
          media.length > 0 ? `Media: ${media.map((m) => m.detail).join('; ')}` : null,
        ].filter(Boolean).join('\n')

        const fullPlan = [
          plan,
          orders.length > 0 ? `Orders: ${orders.map((o) => `${o.summary}: ${o.detail}`).join('; ')}` : null,
          medications.length > 0 ? `Prescriptions: ${medications.map((m) => `${m.summary} ${m.detail}`).join('; ')}` : null,
        ].filter(Boolean).join('\n')

        return {
          id: update.id,
          timestamp: update.createdAt,
          subjective: fullSubjective || '—',
          objective: fullObjective || '—',
          assessment: assessment || diagnoses.length > 0 ? diagnoses.map((d) => d.summary).join('; ') : '—',
          plan: fullPlan || '—',
          signed: update.state === 'SIGNED',
        }
      })
  }

  const cards: SoapCardData[] = []
  for (const p of problems) {
    cards.push({ id: p.id, timestamp: p.createdAt, subjective: `Problem: ${p.summary}: ${p.detail}`, objective: '—', assessment: '—', plan: '—', signed: p.state === 'SIGNED' })
  }
  for (const a of allergies) {
    cards.push({ id: a.id, timestamp: a.createdAt, subjective: `Allergy: ${a.summary}: ${a.detail}`, objective: '—', assessment: '—', plan: '—', signed: a.state === 'SIGNED' })
  }
  for (const m of medications) {
    cards.push({ id: m.id, timestamp: m.createdAt, subjective: `Drug Hx: ${m.summary} ${m.detail}`, objective: '—', assessment: '—', plan: `Prescription: ${m.summary} ${m.detail}`, signed: m.state === 'SIGNED' })
  }
  for (const o of orders) {
    cards.push({ id: o.id, timestamp: o.createdAt, subjective: '—', objective: '—', assessment: '—', plan: `Order: ${o.summary}: ${o.detail}`, signed: o.state === 'SIGNED' })
  }
  return cards.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

function ConsultationSection({ patientRecords, onSave }: {
  patientRecords: ClinicalRecordRow[]
  onSave: (data: { subjective: string; objective: string; assessment: string; plan: string }) => Promise<void>
}) {
  const [subjective, setSubjective] = useState('')
  const [objective, setObjective] = useState('')
  const [assessment, setAssessment] = useState('')
  const [plan, setPlan] = useState('')

  const problems = patientRecords.filter((r) => ['DAILY_PROBLEM', 'COMORBIDITY', 'COMPLICATION'].includes(r.type) && r.state === 'ACTIVE')
  const allergies = patientRecords.filter((r) => r.type === 'ALLERGY' && r.state === 'ACTIVE')
  const medications = patientRecords.filter((r) => r.type === 'MEDICATION' && r.state === 'ACTIVE')
  const soapNotes = patientRecords.filter((r) => r.type === 'DAILY_UPDATE' && r.state === 'ACTIVE').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const isValid = subjective.trim() || objective.trim() || assessment.trim() || plan.trim()

  return (
    <div className="space-y-4">
      {/* Clinical Snapshot */}
      <div className="bg-clinical-surface rounded-xl border border-clinical-border p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Clinical Snapshot</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Active Problems</p>
            {problems.length === 0 ? <p className="text-sm text-gray-400">None</p> : (
              <ul className="space-y-1">{problems.slice(0, 3).map((p) => <li key={p.id} className="text-sm text-gray-700">{p.summary}</li>)}</ul>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Allergies</p>
            {allergies.length === 0 ? <p className="text-sm text-gray-400">No known allergies</p> : (
              <ul className="space-y-1">{allergies.slice(0, 2).map((a) => <li key={a.id} className="text-sm text-orange-600">{a.summary}</li>)}</ul>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Medications</p>
            {medications.length === 0 ? <p className="text-sm text-gray-400">None</p> : (
              <ul className="space-y-1">{medications.slice(0, 3).map((m) => <li key={m.id} className="text-sm text-gray-700">{m.summary}</li>)}</ul>
            )}
          </div>
        </div>
      </div>

      {/* SOAP Entry Form */}
      <div className="bg-clinical-surface rounded-xl border border-clinical-border p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">New SOAP Consultation Note</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Subjective (S)</label>
            <DictationField rows={2} value={subjective} onChange={setSubjective} placeholder="Patient-reported symptoms, history…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Objective (O)</label>
            <DictationField rows={2} value={objective} onChange={setObjective} placeholder="Vitals, exam findings, lab results…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Assessment (A)</label>
            <DictationField rows={2} value={assessment} onChange={setAssessment} placeholder="Clinical impression, differential diagnosis…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Plan (P)</label>
            <DictationField rows={2} value={plan} onChange={setPlan} placeholder="Orders, medications, follow-up…" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onSave({ subjective, objective, assessment, plan })}
            disabled={!isValid}
            className="flex-1 py-2 bg-clinical-primary text-white font-medium rounded-lg hover:bg-clinical-primary/90 disabled:opacity-50"
          >
            Sign & Submit
          </button>
        </div>
      </div>

      {/* Previous SOAP Notes */}
      {soapNotes.length > 0 && (
        <div className="bg-clinical-surface rounded-xl border border-clinical-border p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Previous Consultation Notes</h2>
          <div className="space-y-3">
            {soapNotes.map((note) => {
              const parts = note.detail?.split('|') || []
              return (
                <div key={note.id} className="border border-gray-100 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-2">{new Date(note.createdAt).toLocaleString()}</p>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium text-gray-600">S:</span> {note.summary || '—'}</p>
                    <p><span className="font-medium text-gray-600">O:</span> {parts[0] || '—'}</p>
                    <p><span className="font-medium text-gray-600">A:</span> {parts[1] || '—'}</p>
                    <p><span className="font-medium text-gray-600">P:</span> {parts[2] || '—'}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function DischargeSummarySection({ patientRecords, patient, patientId, onDischarge }: {
  patientRecords: ClinicalRecordRow[]
  patient: { code: string; initials: string | null; ageYears: string | null; sex: string | null; hospitalNumber: string | null } | undefined
  patientId: string
  onDischarge: () => Promise<void>
}) {
  const { saveWorkspaceEntry, activeUnitId } = useClinicalStore()
  const [disposition, setDisposition] = useState('Home')
  const [condition, setCondition] = useState('Stable')
  const [hospitalCourse, setHospitalCourse] = useState('')
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState('')
  const [secondaryDiagnoses, setSecondaryDiagnoses] = useState('')
  const [dischargeMeds, setDischargeMeds] = useState('')
  const [followUpClinic, setFollowUpClinic] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [followUpNotes, setFollowUpNotes] = useState('')
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null)

  const problems = patientRecords.filter((r) => ['DAILY_PROBLEM', 'COMORBIDITY', 'COMPLICATION', 'PROVISIONAL_DIAGNOSIS', 'CONFIRMED_DIAGNOSIS'].includes(r.type) && r.state === 'ACTIVE')
  const allergies = patientRecords.filter((r) => r.type === 'ALLERGY' && r.state === 'ACTIVE')
  const medications = patientRecords.filter((r) => r.type === 'MEDICATION' && r.state === 'ACTIVE')
  const soapNotes = patientRecords.filter((r) => r.type === 'DAILY_UPDATE' && r.state === 'ACTIVE').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const generateSummary = () => {
    let sb = '=== DISCHARGE SUMMARY ===\n'
    sb += `Date: ${new Date().toLocaleDateString()}\n`
    sb += `Patient: ${patient?.code ?? '—'} · ${patient?.initials ?? '—'}\n`
    sb += `${patient?.ageYears ?? '—'}y · ${patient?.sex ?? '—'} · Hosp No: ${patient?.hospitalNumber ?? '—'}\n\n`
    sb += `Disposition: ${disposition}\n`
    sb += `Condition at Discharge: ${condition}\n\n`
    sb += 'Hospital Course:\n'
    sb += hospitalCourse ? `  ${hospitalCourse}\n` : '  (Not specified)\n\n'
    sb += 'Diagnoses:\n'
    if (primaryDiagnosis.trim()) sb += `  Primary: ${primaryDiagnosis.trim()}\n`
    if (secondaryDiagnoses.trim()) sb += `  Secondary: ${secondaryDiagnoses.trim()}\n`
    if (!primaryDiagnosis.trim() && !secondaryDiagnoses.trim()) {
      if (problems.length === 0) sb += '  None\n'
      else problems.forEach((p) => { sb += `  - ${p.summary ?? '—'}: ${p.detail ?? '—'}\n` })
    }
    sb += '\n'
    sb += 'Allergies:\n'
    if (allergies.length === 0) sb += '  No known allergies\n'
    else allergies.forEach((a) => { sb += `  - ${a.summary ?? '—'}: ${a.detail ?? '—'}\n` })
    sb += '\n'
    sb += 'Discharge Medications:\n'
    sb += dischargeMeds ? `  ${dischargeMeds}\n` : medications.length > 0 ? medications.map((m) => `  - ${m.summary} ${m.detail}`).join('\n') + '\n' : '  None\n'
    sb += '\n'
    sb += 'Follow-up:\n'
    const fu = [followUpClinic.trim(), followUpDate.trim() ? `on ${followUpDate.trim()}` : '', followUpNotes.trim()].filter(Boolean).join(' ')
    sb += fu ? `  ${fu}\n` : '  None specified\n\n'
    sb += 'Recent Progress Notes:\n'
    if (soapNotes.length === 0) sb += '  None\n'
    else soapNotes.slice(0, 3).forEach((n) => { sb += `  - ${n.summary ?? '—'}\n` })
    setGeneratedSummary(sb)
  }

  const handleExport = () => {
    if (!generatedSummary) return
    const blob = new Blob([generatedSummary], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `discharge_${patient?.code ?? 'patient'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrintPdf = () => {
    if (!generatedSummary) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<html><head><title>Discharge Summary</title><style>body{font-family:monospace;white-space:pre-wrap;padding:24px;font-size:13px}</style></head><body>${generatedSummary.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br/>')}</body></html>`)
    win.document.close()
    win.print()
  }

  const handleSignAndDischarge = async () => {
    if (!generatedSummary || !activeUnitId || !patientId) return
    await saveWorkspaceEntry({
      unitId: activeUnitId,
      patientId,
      type: 'DISCHARGE_SUMMARY',
      summary: 'Discharge Summary',
      detail: generatedSummary,
      signed: true,
    })
    await onDischarge()
  }

  return (
    <div className="space-y-4">
      <div className="bg-clinical-surface rounded-xl border border-clinical-border p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Discharge Summary Form</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Disposition</label>
              <select value={disposition} onChange={(e) => setDisposition(e.target.value)} className="form-input">
                <option value="Home">Home</option>
                <option value="Home with services">Home with services</option>
                <option value="Rehabilitation">Rehabilitation</option>
                <option value="Skilled nursing facility">Skilled nursing facility</option>
                <option value="Transferred">Transferred</option>
                <option value="Expired">Expired</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Condition at Discharge</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)} className="form-input">
                <option value="Stable">Stable</option>
                <option value="Improved">Improved</option>
                <option value="Unchanged">Unchanged</option>
                <option value="Deteriorated">Deteriorated</option>
                <option value="Deceased">Deceased</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Hospital Course</label>
            <DictationField rows={3} value={hospitalCourse} onChange={setHospitalCourse} placeholder="Summary of hospital course…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Primary Diagnosis</label>
            <DictationField value={primaryDiagnosis} onChange={setPrimaryDiagnosis} placeholder={problems[0]?.summary ?? 'e.g. Community-acquired pneumonia'} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Secondary Diagnoses</label>
            <DictationField rows={2} value={secondaryDiagnoses} onChange={setSecondaryDiagnoses} placeholder="One per line or comma-separated…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Discharge Medications (override auto-fill)</label>
            <DictationField rows={2} value={dischargeMeds} onChange={setDischargeMeds} placeholder={medications.map((m) => `${m.summary} ${m.detail}`).join('; ') || 'Auto-filled from active medications'} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Follow-up Clinic</label>
              <input className="form-input" value={followUpClinic} onChange={(e) => setFollowUpClinic(e.target.value)} placeholder="e.g. Cardiology clinic" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Follow-up Date</label>
              <input className="form-input" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Follow-up Notes</label>
            <DictationField rows={2} value={followUpNotes} onChange={setFollowUpNotes} placeholder="Instructions for follow-up…" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={generateSummary} className="flex-1 py-2 bg-clinical-primary text-white font-medium rounded-lg hover:bg-clinical-primary/90">
            Generate Summary
          </button>
        </div>
      </div>

      {generatedSummary && (
        <div className="bg-clinical-surface rounded-xl border border-clinical-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Preview</h2>
            <div className="flex gap-2">
              <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-clinical-primary border border-clinical-primary/30 rounded-lg hover:bg-clinical-primary/5">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
              <button onClick={handlePrintPdf} className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-clinical-primary border border-clinical-primary/30 rounded-lg hover:bg-clinical-primary/5">
                PDF
              </button>
              <button onClick={handleSignAndDischarge} className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-clinical-error rounded-lg hover:bg-clinical-error/90">
                Sign & Discharge
              </button>
            </div>
          </div>
          <pre className="text-sm font-mono whitespace-pre-wrap bg-gray-50 rounded-lg p-4 border border-gray-100">{generatedSummary}</pre>
        </div>
      )}
    </div>
  )
}
