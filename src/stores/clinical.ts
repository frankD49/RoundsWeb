import { create } from 'zustand'
import type {
  ClinicalUnitSummary,
  ClinicalInvitationSummary,
  ClinicalMemberSummary,
  PatientRow,
  ClinicalRecordRow,
  ClinicalResultRow,
  CoordinationEventRow,
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

  dismissError: () => void
  dismissSuccess: () => void
  dismissInfo: () => void
  clearMessages: () => void
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
    set({ activeUnitId: unitId, members: [], patients: [], records: [], results: [], timeline: [] })
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

  dismissError: () => set({ error: null }),
  dismissSuccess: () => set({ success: null }),
  dismissInfo: () => set({ info: null }),
  clearMessages: () => set({ error: null, success: null, info: null }),
}))
