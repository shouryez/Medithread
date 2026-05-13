'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import Logo from '@/components/Logo'
import { Hospital, Loader2, ArrowRight } from 'lucide-react'

export default function HospitalLoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetch('/api/hospital/me').then(r => r.json()).then(d => { if (d.authenticated) router.push('/hospital/dashboard') }) }, [router])

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const r = await fetch('/api/hospital/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Login failed')
      toast.success(`Welcome, ${d.staff.full_name}`)
      router.push('/hospital/dashboard')
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0b0e14' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/"><Logo size="lg" /></Link>
          <div className="text-xs text-[#a855f7] mt-2 inline-flex items-center gap-2"><Hospital className="w-3 h-3" /> Hospital Portal</div>
        </div>
        <form onSubmit={submit} className="card-accent-purple p-8">
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-[#6a8099] mb-2 block">Work email</label>
              <input className="input-dark" type="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="doctor@hospital.in" required />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[#6a8099] mb-2 block">Password</label>
              <input className="input-dark" type="password" autoComplete="current-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
            </div>
            <button disabled={loading} className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold" style={{ background: '#a855f7', color: '#0b0e14' }}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign in <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
          <div className="mt-6 text-center text-sm text-[#6a8099]">
            New hospital? <Link href="/hospital/register" className="text-[#a855f7] hover:underline">Register your hospital →</Link>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
