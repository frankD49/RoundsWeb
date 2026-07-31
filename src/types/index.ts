// TypeScript types matching iOS/Android data models

export interface ClinicalUnitSummary {
  id: string
  name: string
  role: string
  status: string
}

export interface UnitSelectionSnapshot {
  units: ClinicalUnitSummary[]
  activeUnitId: string | null
}

export interface ClinicalMemberSummary {
  userId: string
  unitId: string
  role: string
  status: string
  displayName: string
  updatedAt: string
}

export interface ClinicalInvitationSummary {
  id: string
  unitId: string
  unitName: string
  email: string
  role: string
  status: string
  createdAt: string
}

export interface PatientRow {
  id: string
  unitId: string
  code: string
  initials: string | null
  hospitalNumber: string | null
  ageYears: string | null
  sex: string | null
  status: string
  updatedAt: string
}

export type ClinicalRecordType =
  | 'ADMISSION_BASELINE'
  | 'PROVISIONAL_DIAGNOSIS'
  | 'CONFIRMED_DIAGNOSIS'
  | 'COMORBIDITY'
  | 'COMPLICATION'
  | 'DAILY_UPDATE'
  | 'DAILY_PROBLEM'
  | 'DAILY_ORDER'
  | 'OBSERVATION_RESULT_MEDIA'
  | 'VENTILATOR'
  | 'CURRENT_STATUS'
  | 'DISPOSITION'
  | 'ALLERGY'
  | 'MEDICATION'

export interface ClinicalRecordRow {
  id: string
  unitId: string
  patientId: string
  type: ClinicalRecordType
  summary: string | null
  detail: string | null
  state: string | null
  updatedAt: string
  createdAt: string
}

export interface ClinicalResultRow {
  id: string
  unitId: string
  patientId: string
  kind: string
  title: string
  value: string | null
  createdAt: string
}

export interface CoordinationEventRow {
  id: string
  unitId: string
  patientId: string | null
  kind: string
  body: string
  createdBy: string | null
  createdAt: string
}

export interface AuditEventRow {
  id: string
  unitId: string
  aggregateId: string
  actorId: string | null
  eventType: string
  payload: string
  createdAt: string
}

export interface ClinicalDeviceAuthorizationSummary {
  id: string
  unitId: string
  platform: string
  displayName: string
  authorizationStatus: 'authorized' | 'awaitingAuthorization' | 'inactive'
  isCurrentDevice: boolean
}

// Crypto types
export interface ClinicalCipherEnvelope {
  version: number
  algorithm: string
  key_id: string
  nonce: string
  ciphertext: string
}

export const CRYPTO_CONSTANTS = {
  envelopeVersion: 1,
  algorithm: 'A256GCM',
  keyByteCount: 32,
  nonceByteCount: 12,
  tagByteCount: 16,
} as const
