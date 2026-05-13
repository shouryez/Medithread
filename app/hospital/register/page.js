'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import Logo from '@/components/Logo'
import { Hospital, ArrowRight, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'

const CITIES = ['Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad', 'Indore']

export default function HospitalRegister() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    hospital_name: '', registration_no: '', city: 'Bangalore', address: '', contact_phone: '',
    admin_name: '', admin_email: '', password: '', confirm: '',
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const next = () => {
    if (!form.hospital_name) return toast.error('Hospital name required')
    if (!form.registration_no) return toast.error('Registration number required')
    setStep(2)
  }

  const submit = async () => {
    if (!form.admin_name) return toast.error('Admin name required')
    if (!form.admin_email) return toast.error('Email required')
    if (form.password.length < 6) return toast.error('Password must be ≥ 6 chars')
    if (form.password !== form.confirm) return toast.error('Passwords don’t match')
    setLoading(true)
    try {
      const r = await fetch('/api/hospital/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed')
      toast.success('Hospital registered!')
      router.push('/hospital/dashboard')
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen p-4 py-10" style={{ background: '#0b0e14' }}>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-4"><Link href="/"><Logo size="lg" /></Link><div className="text-xs text-[#a855f7] mt-2 inline-flex items-center gap-2"><Hospital className="w-3 h-3" /> Hospital Onboarding</div></div>
        <div className="flex items-center gap-2 mb-6">
          {[1,2].map(n => <div key={n} className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#111520' }}><motion.div initial={false} animate={{ width: step >= n ? '100%' : '0%' }} className="h-full" style={{ background: '#a855f7' }} /></div>)}
        </div>
        <div className="card-accent-purple p-8">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-bold mb-1">Hospital details</h2>
                <p className="text-sm text-[#6a8099] mb-6">Step 1 of 2</p>
                <div className="space-y-3">
                  <Field l="Hospital name"><input className="input-dark" value={form.hospital_name} onChange={e => set('hospital_name', e.target.value)} /></Field>
                  <Field l="Registration number"><input className="input-dark" value={form.registration_no} onChange={e => set('registration_no', e.target.value)} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field l="City"><select className="input-dark" value={form.city} onChange={e => set('city', e.target.value)}>{CITIES.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
                    <Field l="Contact phone"><input className="input-dark" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="+91 …" /></Field>
                  </div>
                  <Field l="Address"><textarea className="input-dark min-h-[70px]" value={form.address} onChange={e => set('address', e.target.value)} /></Field>
                </div>
              </motion.div>
            ) : (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-bold mb-1">Admin account</h2>
                <p className="text-sm text-[#6a8099] mb-6">Step 2 of 2 · You’ll be the admin for {form.hospital_name}</p>
                <div className="space-y-3">
                  <Field l="Full name"><input className="input-dark" value={form.admin_name} onChange={e => set('admin_name', e.target.value)} /></Field>
                  <Field l="Work email"><input type="email" className="input-dark" value={form.admin_email} onChange={e => set('admin_email', e.target.value)} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field l="Password"><input type="password" className="input-dark" value={form.password} onChange={e => set('password', e.target.value)} /></Field>
                    <Field l="Confirm"><input type="password" className="input-dark" value={form.confirm} onChange={e => set('confirm', e.target.value)} /></Field>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center justify-between mt-6">
          {step === 2 ? <button onClick={() => setStep(1)} className="btn-secondary inline-flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button> : <div />}
          {step === 1 ? <button onClick={next} className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-semibold" style={{ background: '#a855f7', color: '#0b0e14' }}>Continue <ArrowRight className="w-4 h-4" /></button>
                       : <button onClick={submit} disabled={loading} className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-semibold" style={{ background: '#a855f7', color: '#0b0e14' }}>{loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : <><CheckCircle2 className="w-4 h-4" /> Create hospital</>}</button>}
        </div>
        <div className="text-center mt-6 text-sm text-[#6a8099]">Already onboarded? <Link href="/hospital/login" className="text-[#a855f7] hover:underline">Sign in</Link></div>
      </div>
    </div>
  )
}
function Field({ l, children }) { return <div><label className="text-xs uppercase tracking-wider text-[#6a8099] mb-1 block">{l}</label>{children}</div> }
