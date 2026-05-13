'use client'
import HospitalShell from '@/components/HospitalShell'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import StaffVerification from '@/components/StaffVerification'
import { Plus, Trash2, Camera, Loader2, AlertTriangle, Upload } from 'lucide-react'

const DEPARTMENTS = ['General Medicine','Cardiology','Endocrinology','Orthopedics','Neurology','Dermatology','Gynecology','Pediatrics','Psychiatry','ENT','Ophthalmology','Oncology','Nephrology','Urology','Gastroenterology','Emergency','Surgery','Radiology','Physiotherapy','Other']
const FREQ = ['OD','BD','TDS','QID','SOS']
const DIAG_SUGG = ['Hypertension','Type 2 Diabetes','Asthma','Viral fever','URTI','UTI','Migraine','Gastritis','Allergic rhinitis','Hypothyroidism']

export default function NewVisitPage() { return <HospitalShell><Inner /></HospitalShell> }
function Inner() {
  const sp = useSearchParams()
  const router = useRouter()
  const mediId = sp.get('mediId')
  const [token, setToken] = useState(null)
  const [showVerify, setShowVerify] = useState(true)
  const [patient, setPatient] = useState(null)
  const [form, setForm] = useState({
    visit_date: new Date().toISOString().slice(0, 16),
    department: 'General Medicine', chief_complaint: '', diagnosis: [], notes: '', follow_up_date: '',
    prescriptions: [], reports: [],
  })
  const [diagInput, setDiagInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!mediId) { router.push('/hospital/search'); return }
    fetch(`/api/hospital/patient/${encodeURIComponent(mediId)}`).then(r => r.ok ? r.json() : null).then(d => { if (d) setPatient(d.patient) })
  }, [mediId])

  const addRx = () => setForm(f => ({ ...f, prescriptions: [...f.prescriptions, { drug_name: '', dosage: '', frequency: 'OD', duration_days: '', instructions: '' }] }))
  const updRx = (i, k, v) => setForm(f => ({ ...f, prescriptions: f.prescriptions.map((r, idx) => idx === i ? { ...r, [k]: v } : r) }))
  const rmRx = (i) => setForm(f => ({ ...f, prescriptions: f.prescriptions.filter((_, idx) => idx !== i) }))

  const scanRx = async (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      toast.loading('Scanning prescription with Gemini Vision…', { id: 'ocr' })
      try {
        const r = await fetch('/api/ai/ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: reader.result }) }).then(r => r.json())
        if (r.items?.length) {
          setForm(f => ({ ...f, prescriptions: [...f.prescriptions, ...r.items.map(it => ({ ...it, _scanned: true, frequency: it.frequency || 'OD' }))] }))
          toast.success(`Scanned ${r.items.length} medication${r.items.length !== 1 ? 's' : ''}`, { id: 'ocr' })
        } else toast.error('No medications detected', { id: 'ocr' })
      } catch { toast.error('OCR failed', { id: 'ocr' }) }
    }
    reader.readAsDataURL(file)
  }

  const onReport = (file) => {
    if (!file) return
    if (file.size > 4 * 1024 * 1024) return toast.error('< 4MB')
    const reader = new FileReader()
    reader.onload = () => setForm(f => ({ ...f, reports: [...f.reports, { title: file.name, report_type: 'lab', report_date: new Date().toISOString().slice(0, 10), file_data: reader.result }] }))
    reader.readAsDataURL(file)
  }
  const updReport = (i, k, v) => setForm(f => ({ ...f, reports: f.reports.map((r, idx) => idx === i ? { ...r, [k]: v } : r) }))
  const rmReport = (i) => setForm(f => ({ ...f, reports: f.reports.filter((_, idx) => idx !== i) }))

  const submit = async () => {
    if (!token) return toast.error('Staff verification required')
    setSaving(true)
    try {
      const r = await fetch(`/api/hospital/patient/${encodeURIComponent(mediId)}/visit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, _verification_token: token }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed')
      toast.success('Visit saved!')
      router.push(`/hospital/patient/${encodeURIComponent(mediId)}`)
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  if (showVerify && !token) return <StaffVerification onVerified={(t) => { setToken(t); setShowVerify(false); toast.success('Verified — you may now create the visit') }} onCancel={() => router.back()} />

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">New Visit — {patient?.full_name || '…'}</h1>
      <div className="font-mono text-xs text-[#a855f7] mb-1">{mediId}</div>
      {patient?.allergies?.length > 0 && (
        <div className="mb-4 p-2 rounded-md inline-flex items-center gap-2 text-xs" style={{ background: 'rgba(255,82,82,0.1)', color: '#ff5252', border: '1px solid #ff5252' }}><AlertTriangle className="w-3 h-3" /> Allergies: {patient.allergies.join(' · ')}</div>
      )}

      <div className="card-accent-purple p-5 mb-4">
        <h2 className="text-sm font-semibold mb-3 uppercase tracking-wider text-[#a855f7]">Visit details</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <Field l="Date & time"><input type="datetime-local" className="input-dark" value={form.visit_date} onChange={e => setForm({ ...form, visit_date: e.target.value })} /></Field>
          <Field l="Department"><select className="input-dark" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></Field>
        </div>
        <div className="mt-3"><Field l="Chief complaint"><textarea className="input-dark min-h-[60px]" value={form.chief_complaint} onChange={e => setForm({ ...form, chief_complaint: e.target.value })} /></Field></div>
        <div className="mt-3"><Field l="Diagnosis (press Enter to add)">
          <div className="flex flex-wrap gap-2 mb-2">{form.diagnosis.map(d => <span key={d} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(0,229,255,0.12)', color: '#00e5ff', border: '1px solid #00e5ff' }}>{d} <button onClick={() => setForm({ ...form, diagnosis: form.diagnosis.filter(x => x !== d) })}>×</button></span>)}</div>
          <input className="input-dark" value={diagInput} onChange={e => setDiagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (diagInput.trim()) { setForm(f => ({ ...f, diagnosis: [...f.diagnosis, diagInput.trim()] })); setDiagInput('') } } }} />
          <div className="flex flex-wrap gap-1 mt-2">{DIAG_SUGG.filter(s => !form.diagnosis.includes(s)).slice(0, 8).map(s => <button key={s} onClick={() => setForm(f => ({ ...f, diagnosis: [...f.diagnosis, s] }))} className="text-[10px] px-2 py-0.5 rounded-full text-[#6a8099] hover:text-[#e2e8f4]" style={{ border: '1px dashed #1e2a40' }}>+ {s}</button>)}</div>
        </Field></div>
        <div className="mt-3"><Field l="Clinical notes"><textarea className="input-dark min-h-[100px]" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field></div>
        <div className="mt-3"><Field l="Follow-up date"><input type="date" className="input-dark" value={form.follow_up_date} onChange={e => setForm({ ...form, follow_up_date: e.target.value })} /></Field></div>
      </div>

      <div className="card-accent-purple p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#a855f7]">Prescriptions</h2>
          <div className="flex gap-2">
            <label className="text-xs inline-flex items-center gap-1 cursor-pointer text-[#6a8099] hover:text-[#a855f7]"><Camera className="w-3 h-3" /> Scan prescription<input type="file" accept="image/*" className="hidden" onChange={e => scanRx(e.target.files?.[0])} /></label>
            <button onClick={addRx} className="text-xs text-[#a855f7] inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Add row</button>
          </div>
        </div>
        {form.prescriptions.length === 0 ? <div className="text-xs text-[#6a8099] text-center py-4">No prescriptions yet. Add a row or scan a paper script.</div>
          : <div className="space-y-2">{form.prescriptions.map((p, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center p-2 rounded-md" style={{ background: '#0b0e14', border: '1px solid #1e2a40' }}>
              <input placeholder="Drug name" className="input-dark col-span-3 py-1.5 text-sm" value={p.drug_name || ''} onChange={e => updRx(i, 'drug_name', e.target.value)} />
              <input placeholder="Dosage" className="input-dark col-span-2 py-1.5 text-sm" value={p.dosage || ''} onChange={e => updRx(i, 'dosage', e.target.value)} />
              <select className="input-dark col-span-2 py-1.5 text-sm" value={p.frequency || 'OD'} onChange={e => updRx(i, 'frequency', e.target.value)}>{FREQ.map(f => <option key={f} value={f}>{f}</option>)}</select>
              <input type="number" placeholder="Days" className="input-dark col-span-2 py-1.5 text-sm" value={p.duration_days || ''} onChange={e => updRx(i, 'duration_days', e.target.value)} />
              <input placeholder="Instructions" className="input-dark col-span-2 py-1.5 text-sm" value={p.instructions || ''} onChange={e => updRx(i, 'instructions', e.target.value)} />
              <button onClick={() => rmRx(i)} className="col-span-1 text-[#ff5252] hover:bg-[#ff525220] rounded p-1"><Trash2 className="w-3 h-3" /></button>
              {p._scanned && <span className="col-span-12 text-[10px] text-[#a855f7] -mt-1">📷 Auto-scanned</span>}
            </div>
          ))}</div>}
      </div>

      <div className="card-accent-purple p-5 mb-4">
        <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-semibold uppercase tracking-wider text-[#a855f7]">Reports</h2>
          <label className="text-xs inline-flex items-center gap-1 cursor-pointer text-[#a855f7]"><Upload className="w-3 h-3" /> Add report<input type="file" className="hidden" accept="application/pdf,image/*" onChange={e => onReport(e.target.files?.[0])} /></label>
        </div>
        {form.reports.length === 0 ? <div className="text-xs text-[#6a8099] text-center py-4">No reports attached.</div>
          : <div className="space-y-2">{form.reports.map((r, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center p-2 rounded-md" style={{ background: '#0b0e14', border: '1px solid #1e2a40' }}>
              <input className="input-dark col-span-6 py-1.5 text-sm" value={r.title} onChange={e => updReport(i, 'title', e.target.value)} />
              <select className="input-dark col-span-3 py-1.5 text-sm" value={r.report_type} onChange={e => updReport(i, 'report_type', e.target.value)}>{['lab','xray','mri','ecg','ultrasound','other'].map(t => <option key={t} value={t}>{t}</option>)}</select>
              <input type="date" className="input-dark col-span-2 py-1.5 text-sm" value={r.report_date} onChange={e => updReport(i, 'report_date', e.target.value)} />
              <button onClick={() => rmReport(i)} className="col-span-1 text-[#ff5252]"><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}</div>}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-[#6a8099]">Verified as staff ✓ — token saved for this session.</div>
        <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg px-6 py-2.5 font-semibold" style={{ background: '#a855f7', color: '#0b0e14' }}>{saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save visit'}</button>
      </div>
    </div>
  )
}
function Field({ l, children }) { return <div><label className="text-xs uppercase tracking-wider text-[#6a8099] mb-1 block">{l}</label>{children}</div> }
