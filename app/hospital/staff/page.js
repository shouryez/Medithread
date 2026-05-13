'use client'
import HospitalShell from '@/components/HospitalShell'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { Plus, X, UserCheck } from 'lucide-react'

export default function HStaff() { return <HospitalShell><Inner /></HospitalShell> }
function Inner() {
  const [list, setList] = useState(null)
  const [show, setShow] = useState(false)
  const load = async () => setList((await fetch('/api/hospital/staff').then(r => r.json())).staff)
  useEffect(() => { load() }, [])
  if (!list) return <div className="shimmer h-64 rounded-xl" />
  return (
    <div>
      <div className="flex items-center justify-between mb-6"><div><h1 className="text-3xl font-bold">Staff</h1><p className="text-[#6a8099] text-sm mt-1">{list.length} member{list.length !== 1 ? 's' : ''}</p></div><button onClick={() => setShow(true)} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-sm" style={{ background: '#a855f7', color: '#0b0e14' }}><Plus className="w-4 h-4" /> Invite staff</button></div>
      <div className="card-accent-purple overflow-hidden"><table className="w-full text-sm"><thead><tr className="text-left text-[10px] uppercase tracking-wider text-[#6a8099]" style={{ borderBottom: '1px solid #1e2a40' }}><th className="px-4 py-2">Name</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">Role</th><th className="px-4 py-2">Verified</th><th className="px-4 py-2">Joined</th></tr></thead><tbody>{list.map(s => <tr key={s.id} style={{ borderBottom: '1px solid #1e2a40' }}><td className="px-4 py-2">{s.full_name}</td><td className="px-4 py-2 text-[#6a8099]">{s.email}</td><td className="px-4 py-2"><span className="text-[10px] px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '1px solid #a855f7' }}>{s.role}</span></td><td className="px-4 py-2">{s.is_verified ? <UserCheck className="w-4 h-4 text-[#00e676]" /> : <span className="text-xs text-[#ffab40]">Pending</span>}</td><td className="px-4 py-2 text-xs text-[#6a8099]">{format(new Date(s.created_at), 'dd MMM yyyy')}</td></tr>)}</tbody></table></div>
      {show && <Invite onClose={() => setShow(false)} onSaved={async () => { await load(); setShow(false) }} />}
    </div>
  )
}
function Invite({ onClose, onSaved }) {
  const [form, setForm] = useState({ full_name: '', email: '', role: 'doctor', password: '' })
  const [loading, setLoading] = useState(false)
  const save = async () => {
    if (!form.full_name || !form.email) return toast.error('Name and email required')
    setLoading(true)
    try {
      const r = await fetch('/api/hospital/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Failed')
      toast.success('Staff invited'); onSaved()
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md card-accent-purple p-6" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">Invite staff</h2><button onClick={onClose}><X className="w-4 h-4 text-[#6a8099]" /></button></div>
      <div className="space-y-3">
        <Field l="Full name"><input className="input-dark" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></Field>
        <Field l="Work email"><input type="email" className="input-dark" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
        <Field l="Role"><select className="input-dark" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{['doctor','nurse','receptionist','admin'].map(r => <option key={r} value={r}>{r}</option>)}</select></Field>
        <Field l="Initial password"><input type="password" className="input-dark" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="≥ 6 chars" /></Field>
      </div>
      <button onClick={save} disabled={loading} className="w-full mt-4 rounded-lg px-4 py-2 font-semibold" style={{ background: '#a855f7', color: '#0b0e14' }}>{loading ? 'Saving…' : 'Send invite'}</button>
    </motion.div>
  </div>
}
function Field({ l, children }) { return <div><label className="text-xs uppercase tracking-wider text-[#6a8099] mb-1 block">{l}</label>{children}</div> }
