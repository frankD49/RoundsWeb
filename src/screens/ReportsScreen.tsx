import { useEffect, useState } from 'react'
import { useClinicalStore } from '@/stores/clinical'
import { MessageBanners } from '@/components/Banner'
import { FileSearch, ArrowLeft, Download, Check } from 'lucide-react'

const ALL_SECTIONS = [
  'Demographics', 'Problems', 'Allergies', 'Vitals', 'Labs',
  'Radiology', 'Medications', 'Orders', 'SOAP Notes', 'Ventilator', 'Media',
] as const

const DATE_RANGES = ['Last 24h', 'Last 7 days', 'This admission', 'All time'] as const

const TEMPLATES: { name: string; sections: string[] }[] = [
  { name: 'Rounding Report', sections: ['Demographics', 'Problems', 'Vitals', 'Labs', 'SOAP Notes'] },
  { name: 'Handover Summary', sections: ['Demographics', 'Problems', 'Medications', 'Orders', 'SOAP Notes'] },
  { name: 'Full Admission Report', sections: [...ALL_SECTIONS] },
]

export default function ReportsScreen() {
  const { activeUnitId, patients, records, isLoadingRecords, error, success, dismissError, dismissSuccess, loadRecords } = useClinicalStore()
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set(['Demographics', 'Problems', 'Vitals', 'Labs', 'Medications', 'SOAP Notes']))
  const [dateRange, setDateRange] = useState<string>('Last 7 days')
  const [generatedReport, setGeneratedReport] = useState<string | null>(null)

  useEffect(() => {
    if (activeUnitId) loadRecords(activeUnitId)
  }, [activeUnitId, loadRecords])

  const activePatients = patients.filter((p) => p.status !== 'DISCHARGED')

  const toggleSection = (section: string) => {
    setSelectedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  const buildReport = (): string => {
    if (!selectedPatientId) return 'No patient selected'
    const patient = patients.find((p) => p.id === selectedPatientId)
    if (!patient) return 'Patient not found'
    const patientRecords = records.filter((r) => r.patientId === selectedPatientId)
    let sb = '=== MEDICAL REPORT ===\n'
    sb += `Generated: ${new Date().toLocaleString()}\n`
    sb += `Date Range: ${dateRange}\n\n`

    if (selectedSections.has('Demographics')) {
      sb += `DEMOGRAPHICS:\n  ${patient.code} · ${patient.initials ?? '—'}\n  ${patient.ageYears ?? '—'}y · ${patient.sex ?? '—'}\n  Hosp No: ${patient.hospitalNumber ?? '—'}\n\n`
    }
    if (selectedSections.has('Problems')) {
      const problems = patientRecords.filter((r) => ['DAILY_PROBLEM', 'COMORBIDITY', 'COMPLICATION', 'PROVISIONAL_DIAGNOSIS', 'CONFIRMED_DIAGNOSIS'].includes(r.type) && r.state === 'ACTIVE')
      sb += 'ACTIVE PROBLEMS:\n'
      if (problems.length === 0) sb += '  None\n'
      else problems.forEach((p) => { sb += `  - ${p.summary ?? '—'}: ${p.detail ?? '—'}\n` })
      sb += '\n'
    }
    if (selectedSections.has('Allergies')) {
      const allergies = patientRecords.filter((r) => r.type === 'ALLERGY' && r.state === 'ACTIVE')
      sb += 'ALLERGIES:\n'
      if (allergies.length === 0) sb += '  No known allergies\n'
      else allergies.forEach((a) => { sb += `  - ${a.summary ?? '—'}: ${a.detail ?? '—'}\n` })
      sb += '\n'
    }
    if (selectedSections.has('Medications')) {
      const meds = patientRecords.filter((r) => r.type === 'MEDICATION' && r.state === 'ACTIVE')
      sb += 'ACTIVE MEDICATIONS:\n'
      if (meds.length === 0) sb += '  None\n'
      else meds.forEach((m) => { sb += `  - ${m.summary ?? '—'}: ${m.detail ?? '—'}\n` })
      sb += '\n'
    }
    if (selectedSections.has('Orders')) {
      const orders = patientRecords.filter((r) => r.type === 'DAILY_ORDER' && (r.state === 'ACTIVE' || r.state === 'SIGNED'))
      sb += 'PENDING ORDERS:\n'
      if (orders.length === 0) sb += '  None\n'
      else orders.forEach((o) => { sb += `  - ${o.summary ?? '—'}: ${o.detail ?? '—'}\n` })
      sb += '\n'
    }
    if (selectedSections.has('SOAP Notes')) {
      const notes = patientRecords.filter((r) => r.type === 'DAILY_UPDATE' && r.state === 'ACTIVE')
      sb += 'SOAP NOTES:\n'
      if (notes.length === 0) sb += '  None\n'
      else notes.forEach((n) => { sb += `  [${new Date(n.createdAt).toLocaleString()}]\n    ${n.summary ?? '—'}\n    ${n.detail ?? '—'}\n` })
      sb += '\n'
    }
    if (selectedSections.has('Vitals')) {
      const vitals = patientRecords.filter((r) => r.type === 'OBSERVATION_RESULT_MEDIA' && r.summary?.toLowerCase().includes('vitals'))
      const vitalsLast = vitals.length > 0 ? vitals[vitals.length - 1] : undefined
      sb += 'LATEST VITALS:\n'
      sb += vitalsLast ? `  ${vitalsLast.summary}: ${vitalsLast.detail}\n\n` : '  None recorded\n\n'
    }
    if (selectedSections.has('Labs')) {
      const labs = patientRecords.filter((r) => r.type === 'OBSERVATION_RESULT_MEDIA' && r.summary?.toLowerCase().includes('labs'))
      const labsLast = labs.length > 0 ? labs[labs.length - 1] : undefined
      sb += 'LATEST LABS:\n'
      sb += labsLast ? `  ${labsLast.summary}: ${labsLast.detail}\n\n` : '  None recorded\n\n'
    }
    if (selectedSections.has('Radiology')) {
      const rad = patientRecords.filter((r) => r.type === 'OBSERVATION_RESULT_MEDIA' && r.summary?.toLowerCase().includes('radiology'))
      const radLast = rad.length > 0 ? rad[rad.length - 1] : undefined
      sb += 'LATEST RADIOLOGY:\n'
      sb += radLast ? `  ${radLast.summary}: ${radLast.detail}\n\n` : '  None recorded\n\n'
    }
    if (selectedSections.has('Ventilator')) {
      const vent = patientRecords.filter((r) => r.type === 'VENTILATOR')
      const ventLast = vent.length > 0 ? vent[vent.length - 1] : undefined
      sb += 'LATEST VENTILATOR:\n'
      sb += ventLast ? `  ${ventLast.summary}: ${ventLast.detail}\n\n` : '  None recorded\n\n'
    }
    if (selectedSections.has('Media')) {
      const media = patientRecords.filter((r) => r.type === 'OBSERVATION_RESULT_MEDIA' && !r.summary?.toLowerCase().includes('vitals') && !r.summary?.toLowerCase().includes('labs') && !r.summary?.toLowerCase().includes('radiology'))
      sb += 'MEDIA:\n'
      if (media.length === 0) sb += '  None\n'
      else media.forEach((m) => { sb += `  - ${m.summary ?? '—'}: ${m.detail ?? '—'}\n` })
      sb += '\n'
    }
    return sb
  }

  const handleExport = () => {
    if (!generatedReport) return
    const blob = new Blob([generatedReport], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report_${selectedPatientId ?? 'patient'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (generatedReport) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setGeneratedReport(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Report Preview</h1>
          </div>
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-clinical-primary border border-clinical-primary/30 rounded-lg hover:bg-clinical-primary/5">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
        <pre className="bg-clinical-surface rounded-xl border border-clinical-border p-6 text-sm font-mono whitespace-pre-wrap">{generatedReport}</pre>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <FileSearch className="w-6 h-6 text-clinical-primary" />
        <h1 className="text-2xl font-bold text-gray-900">Medical Reports</h1>
      </div>

      <MessageBanners error={error} success={success} info={null} onDismissError={dismissError} onDismissSuccess={dismissSuccess} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Templates */}
        <div className="bg-clinical-surface rounded-xl border border-clinical-border p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Templates</h2>
          <div className="space-y-2">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.name}
                onClick={() => setSelectedSections(new Set(tpl.sections))}
                className="w-full text-left px-3 py-2 text-sm rounded-lg border border-gray-200 hover:border-clinical-primary/30 hover:bg-clinical-primary/5 transition-colors"
              >
                {tpl.name}
              </button>
            ))}
          </div>
        </div>

        {/* Patient & Date Range */}
        <div className="bg-clinical-surface rounded-xl border border-clinical-border p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Patient & Date Range</h2>
          <div className="space-y-3">
            <div className="max-h-48 overflow-y-auto space-y-1">
              {activePatients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPatientId(p.id)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg border transition-colors ${
                    selectedPatientId === p.id
                      ? 'border-clinical-primary bg-clinical-primary/5 text-clinical-primary font-medium'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {p.code} · {p.initials ?? '—'}
                </button>
              ))}
              {activePatients.length === 0 && <p className="text-sm text-gray-400">No active patients</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date Range</label>
              <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="form-input">
                {DATE_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="bg-clinical-surface rounded-xl border border-clinical-border p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Sections</h2>
          <div className="space-y-1">
            {ALL_SECTIONS.map((section) => (
              <button
                key={section}
                onClick={() => toggleSection(section)}
                className="flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span>{section}</span>
                {selectedSections.has(section) ? (
                  <Check className="w-4 h-4 text-clinical-primary" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-200" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={() => setGeneratedReport(buildReport())}
          disabled={!selectedPatientId || selectedSections.size === 0 || isLoadingRecords}
          className="px-6 py-2.5 bg-clinical-primary text-white font-medium rounded-lg hover:bg-clinical-primary/90 disabled:opacity-50"
        >
          Generate Report
        </button>
      </div>
    </div>
  )
}
