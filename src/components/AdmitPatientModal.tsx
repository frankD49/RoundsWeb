import { useState } from 'react'
import { useClinicalStore } from '@/stores/clinical'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onAdmitted?: (patientId: string) => void
}

export default function AdmitPatientModal({ open, onClose, onAdmitted }: Props) {
  const { activeUnitId, admitPatient } = useClinicalStore()
  const [code, setCode] = useState('')
  const [initials, setInitials] = useState('')
  const [hospitalNumber, setHospitalNumber] = useState('')
  const [ageYears, setAgeYears] = useState('')
  const [sex, setSex] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  const handleSubmit = async () => {
    if (!activeUnitId || !code.trim() || !diagnosis.trim()) return
    setSaving(true)
    const id = await admitPatient({
      unitId: activeUnitId,
      code: code.trim(),
      initials: initials.trim(),
      hospitalNumber: hospitalNumber.trim(),
      ageYears: ageYears.trim(),
      sex: sex.trim(),
      diagnosis: diagnosis.trim(),
    })
    setSaving(false)
    if (id) {
      setCode(''); setInitials(''); setHospitalNumber(''); setAgeYears(''); setSex(''); setDiagnosis('')
      onClose()
      onAdmitted?.(id)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-clinical-surface rounded-2xl border border-clinical-border shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-clinical-border">
          <h2 className="text-lg font-semibold text-gray-900">Admit Patient</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <Field label="Patient Code *" value={code} onChange={setCode} placeholder="e.g. Bed-1A" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Initials" value={initials} onChange={setInitials} placeholder="e.g. JD" />
            <Field label="Hospital No." value={hospitalNumber} onChange={setHospitalNumber} placeholder="e.g. 12345" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Age (years)" value={ageYears} onChange={setAgeYears} placeholder="e.g. 65" />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Sex</label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-clinical-primary/20 focus:border-clinical-primary"
              >
                <option value="">Select…</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </div>
          </div>
          <Field label="Diagnosis *" value={diagnosis} onChange={setDiagnosis} placeholder="e.g. Community-acquired pneumonia" />
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-clinical-border">
          <button
            onClick={handleSubmit}
            disabled={!code.trim() || !diagnosis.trim() || saving}
            className="flex-1 py-2 bg-clinical-primary text-white font-medium rounded-lg hover:bg-clinical-primary/90 disabled:opacity-50"
          >
            {saving ? 'Admitting…' : 'Admit Patient'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-clinical-primary/20 focus:border-clinical-primary"
      />
    </div>
  )
}
