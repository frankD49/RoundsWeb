import { useEffect, useState } from 'react'
import { useClinicalStore } from '@/stores/clinical'
import { MessageBanners } from '@/components/Banner'
import { DictationField } from '@/components/DictationField'
import { Send, ArrowLeft, ArrowRight, Check } from 'lucide-react'

const SPECIALTIES = [
  'Cardiology', 'Neurology', 'Surgery', 'Orthopedics', 'Oncology',
  'Nephrology', 'Pulmonology', 'Endocrinology', 'Dermatology', 'Psychiatry', 'Other',
]

const URGENCY_OPTIONS = ['Routine', 'Urgent', 'STAT']

export default function ReferralScreen() {
  const { activeUnitId, patients, records, error, success, dismissError, dismissSuccess, saveCoordinationEvent, loadRecords } = useClinicalStore()
  const [step, setStep] = useState(1)
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [specialty, setSpecialty] = useState('')
  const [facility, setFacility] = useState('Internal')
  const [urgency, setUrgency] = useState('Routine')
  const [reason, setReason] = useState('')
  const [clinicalSummary, setClinicalSummary] = useState('')
  const [summaryEdited, setSummaryEdited] = useState(false)

  useEffect(() => {
    if (activeUnitId) loadRecords(activeUnitId)
  }, [activeUnitId, loadRecords])

  // Auto-generate the clinical summary from the selected patient's records,
  // unless the user has already edited it.
  useEffect(() => {
    if (!selectedPatientId || summaryEdited) return
    const pr = records.filter((r) => r.patientId === selectedPatientId)
    const problems = pr.filter((r) => ['DAILY_PROBLEM', 'COMORBIDITY', 'COMPLICATION', 'PROVISIONAL_DIAGNOSIS', 'CONFIRMED_DIAGNOSIS'].includes(r.type) && r.state === 'ACTIVE')
    const allergies = pr.filter((r) => r.type === 'ALLERGY' && r.state === 'ACTIVE')
    const meds = pr.filter((r) => r.type === 'MEDICATION' && r.state === 'ACTIVE')
    const latestUpdate = pr.filter((r) => r.type === 'DAILY_UPDATE').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    let sb = ''
    if (problems.length) sb += `Problems: ${problems.map((p) => p.summary).join('; ')}\n`
    if (allergies.length) sb += `Allergies: ${allergies.map((a) => a.summary).join('; ')}\n`
    if (meds.length) sb += `Medications: ${meds.map((m) => `${m.summary} ${m.detail ?? ''}`).join('; ')}\n`
    if (latestUpdate?.summary) sb += `Latest note: ${latestUpdate.summary}${latestUpdate.detail ? ` — ${latestUpdate.detail}` : ''}\n`
    setClinicalSummary(sb.trim())
  }, [selectedPatientId, records, summaryEdited])

  const handleSend = async () => {
    if (!activeUnitId || !selectedPatientId) return
    const body = `REFERRAL LETTER\nTo: ${specialty} (${facility})\nUrgency: ${urgency}\nReason: ${reason}${clinicalSummary ? `\n\nClinical Summary:\n${clinicalSummary}` : ''}`
    await saveCoordinationEvent({ unitId: activeUnitId, patientId: selectedPatientId, kind: 'UNIT_CHAT', body })
    setStep(1)
    setSelectedPatientId(null)
    setSpecialty('')
    setFacility('Internal')
    setUrgency('Routine')
    setReason('')
    setClinicalSummary('')
    setSummaryEdited(false)
  }

  const canNext1 = selectedPatientId && reason.trim()
  const canNext2 = specialty.trim()

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Send className="w-6 h-6 text-clinical-primary" />
        <h1 className="text-2xl font-bold text-gray-900">New Referral</h1>
        <span className="text-sm text-gray-400 ml-2">Step {step} of 3</span>
      </div>

      <MessageBanners error={error} success={success} info={null} onDismissError={dismissError} onDismissSuccess={dismissSuccess} />

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1.5 rounded-full transition-all ${
              s <= step ? 'bg-clinical-primary flex-1' : 'bg-gray-200 w-12'
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="bg-clinical-surface rounded-xl border border-clinical-border p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Patient & Reason</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Select Patient</label>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {patients.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPatientId(p.id)}
                    className={`flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg border transition-colors ${
                      selectedPatientId === p.id
                        ? 'border-clinical-primary bg-clinical-primary/5 text-clinical-primary font-medium'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span>{p.code} · {p.initials ?? '—'}</span>
                    {selectedPatientId === p.id && <Check className="w-4 h-4" />}
                  </button>
                ))}
                {patients.length === 0 && <p className="text-sm text-gray-400">No patients available</p>}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Reason for Referral *</label>
              <DictationField
                rows={3}
                value={reason}
                onChange={setReason}
                placeholder="Describe the clinical reason for this referral…"
              />
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button
              onClick={() => setStep(2)}
              disabled={!canNext1}
              className="flex items-center gap-2 px-4 py-2 bg-clinical-primary text-white font-medium rounded-lg hover:bg-clinical-primary/90 disabled:opacity-50"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-clinical-surface rounded-xl border border-clinical-border p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Destination</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Specialty *</label>
              <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="form-input">
                <option value="">Select specialty…</option>
                {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Facility</label>
                <select value={facility} onChange={(e) => setFacility(e.target.value)} className="form-input">
                  <option value="Internal">Internal</option>
                  <option value="External">External</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Urgency</label>
                <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className="form-input">
                  {URGENCY_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Clinical Summary</label>
              <DictationField
                rows={4}
                value={clinicalSummary}
                onChange={(v) => { setClinicalSummary(v); setSummaryEdited(true) }}
                placeholder="Auto-generated from patient data (editable)…"
              />
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!canNext2}
              className="flex items-center gap-2 px-4 py-2 bg-clinical-primary text-white font-medium rounded-lg hover:bg-clinical-primary/90 disabled:opacity-50"
            >
              Review <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-clinical-surface rounded-xl border border-clinical-border p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Review & Send</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">Patient</span>
              <span className="font-medium text-gray-900">
                {patients.find((p) => p.id === selectedPatientId)?.code ?? '—'}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">To</span>
              <span className="font-medium text-gray-900">{specialty} ({facility})</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">Urgency</span>
              <span className={`font-medium ${urgency === 'STAT' ? 'text-clinical-error' : urgency === 'Urgent' ? 'text-orange-600' : 'text-gray-900'}`}>{urgency}</span>
            </div>
            <div className="border-b border-gray-100 pb-2">
              <span className="text-gray-500 block mb-1">Reason</span>
              <span className="text-gray-900">{reason}</span>
            </div>
            {clinicalSummary && (
              <div className="border-b border-gray-100 pb-2">
                <span className="text-gray-500 block mb-1">Clinical Summary</span>
                <span className="text-gray-700 whitespace-pre-line">{clinicalSummary}</span>
              </div>
            )}
          </div>
          <div className="flex justify-between mt-6">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={handleSend}
              className="flex items-center gap-2 px-6 py-2 bg-clinical-primary text-white font-medium rounded-lg hover:bg-clinical-primary/90"
            >
              <Send className="w-4 h-4" /> Send Referral
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
