import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth'
import { useClinicalStore } from '@/stores/clinical'
import AuthScreen from '@/screens/AuthScreen'
import UnitSelectionScreen from '@/screens/UnitSelectionScreen'
import DeviceAuthorizationScreen from '@/screens/DeviceAuthorizationScreen'
import ClinicalShell from '@/components/ClinicalShell'
import HomeScreen from '@/screens/HomeScreen'
import PatientListScreen from '@/screens/PatientListScreen'
import PatientDetailScreen from '@/screens/PatientDetailScreen'
import MembersScreen from '@/screens/MembersScreen'
import SettingsScreen from '@/screens/SettingsScreen'

export default function App() {
  const session = useAuthStore((s) => s.session)
  const init = useAuthStore((s) => s.init)
  const deviceAuthStatus = useAuthStore((s) => s.deviceAuthStatus)
  const setDeviceAuthStatus = useAuthStore((s) => s.setDeviceAuthStatus)
  const signOut = useAuthStore((s) => s.signOut)
  const units = useClinicalStore((s) => s.units)
  const activeUnitId = useClinicalStore((s) => s.activeUnitId)
  const loadUnits = useClinicalStore((s) => s.loadUnits)

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    if (session && units.length === 0) {
      loadUnits()
    }
  }, [session, units.length, loadUnits])

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<AuthScreen />} />
      </Routes>
    )
  }

  if (units.length === 0 || !activeUnitId) {
    return (
      <Routes>
        <Route path="*" element={<UnitSelectionScreen />} />
      </Routes>
    )
  }

  if (deviceAuthStatus !== 'ready') {
    const activeUnit = units.find((u) => u.id === activeUnitId)
    return (
      <DeviceAuthorizationScreen
        unitId={activeUnitId}
        unitName={activeUnit?.name ?? 'Unit'}
        onAuthorized={() => setDeviceAuthStatus('ready')}
        onSignOut={() => signOut()}
      />
    )
  }

  return (
    <ClinicalShell>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/patients" element={<PatientListScreen />} />
        <Route path="/patients/:patientId" element={<PatientDetailScreen />} />
        <Route path="/members" element={<MembersScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ClinicalShell>
  )
}
