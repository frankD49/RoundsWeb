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
  const [name, setName] = useState('')
  const [hospitalNumber, setHospitalNumber] = useState('')
  const [patientIdNumber, setPatientIdNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [sex, setSex] = useState('M')
  const [diagnosis, setDiagnosis] = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  const calculatedAge = (() => {
    if (!dateOfBirth) return ''
    const dob = new Date(dateOfBirth)
    const diff = Date.now() - dob.getTime()
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000)).toString()
  })()

  const handleSubmit = async () => {
    if (!activeUnitId || !code.trim() || !diagnosis.trim()) return
    setSaving(true)
    const id = await admitPatient({
      unitId: activeUnitId,
      code: code.trim(),
      initials: name.trim(),
      hospitalNumber: hospitalNumber.trim(),
      ageYears: calculatedAge,
      sex: sex.trim(),
      diagnosis: diagnosis.trim(),
      phone: phone.trim(),
      patientIdNumber: patientIdNumber.trim(),
      dateOfBirth: dateOfBirth,
    })
    setSaving(false)
    if (id) {
      setCode(''); setName(''); setHospitalNumber(''); setPatientIdNumber(''); setPhone(''); setDateOfBirth(''); setSex('M'); setDiagnosis('')
      onClose()
      onAdmitted?.(id)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-clinical-surface rounded-2xl border border-clinical-border shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-clinical-border">
          <h2 className="text-lg font-semibold text-gray-900">Admit Patient</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <Field label="Patient Code *" value={code} onChange={setCode} placeholder="e.g. Bed-1A" />
          <Field label="Full Name" value={name} onChange={setName} placeholder="e.g. John Doe" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hospital No." value={hospitalNumber} onChange={setHospitalNumber} placeholder="e.g. 12345" />
            <Field label="Patient ID No." value={patientIdNumber} onChange={setPatientIdNumber} placeholder="e.g. P-001" />
          </div>
          <Field label="Phone Number" value={phone} onChange={setPhone} placeholder="e.g. +234 800 123 4567" />
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date of Birth</label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-clinical-primary/20 focus:border-clinical-primary"
            />
          </div>
          {calculatedAge && (
            <div className="text-sm text-gray-500">
              Age: <span className="font-medium text-gray-700">{calculatedAge} years</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sex</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSex('M')}
                className={`py-2.5 rounded-lg font-medium text-sm transition-colors border ${
                  sex === 'M'
                    ? 'bg-clinical-primary text-white border-clinical-primary'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Male
              </button>
              <button
                type="button"
                onClick={() => setSex('F')}
                className={`py-2.5 rounded-lg font-medium text-sm transition-colors border ${
                  sex === 'F'
                    ? 'bg-clinical-primary text-white border-clinical-primary'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Female
              </button>
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

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-clinical-primary/20 focus:border-clinical-primary"
      />
    </div>
  )
}
