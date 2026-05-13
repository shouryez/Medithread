'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { QRCodeCanvas } from 'qrcode.react'
import Logo from '@/components/Logo'
import { ArrowRight, ArrowLeft, Loader2, X, Plus, CheckCircle2, Sparkles, Copy } from 'lucide-react'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const CITIES = ['Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad', 'Indore']
const ALLERGY_SUGGESTIONS = ['Penicillin', 'Sulfa', 'Aspirin', 'Ibuprofen', 'Latex', 'Peanuts', 'Shellfish']
const CONDITION_SUGGESTIONS = ['Diabetes', 'Hypertension', 'Asthma', 'Thyroid', 'Heart Disease', 'Arthritis']

export default function Register() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [form, setForm] = useState({
    full_name: '', dob: '', gender: '', blood_group: '', city: 'Bangalore',
    allergies: [], chronic_conditions: [],
    emergency_contact_name: '', emergency_contact_phone: '',
  })
  const [mediResult, setMediResult] = useState(null)

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/me')
      const d = await r.json()
      if (!d.authenticated) { router.push('/login'); return }
      if (d.patient) { router.push('/dashboard'); return }
      setAuthChecked(true)
    })()
  }, [router])

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const addTag = (k, v) => { if (!v.trim()) return; if (form[k].includes(v)) return; set(k, [...form[k], v.trim()]) }
  const removeTag = (k, v) => set(k, form[k].filter(x => x !== v))

  const next = () => {
    if (step === 1) {
      if (!form.full_name) return toast.error('Enter your full name')
      if (!form.dob) return toast.error('Pick your date of birth')
      if (!form.gender) return toast.error('Select gender')
      if (!form.blood_group) return toast.error('Select blood group')
    }
    setStep(s => Math.min(3, s + 1))
  }
  const back = () => setStep(s => Math.max(1, s - 1))

  const generate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/patient/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setMediResult(data.patient)
      toast.success('MediID generated!')
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  if (!authChecked) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#00e5ff]" /></div>

  if (mediResult) {
    const emergencyUrl = `${window.location.origin}/emergency/${mediResult.medi_id}`
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', duration: 0.6 }} className="w-full max-w-lg">
          <div className="text-center mb-8">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4" style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid #00e5ff' }}>
              <Sparkles className="w-4 h-4 text-[#00e5ff]" />
              <span className="text-xs text-[#00e5ff]">MediID Generated</span>
            </motion.div>
            <h1 className="text-3xl font-bold mb-2">Welcome to MediThread, {mediResult.full_name.split(' ')[0]}</h1>
            <p className="text-[#6a8099]">This is your lifelong health ID. Save it somewhere safe.</p>
          </div>
          <div className="card-accent-cyan p-8">
            <div className="flex flex-col items-center">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="font-mono text-2xl md:text-3xl font-bold text-[#00e5ff] tracking-wider mb-6">
                {mediResult.medi_id}
              </motion.div>
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.6 }} className="p-4 rounded-xl" style={{ background: '#0b0e14', border: '1px solid #1e2a40' }}>
                <QRCodeCanvas value={emergencyUrl} size={180} bgColor="#0b0e14" fgColor="#00e5ff" level="H" />
              </motion.div>
              <button onClick={() => { navigator.clipboard.writeText(mediResult.medi_id); toast.success('MediID copied') }} className="mt-6 text-sm text-[#6a8099] hover:text-[#00e5ff] inline-flex items-center gap-2">
                <Copy className="w-4 h-4" /> Copy MediID
              </button>
            </div>
          </div>
          <button onClick={() => router.push('/dashboard')} className="btn-primary w-full mt-6 inline-flex items-center justify-center gap-2">Go to Dashboard <ArrowRight className="w-4 h-4" /></button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-10" style={{ background: '#0b0e14' }}>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6"><Logo size="lg" /></div>

        {/* progress */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map(n => (
            <div key={n} className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#111520' }}>
              <motion.div initial={false} animate={{ width: step >= n ? '100%' : '0%' }} className="h-full" style={{ background: '#00e5ff' }} />
            </div>
          ))}
        </div>

        <div className="card-accent-cyan p-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-bold mb-1">Tell us about you</h2>
                <p className="text-sm text-[#6a8099] mb-6">Step 1 of 3 · Personal details</p>
                <div className="space-y-4">
                  <Field label="Full name"><input className="input-dark" value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Your name as on Aadhaar" /></Field>
                  <Field label="Date of birth"><input type="date" className="input-dark" value={form.dob} onChange={e => set('dob', e.target.value)} /></Field>
                  <Field label="Gender">
                    <div className="flex gap-2">
                      {['male', 'female', 'other'].map(g => (
                        <button key={g} onClick={() => set('gender', g)} className="px-4 py-2 rounded-full text-sm capitalize transition" style={{ background: form.gender === g ? '#00e5ff' : '#111520', color: form.gender === g ? '#001318' : '#e2e8f4', border: form.gender === g ? '1px solid #00e5ff' : '1px solid #1e2a40' }}>{g}</button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Blood group">
                    <div className="grid grid-cols-4 gap-2">
                      {BLOOD_GROUPS.map(bg => (
                        <button key={bg} onClick={() => set('blood_group', bg)} className="py-2 rounded-md text-sm font-mono font-semibold transition" style={{ background: form.blood_group === bg ? '#00e5ff' : '#111520', color: form.blood_group === bg ? '#001318' : '#e2e8f4', border: form.blood_group === bg ? '1px solid #00e5ff' : '1px solid #1e2a40' }}>{bg}</button>
                      ))}
                    </div>
                  </Field>
                  <Field label="City">
                    <select className="input-dark" value={form.city} onChange={e => set('city', e.target.value)}>
                      {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>
              </motion.div>
            )}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-bold mb-1">Medical profile</h2>
                <p className="text-sm text-[#6a8099] mb-6">Step 2 of 3 · This appears on your emergency card</p>
                <TagInput label="Allergies" tone="danger" values={form.allergies} suggestions={ALLERGY_SUGGESTIONS} onAdd={v => addTag('allergies', v)} onRemove={v => removeTag('allergies', v)} />
                <div className="h-4" />
                <TagInput label="Chronic conditions" tone="cyan" values={form.chronic_conditions} suggestions={CONDITION_SUGGESTIONS} onAdd={v => addTag('chronic_conditions', v)} onRemove={v => removeTag('chronic_conditions', v)} />
                <div className="h-4" />
                <Field label="Emergency contact name"><input className="input-dark" value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} placeholder="e.g., Spouse, Parent" /></Field>
                <div className="h-4" />
                <Field label="Emergency contact phone"><input className="input-dark" value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} placeholder="+91 …" /></Field>
              </motion.div>
            )}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-bold mb-1">Review & generate</h2>
                <p className="text-sm text-[#6a8099] mb-6">Step 3 of 3 · We'll create your lifelong MediID</p>
                <div className="space-y-3 text-sm">
                  <Row label="Name" value={form.full_name} />
                  <Row label="DOB" value={form.dob} />
                  <Row label="Gender" value={form.gender} />
                  <Row label="Blood Group" value={form.blood_group} />
                  <Row label="City" value={form.city} />
                  <Row label="Allergies" value={form.allergies.length ? form.allergies.join(', ') : '—'} />
                  <Row label="Conditions" value={form.chronic_conditions.length ? form.chronic_conditions.join(', ') : '—'} />
                  <Row label="Emergency" value={form.emergency_contact_name ? `${form.emergency_contact_name} · ${form.emergency_contact_phone}` : '—'} />
                </div>
                <button onClick={generate} disabled={loading} className="btn-primary w-full mt-8 inline-flex items-center justify-center gap-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating your MediID…</> : <><Sparkles className="w-4 h-4" /> Generate MediID</>}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {step < 3 && (
          <div className="flex items-center justify-between mt-6">
            <button onClick={back} disabled={step === 1} className="btn-secondary inline-flex items-center gap-2 disabled:opacity-30"><ArrowLeft className="w-4 h-4" /> Back</button>
            <button onClick={next} className="btn-primary inline-flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></button>
          </div>
        )}
        {step === 3 && (
          <div className="flex items-center justify-between mt-6">
            <button onClick={back} className="btn-secondary inline-flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return <div><label className="text-xs uppercase tracking-wider text-[#6a8099] mb-2 block">{label}</label>{children}</div>
}
function Row({ label, value }) {
  return <div className="flex items-start justify-between gap-4 py-2 border-b" style={{ borderColor: '#1e2a40' }}>
    <span className="text-[#6a8099] text-xs uppercase tracking-wider">{label}</span>
    <span className="text-right text-[#e2e8f4]">{value}</span>
  </div>
}

function TagInput({ label, tone, values, suggestions, onAdd, onRemove }) {
  const [input, setInput] = useState('')
  const colors = tone === 'danger'
    ? { bg: 'rgba(255,82,82,0.12)', text: '#ff5252', border: '#ff5252' }
    : { bg: 'rgba(0,229,255,0.12)', text: '#00e5ff', border: '#00e5ff' }
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-[#6a8099] mb-2 block">{label}</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {values.map(v => (
          <span key={v} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium" style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
            {v} <button onClick={() => onRemove(v)}><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="input-dark flex-1" placeholder={`Add ${label.toLowerCase()}…`} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd(input); setInput('') } }} />
        <button onClick={() => { onAdd(input); setInput('') }} className="btn-secondary px-3"><Plus className="w-4 h-4" /></button>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {suggestions.filter(s => !values.includes(s)).map(s => (
          <button key={s} onClick={() => onAdd(s)} className="text-xs px-2 py-1 rounded-full text-[#6a8099] hover:text-[#e2e8f4]" style={{ border: '1px dashed #1e2a40' }}>+ {s}</button>
        ))}
      </div>
    </div>
  )
}
