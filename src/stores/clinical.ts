import { create } from 'zustand'
import type {
  ClinicalUnitSummary,
  ClinicalInvitationSummary,
  ClinicalMemberSummary,
  PatientRow,
  ClinicalRecordRow,
  ClinicalResultRow,
  CoordinationEventRow,
  AppointmentRow,
  EncounterRow,
  CarePlanRow,
  PrescriptionRow,
  InvestigationOrderRow,
} from '@/types'
import * as api from '@/lib/api'

interface MessageState {
  error: string | null
  success: string | null
  info: string | null
}

interface ClinicalState extends MessageState {
  // Unit selection
  units: ClinicalUnitSummary[]
  activeUnitId: string | null
  isLoadingUnits: boolean
  invitations: ClinicalInvitationSummary[]
  isLoadingInvitations: boolean

  // Members
  members: ClinicalMemberSummary[]
  isLoadingMembers: boolean

  // Patients
  patients: PatientRow[]
  isLoadingPatients: boolean

  // Clinical records
  records: ClinicalRecordRow[]
  isLoadingRecords: boolean

  // Results
  results: ClinicalResultRow[]
  isLoadingResults: boolean

  // Timeline
  timeline: CoordinationEventRow[]
  isLoadingTimeline: boolean

  // Outpatient: Appointments
  appointments: AppointmentRow[]
  isLoadingAppointments: boolean

  // Outpatient: Encounters
  encounters: EncounterRow[]
  isLoadingEncounters: boolean

  // Outpatient: Care Plans
  carePlans: CarePlanRow[]
  isLoadingCarePlans: boolean

  // Outpatient: Prescriptions
  prescriptions: PrescriptionRow[]
  isLoadingPrescriptions: boolean

  // Outpatient: Investigations
  investigations: InvestigationOrderRow[]
  isLoadingInvestigations: boolean

  // Actions
  loadUnits: () => Promise<void>
  selectUnit: (unitId: string) => void
  createUnit: (name: string) => Promise<void>
  loadInvitations: () => Promise<void>
  acceptInvitation: (invitationId: string) => Promise<void>
  sendInvitation: (unitId: string, email: string, role: string) => Promise<void>
  loadMembers: (unitId: string) => Promise<void>
  removeMember: (unitId: string, userId: string) => Promise<void>
  loadPatients: (unitId: string) => Promise<void>
  loadRecords: (unitId: string) => Promise<void>
  loadResults: (unitId: string) => Promise<void>
  loadTimeline: (unitId: string) => Promise<void>

  // Write actions
  admitPatient: (params: {
    unitId: string
    code: string
    initials: string
    hospitalNumber: string
    ageYears: string
    sex: string
    diagnosis: string
  }) => Promise<string | null>
  saveProblem: (params: {
    unitId: string
    patientId: string
    type: string
    summary: string
    detail: string
    state: string
    recordId?: string
  }) => Promise<string | null>
  saveAllergy: (params: {
    unitId: string
    patientId: string
    allergen: string
    reaction: string
    severity: string
    state: string
    recordId?: string
  }) => Promise<string | null>
  saveMedication: (params: {
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
  }) => Promise<string | null>
  saveOrder: (params: {
    unitId: string
    patientId: string
    orderType: string
    priority: string
    indication: string
    details: string
    state: string
    recordId?: string
  }) => Promise<string | null>
  saveDailyUpdate: (params: {
    unitId: string
    patientId: string
    subjective: string
    objective: string
    assessment: string
    plan: string
    state: string
    recordId?: string
  }) => Promise<string | null>
  updateRecordState: (unitId: string, recordId: string, state: string) => Promise<void>
  dischargePatient: (unitId: string, patientId: string) => Promise<void>
  saveResult: (params: {
    unitId: string
    patientId: string
    kind: string
    title: string
    value: string
  }) => Promise<string | null>
  saveCoordinationEvent: (params: {
    unitId: string
    patientId: string | null
    kind: string
    body: string
  }) => Promise<string | null>

  // Outpatient actions
  loadAppointments: (unitId: string) => Promise<void>
  loadEncounters: (unitId: string) => Promise<void>
  loadCarePlans: (unitId: string) => Promise<void>
  loadPrescriptions: (unitId: string) => Promise<void>
  loadInvestigations: (unitId: string) => Promise<void>
  createAppointment: (params: {
    unitId: string
    patientId: string
    clinicianId: string
    kind: string
    reason: string
    startAt: string
    endAt: string
    notes: string
  }) => Promise<string | null>
  cancelAppointment: (unitId: string, appointmentId: string) => Promise<void>
  checkInAppointment: (unitId: string, appointmentId: string) => Promise<void>
  checkOutAppointment: (unitId: string, appointmentId: string) => Promise<void>
  createEncounter: (params: {
    unitId: string
    patientId: string
    clinicianId: string
    appointmentId?: string
    subjective: string
    objective: string
    assessment: string
    plan: string
    diagnosisCodes?: string
  }) => Promise<string | null>
  signEncounter: (unitId: string, encounterId: string) => Promise<void>
  createCarePlan: (params: {
    unitId: string
    patientId: string
    title: string
    description: string
    goals: string
    reviewIntervalDays: number
  }) => Promise<string | null>
  updateCarePlanStatus: (unitId: string, carePlanId: string, status: string) => Promise<void>
  createPrescription: (params: {
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
  }) => Promise<string | null>
  discontinuePrescription: (unitId: string, prescriptionId: string) => Promise<void>
  createInvestigationOrder: (params: {
    unitId: string
    patientId: string
    encounterId?: string
    testName: string
    clinicalIndication?: string
    notes?: string
  }) => Promise<string | null>
  acknowledgeInvestigation: (unitId: string, investigationId: string) => Promise<void>

  // MAR actions
  medicationAdministrations: ClinicalRecordRow[]
  generateMarDoses: (unitId: string, dateIso: string) => Promise<void>
  administerDose: (unitId: string, recordId: string) => Promise<void>
  refuseDose: (unitId: string, recordId: string) => Promise<void>

  dismissError: () => void
  dismissSuccess: () => void
  dismissInfo: () => void
  clearMessages: () => void
}

function parseFrequencyToHours(frequency: string): number[] {
  const upper = frequency.toUpperCase()
  if (upper.includes('OD') || upper.includes('DAILY') || upper.includes('QD')) return [8]
  if (upper.includes('BD') || upper.includes('BID')) return [8, 20]
  if (upper.includes('TDS') || upper.includes('TID') || upper.includes('Q8H')) return [8, 14, 20]
  if (upper.includes('QDS') || upper.includes('QID') || upper.includes('Q6H')) return [6, 12, 18, 0]
  if (upper.includes('Q4H')) return [4, 8, 12, 16, 20, 0]
  if (upper.includes('PRN')) return [10]
  if (upper.includes('STAT')) return [new Date().getHours()]
  return [8]
}

function extractScheduledHour(detail: string): number {
  const parts = detail.split(' · ')
  return parseInt(parts[parts.length - 1] ?? '0', 10) || 0
}

export const useClinicalStore = create<ClinicalState>((set) => ({
  error: null,
  success: null,
  info: null,

  units: [],
  activeUnitId: null,
  isLoadingUnits: false,
  invitations: [],
  isLoadingInvitations: false,

  members: [],
  isLoadingMembers: false,

  patients: [],
  isLoadingPatients: false,

  records: [],
  isLoadingRecords: false,

  results: [],
  isLoadingResults: false,

  timeline: [],
  isLoadingTimeline: false,

  appointments: [],
  isLoadingAppointments: false,
  encounters: [],
  isLoadingEncounters: false,
  carePlans: [],
  isLoadingCarePlans: false,
  prescriptions: [],
  isLoadingPrescriptions: false,
  investigations: [],
  isLoadingInvestigations: false,
  medicationAdministrations: [],

  loadUnits: async () => {
    set({ isLoadingUnits: true, error: null })
    try {
      const units = await api.fetchUnitMemberships()
      const stored = localStorage.getItem('rounds-active-unit')
      const activeUnitId = units.find((u) => u.id === stored)?.id ?? units[0]?.id ?? null
      set({ units, activeUnitId, isLoadingUnits: false })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e), isLoadingUnits: false })
    }
  },

  selectUnit: (unitId) => {
    localStorage.setItem('rounds-active-unit', unitId)
    set({ activeUnitId: unitId, members: [], patients: [], records: [], results: [], timeline: [], appointments: [], encounters: [], carePlans: [], prescriptions: [], investigations: [] })
  },

  createUnit: async (name) => {
    set({ isLoadingUnits: true, error: null })
    try {
      await api.createUnit(name)
      const units = await api.fetchUnitMemberships()
      set({ units, isLoadingUnits: false, success: `Unit "${name}" created.` })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e), isLoadingUnits: false })
    }
  },

  loadInvitations: async () => {
    set({ isLoadingInvitations: true, error: null })
    try {
      const invitations = await api.fetchPendingInvitations()
      set({ invitations, isLoadingInvitations: false })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e), isLoadingInvitations: false })
    }
  },

  acceptInvitation: async (invitationId) => {
    set({ error: null })
    try {
      await api.acceptInvitation(invitationId)
      const units = await api.fetchUnitMemberships()
      set({ units, success: 'Invitation accepted.' })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
    }
  },

  sendInvitation: async (unitId, email, role) => {
    set({ error: null })
    try {
      await api.sendInvitation(unitId, email, role)
      set({ success: `Invitation sent to ${email}.` })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
    }
  },

  loadMembers: async (unitId) => {
    set({ isLoadingMembers: true, error: null })
    try {
      const members = await api.fetchUnitMembers(unitId)
      set({ members, isLoadingMembers: false })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e), isLoadingMembers: false })
    }
  },

  removeMember: async (unitId, userId) => {
    set({ error: null })
    try {
      await api.removeMember(unitId, userId)
      const members = await api.fetchUnitMembers(unitId)
      set({ members, success: 'Member removed.' })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
    }
  },

  loadPatients: async (unitId) => {
    set({ isLoadingPatients: true, error: null })
    try {
      const patients = await api.fetchPatients(unitId)
      set({ patients, isLoadingPatients: false })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e), isLoadingPatients: false })
    }
  },

  loadRecords: async (unitId) => {
    set({ isLoadingRecords: true, error: null })
    try {
      const records = await api.fetchClinicalRecords(unitId)
      set({ records, isLoadingRecords: false })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e), isLoadingRecords: false })
    }
  },

  loadResults: async (unitId) => {
    set({ isLoadingResults: true, error: null })
    try {
      const results = await api.fetchClinicalResults(unitId)
      set({ results, isLoadingResults: false })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e), isLoadingResults: false })
    }
  },

  loadTimeline: async (unitId) => {
    set({ isLoadingTimeline: true, error: null })
    try {
      const timeline = await api.fetchCoordinationEvents(unitId)
      set({ timeline, isLoadingTimeline: false })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e), isLoadingTimeline: false })
    }
  },

  admitPatient: async (params) => {
    set({ error: null, success: null })
    try {
      const patientId = await api.admitPatient(params)
      const patients = await api.fetchPatients(params.unitId)
      const records = await api.fetchClinicalRecords(params.unitId)
      set({ patients, records, success: `Patient ${params.code} admitted.` })
      return patientId
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
      return null
    }
  },

  saveProblem: async (params) => {
    set({ error: null, success: null })
    try {
      const id = await api.saveProblem(params)
      const records = await api.fetchClinicalRecords(params.unitId)
      set({ records, success: 'Problem saved.' })
      return id
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
      return null
    }
  },

  saveAllergy: async (params) => {
    set({ error: null, success: null })
    try {
      const id = await api.saveAllergy(params)
      const records = await api.fetchClinicalRecords(params.unitId)
      set({ records, success: 'Allergy saved.' })
      return id
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
      return null
    }
  },

  saveMedication: async (params) => {
    set({ error: null, success: null })
    try {
      const id = await api.saveMedication(params)
      const records = await api.fetchClinicalRecords(params.unitId)
      set({ records, success: 'Medication saved.' })
      return id
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
      return null
    }
  },

  saveOrder: async (params) => {
    set({ error: null, success: null })
    try {
      const id = await api.saveOrder(params)
      const records = await api.fetchClinicalRecords(params.unitId)
      set({ records, success: 'Order saved.' })
      return id
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
      return null
    }
  },

  saveDailyUpdate: async (params) => {
    set({ error: null, success: null })
    try {
      const id = await api.saveDailyUpdate(params)
      const records = await api.fetchClinicalRecords(params.unitId)
      set({ records, success: 'Progress note saved.' })
      return id
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
      return null
    }
  },

  updateRecordState: async (unitId, recordId, state) => {
    set({ error: null, success: null })
    try {
      await api.updateRecordState({ unitId, recordId, state })
      const records = await api.fetchClinicalRecords(unitId)
      set({ records, success: `Record marked as ${state}.` })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
    }
  },

  dischargePatient: async (unitId, patientId) => {
    set({ error: null, success: null })
    try {
      await api.dischargePatient(unitId, patientId)
      const patients = await api.fetchPatients(unitId)
      set({ patients, success: 'Patient discharged.' })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
    }
  },

  saveResult: async (params) => {
    set({ error: null, success: null })
    try {
      const id = await api.saveResult(params)
      const results = await api.fetchClinicalResults(params.unitId)
      set({ results, success: 'Result saved.' })
      return id
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
      return null
    }
  },

  saveCoordinationEvent: async (params) => {
    set({ error: null, success: null })
    try {
      const id = await api.saveCoordinationEvent(params)
      const timeline = await api.fetchCoordinationEvents(params.unitId)
      set({ timeline, success: 'Event posted.' })
      return id
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
      return null
    }
  },

  // --- Outpatient actions ---

  loadAppointments: async (unitId) => {
    set({ isLoadingAppointments: true, error: null })
    try {
      const appointments = await api.fetchAppointments(unitId)
      set({ appointments, isLoadingAppointments: false })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e), isLoadingAppointments: false })
    }
  },

  loadEncounters: async (unitId) => {
    set({ isLoadingEncounters: true, error: null })
    try {
      const encounters = await api.fetchEncounters(unitId)
      set({ encounters, isLoadingEncounters: false })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e), isLoadingEncounters: false })
    }
  },

  loadCarePlans: async (unitId) => {
    set({ isLoadingCarePlans: true, error: null })
    try {
      const carePlans = await api.fetchCarePlans(unitId)
      set({ carePlans, isLoadingCarePlans: false })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e), isLoadingCarePlans: false })
    }
  },

  loadPrescriptions: async (unitId) => {
    set({ isLoadingPrescriptions: true, error: null })
    try {
      const prescriptions = await api.fetchPrescriptions(unitId)
      set({ prescriptions, isLoadingPrescriptions: false })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e), isLoadingPrescriptions: false })
    }
  },

  loadInvestigations: async (unitId) => {
    set({ isLoadingInvestigations: true, error: null })
    try {
      const investigations = await api.fetchInvestigationOrders(unitId)
      set({ investigations, isLoadingInvestigations: false })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e), isLoadingInvestigations: false })
    }
  },

  createAppointment: async (params) => {
    set({ error: null, success: null })
    try {
      const id = await api.createAppointment(params)
      const appointments = await api.fetchAppointments(params.unitId)
      set({ appointments, success: 'Appointment scheduled.' })
      return id
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
      return null
    }
  },

  cancelAppointment: async (unitId, appointmentId) => {
    set({ error: null, success: null })
    try {
      await api.cancelAppointment(unitId, appointmentId)
      const appointments = await api.fetchAppointments(unitId)
      set({ appointments, success: 'Appointment cancelled.' })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
    }
  },

  checkInAppointment: async (unitId, appointmentId) => {
    set({ error: null, success: null })
    try {
      await api.checkInAppointment(unitId, appointmentId)
      const appointments = await api.fetchAppointments(unitId)
      set({ appointments, success: 'Patient checked in.' })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
    }
  },

  checkOutAppointment: async (unitId, appointmentId) => {
    set({ error: null, success: null })
    try {
      await api.checkOutAppointment(unitId, appointmentId)
      const appointments = await api.fetchAppointments(unitId)
      set({ appointments, success: 'Appointment completed.' })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
    }
  },

  createEncounter: async (params) => {
    set({ error: null, success: null })
    try {
      const id = await api.createEncounter(params)
      const encounters = await api.fetchEncounters(params.unitId)
      set({ encounters, success: 'Encounter created.' })
      return id
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
      return null
    }
  },

  signEncounter: async (unitId, encounterId) => {
    set({ error: null, success: null })
    try {
      await api.signEncounter(unitId, encounterId)
      const encounters = await api.fetchEncounters(unitId)
      set({ encounters, success: 'Encounter signed.' })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
    }
  },

  createCarePlan: async (params) => {
    set({ error: null, success: null })
    try {
      const id = await api.createCarePlan(params)
      const carePlans = await api.fetchCarePlans(params.unitId)
      set({ carePlans, success: 'Care plan created.' })
      return id
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
      return null
    }
  },

  updateCarePlanStatus: async (unitId, carePlanId, status) => {
    set({ error: null, success: null })
    try {
      await api.updateCarePlanStatus(unitId, carePlanId, status)
      const carePlans = await api.fetchCarePlans(unitId)
      set({ carePlans, success: `Care plan ${status.toLowerCase()}.` })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
    }
  },

  createPrescription: async (params) => {
    set({ error: null, success: null })
    try {
      const id = await api.createPrescription(params)
      const prescriptions = await api.fetchPrescriptions(params.unitId)
      set({ prescriptions, success: 'Prescription created.' })
      return id
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
      return null
    }
  },

  discontinuePrescription: async (unitId, prescriptionId) => {
    set({ error: null, success: null })
    try {
      await api.discontinuePrescription(unitId, prescriptionId)
      const prescriptions = await api.fetchPrescriptions(unitId)
      set({ prescriptions, success: 'Prescription discontinued.' })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
    }
  },

  createInvestigationOrder: async (params) => {
    set({ error: null, success: null })
    try {
      const id = await api.createInvestigationOrder(params)
      const investigations = await api.fetchInvestigationOrders(params.unitId)
      set({ investigations, success: 'Investigation ordered.' })
      return id
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
      return null
    }
  },

  acknowledgeInvestigation: async (unitId, investigationId) => {
    set({ error: null, success: null })
    try {
      await api.acknowledgeInvestigation(unitId, investigationId)
      const investigations = await api.fetchInvestigationOrders(unitId)
      set({ investigations, success: 'Investigation acknowledged.' })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
    }
  },

  generateMarDoses: async (unitId, dateIso) => {
    set({ error: null, success: null })
    try {
      const records = await api.fetchClinicalRecords(unitId)
      const activeMedications = records.filter((r) => r.type === 'MEDICATION' && (r.state ?? 'ACTIVE').toUpperCase() === 'ACTIVE')
      const existingAdmins = records.filter((r) => r.type === 'MEDICATION_ADMINISTRATION' && r.detail?.includes(dateIso))
      for (const med of activeMedications) {
        const parts = (med.detail ?? '').split(' · ')
        const dose = parts[0] ?? ''
        const route = parts[1] ?? ''
        const frequency = parts[2] ?? ''
        const hours = parseFrequencyToHours(frequency)
        for (const hour of hours) {
          const alreadyExists = existingAdmins.some((a) => a.detail?.includes(med.id) && extractScheduledHour(a.detail ?? '') === hour)
          if (alreadyExists) continue
          await api.saveMedicationAdministration({
            unitId,
            patientId: med.patientId,
            medicationRecordId: med.id,
            drugName: med.summary ?? '',
            dose,
            route,
            frequency,
            scheduledDateIso: dateIso,
            scheduledTimeHour: hour,
            status: 'SCHEDULED',
          })
        }
      }
      const updated = await api.fetchClinicalRecords(unitId)
      const medicationAdministrations = updated.filter((r) => r.type === 'MEDICATION_ADMINISTRATION')
      set({ records: updated, medicationAdministrations, success: 'Scheduled doses generated.' })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
    }
  },

  administerDose: async (unitId, recordId) => {
    set({ error: null, success: null })
    try {
      await api.updateMedicationAdministrationStatus(unitId, recordId, 'ADMINISTERED')
      const updated = await api.fetchClinicalRecords(unitId)
      const medicationAdministrations = updated.filter((r) => r.type === 'MEDICATION_ADMINISTRATION')
      set({ records: updated, medicationAdministrations, success: 'Dose administered.' })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
    }
  },

  refuseDose: async (unitId, recordId) => {
    set({ error: null, success: null })
    try {
      await api.updateMedicationAdministrationStatus(unitId, recordId, 'REFUSED')
      const updated = await api.fetchClinicalRecords(unitId)
      const medicationAdministrations = updated.filter((r) => r.type === 'MEDICATION_ADMINISTRATION')
      set({ records: updated, medicationAdministrations, info: 'Dose refused.' })
    } catch (e) {
      set({ error: String(e instanceof Error ? e.message : e) })
    }
  },

  dismissError: () => set({ error: null }),
  dismissSuccess: () => set({ success: null }),
  dismissInfo: () => set({ info: null }),
  clearMessages: () => set({ error: null, success: null, info: null }),
}))
