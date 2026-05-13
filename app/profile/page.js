'use client'
import PatientShell from '@/components/PatientShell'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { X, Plus } from 'lucide-react'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const CITIES = ['Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad', 'Indore']

export default function ProfilePage() { return <PatientShell><Inner /></PatientShell> }

function Inner() {
  const [p, setP] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => setP(d.patient))
  }, [])

  const set = (k, v) => setP(prev => ({ ...prev, [k]: v }))
  const addTag = (k, v) => { if (!v.trim()) return; if (p[k].includes(v)) return; set(k, [...(p[k] || []), v.trim()]) }
  const rmTag = (k, v) => set(k, (p[k] || []).filter(x => x !== v))

  const save = async () => {
    setSaving(true)
    try {
      const r = await fetch('/api/patient/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })
      if (!r.ok) throw new Error('Failed')
      toast.success('Profile updated')
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  if (!p) return <div className="shimmer h-64 rounded-xl" />

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Profile</h1>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card-accent-cyan p-5">
          <div className="text-xs uppercase tracking-wider text-[#6a8099] mb-3 font-semibold">Personal</div>
          <div className="space-y-3">
            <Field l="Full name"><input className="input-dark" value={p.full_name || ''} onChange={e => set('full_name', e.target.value)} /></Field>
            <Field l="Date of birth"><input type="date" className="input-dark" value={p.dob || ''} onChange={e => set('dob', e.target.value)} /></Field>
            <Field l="Gender">
              <div className="flex gap-2">{['male','female','other'].map(g => <button key={g} onClick={() => set('gender', g)} className="px-3 py-1.5 rounded-full text-xs capitalize" style={{ background: p.gender === g ? '#00e5ff' : '#111520', color: p.gender === g ? '#001318' : '#e2e8f4', border: '1px solid #1e2a40' }}>{g}</button>)}</div>
            </Field>
            <Field l="City"><select className="input-dark" value={p.city || 'Bangalore'} onChange={e => set('city', e.target.value)}>{CITIES.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
            <Field l="Phone"><input className="input-dark font-mono" value={p.phone || ''} disabled /></Field>
          </div>
        </div>

        <div className="card-accent-cyan p-5">
          <div className="text-xs uppercase tracking-wider text-[#6a8099] mb-3 font-semibold">Medical</div>
          <div className="space-y-3">
            <Field l="Blood group">
              <div className="grid grid-cols-4 gap-2">{BLOOD_GROUPS.map(bg => <button key={bg} onClick={() => set('blood_group', bg)} className="py-2 rounded text-xs font-mono font-semibold" style={{ background: p.blood_group === bg ? '#00e5ff' : '#111520', color: p.blood_group === bg ? '#001318' : '#e2e8f4', border: '1px solid #1e2a40' }}>{bg}</button>)}</div>
            </Field>
            <Tags l="Allergies" tone="danger" values={p.allergies || []} onAdd={v => addTag('allergies', v)} onRemove={v => rmTag('allergies', v)} />
            <Tags l="Chronic conditions" tone="cyan" values={p.chronic_conditions || []} onAdd={v => addTag('chronic_conditions', v)} onRemove={v => rmTag('chronic_conditions', v)} />
            <Field l="Emergency contact name"><input className="input-dark" value={p.emergency_contact_name || ''} onChange={e => set('emergency_contact_name', e.target.value)} /></Field>
            <Field l="Emergency contact phone"><input className="input-dark" value={p.emergency_contact_phone || ''} onChange={e => set('emergency_contact_phone', e.target.value)} /></Field>
          </div>
        </div>
      </div>
      <button onClick={save} disabled={saving} className="btn-primary mt-6">{saving ? 'Saving…' : 'Save changes'}</button>
    </div>
  )
}

function Field({ l, children }) { return <div><label className="text-xs uppercase tracking-wider text-[#6a8099] mb-1 block">{l}</label>{children}</div> }
function Tags({ l, tone, values, onAdd, onRemove }) {
  const [v, setV] = useState('')
  const c = tone === 'danger' ? { bg: 'rgba(255,82,82,0.12)', text: '#ff5252', border: '#ff5252' } : { bg: 'rgba(0,229,255,0.12)', text: '#00e5ff', border: '#00e5ff' }
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-[#6a8099] mb-2 block">{l}</label>
      <div className="flex flex-wrap gap-2 mb-2">{values.map(x => <span key={x} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs" style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>{x} <button onClick={() => onRemove(x)}><X className="w-3 h-3" /></button></span>)}</div>
      <div className="flex gap-2"><input className="input-dark flex-1" value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd(v); setV('') } }} /><button onClick={() => { onAdd(v); setV('') }} className="btn-secondary px-3"><Plus className="w-4 h-4" /></button></div>
    </div>
  )
}
