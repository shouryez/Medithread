'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { LayoutDashboard, Activity, Pill, FileText, Shield, TrendingUp, Bell, User, Settings, LogOut, Loader2, ScanLine } from 'lucide-react'
import Logo from '@/components/Logo'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/timeline', label: 'Timeline', icon: Activity },
  { href: '/medications', label: 'Medications', icon: Pill, badgeKey: 'meds' },
  { href: '/medicine-scan', label: 'Scan Medicine', icon: ScanLine },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/consent', label: 'Consent', icon: Shield, badgeKey: 'consents' },
  { href: '/chronic', label: 'Chronic Tracker', icon: TrendingUp },
  { href: '/reminders', label: 'Reminders', icon: Bell },
]
const NAV_BOTTOM = [
  { href: '/profile', label: 'Profile', icon: User },
]

export default function PatientShell({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [badges, setBadges] = useState({ meds: 0, consents: 0 })

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/me')
        const d = await r.json()
        if (!d.authenticated) { window.location.href = '/login'; return }
        if (!d.patient) { window.location.href = '/register'; return }
        setPatient(d.patient)
        // badges
        const dash = await fetch('/api/patient/dashboard').then(r => r.json())
        setBadges({ meds: dash.stats?.activeMeds || 0, consents: dash.stats?.pendingConsents || 0 })
      } finally { setLoading(false) }
    })()
  }, [pathname])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('Signed out')
    window.location.href = '/'
  }

  if (loading || !patient) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#00e5ff]" /></div>
  }

  const initials = patient.full_name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="min-h-screen flex" style={{ background: '#0b0e14' }}>
      <aside className="hidden md:flex w-[220px] flex-col fixed inset-y-0 left-0 border-r" style={{ background: '#111520', borderColor: '#1e2a40' }}>
        <div className="px-5 py-5 border-b" style={{ borderColor: '#1e2a40' }}>
          <Logo size="md" />
        </div>
        <div className="px-4 py-4 border-b flex items-center gap-3" style={{ borderColor: '#1e2a40' }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm" style={{ background: 'rgba(0,229,255,0.15)', color: '#00e5ff', border: '1px solid #00e5ff' }}>{initials}</div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{patient.full_name}</div>
            <div className="text-[10px] font-mono text-[#00e5ff] truncate">{patient.medi_id}</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-auto">
          {NAV.map(n => {
            const Icon = n.icon
            const active = pathname?.startsWith(n.href)
            const badge = n.badgeKey ? badges[n.badgeKey] : 0
            return (
              <Link key={n.href} href={n.href} className="relative flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition" style={{ background: active ? 'rgba(0,229,255,0.08)' : 'transparent', color: active ? '#00e5ff' : '#e2e8f4' }}>
                {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full" style={{ background: '#00e5ff' }} />}
                <span className="inline-flex items-center gap-3"><Icon className="w-4 h-4" />{n.label}</span>
                {badge > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: n.badgeKey === 'consents' ? '#ffab40' : '#ff5252', color: '#0b0e14' }}>{badge}</span>
                )}
              </Link>
            )
          })}
          <div className="my-3 border-t" style={{ borderColor: '#1e2a40' }} />
          {NAV_BOTTOM.map(n => {
            const Icon = n.icon
            const active = pathname?.startsWith(n.href)
            return (
              <Link key={n.href} href={n.href} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition" style={{ background: active ? 'rgba(0,229,255,0.08)' : 'transparent', color: active ? '#00e5ff' : '#e2e8f4' }}>
                <Icon className="w-4 h-4" />{n.label}
              </Link>
            )
          })}
        </nav>
        <div className="px-4 py-4 border-t" style={{ borderColor: '#1e2a40' }}>
          <button onClick={logout} className="w-full inline-flex items-center justify-center gap-2 text-sm text-[#6a8099] hover:text-[#ff5252] transition"><LogOut className="w-4 h-4" /> Sign out</button>
        </div>
      </aside>

      <main className="flex-1 md:ml-[220px] p-6 md:p-10 max-w-full overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
