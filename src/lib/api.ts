import { supabase } from './supabase'
import {
  ensureUnitKey,
  ensurePatientKey,
  encryptPatientField,
  encryptPatientDemographic,
  encryptUnitField,
  hospitalNumberLookupHash,
  decryptPatientField,
  decryptPatientDemographic,
  decryptUnitField,
} from './keyManager'
import type {
  ClinicalUnitSummary,
  ClinicalMemberSummary,
  ClinicalInvitationSummary,
  PatientRow,
  ClinicalRecordRow,
  ClinicalResultRow,
  CoordinationEventRow,
  AuditEventRow,
} from '@/types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return session.access_token
}

async function restRequest<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  options: {
    query?: Record<string, string>
    body?: unknown
    prefer?: string
  } = {},
): Promise<T> {
  const accessToken = await getAccessToken()
  const url = new URL(`${SUPABASE_URL}/${path}`)
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      url.searchParams.set(key, value)
    }
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Supabase request failed with status ${res.status}: ${text}`)
  }

  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

async function rpc<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const accessToken = await getAccessToken()
  const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/${name}`)

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Supabase RPC failed with status ${res.status}: ${text}`)
  }

  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

// --- Unit Selection ---

export async function fetchUnitMemberships(): Promise<ClinicalUnitSummary[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const rows = await restRequest<Array<{
    unit_id: string
    role: string
    status: string
    medical_units: { name: string } | null
  }>>('rest/v1/unit_memberships', 'GET', {
    query: {
      select: 'unit_id,role,status,medical_units(name)',
      user_id: `eq.${user.id}`,
      status: 'eq.ACTIVE',
    },
  })

  return rows.map((row) => ({
    id: row.unit_id,
    name: row.medical_units?.name ?? 'Clinical Unit',
    role: row.role,
    status: row.status,
  }))
}

export async function createUnit(name: string): Promise<string> {
  const result = await rpc<string>('create_unit_with_owner', { p_name: name })
  return typeof result === 'string' ? result : (result as unknown as string)
}

export async function fetchPendingInvitations(): Promise<ClinicalInvitationSummary[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return []

  const email = user.email.toLowerCase().trim()
  const rows = await restRequest<Array<{
    id: string
    unit_id: string
    invited_email: string
    invited_role: string
    status: string
    created_at: string
    medical_units: { name: string } | null
  }>>('rest/v1/unit_invitations', 'GET', {
    query: {
      select: 'id,unit_id,invited_email,invited_role,status,created_at,medical_units(name)',
      order: 'created_at.desc',
    },
  })

  return rows
    .filter((r) => r.invited_email.toLowerCase().trim() === email && r.status.toUpperCase() === 'PENDING')
    .map((r) => ({
      id: r.id,
      unitId: r.unit_id,
      unitName: r.medical_units?.name ?? 'Clinical Unit',
      email: r.invited_email,
      role: r.invited_role,
      status: r.status,
      createdAt: r.created_at,
    }))
}

export async function acceptInvitation(invitationId: string): Promise<string> {
  const result = await rpc<string>('accept_unit_invitation', { p_invitation_id: invitationId })
  return typeof result === 'string' ? result : (result as unknown as string)
}

export async function sendInvitation(unitId: string, email: string, role: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  await restRequest('rest/v1/unit_invitations', 'POST', {
    body: [{
      unit_id: unitId,
      invited_email: email.toLowerCase().trim(),
      invited_role: role.toUpperCase().trim(),
      invited_by: user.id,
      status: 'PENDING',
    }],
    prefer: 'return=minimal',
    query: { on_conflict: 'unit_id,invited_email' },
  })
}

// --- Members ---

export async function fetchUnitMembers(unitId: string): Promise<ClinicalMemberSummary[]> {
  const rows = await restRequest<Array<{
    unit_id: string
    user_id: string
    role: string
    status: string
    updated_at: string
    display_name: string
  }>>('rest/v1/unit_member_details', 'GET', {
    query: {
      select: 'unit_id,user_id,role,status,updated_at,display_name',
      unit_id: `eq.${unitId}`,
    },
  })

  return rows.map((r) => ({
    userId: r.user_id,
    unitId: r.unit_id,
    role: r.role,
    status: r.status,
    displayName: r.display_name,
    updatedAt: r.updated_at,
  }))
}

export async function removeMember(unitId: string, userId: string): Promise<void> {
  await rpc('remove_unit_member', { p_unit_id: unitId, p_user_id: userId })
}

// --- Patients ---

export async function fetchPatients(unitId: string): Promise<PatientRow[]> {
  const rows = await restRequest<Array<{
    id: string
    unit_id: string
    code: string
    encrypted_initials: string | null
    encrypted_hospital_number: string | null
    encrypted_age_years: string | null
    encrypted_sex: string | null
    status: string
    updated_at: string
  }>>('rest/v1/patients', 'GET', {
    query: {
      select: 'id,unit_id,code,encrypted_initials,encrypted_hospital_number,encrypted_age_years,encrypted_sex,status,updated_at',
      unit_id: `eq.${unitId}`,
      status: 'neq.ARCHIVED',
      order: 'updated_at.desc',
      limit: '100',
    },
  })

  const decrypted = await Promise.all(rows.map(async (r) => ({
    id: r.id,
    unitId: r.unit_id,
    code: r.code,
    initials: r.encrypted_initials ? await decryptPatientDemographic(r.encrypted_initials, r.unit_id, r.id, 'initials') : null,
    hospitalNumber: r.encrypted_hospital_number ? await decryptPatientDemographic(r.encrypted_hospital_number, r.unit_id, r.id, 'hospital_number') : null,
    ageYears: r.encrypted_age_years ? await decryptPatientDemographic(r.encrypted_age_years, r.unit_id, r.id, 'age_years') : null,
    sex: r.encrypted_sex ? await decryptPatientDemographic(r.encrypted_sex, r.unit_id, r.id, 'sex') : null,
    status: r.status,
    updatedAt: r.updated_at,
  })))

  return decrypted
}

// --- Clinical Records ---

export async function fetchClinicalRecords(unitId: string): Promise<ClinicalRecordRow[]> {
  const rows = await restRequest<Array<{
    id: string
    unit_id: string
    patient_id: string
    type: string
    summary: string | null
    detail: string | null
    state: string | null
    updated_at: string
    created_at: string
  }>>('rest/v1/clinical_records', 'GET', {
    query: {
      select: 'id,unit_id,patient_id,type,summary,detail,state,updated_at,created_at',
      unit_id: `eq.${unitId}`,
      state: 'neq.ARCHIVED',
      order: 'updated_at.desc',
      limit: '100',
    },
  })

  const decrypted = await Promise.all(rows.map(async (r) => ({
    id: r.id,
    unitId: r.unit_id,
    patientId: r.patient_id,
    type: r.type as ClinicalRecordRow['type'],
    summary: r.summary ? await decryptPatientField(r.summary, r.unit_id, r.patient_id, r.id, 'clinical_records', 'summary') : null,
    detail: r.detail ? await decryptPatientField(r.detail, r.unit_id, r.patient_id, r.id, 'clinical_records', 'detail') : null,
    state: r.state,
    updatedAt: r.updated_at,
    createdAt: r.created_at,
  })))

  return decrypted
}

// --- Clinical Results ---

export async function fetchClinicalResults(unitId: string): Promise<ClinicalResultRow[]> {
  const rows = await restRequest<Array<{
    id: string
    unit_id: string
    patient_id: string
    kind: string
    title: string
    value: string | null
    created_at: string
  }>>('rest/v1/clinical_results', 'GET', {
    query: {
      select: 'id,unit_id,patient_id,kind,title,value,created_at',
      unit_id: `eq.${unitId}`,
      order: 'created_at.desc',
      limit: '100',
    },
  })

  const decrypted = await Promise.all(rows.map(async (r) => ({
    id: r.id,
    unitId: r.unit_id,
    patientId: r.patient_id,
    kind: r.kind,
    title: await decryptPatientField(r.title, r.unit_id, r.patient_id, r.id, 'clinical_results', 'title'),
    value: r.value ? await decryptPatientField(r.value, r.unit_id, r.patient_id, r.id, 'clinical_results', 'value') : null,
    createdAt: r.created_at,
  })))

  return decrypted
}

// --- Coordination Events (Timeline) ---

export async function fetchCoordinationEvents(unitId: string): Promise<CoordinationEventRow[]> {
  const rows = await restRequest<Array<{
    id: string
    unit_id: string
    patient_id: string | null
    kind: string
    body: string
    created_by: string | null
    created_at: string
  }>>('rest/v1/coordination_events', 'GET', {
    query: {
      select: 'id,unit_id,patient_id,kind,body,created_by,created_at',
      unit_id: `eq.${unitId}`,
      order: 'created_at.desc',
      limit: '100',
    },
  })

  const decrypted = await Promise.all(rows.map(async (r) => ({
    id: r.id,
    unitId: r.unit_id,
    patientId: r.patient_id,
    kind: r.kind,
    body: r.patient_id
      ? await decryptPatientField(r.body, r.unit_id, r.patient_id, r.id, 'coordination_events', 'body')
      : await decryptUnitField(r.body, r.unit_id, r.id, 'coordination_events', 'body'),
    createdBy: r.created_by,
    createdAt: r.created_at,
  })))

  return decrypted
}

// --- Audit Events ---

export async function fetchAuditEvents(unitId: string): Promise<AuditEventRow[]> {
  const rows = await restRequest<Array<{
    id: string
    unit_id: string
    aggregate_id: string
    actor_id: string | null
    event_type: string
    payload: string
    created_at: string
  }>>('rest/v1/audit_events', 'GET', {
    query: {
      select: 'id,unit_id,aggregate_id,actor_id,event_type,payload,created_at',
      unit_id: `eq.${unitId}`,
      order: 'created_at.desc',
      limit: '100',
    },
  })

  return rows.map((r) => ({
    id: r.id,
    unitId: r.unit_id,
    aggregateId: r.aggregate_id,
    actorId: r.actor_id,
    eventType: r.event_type,
    payload: r.payload,
    createdAt: r.created_at,
  }))
}

// --- Write: Helper ---

function uuid(): string {
  return crypto.randomUUID()
}

function clinicalDateIso(): string {
  return new Date().toISOString().slice(0, 10)
}

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

async function upsertRow(table: string, row: Record<string, unknown>, conflictColumn = 'id'): Promise<void> {
  await restRequest(`rest/v1/${table}`, 'POST', {
    body: [row],
    prefer: 'resolution=merge-duplicates,return=minimal',
    query: { on_conflict: conflictColumn },
  })
}

// --- Write: Admit Patient ---

export async function admitPatient(params: {
  unitId: string
  code: string
  initials: string
  hospitalNumber: string
  ageYears: string
  sex: string
  diagnosis: string
}): Promise<string> {
  const patientId = uuid()
  const userId = await getUserId()

  // Ensure unit key exists for encrypting demographics
  const unitKeyInfo = await ensureUnitKey(params.unitId, userId)

  // Encrypt patient demographics with unit key
  const encInitials = await encryptPatientDemographic(
    params.initials.toUpperCase(), params.unitId, patientId, 'initials',
    unitKeyInfo.key, unitKeyInfo.keyId,
  )
  const encHospitalNumber = await encryptPatientDemographic(
    params.hospitalNumber, params.unitId, patientId, 'hospital_number',
    unitKeyInfo.key, unitKeyInfo.keyId,
  )
  const encAgeYears = await encryptPatientDemographic(
    params.ageYears, params.unitId, patientId, 'age_years',
    unitKeyInfo.key, unitKeyInfo.keyId,
  )
  const encSex = await encryptPatientDemographic(
    params.sex, params.unitId, patientId, 'sex',
    unitKeyInfo.key, unitKeyInfo.keyId,
  )
  const lookupHash = await hospitalNumberLookupHash(
    unitKeyInfo.key, params.unitId, params.hospitalNumber,
  )

  await upsertRow('patients', {
    id: patientId,
    unit_id: params.unitId,
    code: params.code,
    encrypted_initials: encInitials,
    encrypted_hospital_number: encHospitalNumber,
    encrypted_age_years: encAgeYears,
    encrypted_sex: encSex,
    hospital_number_lookup_hash: lookupHash,
    status: 'ACTIVE',
    created_by: userId,
  })

  // Ensure patient key exists for encrypting clinical records
  const patientKeyInfo = await ensurePatientKey(params.unitId, patientId, userId)

  const baselineId = uuid()
  const encBaselineSummary = await encryptPatientField(
    params.diagnosis, params.unitId, patientId, baselineId,
    'clinical_records', 'summary', patientKeyInfo.key, patientKeyInfo.keyId,
  )
  const encBaselineDetail = await encryptPatientField(
    `Admission: ${params.initials.toUpperCase()} · ${params.ageYears}y · ${params.sex} · Hosp No: ${params.hospitalNumber}`,
    params.unitId, patientId, baselineId,
    'clinical_records', 'detail', patientKeyInfo.key, patientKeyInfo.keyId,
  )
  await upsertRow('clinical_records', {
    id: baselineId,
    unit_id: params.unitId,
    patient_id: patientId,
    type: 'ADMISSION_BASELINE',
    summary: encBaselineSummary,
    detail: encBaselineDetail,
    state: 'SIGNED',
    clinical_date: clinicalDateIso(),
    signed_by: userId,
    signed_at: new Date().toISOString(),
    created_by: userId,
  })

  const diagnosisId = uuid()
  const encDxSummary = await encryptPatientField(
    params.diagnosis, params.unitId, patientId, diagnosisId,
    'clinical_records', 'summary', patientKeyInfo.key, patientKeyInfo.keyId,
  )
  const encDxDetail = await encryptPatientField(
    'Initial diagnosis on admission', params.unitId, patientId, diagnosisId,
    'clinical_records', 'detail', patientKeyInfo.key, patientKeyInfo.keyId,
  )
  await upsertRow('clinical_records', {
    id: diagnosisId,
    unit_id: params.unitId,
    patient_id: patientId,
    type: 'PROVISIONAL_DIAGNOSIS',
    summary: encDxSummary,
    detail: encDxDetail,
    state: 'ACTIVE',
    clinical_date: clinicalDateIso(),
    created_by: userId,
  })

  return patientId
}

// --- Write: Clinical Records ---

export async function saveProblem(params: {
  unitId: string
  patientId: string
  type: string
  summary: string
  detail: string
  state: string
  recordId?: string
}): Promise<string> {
  const id = params.recordId ?? uuid()
  const userId = await getUserId()
  const patientKeyInfo = await ensurePatientKey(params.unitId, params.patientId, userId)
  const encSummary = await encryptPatientField(
    params.summary, params.unitId, params.patientId, id,
    'clinical_records', 'summary', patientKeyInfo.key, patientKeyInfo.keyId,
  )
  const encDetail = await encryptPatientField(
    params.detail, params.unitId, params.patientId, id,
    'clinical_records', 'detail', patientKeyInfo.key, patientKeyInfo.keyId,
  )
  await upsertRow('clinical_records', {
    id,
    unit_id: params.unitId,
    patient_id: params.patientId,
    type: params.type,
    summary: encSummary,
    detail: encDetail,
    state: params.state,
    clinical_date: clinicalDateIso(),
    created_by: userId,
  })
  return id
}

export async function saveAllergy(params: {
  unitId: string
  patientId: string
  allergen: string
  reaction: string
  severity: string
  state: string
  recordId?: string
}): Promise<string> {
  const id = params.recordId ?? uuid()
  const userId = await getUserId()
  const patientKeyInfo = await ensurePatientKey(params.unitId, params.patientId, userId)
  const encSummary = await encryptPatientField(
    params.allergen, params.unitId, params.patientId, id,
    'clinical_records', 'summary', patientKeyInfo.key, patientKeyInfo.keyId,
  )
  const encDetail = await encryptPatientField(
    `${params.reaction} — ${params.severity}`, params.unitId, params.patientId, id,
    'clinical_records', 'detail', patientKeyInfo.key, patientKeyInfo.keyId,
  )
  await upsertRow('clinical_records', {
    id,
    unit_id: params.unitId,
    patient_id: params.patientId,
    type: 'ALLERGY',
    summary: encSummary,
    detail: encDetail,
    state: params.state,
    clinical_date: clinicalDateIso(),
    created_by: userId,
  })
  return id
}

export async function saveMedication(params: {
  unitId: string
  patientId: string
  drug: string
  dose: string
  route: string
  frequency: string
  duration: string
  notes: string
  state: string
  recordId?: string
}): Promise<string> {
  const id = params.recordId ?? uuid()
  const userId = await getUserId()
  const parts = [params.dose, params.route, params.frequency, params.duration, params.notes].filter(Boolean)
  const patientKeyInfo = await ensurePatientKey(params.unitId, params.patientId, userId)
  const encSummary = await encryptPatientField(
    params.drug, params.unitId, params.patientId, id,
    'clinical_records', 'summary', patientKeyInfo.key, patientKeyInfo.keyId,
  )
  const encDetail = await encryptPatientField(
    parts.join(' · '), params.unitId, params.patientId, id,
    'clinical_records', 'detail', patientKeyInfo.key, patientKeyInfo.keyId,
  )
  await upsertRow('clinical_records', {
    id,
    unit_id: params.unitId,
    patient_id: params.patientId,
    type: 'MEDICATION',
    summary: encSummary,
    detail: encDetail,
    state: params.state,
    clinical_date: clinicalDateIso(),
    created_by: userId,
  })
  return id
}

export async function saveOrder(params: {
  unitId: string
  patientId: string
  orderType: string
  priority: string
  indication: string
  details: string
  state: string
  recordId?: string
}): Promise<string> {
  const id = params.recordId ?? uuid()
  const userId = await getUserId()
  const patientKeyInfo = await ensurePatientKey(params.unitId, params.patientId, userId)
  const encSummary = await encryptPatientField(
    `${params.orderType} · ${params.priority}`, params.unitId, params.patientId, id,
    'clinical_records', 'summary', patientKeyInfo.key, patientKeyInfo.keyId,
  )
  const encDetail = await encryptPatientField(
    `${params.indication} | ${params.details}`, params.unitId, params.patientId, id,
    'clinical_records', 'detail', patientKeyInfo.key, patientKeyInfo.keyId,
  )
  await upsertRow('clinical_records', {
    id,
    unit_id: params.unitId,
    patient_id: params.patientId,
    type: 'DAILY_ORDER',
    summary: encSummary,
    detail: encDetail,
    state: params.state,
    clinical_date: clinicalDateIso(),
    created_by: userId,
  })
  return id
}

export async function saveDailyUpdate(params: {
  unitId: string
  patientId: string
  subjective: string
  objective: string
  assessment: string
  plan: string
  state: string
  recordId?: string
}): Promise<string> {
  const id = params.recordId ?? uuid()
  const userId = await getUserId()
  const summary = params.assessment || 'Daily Progress Note'
  const detail = `S: ${params.subjective} | O: ${params.objective} | A: ${params.assessment} | P: ${params.plan}`
  const patientKeyInfo = await ensurePatientKey(params.unitId, params.patientId, userId)
  const encSummary = await encryptPatientField(
    summary, params.unitId, params.patientId, id,
    'clinical_records', 'summary', patientKeyInfo.key, patientKeyInfo.keyId,
  )
  const encDetail = await encryptPatientField(
    detail, params.unitId, params.patientId, id,
    'clinical_records', 'detail', patientKeyInfo.key, patientKeyInfo.keyId,
  )
  await upsertRow('clinical_records', {
    id,
    unit_id: params.unitId,
    patient_id: params.patientId,
    type: 'DAILY_UPDATE',
    summary: encSummary,
    detail: encDetail,
    state: params.state,
    clinical_date: clinicalDateIso(),
    created_by: userId,
  })
  return id
}

export async function updateRecordState(params: {
  unitId: string
  recordId: string
  state: string
}): Promise<void> {
  await restRequest(`rest/v1/clinical_records`, 'PATCH', {
    query: {
      id: `eq.${params.recordId}`,
    },
    body: {
      state: params.state,
      updated_at: new Date().toISOString(),
    },
    prefer: 'return=minimal',
  })
}

export async function dischargePatient(_unitId: string, patientId: string): Promise<void> {
  await restRequest(`rest/v1/patients`, 'PATCH', {
    query: {
      id: `eq.${patientId}`,
    },
    body: {
      status: 'ARCHIVED',
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    prefer: 'return=minimal',
  })
}

// --- Write: Clinical Results ---

export async function saveResult(params: {
  unitId: string
  patientId: string
  kind: string
  title: string
  value: string
}): Promise<string> {
  const id = uuid()
  const userId = await getUserId()
  const patientKeyInfo = await ensurePatientKey(params.unitId, params.patientId, userId)
  const encTitle = await encryptPatientField(
    params.title, params.unitId, params.patientId, id,
    'clinical_results', 'title', patientKeyInfo.key, patientKeyInfo.keyId,
  )
  const encValue = await encryptPatientField(
    params.value, params.unitId, params.patientId, id,
    'clinical_results', 'value', patientKeyInfo.key, patientKeyInfo.keyId,
  )
  await upsertRow('clinical_results', {
    id,
    unit_id: params.unitId,
    patient_id: params.patientId,
    kind: params.kind,
    title: encTitle,
    value: encValue,
    created_by: userId,
  })
  return id
}

// --- Write: Coordination Events ---

export async function saveCoordinationEvent(params: {
  unitId: string
  patientId: string | null
  kind: string
  body: string
}): Promise<string> {
  const id = uuid()
  const userId = await getUserId()

  let encBody: string
  if (params.patientId) {
    const patientKeyInfo = await ensurePatientKey(params.unitId, params.patientId, userId)
    encBody = await encryptPatientField(
      params.body, params.unitId, params.patientId, id,
      'coordination_events', 'body', patientKeyInfo.key, patientKeyInfo.keyId,
    )
  } else {
    const unitKeyInfo = await ensureUnitKey(params.unitId, userId)
    encBody = await encryptUnitField(
      params.body, params.unitId, id,
      'coordination_events', 'body', unitKeyInfo.key, unitKeyInfo.keyId,
    )
  }

  await upsertRow('coordination_events', {
    id,
    unit_id: params.unitId,
    patient_id: params.patientId,
    kind: params.kind,
    body: encBody,
    created_by: userId,
  })
  return id
}
