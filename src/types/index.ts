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
  phone: string | null
  patientIdNumber: string | null
  dateOfBirth: string | null
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
  | 'MEDICATION_ADMINISTRATION'
  | 'DISCHARGE_SUMMARY'

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

// --- Outpatient types ---

export type AppointmentKind =
  | 'NEW_CONSULT' | 'FOLLOW_UP' | 'PROCEDURE' | 'TELEHEALTH'
  | 'URGENT_REVIEW' | 'ANNUAL_REVIEW' | 'VACCINATION'

export type AppointmentStatus =
  | 'SCHEDULED' | 'CHECKED_IN' | 'IN_ROOM' | 'COMPLETED'
  | 'CANCELLED' | 'NO_SHOW' | 'RESCHEDULED'

export type EncounterStatus = 'DRAFT' | 'ACTIVE' | 'SIGNED' | 'AMENDED' | 'ARCHIVED'

export type CarePlanStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DISCONTINUED'

export type PrescriptionStatus = 'ACTIVE' | 'DISCONTINUED' | 'EXPIRED' | 'CANCELLED'

export type InvestigationStatus = 'ORDERED' | 'IN_PROGRESS' | 'RESULTED' | 'CANCELLED' | 'ACKNOWLEDGED'

export interface AppointmentRow {
  id: string
  unitId: string
  patientId: string
  clinicianId: string
  kind: AppointmentKind
  status: AppointmentStatus
  reason: string | null
  startAt: string
  endAt: string
  notes: string | null
  checkInAt: string | null
  checkOutAt: string | null
  updatedAt: string
}

export interface EncounterRow {
  id: string
  unitId: string
  patientId: string
  appointmentId: string | null
  clinicianId: string
  encounterDate: string
  status: EncounterStatus
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  diagnosisCodes: string | null
  summary: string | null
  signedBy: string | null
  signedAt: string | null
  updatedAt: string
}

export interface CarePlanRow {
  id: string
  unitId: string
  patientId: string
  title: string
  description: string | null
  goals: string | null
  status: CarePlanStatus
  reviewIntervalDays: number
  nextReviewDate: string | null
  startedAt: string
  completedAt: string | null
  updatedAt: string
}

export interface PrescriptionRow {
  id: string
  unitId: string
  patientId: string
  encounterId: string | null
  medicationName: string
  dose: string
  frequency: string
  route: string | null
  instructions: string | null
  status: PrescriptionStatus
  startsOn: string
  endsOn: string | null
  repeatCount: number
  repeatsUsed: number
  nextReviewDate: string | null
  updatedAt: string
}

export interface InvestigationOrderRow {
  id: string
  unitId: string
  patientId: string
  encounterId: string | null
  testName: string
  clinicalIndication: string | null
  notes: string | null
  status: InvestigationStatus
  orderedAt: string
  resultedAt: string | null
  acknowledgedBy: string | null
  acknowledgedAt: string | null
  updatedAt: string
}

export const CRYPTO_CONSTANTS = {
  envelopeVersion: 1,
  algorithm: 'A256GCM',
  keyByteCount: 32,
  nonceByteCount: 12,
  tagByteCount: 16,
} as const
