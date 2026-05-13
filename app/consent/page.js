'use client'
import PatientShell from '@/components/PatientShell'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { formatDistanceToNow, format } from 'date-fns'
import { Shield, Check, X, AlertTriangle, Plus } from 'lucide-react'

export default function ConsentPage() { return <PatientShell><Inner /></PatientShell> }

function Inner() {
  const [data, setData] = useState(null)
  const load = async () => setData(await fetch('/api/consents').then(r => r.json()))
  useEffect(() => { load() }, [])

  const act = async (id, action) => {
    const r = await fetch(`/api/consents/${id}/${action}`, { method: 'POST' })
    if (r.ok) { toast.success(`Consent ${action}d`); await load() } else toast.error('Failed')
  }

  const simulateRequest = async () => {
    const name = prompt('Demo: hospital name requesting access?', 'Fortis Healthcare')
    if (!name) return
    const r = await fetch('/api/consents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hospital_name: name }) })
    if (r.ok) { toast.success('Demo consent request created'); await load() }
  }

  if (!data) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="shimmer h-24 rounded-xl" />)}</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Consent Manager</h1>
          <p className="text-[#6a8099] text-sm mt-1">Control who sees your record · every access logged forever</p>
        </div>
        <button onClick={simulateRequest} className="btn-secondary text-xs inline-flex items-center gap-2"><Plus className="w-3 h-3" /> Simulate hospital request</button>
      </div>

      {data.pending.length > 0 && (
        <div className="mb-6 p-4 rounded-xl" style={{ background: 'rgba(255,171,64,0.05)', border: '1px solid #ffab40' }}>
          <div className="text-xs uppercase tracking-wider text-[#ffab40] mb-3 font-semibold inline-flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Pending requests</div>
          <div className="space-y-2">
            {data.pending.map(c => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3 p-3 rounded-lg" style={{ background: '#0b0e14', border: '1px solid #1e2a40' }}>
                <div>
                  <div className="font-semibold">{c.hospital?.name || 'Unknown hospital'}</div>
                  <div className="text-xs text-[#6a8099]">Requested {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => act(c.id, 'deny')} className="px-3 py-1.5 rounded-md text-xs" style={{ background: 'rgba(255,82,82,0.12)', color: '#ff5252', border: '1px solid #ff5252' }}><X className="w-3 h-3 inline" /> Deny</button>
                  <button onClick={() => act(c.id, 'approve')} className="px-3 py-1.5 rounded-md text-xs" style={{ background: '#00e5ff', color: '#001318' }}><Check className="w-3 h-3 inline" /> Approve</button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="card-accent-cyan p-4 mb-6">
        <div className="text-xs uppercase tracking-wider text-[#6a8099] mb-3 font-semibold inline-flex items-center gap-2"><Shield className="w-4 h-4" /> Active consents</div>
        {data.active.length === 0 ? <div className="text-sm text-[#6a8099]">No active access — no one can see your record right now.</div>
          : <div className="space-y-2">
              {data.active.map(c => {
                const exp = new Date(c.expires_at)
                const mins = Math.max(0, Math.floor((exp - new Date()) / 60000))
                const expSoon = mins < 60
                return (
                  <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-lg" style={{ background: '#0b0e14', border: '1px solid #1e2a40' }}>
                    <div>
                      <div className="font-semibold">{c.hospital?.name}</div>
                      <div className="text-xs" style={{ color: expSoon ? '#ffab40' : '#6a8099' }}>Expires in {Math.floor(mins / 60)}h {mins % 60}m</div>
                    </div>
                    <button onClick={() => act(c.id, 'revoke')} className="text-xs text-[#ff5252] hover:underline">Revoke now</button>
                  </div>
                )
              })}
            </div>}
      </div>

      <div className="card-accent-cyan overflow-hidden">
        <div className="p-4 border-b" style={{ borderColor: '#1e2a40' }}>
          <div className="text-xs uppercase tracking-wider text-[#6a8099] font-semibold">Access log · last 50 events</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[10px] uppercase tracking-wider text-[#6a8099]" style={{ borderBottom: '1px solid #1e2a40' }}>
              <th className="px-4 py-2">Time</th><th className="px-4 py-2">Action</th><th className="px-4 py-2">Hospital</th><th className="px-4 py-2">Role</th>
            </tr></thead>
            <tbody>
              {data.audit.length === 0 ? <tr><td colSpan="4" className="px-4 py-6 text-center text-[#6a8099] text-xs">No events yet</td></tr> :
                data.audit.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #1e2a40' }}>
                    <td className="px-4 py-2 font-mono text-xs text-[#a855f7]">{format(new Date(a.created_at), 'dd MMM HH:mm')}</td>
                    <td className="px-4 py-2 text-xs"><ActionBadge t={a.action_type} /></td>
                    <td className="px-4 py-2 text-xs">{a.hospital?.name || '—'}</td>
                    <td className="px-4 py-2 text-xs text-[#6a8099] capitalize">{a.performed_by_role}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ActionBadge({ t }) {
  const map = {
    consent_granted: { c: '#00e676', l: 'Approved' },
    consent_revoked: { c: '#ff5252', l: 'Revoked/Denied' },
    record_viewed: { c: '#a855f7', l: 'Record viewed' },
    visit_created: { c: '#00e5ff', l: 'Visit added' },
    prescription_uploaded: { c: '#ffab40', l: 'Prescription' },
    report_uploaded: { c: '#00e5ff', l: 'Report' },
    verification_passed: { c: '#00e676', l: 'Verified' },
    verification_failed: { c: '#ff5252', l: 'Verify failed' },
  }
  const m = map[t] || { c: '#6a8099', l: t }
  return <span className="text-[10px] px-2 py-0.5 rounded-full inline-block" style={{ background: m.c + '20', color: m.c, border: `1px solid ${m.c}` }}>{m.l}</span>
}
