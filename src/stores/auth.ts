import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { clearDeviceKeys } from '@/lib/deviceAuth'

export type DeviceAuthStatus = 'unknown' | 'ready' | 'awaiting-authorization' | 'no-unit-key'
export type ClinicalMode = 'inpatient' | 'outpatient'

interface AuthState {
  session: Session | null
  loading: boolean
  error: string | null
  deviceAuthStatus: DeviceAuthStatus
  clinicalMode: ClinicalMode
  accountType: string | null
  accountRole: string | null
  init: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string, accountType: string, role: string | null, country: string | null, licenseNumber: string | null, orgType: string | null) => Promise<void>
  signOut: () => Promise<void>
  setDeviceAuthStatus: (status: DeviceAuthStatus) => void
  setClinicalMode: (mode: ClinicalMode) => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  loading: false,
  error: null,
  deviceAuthStatus: 'unknown',
  clinicalMode: (localStorage.getItem('rounds-clinical-mode') as ClinicalMode) || 'inpatient',
  accountType: null,
  accountRole: null,

  init: async () => {
    if (!isSupabaseConfigured) return
    const { data: { session } } = await supabase.auth.getSession()
    const meta = session?.user?.user_metadata
    set({ session, accountType: meta?.account_type ?? null, accountRole: meta?.role ?? null })
    supabase.auth.onAuthStateChange((_event, session) => {
      const meta = session?.user?.user_metadata
      set({ session, deviceAuthStatus: 'unknown', accountType: meta?.account_type ?? null, accountRole: meta?.role ?? null })
    })
  },

  signIn: async (email, password) => {
    if (!isSupabaseConfigured) {
      set({ error: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env' })
      return
    }
    set({ loading: true, error: null })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) set({ error: error.message })
    set({ loading: false })
  },

  signUp: async (email, password, fullName, acctType, role, country, licenseNumber, orgType) => {
    if (!isSupabaseConfigured) {
      set({ error: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env' })
      return
    }
    set({ loading: true, error: null })
    const data: Record<string, string> = { display_name: fullName, account_type: acctType }
    if (role) data.role = role
    if (country) data.country = country
    if (licenseNumber) data.license_number = licenseNumber
    if (orgType) data.org_type = orgType
    const { error } = await supabase.auth.signUp({ email, password, options: { data } })
    if (error) set({ error: error.message })
    set({ loading: false })
  },

  signOut: async () => {
    await clearDeviceKeys().catch(() => {})
    if (!isSupabaseConfigured) {
      set({ session: null, deviceAuthStatus: 'unknown' })
      return
    }
    await supabase.auth.signOut()
    set({ session: null, deviceAuthStatus: 'unknown' })
  },

  setDeviceAuthStatus: (status) => set({ deviceAuthStatus: status }),

  setClinicalMode: (mode) => {
    localStorage.setItem('rounds-clinical-mode', mode)
    set({ clinicalMode: mode })
  },

  clearError: () => set({ error: null }),
}))

export function useCanCreateUnit(): boolean {
  const accountType = useAuthStore((s) => s.accountType)
  const accountRole = useAuthStore((s) => s.accountRole)
  return accountType?.toUpperCase() === 'ORGANIZATION' || accountRole?.toLowerCase() === 'physician'
}
