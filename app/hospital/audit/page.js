'use client'
import HospitalShell from '@/components/HospitalShell'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { AlertTriangle, Shield } from 'lucide-react'

export default function HAudit() { return <HospitalShell><Inner /></HospitalShell> }
function Inner() {
  const [data, setData] = useState(null)
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState({})
  useEffect(() => { fetch(`/api/hospital/audit${filter ? `?action=${filter}` : ''}`).then(r => r.json()).then(setData) }, [filter])
  if (!data) return <div className="shimmer h-64 rounded-xl" />
  return (
    <div>
      <div className="mb-6"><h1 className="text-3xl font-bold">Audit Log</h1><p className="text-[#6a8099] text-sm mt-1 inline-flex items-center gap-2"><Shield className="w-3 h-3" /> Complete immutable activity trail</p></div>
      {data.recentFails > 0 && <div className="mb-4 p-3 rounded-lg inline-flex items-center gap-2 text-sm" style={{ background: 'rgba(255,82,82,0.1)', color: '#ff5252', border: '1px solid #ff5252' }}><AlertTriangle className="w-4 h-4" /> {data.recentFails} verification failure{data.recentFails !== 1 ? 's' : ''} in last 24h</div>}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['','record_viewed','visit_created','prescription_uploaded','report_uploaded','consent_granted','consent_revoked','verification_failed','verification_passed'].map(a => (
          <button key={a || 'all'} onClick={() => setFilter(a)} className="px-3 py-1 rounded-full text-xs capitalize" style={{ background: filter === a ? '#a855f7' : '#111520', color: filter === a ? '#0b0e14' : '#e2e8f4', border: '1px solid #1e2a40' }}>{a ? a.replace(/_/g, ' ') : 'All'}</button>
        ))}
      </div>
      <div className="card-accent-purple overflow-hidden">
        <table className="w-full text-sm"><thead><tr className="text-left text-[10px] uppercase tracking-wider text-[#6a8099]" style={{ borderBottom: '1px solid #1e2a40' }}>
          <th className="px-4 py-2">Timestamp</th><th className="px-4 py-2">Action</th><th className="px-4 py-2">Patient</th><th className="px-4 py-2">Staff</th><th></th>
        </tr></thead><tbody>
          {data.logs.length === 0 ? <tr><td colSpan="5" className="text-center py-6 text-sm text-[#6a8099]">No events.</td></tr> :
            data.logs.map(a => <>
              <tr key={a.id} style={{ borderBottom: '1px solid #1e2a40' }}>
                <td className="px-4 py-2 font-mono text-xs text-[#a855f7]">{format(new Date(a.created_at), 'dd MMM HH:mm:ss')}</td>
                <td className="px-4 py-2 text-xs"><ActionBadge t={a.action_type} /></td>
                <td className="px-4 py-2 text-xs">{a.patient?.full_name || '—'} {a.patient?.medi_id && <span className="font-mono text-[10px] text-[#6a8099]"> · {a.patient.medi_id}</span>}</td>
                <td className="px-4 py-2 text-xs">{a.staff?.full_name || '—'} {a.staff && <span className="text-[10px] text-[#6a8099] capitalize"> · {a.staff.role}</span>}</td>
                <td className="px-4 py-2"><button onClick={() => setExpanded(e => ({ ...e, [a.id]: !e[a.id] }))} className="text-[10px] text-[#a855f7]">{expanded[a.id] ? 'Hide' : 'Meta'}</button></td>
              </tr>
              {expanded[a.id] && <tr><td colSpan="5" className="px-4 py-2 text-[10px] font-mono text-[#6a8099]" style={{ background: '#0b0e14' }}>{JSON.stringify(a.metadata || {}, null, 2)}</td></tr>}
            </>)}
        </tbody></table>
      </div>
    </div>
  )
}
function ActionBadge({ t }) {
  const m = {
    record_viewed: { c: '#00e5ff' }, visit_created: { c: '#00e676' }, prescription_uploaded: { c: '#00e676' }, report_uploaded: { c: '#00e676' },
    consent_granted: { c: '#ffab40' }, consent_revoked: { c: '#ffab40' },
    verification_failed: { c: '#ff5252' }, verification_passed: { c: '#00e676' },
  }[t] || { c: '#6a8099' }
  return <span className="text-[10px] px-2 py-0.5 rounded-full inline-block capitalize" style={{ background: m.c + '20', color: m.c, border: `1px solid ${m.c}` }}>{t.replace(/_/g, ' ')}</span>
}
