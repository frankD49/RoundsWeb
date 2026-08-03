import { useEffect, useState, useRef } from 'react'
import { useClinicalStore } from '@/stores/clinical'
import { useAuthStore, useCanCreateUnit } from '@/stores/auth'
import { MessageBanners } from '@/components/Banner'
import { Building2, Plus, Mail, Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function UnitSelectionScreen() {
  const {
    units, isLoadingUnits, invitations, isLoadingInvitations,
    error, success, info,
    loadUnits, loadInvitations, selectUnit, createUnit, acceptInvitation,
    dismissError, dismissSuccess, dismissInfo,
  } = useClinicalStore()
  const setDeviceAuthStatus = useAuthStore((s) => s.setDeviceAuthStatus)
  const canCreateUnit = useCanCreateUnit()

  const [showCreate, setShowCreate] = useState(false)
  const [newUnitName, setNewUnitName] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showInvitations, setShowInvitations] = useState(false)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    loadUnits()
    loadInvitations()
  }, [loadUnits, loadInvitations])

  useEffect(() => {
    if (invitations.length > 0) {
      setShowInvitations(true)
    }
  }, [invitations.length])

  useEffect(() => {
    if (currentIndex >= units.length && units.length > 0) {
      setCurrentIndex(units.length - 1)
    }
  }, [units.length, currentIndex])

  const handleCreate = async () => {
    if (!newUnitName.trim()) return
    await createUnit(newUnitName.trim())
    setNewUnitName('')
    setShowCreate(false)
  }

  const handleContinue = () => {
    const unit = units[currentIndex]
    if (!unit) return
    setDeviceAuthStatus('unknown')
    selectUnit(unit.id)
  }

  const goLeft = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1)
  }

  const goRight = () => {
    if (currentIndex < units.length - 1) setCurrentIndex(currentIndex + 1)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (delta > 50) goLeft()
    else if (delta < -50) goRight()
    touchStartX.current = null
  }

  if (isLoadingUnits) {
    return (
      <div className="min-h-screen bg-clinical-background flex items-center justify-center">
        <p className="text-gray-400">Loading units…</p>
      </div>
    )
  }

  if (units.length === 0) {
    return (
      <div className="min-h-screen bg-clinical-background flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-clinical-primary/10 flex items-center justify-center mb-3">
              <Building2 className="w-7 h-7 text-clinical-primary" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome to Rounds</h1>
            <p className="text-sm text-gray-500 mt-1">{canCreateUnit ? 'Create your first clinical unit to get started' : 'Only Physicians and Organizations can create clinical units. Ask your unit administrator for an invitation.'}</p>
          </div>

          <MessageBanners
            error={error} success={success} info={info}
            onDismissError={dismissError} onDismissSuccess={dismissSuccess} onDismissInfo={dismissInfo}
          />

          <div className="bg-clinical-surface rounded-xl border border-clinical-border p-4 space-y-3">
            {canCreateUnit ? (
              <>
                <input
                  type="text"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  placeholder="Unit name (e.g. Ward 3)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-clinical-primary/20 focus:border-clinical-primary"
                  autoFocus
                />
                <button
                  onClick={handleCreate}
                  disabled={!newUnitName.trim() || isLoadingUnits}
                  className="w-full py-2.5 bg-clinical-primary text-white font-medium rounded-lg hover:bg-clinical-primary/90 disabled:opacity-50"
                >
                  Create Unit
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">
                You don't have permission to create units. If you've received an invitation, accept it below.
              </p>
            )}
          </div>

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
        </div>
      </div>
    )
  }

  const currentUnit = units[currentIndex]

  return (
    <div className="min-h-screen bg-clinical-background flex flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Top bar with page indicators and sign out */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <button
          onClick={() => { setShowCreate(true) }}
          disabled={!canCreateUnit}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-clinical-primary border border-clinical-primary/30 rounded-lg hover:bg-clinical-primary/5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          New Unit
        </button>

        {/* Page indicators */}
        {units.length > 1 && (
          <div className="flex items-center gap-2">
            {units.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-2 rounded-full transition-all',
                  i === currentIndex ? 'w-6 bg-clinical-primary' : 'w-2 bg-gray-300'
                )}
              />
            ))}
          </div>
        )}

        {invitations.length > 0 && (
          <button
            onClick={() => setShowInvitations(true)}
            className="relative flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-clinical-info border border-clinical-info/30 rounded-lg hover:bg-clinical-info/5"
          >
            <Mail className="w-4 h-4" />
            Invitations
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-clinical-info text-white text-xs rounded-full flex items-center justify-center">
              {invitations.length}
            </span>
          </button>
        )}
        {invitations.length === 0 && <div className="w-20" />}
      </div>

      {/* Message banners */}
      <div className="px-6 py-2">
        <MessageBanners
          error={error} success={success} info={info}
          onDismissError={dismissError} onDismissSuccess={dismissSuccess} onDismissInfo={dismissInfo}
        />
      </div>

      {/* Full-screen unit card */}
      <div className="flex-1 flex items-center justify-center px-6 pb-32 relative overflow-hidden">
        {units.length > 1 && currentIndex > 0 && (
          <button
            onClick={goLeft}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-clinical-surface border border-clinical-border flex items-center justify-center text-gray-600 hover:bg-gray-50 z-10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <div
          key={currentUnit.id}
          className="w-full max-w-md bg-clinical-surface rounded-3xl border border-clinical-border shadow-sm flex flex-col items-center justify-center p-10 min-h-[400px]"
        >
          <div className="w-20 h-20 rounded-3xl bg-clinical-primary/10 flex items-center justify-center mb-6">
            <Building2 className="w-10 h-10 text-clinical-primary" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 text-center">{currentUnit.name}</h2>
          <div className="flex items-center gap-3 mt-3">
            <span className="px-3 py-1 text-sm font-medium text-clinical-primary bg-clinical-primary/10 rounded-full">
              {currentUnit.role}
            </span>
            <span className="px-3 py-1 text-sm text-gray-500 bg-gray-100 rounded-full">
              {currentUnit.status}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-6">
            {units.length > 1 ? `Unit ${currentIndex + 1} of ${units.length}` : 'Your unit'}
          </p>
          {units.length > 1 && (
            <p className="text-xs text-gray-400 mt-2">Swipe to browse units</p>
          )}
        </div>

        {units.length > 1 && currentIndex < units.length - 1 && (
          <button
            onClick={goRight}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-clinical-surface border border-clinical-border flex items-center justify-center text-gray-600 hover:bg-gray-50 z-10"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Continue button fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 px-6 py-6 bg-gradient-to-t from-clinical-background via-clinical-background to-transparent">
        <button
          onClick={handleContinue}
          disabled={isLoadingUnits}
          className="w-full max-w-md mx-auto block py-3.5 bg-clinical-primary text-white font-semibold rounded-xl hover:bg-clinical-primary/90 disabled:opacity-50 shadow-sm"
        >
          Continue
        </button>
      </div>

      {/* Invitation overlay */}
      {showInvitations && invitations.length > 0 && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={() => setShowInvitations(false)}>
          <div
            className="w-full sm:max-w-lg bg-clinical-surface rounded-t-3xl sm:rounded-3xl border border-clinical-border p-6 max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Pending Invitations</h3>
              <button onClick={() => setShowInvitations(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-3 bg-clinical-background rounded-xl border border-clinical-border">
                  <Mail className="w-5 h-5 text-clinical-info flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{inv.unitName}</p>
                    <p className="text-xs text-gray-500">Invited as {inv.role}</p>
                  </div>
                  <button
                    onClick={() => {
                      acceptInvitation(inv.id)
                      setShowInvitations(false)
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-clinical-primary border border-clinical-primary/30 rounded-lg hover:bg-clinical-primary/5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Accept
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create unit modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => { setShowCreate(false); setNewUnitName('') }}>
          <div
            className="w-full max-w-sm bg-clinical-surface rounded-2xl border border-clinical-border p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Create New Unit</h3>
              <button onClick={() => { setShowCreate(false); setNewUnitName('') }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              value={newUnitName}
              onChange={(e) => setNewUnitName(e.target.value)}
              placeholder="Unit name (e.g. Ward 3)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-clinical-primary/20 focus:border-clinical-primary mb-3"
              autoFocus
            />
            <button
              onClick={handleCreate}
              disabled={!newUnitName.trim() || isLoadingUnits}
              className="w-full py-2.5 bg-clinical-primary text-white font-medium rounded-lg hover:bg-clinical-primary/90 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
