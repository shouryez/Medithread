'use client'
import HospitalShell from '@/components/HospitalShell'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { format, formatDistanceToNow } from 'date-fns'
import { Search, Users, FileWarning, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react'

export default function HDashboard() { return <HospitalShell><Inner /></HospitalShell> }
function Inner() {
  const [data, setData] = useState(null)
  const [now, setNow] = useState(new Date())
  const [seeded, setSeeded] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [inbound, setInbound] = useState([])
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  const load = async () => {
    const d = await fetch('/api/hospital/dashboard').then(r => r.json())
    setData(d)
    const st = await fetch('/api/hospital/demo/status').then(r => r.json()).catch(() => ({ seeded: false }))
    setSeeded(!!st.seeded)
    const ib = await fetch('/api/hospital/inbound-visits').then(r => r.json()).catch(() => ({ visits: [] }))
    setInbound(ib.visits || [])
  }
  useEffect(() => { load() }, [])

  const seedDemo = async () => {
    setSeeding(true)
    try {
      const r = await fetch('/api/hospital/demo/seed', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      toast.success(d.already_seeded ? 'Demo data already loaded' : `Loaded ${d.patients} demo patients`)
      await load()
    } catch (e) { toast.error(e.message) } finally { setSeeding(false) }
  }

  const actInbound = async (id, action) => {
    const r = await fetch(`/api/hospital/inbound-visits/${id}/${action}`, { method: 'POST' })
    if (r.ok) { toast.success(`Visit ${action}d`); await load() }
    else toast.error('Failed')
  }

  if (!data) return <div className="flex items-center justify-center h-96"><Loader2 className="w-6 h-6 animate-spin text-[#a855f7]" /></div>

  const hour = now.getHours(); const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const stats = [
    { l: 'Patients today', v: data.stats.todayCount, c: '#a855f7', I: Users },
    { l: 'This month', v: data.stats.monthCount, c: '#a855f7', I: Users },
    { l: 'Pending uploads', v: data.stats.pendingUploads, c: data.stats.pendingUploads ? '#ffab40' : '#6a8099', I: FileWarning },
    { l: 'Active sessions', v: data.stats.activeSessions, c: '#00e676', I: ShieldCheck },
  ]
  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
      <motion.div variants={fade} className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">{greet}, Dr {data.staff.full_name.split(' ').slice(-1)[0]}</h1>
          <p className="text-[#6a8099] text-sm mt-1">{data.hospital.name} · {data.hospital.city}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-right text-xs text-[#6a8099]">
            <div className="font-mono text-lg text-[#a855f7]">{format(now, 'HH:mm:ss')}</div>
            <div>{format(now, 'EEEE, dd MMM yyyy')}</div>
          </div>
          {!seeded && (
            <button onClick={seedDemo} disabled={seeding} className="btn-secondary text-xs inline-flex items-center gap-2">
              <Sparkles className="w-3 h-3" /> {seeding ? 'Loading…' : 'Load demo data'}
            </button>
          )}
          <Link href="/hospital/search" className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-semibold text-sm" style={{ background: '#a855f7', color: '#0b0e14' }}><Search className="w-4 h-4" /> Search Patient</Link>
        </div>
      </motion.div>

      <motion.div variants={fade} className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map(s => { const Icon = s.I; return (
          <div key={s.l} className="p-4 rounded-xl relative overflow-hidden" style={{ background: '#111520', border: '1px solid #1e2a40' }}>
            <span className="absolute top-0 left-0 right-0 h-0.5" style={{ background: s.c, opacity: 0.7 }} />
            <div className="flex items-start justify-between"><div><div className="text-xs text-[#6a8099] uppercase tracking-wider">{s.l}</div><div className="text-3xl font-bold mt-2" style={{ color: s.c }}>{s.v}</div></div><Icon className="w-4 h-4" style={{ color: s.c, opacity: 0.6 }} /></div>
          </div>
        )})}
      </motion.div>

      <motion.div variants={fade} className="card-accent-purple p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold inline-flex items-center gap-2"><Inbox className="w-4 h-4 text-[#ffab40]" /> Patient-submitted visits</h2>
          <span className="text-xs text-[#6a8099]">{inbound.length} pending</span>
        </div>
        {inbound.length === 0 ? (
          <div className="text-center py-6 text-xs text-[#6a8099]">No pending verifications. When a patient self-reports a visit at your hospital, it appears here.</div>
        ) : (
          <div className="space-y-2">
            {inbound.map(v => (
              <div key={v.id} className="p-3 rounded-lg" style={{ background: '#0b0e14', border: '1px solid #1e2a40' }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-mono text-[#a855f7]">{v.patient?.medi_id || '—'}</div>
                    <div className="font-semibold">{v.patient?.full_name || 'Unknown patient'}</div>
                    <div className="text-xs text-[#6a8099]">{v.department} · {format(new Date(v.visit_date), 'dd MMM yyyy, HH:mm')}</div>
                    {v.chief_complaint && <div className="text-xs italic text-[#6a8099] mt-1">“{v.chief_complaint}”</div>}
                    {v.patient?.allergies?.length > 0 && (
                      <div className="inline-flex items-center gap-1 text-[10px] text-[#ff5252] mt-1">
                        ⚠ Allergies: {v.patient.allergies.join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => actInbound(v.id, 'deny')} className="px-3 py-1.5 rounded-md text-xs" style={{ background: 'rgba(255,82,82,0.12)', color: '#ff5252', border: '1px solid #ff5252' }}><X className="w-3 h-3 inline" /> Deny</button>
                    <button onClick={() => actInbound(v.id, 'approve')} className="px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: '#a855f7', color: '#0b0e14' }}><Check className="w-3 h-3 inline" /> Approve</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div variants={fade} className="card-accent-purple p-4 mb-6">
        <div className="flex items-center justify-between mb-3"><h2 className="text-lg font-semibold">Today’s patients</h2><span className="text-xs text-[#6a8099]">{data.todayPatients.length} visit{data.todayPatients.length !== 1 ? 's' : ''}</span></div>
        {data.todayPatients.length === 0 ? <div className="text-center py-8 text-sm text-[#6a8099]">No patients yet today.</div>
          : <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left text-[10px] uppercase tracking-wider text-[#6a8099]" style={{ borderBottom: '1px solid #1e2a40' }}>
              <th className="px-2 py-2">Patient</th><th className="px-2 py-2">MediID</th><th className="px-2 py-2">Department</th><th className="px-2 py-2">Time</th><th className="px-2 py-2">Status</th><th></th>
            </tr></thead>
            <tbody>{data.todayPatients.map(t => (
              <tr key={t.visit_id} style={{ borderBottom: '1px solid #1e2a40' }}>
                <td className="px-2 py-2">{t.patient?.full_name || '—'}</td>
                <td className="px-2 py-2 font-mono text-xs text-[#a855f7]">{t.patient?.medi_id || '—'}</td>
                <td className="px-2 py-2 text-[#6a8099]">{t.department}</td>
                <td className="px-2 py-2 font-mono text-xs">{format(new Date(t.visit_date), 'HH:mm')}</td>
                <td className="px-2 py-2"><StatusBadge s={t.status} /></td>
                <td className="px-2 py-2 text-right">{t.patient?.medi_id && <Link href={`/hospital/patient/${t.patient.medi_id}`} className="text-xs text-[#a855f7] hover:underline inline-flex items-center gap-1">View <ArrowRight className="w-3 h-3" /></Link>}</td>
              </tr>
            ))}</tbody>
          </table></div>}
      </motion.div>

      <motion.div variants={fade} className="card-accent-purple p-4">
        <div className="flex items-center justify-between mb-3"><h2 className="text-lg font-semibold">Recent activity</h2><Link href="/hospital/audit" className="text-xs text-[#a855f7] hover:underline">View full log →</Link></div>
        {data.recentAudit.length === 0 ? <div className="text-sm text-[#6a8099] py-4">No events yet.</div>
          : data.recentAudit.map(a => (
            <div key={a.id} className="text-xs flex items-center justify-between py-2" style={{ borderBottom: '1px solid #1e2a40' }}>
              <span className="font-mono text-[#a855f7]">{format(new Date(a.created_at), 'HH:mm:ss')}</span>
              <span className="text-[#e2e8f4]">{a.action_type.replace(/_/g, ' ')}</span>
              <span className="text-[#6a8099]">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
            </div>
          ))}
      </motion.div>
    </motion.div>
  )
}
const fade = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }
function StatusBadge({ s }) {
  const c = s === 'completed' ? '#00e676' : s === 'in_progress' ? '#ffab40' : '#6a8099'
  return <span className="text-[10px] px-2 py-0.5 rounded-full inline-block capitalize" style={{ background: c + '20', color: c, border: `1px solid ${c}` }}>{s.replace('_',' ')}</span>
}
