import { useEffect, useState } from 'react'
import { useClinicalStore } from '@/stores/clinical'
import { useAuthStore } from '@/stores/auth'
import { MessageBanners } from '@/components/Banner'
import { Building2, Plus, Mail, Check } from 'lucide-react'

export default function UnitSelectionScreen() {
  const {
    units, isLoadingUnits, invitations, isLoadingInvitations,
    error, success, info,
    loadUnits, loadInvitations, selectUnit, createUnit, acceptInvitation,
    dismissError, dismissSuccess, dismissInfo,
  } = useClinicalStore()
  const setDeviceAuthStatus = useAuthStore((s) => s.setDeviceAuthStatus)

  const [showCreate, setShowCreate] = useState(false)
  const [newUnitName, setNewUnitName] = useState('')

  useEffect(() => {
    loadUnits()
    loadInvitations()
  }, [loadUnits, loadInvitations])

  const handleCreate = async () => {
    if (!newUnitName.trim()) return
    await createUnit(newUnitName.trim())
    setNewUnitName('')
    setShowCreate(false)
  }

  return (
    <div className="min-h-screen bg-clinical-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-clinical-primary/10 flex items-center justify-center mb-3">
            <Building2 className="w-7 h-7 text-clinical-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Select a Unit</h1>
          <p className="text-sm text-gray-500 mt-1">Choose a clinical unit to continue</p>
        </div>

        <div className="space-y-2 mb-4">
          <MessageBanners
            error={error} success={success} info={info}
            onDismissError={dismissError} onDismissSuccess={dismissSuccess} onDismissInfo={dismissInfo}
          />
        </div>

        {isLoadingUnits ? (
          <div className="bg-clinical-surface rounded-xl border border-clinical-border p-8 text-center">
            <p className="text-gray-400">Loading units…</p>
          </div>
        ) : units.length > 0 ? (
          <div className="space-y-2">
            {units.map((unit) => (
              <button
                key={unit.id}
                onClick={() => { setDeviceAuthStatus('unknown'); selectUnit(unit.id) }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-clinical-surface rounded-xl border border-clinical-border hover:border-clinical-primary/30 transition-colors text-left"
              >
                <Building2 className="w-5 h-5 text-clinical-secondary flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{unit.name}</p>
                  <p className="text-xs text-gray-500">{unit.role} · {unit.status}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-clinical-surface rounded-xl border border-clinical-border p-8 text-center mb-4">
            <p className="text-gray-400">You don't belong to any units yet.</p>
            <p className="text-gray-400 text-sm mt-1">Create one or accept a pending invitation below.</p>
          </div>
        )}

        {/* Pending invitations */}
        {!isLoadingInvitations && invitations.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Pending Invitations</h2>
            <div className="space-y-2">
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-3 bg-clinical-surface rounded-xl border border-clinical-border">
                  <Mail className="w-5 h-5 text-clinical-info flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{inv.unitName}</p>
                    <p className="text-xs text-gray-500">Invited as {inv.role}</p>
                  </div>
                  <button
                    onClick={() => acceptInvitation(inv.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-clinical-primary border border-clinical-primary/30 rounded-lg hover:bg-clinical-primary/5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Accept
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create unit */}
        <div className="mt-6">
          {showCreate ? (
            <div className="bg-clinical-surface rounded-xl border border-clinical-border p-4 space-y-3">
              <input
                type="text"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                placeholder="Unit name (e.g. Ward 3)"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-clinical-primary/20 focus:border-clinical-primary"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={!newUnitName.trim() || isLoadingUnits}
                  className="flex-1 py-2 bg-clinical-primary text-white font-medium rounded-lg hover:bg-clinical-primary/90 disabled:opacity-50"
                >
                  Create
                </button>
                <button
                  onClick={() => { setShowCreate(false); setNewUnitName('') }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-clinical-primary border border-clinical-primary/30 rounded-xl hover:bg-clinical-primary/5"
            >
              <Plus className="w-4 h-4" />
              Create New Unit
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
