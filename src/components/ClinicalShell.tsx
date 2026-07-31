import { Home, Users, Settings, LogOut, Stethoscope, Building2, ChevronDown } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuthStore } from '@/stores/auth'
import { useClinicalStore } from '@/stores/clinical'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/patients', label: 'Patients', icon: Stethoscope },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function ClinicalShell({ children }: { children: React.ReactNode }) {
  const signOut = useAuthStore((s) => s.signOut)
  const setDeviceAuthStatus = useAuthStore((s) => s.setDeviceAuthStatus)
  const navigate = useNavigate()
  const units = useClinicalStore((s) => s.units)
  const activeUnitId = useClinicalStore((s) => s.activeUnitId)
  const selectUnit = useClinicalStore((s) => s.selectUnit)
  const [unitMenuOpen, setUnitMenuOpen] = useState(false)

  const activeUnit = units.find((u) => u.id === activeUnitId)

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const handleSelectUnit = (unitId: string) => {
    setDeviceAuthStatus('unknown')
    selectUnit(unitId)
    setUnitMenuOpen(false)
  }

  return (
    <div className="flex h-screen bg-clinical-background">
      <aside className="w-60 bg-clinical-surface border-r border-clinical-border flex flex-col">
        <div className="px-5 py-5 border-b border-clinical-border">
          <h1 className="text-lg font-bold text-clinical-primary">Rounds</h1>
          <p className="text-xs text-gray-500 mt-0.5">Clinical Workspace</p>
        </div>

        {/* Unit selector */}
        <div className="px-3 py-3 border-b border-clinical-border relative">
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
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-clinical-primary/10 text-clinical-primary'
                    : 'text-gray-600 hover:bg-gray-100'
                )
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-clinical-border">
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
