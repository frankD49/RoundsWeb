import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { clearDeviceKeys } from '@/lib/deviceAuth'

export type DeviceAuthStatus = 'unknown' | 'ready' | 'awaiting-authorization' | 'no-unit-key'

interface AuthState {
  session: Session | null
  loading: boolean
  error: string | null
  deviceAuthStatus: DeviceAuthStatus
  init: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  setDeviceAuthStatus: (status: DeviceAuthStatus) => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  loading: false,
  error: null,
  deviceAuthStatus: 'unknown',

  init: async () => {
    if (!isSupabaseConfigured) return
    const { data: { session } } = await supabase.auth.getSession()
    set({ session })
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, deviceAuthStatus: 'unknown' })
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

  clearError: () => set({ error: null }),
}))
