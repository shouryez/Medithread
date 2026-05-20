'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import Logo from '@/components/Logo'
import { Hospital, Loader2, ArrowRight, ShieldCheck, LogOut } from 'lucide-react'

export default function HospitalLoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [existingSession, setExistingSession] = useState(null) // { staff, hospital } or null
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/hospital/me', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d?.authenticated && d?.staff) {
          // Don't auto-redirect — let the user choose to continue or sign out.
          setExistingSession({ staff: d.staff, hospital: d.hospital })
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCheckingSession(false) })
    return () => { cancelled = true }
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      toast.error('Email and password required')
      return
    }
    setLoading(true)
    try {
      const r = await fetch('/api/hospital/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify(form),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Login failed')
      toast.success(`Welcome, ${d.staff.full_name}`)
      // Hard navigation so the new cookie is picked up by the next page
      window.location.href = '/hospital/dashboard'
    } catch (e) {
      toast.error(e.message)
      setLoading(false)
    }
  }

  const signOutAndContinue = async () => {
    try {
      await fetch('/api/hospital/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {}
    setExistingSession(null)
    setForm({ email: '', password: '' })
    toast.success('Signed out — you can sign in to a different account')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0b0e14' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/"><Logo size="lg" /></Link>
          <div className="text-xs text-[#a855f7] mt-2 inline-flex items-center gap-2"><Hospital className="w-3 h-3" /> Hospital Portal</div>
        </div>

        {checkingSession ? (
          <div className="card-accent-purple p-8 text-center text-sm text-[#6a8099] inline-flex items-center justify-center gap-2 w-full">
            <Loader2 className="w-4 h-4 animate-spin" /> Checking session…
          </div>
        ) : existingSession ? (
          <div className="card-accent-purple p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.4)' }}>
                <ShieldCheck className="w-5 h-5 text-[#a855f7]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase tracking-wider text-[#6a8099]">Already signed in</div>
                <div className="font-semibold truncate">{existingSession.staff.full_name}</div>
                <div className="text-xs text-[#6a8099] truncate">{existingSession.hospital?.name}</div>
              </div>
            </div>
            <button
              onClick={() => { window.location.href = '/hospital/dashboard' }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold mb-3"
              style={{ background: '#a855f7', color: '#0b0e14' }}
            >
              Continue to dashboard <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={signOutAndContinue}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm"
              style={{ background: 'transparent', color: '#ff5252', border: '1px solid rgba(255,82,82,0.4)' }}
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out & use a different account
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="card-accent-purple p-8" autoComplete="off">
            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-[#6a8099] mb-2 block">Work email</label>
                <input
                  className="input-dark"
                  type="email"
                  name="work-email"
                  autoComplete="off"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="doctor@hospital.in"
                  required
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-[#6a8099] mb-2 block">Password</label>
                <input
                  className="input-dark"
                  type="password"
                  name="hospital-password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold disabled:opacity-60"
                style={{ background: '#a855f7', color: '#0b0e14' }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign in <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
            <div className="mt-6 text-center text-sm text-[#6a8099]">
              New hospital? <Link href="/hospital/register" className="text-[#a855f7] hover:underline">Register your hospital →</Link>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  )
}
