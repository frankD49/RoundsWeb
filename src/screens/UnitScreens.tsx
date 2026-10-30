import { useEffect, useMemo, useState } from 'react'
import { useClinicalStore } from '@/stores/clinical'
import { MessageBanners } from '@/components/Banner'
import { DictationField } from '@/components/DictationField'
import { fetchAuditEvents } from '@/lib/api'
import { MessageSquare, Send, AlertCircle, BarChart3, CheckCircle } from 'lucide-react'
import type { AuditEventRow } from '@/types'

const STALE_MS = 48 * 60 * 60 * 1000

// --- Messages: unit/patient/acknowledgment coordination chat ---

export function MessagesScreen() {
  const {
    activeUnitId, patients, timeline, isLoadingTimeline,
    error, success, dismissError, dismissSuccess,
    loadTimeline, saveCoordinationEvent,
  } = useClinicalStore()
  const [scope, setScope] = useState<'UNIT' | 'PATIENT' | 'ACKNOWLEDGMENT'>('UNIT')
  const [patientId, setPatientId] = useState('')
  const [text, setText] = useState('')

  useEffect(() => {
    if (activeUnitId) loadTimeline(activeUnitId)
  }, [activeUnitId, loadTimeline])

  const filtered = useMemo(() => {
    return timeline.filter((e) => {
      if (scope === 'UNIT') return e.patientId == null && e.kind === 'UNIT_CHAT'
      if (scope === 'PATIENT') return e.kind === 'PATIENT_CHAT'
      return e.kind === 'ACKNOWLEDGMENT'
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [timeline, scope])

  const patientCode = (id: string | null) =>
    id ? patients.find((p) => p.id === id)?.code ?? 'Patient' : 'Unit'

  const send = async () => {
    if (!activeUnitId || !text.trim()) return
    const kind = scope === 'UNIT' ? 'UNIT_CHAT' : scope === 'PATIENT' ? 'PATIENT_CHAT' : 'ACKNOWLEDGMENT'
    await saveCoordinationEvent({
      unitId: activeUnitId,
      patientId: scope === 'PATIENT' ? patientId || null : null,
      kind,
      body: text.trim(),
    })
    setText('')
  }

  return (
    <div className="p-8 max-w-3xl mx-auto flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4">
        <MessageSquare className="w-6 h-6 text-clinical-primary" />
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
      </div>
      <MessageBanners error={error} success={success} info={null} onDismissError={dismissError} onDismissSuccess={dismissSuccess} />

      <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
        {(['UNIT', 'PATIENT', 'ACKNOWLEDGMENT'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              scope === s ? 'bg-white text-clinical-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {s === 'UNIT' ? 'Unit' : s === 'PATIENT' ? 'Patient' : 'Acknowledgment'}
          </button>
        ))}
      </div>

      {scope === 'PATIENT' && (
        <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className="form-input mb-4">
          <option value="">Select patient…</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.initials ?? '—'}</option>)}
        </select>
      )}

      <div className="flex-1 overflow-auto space-y-2 mb-4 min-h-40">
        {isLoadingTimeline ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 pt-8 text-center">No {scope.toLowerCase()} messages yet.</p>
        ) : (
          filtered.map((m) => (
            <div key={m.id} className="bg-clinical-surface rounded-xl border border-clinical-border p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-clinical-primary">{patientCode(m.patientId)}</span>
                <span className="text-[11px] text-gray-400">{new Date(m.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{m.body}</p>
            </div>
          ))
        )}
      </div>

      <div className="flex items-end gap-2 border-t border-clinical-border pt-3">
        <div className="flex-1"><DictationField rows={2} value={text} onChange={setText} placeholder="Message" /></div>
        <button
          onClick={send}
          disabled={!text.trim() || (scope === 'PATIENT' && !patientId)}
          className="p-2.5 rounded-lg bg-clinical-primary text-white disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// --- Alerts & Handover ---

export function AlertsScreen() {
  const {
    activeUnitId, timeline, isLoadingTimeline,
    error, success, dismissError, dismissSuccess,
    loadTimeline, saveCoordinationEvent,
  } = useClinicalStore()
  const [kind, setKind] = useState<'ALERT' | 'HANDOVER'>('ALERT')
  const [text, setText] = useState('')

  useEffect(() => {
    if (activeUnitId) loadTimeline(activeUnitId)
  }, [activeUnitId, loadTimeline])

  const entries = useMemo(
    () => timeline
      .filter((e) => e.kind === kind)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [timeline, kind],
  )

  const send = async () => {
    if (!activeUnitId || !text.trim()) return
    await saveCoordinationEvent({ unitId: activeUnitId, patientId: null, kind, body: text.trim() })
    setText('')
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <AlertCircle className="w-6 h-6 text-clinical-primary" />
        <h1 className="text-2xl font-bold text-gray-900">Alerts & Handover</h1>
      </div>
      <MessageBanners error={error} success={success} info={null} onDismissError={dismissError} onDismissSuccess={dismissSuccess} />

      <div className="bg-clinical-surface rounded-xl border border-clinical-border p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">New Alert or Handover</h2>
        <div className="flex bg-gray-100 rounded-lg p-1 mb-3">
          {(['ALERT', 'HANDOVER'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                kind === k ? 'bg-white text-clinical-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {k === 'ALERT' ? 'Alert' : 'Handover'}
            </button>
          ))}
        </div>
        <DictationField rows={3} value={text} onChange={setText} placeholder="Entry" />
        <button
          onClick={send}
          disabled={!text.trim()}
          className="mt-3 px-5 py-2 bg-clinical-primary text-white text-sm font-medium rounded-lg hover:bg-clinical-primary/90 disabled:opacity-50"
        >
          Save
        </button>
      </div>

      <div className="space-y-2">
        {isLoadingTimeline ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No {kind === 'ALERT' ? 'alerts' : 'handovers'} yet.</p>
        ) : (
          entries.map((e) => (
            <div key={e.id} className={`rounded-xl border p-4 ${kind === 'ALERT' ? 'border-clinical-warning/40 bg-clinical-warning/5' : 'border-clinical-border bg-clinical-surface'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-semibold ${kind === 'ALERT' ? 'text-clinical-warning' : 'text-clinical-primary'}`}>{kind}</span>
                <span className="text-[11px] text-gray-400">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{e.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// --- Unit Analytics ---

function MetricTile({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-clinical-surface rounded-xl border border-clinical-border p-4 flex-1">
      <p className="text-xs text-gray-500 mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

export function AnalyticsScreen() {
  const { activeUnitId, units, patients, records, loadPatients, loadRecords } = useClinicalStore()
  const [auditEvents, setAuditEvents] = useState<AuditEventRow[]>([])

  useEffect(() => {
    if (!activeUnitId) return
    loadPatients(activeUnitId)
    loadRecords(activeUnitId)
    fetchAuditEvents(activeUnitId).then(setAuditEvents).catch(() => setAuditEvents([]))
  }, [activeUnitId, loadPatients, loadRecords])

  const unitName = units.find((u) => u.id === activeUnitId)?.name ?? 'Unit'

  const stats = useMemo(() => {
    const active = patients.filter((p) => p.status !== 'DISCHARGED')
    const archived = patients.filter((p) => p.status === 'DISCHARGED')
    const now = Date.now()
    const latestByPatient = new Map<string, number>()
    for (const r of records) {
      const t = new Date(r.createdAt).getTime()
      if (t > (latestByPatient.get(r.patientId) ?? 0)) latestByPatient.set(r.patientId, t)
    }
    const hasDisposition = new Set(records.filter((r) => r.type === 'DISPOSITION' || r.type === 'DISCHARGE_SUMMARY').map((r) => r.patientId))
    const stale = active.filter((p) => {
      if (hasDisposition.has(p.id)) return false
      const latest = latestByPatient.get(p.id)
      return latest != null && now - latest > STALE_MS
    })
    const signed = active.filter((p) => {
      const updates = records.filter((r) => r.patientId === p.id && r.type === 'DAILY_UPDATE')
      const latest = updates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      return latest?.state === 'SIGNED'
    })
    const sexBreakdown = new Map<string, number>()
    for (const p of active) {
      const sex = p.sex ? p.sex[0].toUpperCase() + p.sex.slice(1).toLowerCase() : 'Unknown'
      sexBreakdown.set(sex, (sexBreakdown.get(sex) ?? 0) + 1)
    }
    const ageBuckets = new Map<string, number>([['0-17', 0], ['18-39', 0], ['40-64', 0], ['65-79', 0], ['80+', 0]])
    for (const p of active) {
      const age = parseInt(p.ageYears ?? '', 10)
      const bucket = Number.isNaN(age) ? null : age <= 17 ? '0-17' : age <= 39 ? '18-39' : age <= 64 ? '40-64' : age <= 79 ? '65-79' : '80+'
      if (bucket) ageBuckets.set(bucket, (ageBuckets.get(bucket) ?? 0) + 1)
    }
    return {
      totalActive: active.length,
      totalStale: stale.length,
      totalArchived: archived.length,
      signed: signed.length,
      unsigned: active.length - signed.length,
      dispositions: hasDisposition.size,
      sexBreakdown: [...sexBreakdown.entries()],
      ageBuckets: [...ageBuckets.entries()],
    }
  }, [patients, records])

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <BarChart3 className="w-6 h-6 text-clinical-primary" />
        <h1 className="text-2xl font-bold text-gray-900">Unit Analytics</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">{unitName}</p>

      <h2 className="text-sm font-semibold text-gray-700 mb-2">Patient Overview</h2>
      <div className="flex gap-2 mb-5">
        <MetricTile title="Active" value={String(stats.totalActive)} />
        <MetricTile title="Stale (48h+)" value={String(stats.totalStale)} />
        <MetricTile title="Archived" value={String(stats.totalArchived)} />
      </div>

      <h2 className="text-sm font-semibold text-gray-700 mb-2">Signing Status</h2>
      <div className="flex gap-2 mb-5">
        <MetricTile title="Signed" value={String(stats.signed)} />
        <MetricTile title="Unsigned" value={String(stats.unsigned)} />
        <MetricTile title="Dispositions" value={String(stats.dispositions)} />
      </div>

      {stats.sexBreakdown.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Sex Breakdown</h2>
          <div className="bg-clinical-surface rounded-xl border border-clinical-border p-4 mb-5 space-y-1">
            {stats.sexBreakdown.map(([sex, count]) => (
              <div key={sex} className="flex justify-between text-sm">
                <span className="text-gray-600">{sex}</span>
                <span className="font-medium text-gray-900">{count} ({stats.totalActive ? Math.round(count * 100 / stats.totalActive) : 0}%)</span>
              </div>
            ))}
          </div>
        </>
      )}

      {stats.ageBuckets.some(([, c]) => c > 0) && (
        <>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Age Distribution</h2>
          <div className="bg-clinical-surface rounded-xl border border-clinical-border p-4 mb-5 space-y-1">
            {stats.ageBuckets.map(([bucket, count]) => (
              <div key={bucket} className="flex justify-between text-sm">
                <span className="text-gray-600">{bucket}</span>
                <span className="font-medium text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {auditEvents.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Recent Audit Events</h2>
          <div className="bg-clinical-surface rounded-xl border border-clinical-border p-4 space-y-1">
            {auditEvents.slice(0, 10).map((e) => (
              <div key={e.id} className="flex justify-between text-sm">
                <span className="text-gray-600">{e.eventType}</span>
                <span className="text-xs text-gray-400">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
        <CheckCircle className="w-3.5 h-3.5" /> Analytics computed from decrypted in-app data only.
      </div>
    </div>
  )
}
