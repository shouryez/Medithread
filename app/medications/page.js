'use client'
import PatientShell from '@/components/PatientShell'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { format, differenceInDays } from 'date-fns'
import { Plus, X, Pill, AlertTriangle, Bell, BellOff } from 'lucide-react'

export default function MedicationsPage() { return <PatientShell><Inner /></PatientShell> }

function Inner() {
  const [tab, setTab] = useState('active')
  const [data, setData] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  const load = async () => setData(await fetch('/api/medications').then(r => r.json()))
  useEffect(() => { load() }, [])

  const update = async (id, patch) => {
    await fetch(`/api/medications/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    await load()
  }

  if (!data) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="shimmer h-24 rounded-xl" />)}</div>

  const list = tab === 'active' ? data.active : data.past

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Medications</h1>
          <p className="text-[#6a8099] text-sm mt-1">{data.active.length} active · {data.past.length} past</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Add self-medication</button>
      </div>

      {data.active.length >= 2 && (
        <div className="mb-4 p-3 rounded-xl flex items-center gap-3 text-sm" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.3)' }}>
          <AlertTriangle className="w-4 h-4 text-[#a855f7]" />
          <span>You have multiple active medications. Always inform your doctor of all current drugs to avoid interactions.</span>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {['active', 'past'].map(t => (
          <button key={t} onClick={() => setTab(t)} className="px-4 py-2 rounded-full text-sm capitalize transition" style={{ background: tab === t ? '#00e5ff' : '#111520', color: tab === t ? '#001318' : '#e2e8f4', border: '1px solid #1e2a40' }}>{t}</button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="card-accent-cyan p-12 text-center">
          <Pill className="w-10 h-10 mx-auto text-[#6a8099] mb-3" />
          <div className="text-lg font-semibold mb-1">No {tab} medications</div>
          <div className="text-sm text-[#6a8099]">{tab === 'active' ? 'Add a self-medication or wait for a doctor to prescribe.' : 'Past medications will appear here.'}</div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {list.map(m => {
            const start = m.start_date ? new Date(m.start_date) : new Date(m.created_at)
            const total = m.duration_days || 0
            const elapsed = total ? differenceInDays(new Date(), start) : 0
            const remaining = total ? Math.max(0, total - elapsed) : null
            const pct = total ? Math.min(100, (elapsed / total) * 100) : 0
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="card-accent-cyan p-4" style={{ opacity: m.is_active ? 1 : 0.7 }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-lg">{m.drug_name}</div>
                    <div className="text-sm text-[#6a8099]">{m.dosage} · {m.frequency} {m.duration_days ? `· ${m.duration_days} days` : ''}</div>
                    <div className="text-xs text-[#6a8099] mt-1">
                      {m.prescribed_by ? `Prescribed by ${m.hospital?.name || 'Doctor'}` : 'Self-medication'} · {format(start, 'dd MMM yyyy')}
                    </div>
                  </div>
                  {m.is_active ? <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,230,118,0.12)', color: '#00e676', border: '1px solid #00e676' }}>Active</span>
                              : <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(106,128,153,0.12)', color: '#6a8099', border: '1px solid #6a8099' }}>Completed</span>}
                </div>
                {total > 0 && (
                  <div className="mt-3">
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#0b0e14' }}>
                      <div className="h-full transition-all" style={{ width: `${pct}%`, background: pct > 80 ? '#ffab40' : '#00e5ff' }} />
                    </div>
                    <div className="text-xs text-[#6a8099] mt-1">{remaining} day{remaining !== 1 ? 's' : ''} remaining</div>
                    {remaining !== null && remaining < 7 && m.is_active && (
                      <div className="mt-2 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded" style={{ background: 'rgba(255,171,64,0.12)', color: '#ffab40', border: '1px solid #ffab40' }}><AlertTriangle className="w-3 h-3" /> Refill soon</div>
                    )}
                  </div>
                )}
                {m.instructions && <div className="text-xs italic text-[#6a8099] mt-3">{m.instructions}</div>}
                {m.is_active && (
                  <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t" style={{ borderColor: '#1e2a40' }}>
                    <button onClick={() => update(m.id, { reminder_enabled: !m.reminder_enabled })} className="text-xs inline-flex items-center gap-1" style={{ color: m.reminder_enabled ? '#00e5ff' : '#6a8099' }}>
                      {m.reminder_enabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />} {m.reminder_enabled ? 'Reminder on' : 'Set reminder'}
                    </button>
                    <button onClick={() => update(m.id, { is_active: false })} className="text-xs text-[#6a8099] hover:text-[#ff5252]">Mark completed</button>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      {showAdd && <AddMedModal onClose={() => setShowAdd(false)} onSaved={async () => { await load(); setShowAdd(false) }} />}
    </div>
  )
}

function AddMedModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ drug_name: '', dosage: '', frequency: '', duration_days: '', instructions: '', start_date: new Date().toISOString().slice(0, 10) })
  const [loading, setLoading] = useState(false)
  const save = async () => {
    if (!form.drug_name) return toast.error('Drug name required')
    setLoading(true)
    try {
      const r = await fetch('/api/medications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!r.ok) throw new Error('Failed')
      toast.success('Medication added')
      onSaved()
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md card-accent-cyan p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">Add medication</h2><button onClick={onClose}><X className="w-4 h-4 text-[#6a8099]" /></button></div>
        <div className="space-y-3">
          <Label l="Drug name"><input className="input-dark" value={form.drug_name} onChange={e => setForm({ ...form, drug_name: e.target.value })} /></Label>
          <Label l="Dosage"><input className="input-dark" placeholder="e.g., 500mg" value={form.dosage} onChange={e => setForm({ ...form, dosage: e.target.value })} /></Label>
          <Label l="Frequency"><input className="input-dark" placeholder="e.g., Twice daily" value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} /></Label>
          <div className="grid grid-cols-2 gap-3">
            <Label l="Duration (days)"><input type="number" className="input-dark" value={form.duration_days} onChange={e => setForm({ ...form, duration_days: e.target.value })} /></Label>
            <Label l="Start date"><input type="date" className="input-dark" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></Label>
          </div>
          <Label l="Notes"><textarea className="input-dark min-h-[60px]" value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} /></Label>
        </div>
        <button onClick={save} disabled={loading} className="btn-primary w-full mt-4">{loading ? 'Saving…' : 'Save medication'}</button>
      </motion.div>
    </div>
  )
}
function Label({ l, children }) { return <div><label className="text-xs uppercase tracking-wider text-[#6a8099] mb-1 block">{l}</label>{children}</div> }
