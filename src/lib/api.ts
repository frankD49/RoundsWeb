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
  AppointmentRow,
  EncounterRow,
  CarePlanRow,
  PrescriptionRow,
  InvestigationOrderRow,
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

// --- Outpatient: Appointments ---

export async function fetchAppointments(unitId: string): Promise<AppointmentRow[]> {
  const rows = await restRequest<Array<{
    id: string
    unit_id: string
    patient_id: string
    clinician_id: string
    kind: string
    status: string
    encrypted_reason: string | null
    start_at: string
    end_at: string
    encrypted_notes: string | null
    check_in_at: string | null
    check_out_at: string | null
    updated_at: string
  }>>('rest/v1/appointments', 'GET', {
    query: {
      select: 'id,unit_id,patient_id,clinician_id,kind,status,encrypted_reason,start_at,end_at,encrypted_notes,check_in_at,check_out_at,updated_at',
      unit_id: `eq.${unitId}`,
      order: 'start_at.desc',
      limit: '100',
    },
  })

  return Promise.all(rows.map(async (r) => ({
    id: r.id,
    unitId: r.unit_id,
    patientId: r.patient_id,
    clinicianId: r.clinician_id,
    kind: r.kind as AppointmentRow['kind'],
    status: r.status as AppointmentRow['status'],
    reason: r.encrypted_reason ? await decryptPatientField(r.encrypted_reason, r.unit_id, r.patient_id, r.id, 'appointments', 'encrypted_reason') : null,
    startAt: r.start_at,
    endAt: r.end_at,
    notes: r.encrypted_notes ? await decryptPatientField(r.encrypted_notes, r.unit_id, r.patient_id, r.id, 'appointments', 'encrypted_notes') : null,
    checkInAt: r.check_in_at,
    checkOutAt: r.check_out_at,
    updatedAt: r.updated_at,
  })))
}

export async function createAppointment(params: {
  unitId: string
  patientId: string
  clinicianId: string
  kind: string
  reason: string
  startAt: string
  endAt: string
  notes: string
}): Promise<string> {
  const id = uuid()
  const userId = await getUserId()
  const patientKeyInfo = await ensurePatientKey(params.unitId, params.patientId, userId)
  const encReason = await encryptPatientField(params.reason, params.unitId, params.patientId, id, 'appointments', 'encrypted_reason', patientKeyInfo.key, patientKeyInfo.keyId)
  const encNotes = params.notes ? await encryptPatientField(params.notes, params.unitId, params.patientId, id, 'appointments', 'encrypted_notes', patientKeyInfo.key, patientKeyInfo.keyId) : null

  await upsertRow('appointments', {
    id,
    unit_id: params.unitId,
    patient_id: params.patientId,
    clinician_id: params.clinicianId,
    kind: params.kind,
    status: 'SCHEDULED',
    encrypted_reason: encReason,
    start_at: params.startAt,
    end_at: params.endAt,
    encrypted_notes: encNotes,
    created_by: userId,
  })
  return id
}

export async function cancelAppointment(_unitId: string, appointmentId: string): Promise<void> {
  await restRequest('rest/v1/appointments', 'PATCH', {
    query: { id: `eq.${appointmentId}` },
    body: { status: 'CANCELLED', updated_at: new Date().toISOString() },
    prefer: 'return=minimal',
  })
}

export async function checkInAppointment(_unitId: string, appointmentId: string): Promise<void> {
  await restRequest('rest/v1/appointments', 'PATCH', {
    query: { id: `eq.${appointmentId}` },
    body: { status: 'CHECKED_IN', check_in_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    prefer: 'return=minimal',
  })
}

export async function checkOutAppointment(_unitId: string, appointmentId: string): Promise<void> {
  await restRequest('rest/v1/appointments', 'PATCH', {
    query: { id: `eq.${appointmentId}` },
    body: { status: 'COMPLETED', check_out_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    prefer: 'return=minimal',
  })
}

// --- Outpatient: Encounters ---

export async function fetchEncounters(unitId: string): Promise<EncounterRow[]> {
  const rows = await restRequest<Array<{
    id: string
    unit_id: string
    patient_id: string
    appointment_id: string | null
    clinician_id: string
    encounter_date: string
    status: string
    encrypted_subjective: string | null
    encrypted_objective: string | null
    encrypted_assessment: string | null
    encrypted_plan: string | null
    encrypted_diagnosis_codes: string | null
    encrypted_summary: string | null
    signed_by: string | null
    signed_at: string | null
    updated_at: string
  }>>('rest/v1/encounters', 'GET', {
    query: {
      select: 'id,unit_id,patient_id,appointment_id,clinician_id,encounter_date,status,encrypted_subjective,encrypted_objective,encrypted_assessment,encrypted_plan,encrypted_diagnosis_codes,encrypted_summary,signed_by,signed_at,updated_at',
      unit_id: `eq.${unitId}`,
      order: 'encounter_date.desc',
      limit: '100',
    },
  })

  return Promise.all(rows.map(async (r) => ({
    id: r.id,
    unitId: r.unit_id,
    patientId: r.patient_id,
    appointmentId: r.appointment_id,
    clinicianId: r.clinician_id,
    encounterDate: r.encounter_date,
    status: r.status as EncounterRow['status'],
    subjective: r.encrypted_subjective ? await decryptPatientField(r.encrypted_subjective, r.unit_id, r.patient_id, r.id, 'encounters', 'encrypted_subjective') : null,
    objective: r.encrypted_objective ? await decryptPatientField(r.encrypted_objective, r.unit_id, r.patient_id, r.id, 'encounters', 'encrypted_objective') : null,
    assessment: r.encrypted_assessment ? await decryptPatientField(r.encrypted_assessment, r.unit_id, r.patient_id, r.id, 'encounters', 'encrypted_assessment') : null,
    plan: r.encrypted_plan ? await decryptPatientField(r.encrypted_plan, r.unit_id, r.patient_id, r.id, 'encounters', 'encrypted_plan') : null,
    diagnosisCodes: r.encrypted_diagnosis_codes ? await decryptPatientField(r.encrypted_diagnosis_codes, r.unit_id, r.patient_id, r.id, 'encounters', 'encrypted_diagnosis_codes') : null,
    summary: r.encrypted_summary ? await decryptPatientField(r.encrypted_summary, r.unit_id, r.patient_id, r.id, 'encounters', 'encrypted_summary') : null,
    signedBy: r.signed_by,
    signedAt: r.signed_at,
    updatedAt: r.updated_at,
  })))
}

export async function createEncounter(params: {
  unitId: string
  patientId: string
  clinicianId: string
  appointmentId?: string
  subjective: string
  objective: string
  assessment: string
  plan: string
  diagnosisCodes?: string
}): Promise<string> {
  const id = uuid()
  const userId = await getUserId()
  const patientKeyInfo = await ensurePatientKey(params.unitId, params.patientId, userId)
  const enc = async (field: string, value: string) =>
    encryptPatientField(value, params.unitId, params.patientId, id, 'encounters', field, patientKeyInfo.key, patientKeyInfo.keyId)

  const summary = params.assessment || 'Encounter'
  await upsertRow('encounters', {
    id,
    unit_id: params.unitId,
    patient_id: params.patientId,
    appointment_id: params.appointmentId ?? null,
    clinician_id: params.clinicianId,
    encounter_date: clinicalDateIso(),
    status: 'ACTIVE',
    encrypted_subjective: await enc('encrypted_subjective', params.subjective),
    encrypted_objective: await enc('encrypted_objective', params.objective),
    encrypted_assessment: await enc('encrypted_assessment', params.assessment),
    encrypted_plan: await enc('encrypted_plan', params.plan),
    encrypted_diagnosis_codes: params.diagnosisCodes ? await enc('encrypted_diagnosis_codes', params.diagnosisCodes) : null,
    encrypted_summary: await enc('encrypted_summary', summary),
    created_by: userId,
  })
  return id
}

export async function signEncounter(_unitId: string, encounterId: string): Promise<void> {
  const userId = await getUserId()
  await restRequest('rest/v1/encounters', 'PATCH', {
    query: { id: `eq.${encounterId}` },
    body: { status: 'SIGNED', signed_by: userId, signed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    prefer: 'return=minimal',
  })
}

// --- Outpatient: Care Plans ---

export async function fetchCarePlans(unitId: string): Promise<CarePlanRow[]> {
  const rows = await restRequest<Array<{
    id: string
    unit_id: string
    patient_id: string
    encrypted_title: string
    encrypted_description: string | null
    encrypted_goals: string | null
    status: string
    review_interval_days: number
    next_review_date: string | null
    started_at: string
    completed_at: string | null
    updated_at: string
  }>>('rest/v1/care_plans', 'GET', {
    query: {
      select: 'id,unit_id,patient_id,encrypted_title,encrypted_description,encrypted_goals,status,review_interval_days,next_review_date,started_at,completed_at,updated_at',
      unit_id: `eq.${unitId}`,
      order: 'updated_at.desc',
      limit: '100',
    },
  })

  return Promise.all(rows.map(async (r) => ({
    id: r.id,
    unitId: r.unit_id,
    patientId: r.patient_id,
    title: await decryptPatientField(r.encrypted_title, r.unit_id, r.patient_id, r.id, 'care_plans', 'encrypted_title'),
    description: r.encrypted_description ? await decryptPatientField(r.encrypted_description, r.unit_id, r.patient_id, r.id, 'care_plans', 'encrypted_description') : null,
    goals: r.encrypted_goals ? await decryptPatientField(r.encrypted_goals, r.unit_id, r.patient_id, r.id, 'care_plans', 'encrypted_goals') : null,
    status: r.status as CarePlanRow['status'],
    reviewIntervalDays: r.review_interval_days,
    nextReviewDate: r.next_review_date,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    updatedAt: r.updated_at,
  })))
}

export async function createCarePlan(params: {
  unitId: string
  patientId: string
  title: string
  description: string
  goals: string
  reviewIntervalDays: number
}): Promise<string> {
  const id = uuid()
  const userId = await getUserId()
  const patientKeyInfo = await ensurePatientKey(params.unitId, params.patientId, userId)
  const enc = async (field: string, value: string) =>
    encryptPatientField(value, params.unitId, params.patientId, id, 'care_plans', field, patientKeyInfo.key, patientKeyInfo.keyId)

  await upsertRow('care_plans', {
    id,
    unit_id: params.unitId,
    patient_id: params.patientId,
    encrypted_title: await enc('encrypted_title', params.title),
    encrypted_description: params.description ? await enc('encrypted_description', params.description) : null,
    encrypted_goals: params.goals ? await enc('encrypted_goals', params.goals) : null,
    status: 'ACTIVE',
    review_interval_days: params.reviewIntervalDays || 90,
    created_by: userId,
  })
  return id
}

export async function updateCarePlanStatus(_unitId: string, carePlanId: string, status: string): Promise<void> {
  const body: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'COMPLETED') body.completed_at = new Date().toISOString()
  await restRequest('rest/v1/care_plans', 'PATCH', {
    query: { id: `eq.${carePlanId}` },
    body,
    prefer: 'return=minimal',
  })
}

// --- Outpatient: Prescriptions ---

export async function fetchPrescriptions(unitId: string): Promise<PrescriptionRow[]> {
  const rows = await restRequest<Array<{
    id: string
    unit_id: string
    patient_id: string
    encounter_id: string | null
    encrypted_medication_name: string
    encrypted_dose: string
    encrypted_frequency: string
    encrypted_route: string | null
    encrypted_instructions: string | null
    status: string
    starts_on: string
    ends_on: string | null
    repeat_count: number
    repeats_used: number
    next_review_date: string | null
    updated_at: string
  }>>('rest/v1/prescriptions', 'GET', {
    query: {
      select: 'id,unit_id,patient_id,encounter_id,encrypted_medication_name,encrypted_dose,encrypted_frequency,encrypted_route,encrypted_instructions,status,starts_on,ends_on,repeat_count,repeats_used,next_review_date,updated_at',
      unit_id: `eq.${unitId}`,
      order: 'updated_at.desc',
      limit: '100',
    },
  })

  return Promise.all(rows.map(async (r) => ({
    id: r.id,
    unitId: r.unit_id,
    patientId: r.patient_id,
    encounterId: r.encounter_id,
    medicationName: await decryptPatientField(r.encrypted_medication_name, r.unit_id, r.patient_id, r.id, 'prescriptions', 'encrypted_medication_name'),
    dose: await decryptPatientField(r.encrypted_dose, r.unit_id, r.patient_id, r.id, 'prescriptions', 'encrypted_dose'),
    frequency: await decryptPatientField(r.encrypted_frequency, r.unit_id, r.patient_id, r.id, 'prescriptions', 'encrypted_frequency'),
    route: r.encrypted_route ? await decryptPatientField(r.encrypted_route, r.unit_id, r.patient_id, r.id, 'prescriptions', 'encrypted_route') : null,
    instructions: r.encrypted_instructions ? await decryptPatientField(r.encrypted_instructions, r.unit_id, r.patient_id, r.id, 'prescriptions', 'encrypted_instructions') : null,
    status: r.status as PrescriptionRow['status'],
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    repeatCount: r.repeat_count,
    repeatsUsed: r.repeats_used,
    nextReviewDate: r.next_review_date,
    updatedAt: r.updated_at,
  })))
}

export async function createPrescription(params: {
  unitId: string
  patientId: string
  encounterId?: string
  medicationName: string
  dose: string
  frequency: string
  route?: string
  instructions?: string
  startsOn?: string
  endsOn?: string
  repeatCount?: number
}): Promise<string> {
  const id = uuid()
  const userId = await getUserId()
  const patientKeyInfo = await ensurePatientKey(params.unitId, params.patientId, userId)
  const enc = async (field: string, value: string) =>
    encryptPatientField(value, params.unitId, params.patientId, id, 'prescriptions', field, patientKeyInfo.key, patientKeyInfo.keyId)

  await upsertRow('prescriptions', {
    id,
    unit_id: params.unitId,
    patient_id: params.patientId,
    encounter_id: params.encounterId ?? null,
    encrypted_medication_name: await enc('encrypted_medication_name', params.medicationName),
    encrypted_dose: await enc('encrypted_dose', params.dose),
    encrypted_frequency: await enc('encrypted_frequency', params.frequency),
    encrypted_route: params.route ? await enc('encrypted_route', params.route) : null,
    encrypted_instructions: params.instructions ? await enc('encrypted_instructions', params.instructions) : null,
    status: 'ACTIVE',
    starts_on: params.startsOn ?? clinicalDateIso(),
    ends_on: params.endsOn ?? null,
    repeat_count: params.repeatCount ?? 0,
    created_by: userId,
  })
  return id
}

export async function discontinuePrescription(_unitId: string, prescriptionId: string): Promise<void> {
  await restRequest('rest/v1/prescriptions', 'PATCH', {
    query: { id: `eq.${prescriptionId}` },
    body: { status: 'DISCONTINUED', updated_at: new Date().toISOString() },
    prefer: 'return=minimal',
  })
}

// --- Outpatient: Investigation Orders ---

export async function fetchInvestigationOrders(unitId: string): Promise<InvestigationOrderRow[]> {
  const rows = await restRequest<Array<{
    id: string
    unit_id: string
    patient_id: string
    encounter_id: string | null
    encrypted_test_name: string
    encrypted_clinical_indication: string | null
    encrypted_notes: string | null
    status: string
    ordered_at: string
    resulted_at: string | null
    acknowledged_by: string | null
    acknowledged_at: string | null
    updated_at: string
  }>>('rest/v1/investigation_orders', 'GET', {
    query: {
      select: 'id,unit_id,patient_id,encounter_id,encrypted_test_name,encrypted_clinical_indication,encrypted_notes,status,ordered_at,resulted_at,acknowledged_by,acknowledged_at,updated_at',
      unit_id: `eq.${unitId}`,
      order: 'ordered_at.desc',
      limit: '100',
    },
  })

  return Promise.all(rows.map(async (r) => ({
    id: r.id,
    unitId: r.unit_id,
    patientId: r.patient_id,
    encounterId: r.encounter_id,
    testName: await decryptPatientField(r.encrypted_test_name, r.unit_id, r.patient_id, r.id, 'investigation_orders', 'encrypted_test_name'),
    clinicalIndication: r.encrypted_clinical_indication ? await decryptPatientField(r.encrypted_clinical_indication, r.unit_id, r.patient_id, r.id, 'investigation_orders', 'encrypted_clinical_indication') : null,
    notes: r.encrypted_notes ? await decryptPatientField(r.encrypted_notes, r.unit_id, r.patient_id, r.id, 'investigation_orders', 'encrypted_notes') : null,
    status: r.status as InvestigationOrderRow['status'],
    orderedAt: r.ordered_at,
    resultedAt: r.resulted_at,
    acknowledgedBy: r.acknowledged_by,
    acknowledgedAt: r.acknowledged_at,
    updatedAt: r.updated_at,
  })))
}

export async function createInvestigationOrder(params: {
  unitId: string
  patientId: string
  encounterId?: string
  testName: string
  clinicalIndication?: string
  notes?: string
}): Promise<string> {
  const id = uuid()
  const userId = await getUserId()
  const patientKeyInfo = await ensurePatientKey(params.unitId, params.patientId, userId)
  const enc = async (field: string, value: string) =>
    encryptPatientField(value, params.unitId, params.patientId, id, 'investigation_orders', field, patientKeyInfo.key, patientKeyInfo.keyId)

  await upsertRow('investigation_orders', {
    id,
    unit_id: params.unitId,
    patient_id: params.patientId,
    encounter_id: params.encounterId ?? null,
    encrypted_test_name: await enc('encrypted_test_name', params.testName),
    encrypted_clinical_indication: params.clinicalIndication ? await enc('encrypted_clinical_indication', params.clinicalIndication) : null,
    encrypted_notes: params.notes ? await enc('encrypted_notes', params.notes) : null,
    status: 'ORDERED',
    created_by: userId,
  })
  return id
}

export async function acknowledgeInvestigation(_unitId: string, investigationId: string): Promise<void> {
  const userId = await getUserId()
  await restRequest('rest/v1/investigation_orders', 'PATCH', {
    query: { id: `eq.${investigationId}` },
    body: {
      status: 'ACKNOWLEDGED',
      acknowledged_by: userId,
      acknowledged_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    prefer: 'return=minimal',
  })
}

// --- MAR: Medication Administration ---

export async function saveMedicationAdministration(params: {
  unitId: string
  patientId: string
  medicationRecordId: string
  drugName: string
  dose: string
  route: string
  frequency: string
  scheduledDateIso: string
  scheduledTimeHour: number
  status: string
  recordId?: string
}): Promise<string> {
  const id = params.recordId ?? uuid()
  const userId = await getUserId()
  const patientKeyInfo = await ensurePatientKey(params.unitId, params.patientId, userId)
  const detail = [params.medicationRecordId, params.dose, params.route, params.frequency, params.scheduledDateIso, String(params.scheduledTimeHour)].join(' · ')
  const encSummary = await encryptPatientField(
    params.drugName, params.unitId, params.patientId, id,
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
    type: 'MEDICATION_ADMINISTRATION',
    summary: encSummary,
    detail: encDetail,
    state: params.status,
    clinical_date: params.scheduledDateIso,
    created_by: userId,
  })
  return id
}

export async function updateMedicationAdministrationStatus(
  _unitId: string,
  recordId: string,
  status: string,
  _administeredBy?: string,
): Promise<void> {
  const body: Record<string, unknown> = {
    state: status,
    updated_at: new Date().toISOString(),
  }
  if (status.toUpperCase() === 'ADMINISTERED') {
    const userId = await getUserId()
    body.signed_by = userId
    body.signed_at = new Date().toISOString()
  }
  await restRequest('rest/v1/clinical_records', 'PATCH', {
    query: { id: `eq.${recordId}` },
    body,
    prefer: 'return=minimal',
  })
}
