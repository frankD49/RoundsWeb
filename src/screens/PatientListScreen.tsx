import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClinicalStore } from '@/stores/clinical'
import { MessageBanners } from '@/components/Banner'
import AdmitPatientModal from '@/components/AdmitPatientModal'
import { Search, RefreshCw, UserPlus } from 'lucide-react'

export default function PatientListScreen() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showAdmit, setShowAdmit] = useState(false)
  const {
    activeUnitId, patients, isLoadingPatients,
    error, dismissError,
    loadPatients,
  } = useClinicalStore()

  useEffect(() => {
    if (activeUnitId) loadPatients(activeUnitId)
  }, [activeUnitId, loadPatients])

  const filtered = patients.filter((p) =>
    p.code.toLowerCase().includes(search.toLowerCase()) ||
    (p.initials ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.hospitalNumber ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Patients</h1>
      <p className="text-gray-500 mb-6">Active patient census</p>

      <MessageBanners error={error} success={null} info={null} onDismissError={dismissError} />

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient code…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-clinical-primary/20 focus:border-clinical-primary"
          />
        </div>
        <button
          onClick={() => activeUnitId && loadPatients(activeUnitId)}
          disabled={isLoadingPatients}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoadingPatients ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <button
          onClick={() => setShowAdmit(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-clinical-primary rounded-lg hover:bg-clinical-primary/90"
        >
          <UserPlus className="w-4 h-4" />
          Admit
        </button>
      </div>

      {isLoadingPatients ? (
        <div className="bg-clinical-surface rounded-xl border border-clinical-border p-8 text-center">
          <p className="text-gray-400">Loading patients…</p>
        </div>
      ) : filtered.length > 0 ? (
        <div className="bg-clinical-surface rounded-xl border border-clinical-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-clinical-border">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Code</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Initials</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Age/Sex</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Hosp No</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/patients/${p.id}`)}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.code}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{p.initials ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{p.ageYears ? `${p.ageYears}y` : '—'}{p.sex ? ` · ${p.sex}` : ''}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{p.hospitalNumber ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-clinical-primary/10 text-clinical-primary">
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(p.updatedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-clinical-surface rounded-xl border border-clinical-border p-8 text-center">
          <p className="text-gray-400">{search ? 'No patients match your search.' : 'No active patients in this unit.'}</p>
        </div>
      )}

      <AdmitPatientModal
        open={showAdmit}
        onClose={() => setShowAdmit(false)}
        onAdmitted={(patientId) => navigate(`/patients/${patientId}`)}
      />
    </div>
  )
}
