'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { LayoutDashboard, Search, Users, Shield, UserCheck, BarChart2, Settings, LogOut, Loader2 } from 'lucide-react'
import Logo from '@/components/Logo'

const NAV = [
  { href: '/hospital/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/hospital/search', label: 'Find Patient', icon: Search },
  { href: '/hospital/audit', label: 'Audit Log', icon: Shield },
  { href: '/hospital/staff', label: 'Staff', icon: UserCheck, adminOnly: true },
  { href: '/hospital/analytics', label: 'Analytics', icon: BarChart2 },
]

export default function HospitalShell({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ctx, setCtx] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/hospital/me')
        const d = await r.json()
        if (!d.authenticated) { window.location.href = '/hospital/login'; return }
        setCtx(d)
      } finally { setLoading(false) }
    })()
  }, [pathname])

  const logout = async () => { await fetch('/api/hospital/auth/logout', { method: 'POST' }); toast.success('Signed out'); window.location.href = '/hospital/login' }

  if (loading || !ctx) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#a855f7]" /></div>

  const { staff, hospital } = ctx
  const initials = staff.full_name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="min-h-screen flex" style={{ background: '#0b0e14' }}>
      <aside className="hidden md:flex w-[220px] flex-col fixed inset-y-0 left-0 border-r" style={{ background: '#111520', borderColor: '#1e2a40' }}>
        <div className="px-5 py-5 border-b" style={{ borderColor: '#1e2a40' }}><Logo size="md" /></div>
        <div className="px-4 py-4 border-b flex items-center gap-3" style={{ borderColor: '#1e2a40' }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid #a855f7' }}>{initials}</div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{staff.full_name}</div>
            <div className="text-[10px] capitalize text-[#a855f7]">{staff.role}</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-auto">
          {NAV.filter(n => !n.adminOnly || staff.role === 'admin').map(n => {
            const Icon = n.icon
            const active = pathname?.startsWith(n.href)
            return (
              <Link key={n.href} href={n.href} className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition" style={{ background: active ? 'rgba(168,85,247,0.08)' : 'transparent', color: active ? '#a855f7' : '#e2e8f4' }}>
                {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full" style={{ background: '#a855f7' }} />}
                <Icon className="w-4 h-4" />{n.label}
              </Link>
            )
          })}
        </nav>
        <div className="px-4 py-3 border-t text-xs" style={{ borderColor: '#1e2a40' }}>
          <div className="text-[#e2e8f4] font-medium truncate">{hospital.name}</div>
          <div className="text-[#6a8099] truncate">{hospital.city}</div>
        </div>
        <div className="px-4 py-3 border-t" style={{ borderColor: '#1e2a40' }}>
          <button onClick={logout} className="w-full inline-flex items-center justify-center gap-2 text-sm text-[#6a8099] hover:text-[#ff5252]"><LogOut className="w-4 h-4" /> Sign out</button>
        </div>
      </aside>
      <main className="flex-1 md:ml-[220px] p-6 md:p-10 max-w-full overflow-x-hidden">{children}</main>
    </div>
  )
}
