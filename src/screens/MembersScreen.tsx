import { useEffect, useState } from 'react'
import { useClinicalStore } from '@/stores/clinical'
import { useAuthStore } from '@/stores/auth'
import { MessageBanners } from '@/components/Banner'
import { UserPlus, Trash2, RefreshCw } from 'lucide-react'

export default function MembersScreen() {
  const {
    activeUnitId, members, isLoadingMembers,
    error, success, info,
    loadMembers, removeMember, sendInvitation,
    dismissError, dismissSuccess, dismissInfo,
  } = useClinicalStore()

  const { session } = useAuthStore()
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('PHYSICIAN')

  useEffect(() => {
    if (activeUnitId) loadMembers(activeUnitId)
  }, [activeUnitId, loadMembers])

  const handleInvite = async () => {
    if (!activeUnitId || !inviteEmail.trim()) return
    await sendInvitation(activeUnitId, inviteEmail.trim(), inviteRole)
    setInviteEmail('')
    setShowInvite(false)
  }

  const handleRemove = async (userId: string) => {
    if (!activeUnitId) return
    if (!confirm('Remove this member from the unit?')) return
    await removeMember(activeUnitId, userId)
  }

  const currentMember = members.find((m) => m.userId === session?.user?.id)
  const canManage = currentMember?.role === 'OWNER' || currentMember?.role === 'ADMIN'

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Members</h1>
        <div className="flex gap-2">
          <button
            onClick={() => activeUnitId && loadMembers(activeUnitId)}
            disabled={isLoadingMembers}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingMembers ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {canManage && (
            <button
              onClick={() => setShowInvite(!showInvite)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-clinical-primary rounded-lg hover:bg-clinical-primary/90"
            >
              <UserPlus className="w-4 h-4" />
              Invite
            </button>
          )}
        </div>
      </div>
      <p className="text-gray-500 mb-6">Unit members and roles</p>

      <MessageBanners
        error={error} success={success} info={info}
        onDismissError={dismissError} onDismissSuccess={dismissSuccess} onDismissInfo={dismissInfo}
      />

      {showInvite && (
        <div className="bg-clinical-surface rounded-xl border border-clinical-border p-4 mb-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Invite a Member</h2>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@hospital.org"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-clinical-primary/20 focus:border-clinical-primary"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-clinical-primary/20"
            >
              <option value="PHYSICIAN">Physician</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button
              onClick={handleInvite}
              disabled={!inviteEmail.trim()}
              className="px-4 py-2 bg-clinical-primary text-white font-medium rounded-lg hover:bg-clinical-primary/90 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {isLoadingMembers ? (
        <div className="bg-clinical-surface rounded-xl border border-clinical-border p-8 text-center">
          <p className="text-gray-400">Loading members…</p>
        </div>
      ) : members.length > 0 ? (
        <div className="bg-clinical-surface rounded-xl border border-clinical-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-clinical-border">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Role</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Status</th>
                {canManage && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId} className="border-b border-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{m.displayName}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      m.role === 'OWNER' ? 'bg-clinical-primary/10 text-clinical-primary' :
                      m.role === 'ADMIN' ? 'bg-clinical-info/10 text-clinical-info' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{m.status}</td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      {m.userId !== session?.user?.id && (
                        <button
                          onClick={() => handleRemove(m.userId)}
                          className="text-clinical-error hover:bg-clinical-error/5 p-1.5 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-clinical-surface rounded-xl border border-clinical-border p-8 text-center">
          <p className="text-gray-400">No members found.</p>
        </div>
      )}
    </div>
  )
}
