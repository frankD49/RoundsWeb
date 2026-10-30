import { Home, Users, Settings, LogOut, Stethoscope, Building2, ChevronDown, Calendar, FileText, ClipboardList, Pill, FlaskConical, MessageSquare, AlertCircle, BarChart3, Cross, FileSearch, Send } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuthStore, type ClinicalMode } from '@/stores/auth'
import { useClinicalStore } from '@/stores/clinical'
import { cn } from '@/lib/utils'

const inpatientNavItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/patients', label: 'Patients', icon: Stethoscope },
  { to: '/rx', label: 'Rx', icon: Cross },
  { to: '/reports', label: 'Reports', icon: FileSearch },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/alerts', label: 'Alerts', icon: AlertCircle },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const outpatientNavItems = [
  { to: '/outpatient-dashboard', label: 'Dashboard', icon: Home },
  { to: '/outpatient', label: 'Appointments', icon: Calendar },
  { to: '/outpatient', label: 'Encounters', icon: FileText },
  { to: '/outpatient', label: 'Care Plans', icon: ClipboardList },
  { to: '/outpatient', label: 'Prescriptions', icon: Pill },
  { to: '/outpatient', label: 'Investigations', icon: FlaskConical },
  { to: '/referrals', label: 'Referrals', icon: Send },
  { to: '/reports', label: 'Reports', icon: FileSearch },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function ClinicalShell({ children }: { children: React.ReactNode }) {
  const signOut = useAuthStore((s) => s.signOut)
  const setDeviceAuthStatus = useAuthStore((s) => s.setDeviceAuthStatus)
  const clinicalMode = useAuthStore((s) => s.clinicalMode)
  const setClinicalMode = useAuthStore((s) => s.setClinicalMode)
  const navigate = useNavigate()
  const units = useClinicalStore((s) => s.units)
  const activeUnitId = useClinicalStore((s) => s.activeUnitId)
  const selectUnit = useClinicalStore((s) => s.selectUnit)
  const [unitMenuOpen, setUnitMenuOpen] = useState(false)

  const activeUnit = units.find((u) => u.id === activeUnitId)
  const navItems = clinicalMode === 'outpatient' ? outpatientNavItems : inpatientNavItems

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const handleSelectUnit = (unitId: string) => {
    setDeviceAuthStatus('unknown')
    selectUnit(unitId)
    setUnitMenuOpen(false)
  }

  const handleModeSwitch = (mode: ClinicalMode) => {
    setClinicalMode(mode)
    if (mode === 'outpatient') {
      navigate('/outpatient-dashboard')
    } else {
      navigate('/')
    }
  }

  return (
    <div className={cn("flex h-screen", clinicalMode === 'outpatient' ? "bg-outpatient-background" : "bg-clinical-background")}>
      <aside className={cn("w-60 border-r flex flex-col", clinicalMode === 'outpatient' ? "bg-outpatient-surface border-outpatient-border" : "bg-clinical-surface border-clinical-border")}>
        <div className={cn("px-5 py-5 border-b", clinicalMode === 'outpatient' ? "border-outpatient-border" : "border-clinical-border")}>
          <h1 className={cn("text-lg font-bold", clinicalMode === 'outpatient' ? "text-outpatient-primary" : "text-clinical-primary")}>Rounds</h1>
          <p className="text-xs text-gray-500 mt-0.5">Clinical Workspace</p>
        </div>

        {/* Mode switcher */}
        <div className={cn("px-3 py-3 border-b", clinicalMode === 'outpatient' ? "border-outpatient-border" : "border-clinical-border")}>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => handleModeSwitch('inpatient')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-colors',
                clinicalMode === 'inpatient'
                  ? 'bg-white text-clinical-primary shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Stethoscope className="w-3.5 h-3.5" />
              Inpatient
            </button>
            <button
              onClick={() => handleModeSwitch('outpatient')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-colors',
                clinicalMode === 'outpatient'
                  ? 'bg-white text-outpatient-primary shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
              Outpatient
            </button>
          </div>
        </div>

        {/* Unit selector */}
        <div className={cn("px-3 py-3 border-b relative", clinicalMode === 'outpatient' ? "border-outpatient-border" : "border-clinical-border")}>
          <button
            onClick={() => setUnitMenuOpen(!unitMenuOpen)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Building2 className="w-4 h-4 text-clinical-secondary flex-shrink-0" />
            <span className="flex-1 truncate text-left">{activeUnit?.name ?? 'Select Unit'}</span>
            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </button>
          {unitMenuOpen && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
              {units.map((unit) => (
                <button
                  key={unit.id}
                  onClick={() => handleSelectUnit(unit.id)}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-50',
                    unit.id === activeUnitId && 'text-clinical-primary font-medium'
                  )}
                >
                  <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="flex-1 truncate">{unit.name}</span>
                  <span className="text-xs text-gray-400">{unit.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                    ? (clinicalMode === 'outpatient' ? 'bg-outpatient-primary/10 text-outpatient-primary' : 'bg-clinical-primary/10 text-clinical-primary')
                    : 'text-black hover:bg-gray-100'
                )
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={cn("px-3 py-4 border-t", clinicalMode === 'outpatient' ? "border-outpatient-border" : "border-clinical-border")}>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 w-full transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
