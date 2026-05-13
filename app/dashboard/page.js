'use client'
import PatientShell from '@/components/PatientShell'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { QRCodeCanvas } from 'qrcode.react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { Activity, Pill, FileText, ShieldAlert, Copy, Download, AlertTriangle, MapPin, Plus, Sparkles } from 'lucide-react'
import { format } from 'date-fns'

export default function DashboardPage() {
  return <PatientShell><DashboardInner /></PatientShell>
}

function DashboardInner() {
  const [me, setMe] = useState(null)
  const [data, setData] = useState(null)
  const [seeding, setSeeding] = useState(false)

  const load = async () => {
    const meRes = await fetch('/api/me').then(r => r.json())
    setMe(meRes.patient)
    const dash = await fetch('/api/patient/dashboard').then(r => r.json())
    setData(dash)
  }
  useEffect(() => { load() }, [])

  const seedDemo = async () => {
    setSeeding(true)
    try {
      const r = await fetch('/api/demo/seed', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      toast.success('Demo data loaded')
      await load()
    } catch (e) { toast.error(e.message) } finally { setSeeding(false) }
  }

  if (!me || !data) return <div className="space-y-4">{[1,2,3].map(i=> <div key={i} className="shimmer h-32 rounded-xl" />)}</div>

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = me.full_name.split(' ')[0]
  const emergencyUrl = `${window.location.origin}/emergency/${me.medi_id}`

  const downloadQR = () => {
    const canvas = document.getElementById('mediid-qr')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a'); a.href = url; a.download = `medi-id-${me.medi_id}.png`; a.click()
  }

  const stats = [
    { l: 'Total Visits', v: data.stats.visits, c: '#00e5ff', I: Activity },
    { l: 'Active Medications', v: data.stats.activeMeds, c: '#ffab40', I: Pill },
    { l: 'Reports Stored', v: data.stats.reports, c: '#00e676', I: FileText },
    { l: 'Pending Access Requests', v: data.stats.pendingConsents, c: '#ff5252', I: ShieldAlert },
  ]

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }}>
      <motion.div variants={fadeUp} className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">{greet}, {firstName}</h1>
          <p className="text-[#6a8099] text-sm mt-1">Here’s a quick view of your health record.</p>
        </div>
        <button onClick={seedDemo} disabled={seeding} className="btn-secondary text-xs inline-flex items-center gap-2">
          <Sparkles className="w-3 h-3" /> {seeding ? 'Loading…' : 'Load demo data'}
        </button>
      </motion.div>

      {me.allergies?.length > 0 && (
        <motion.div variants={fadeUp} className="mb-6 p-4 rounded-xl pulse-red flex items-center gap-3" style={{ background: 'rgba(255,82,82,0.08)', border: '1px solid #ff5252' }}>
          <AlertTriangle className="w-5 h-5 text-[#ff5252] flex-shrink-0" />
          <div className="flex-1">
            <div className="font-semibold text-[#ff5252]">Active allergies on record</div>
            <div className="text-sm text-[#e2e8f4] mt-1">{me.allergies.join(' · ')}</div>
          </div>
        </motion.div>
      )}

      <motion.div variants={fadeUp} className="card-accent-cyan p-6 mb-6" style={{ borderColor: 'rgba(0,229,255,0.4)' }}>
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-[#6a8099] mb-1">MediID</div>
            <div className="font-mono text-2xl md:text-3xl font-bold text-[#00e5ff] tracking-wider mb-3 break-all">{me.medi_id}</div>
            <div className="text-lg font-semibold">{me.full_name}</div>
            <div className="text-sm text-[#6a8099] flex flex-wrap gap-x-3 mt-1">
              <span>{me.dob}</span><span>·</span><span className="capitalize">{me.gender}</span><span>·</span><span className="font-mono font-semibold text-[#e2e8f4]">{me.blood_group}</span><span>·</span><span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {me.city}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {me.allergies?.map(a => <Tag key={a} tone="danger">{a}</Tag>)}
              {me.chronic_conditions?.map(a => <Tag key={a} tone="cyan">{a}</Tag>)}
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 rounded-xl" style={{ background: '#0b0e14', border: '1px solid #1e2a40' }}>
              <QRCodeCanvas id="mediid-qr" value={emergencyUrl} size={120} bgColor="#0b0e14" fgColor="#00e5ff" level="H" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { navigator.clipboard.writeText(me.medi_id); toast.success('MediID copied') }} className="text-xs text-[#6a8099] hover:text-[#00e5ff] inline-flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
              <button onClick={downloadQR} className="text-xs text-[#6a8099] hover:text-[#00e5ff] inline-flex items-center gap-1"><Download className="w-3 h-3" /> QR</button>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map(s => {
          const Icon = s.I
          return (
            <div key={s.l} className="p-4 rounded-xl relative overflow-hidden" style={{ background: '#111520', border: '1px solid #1e2a40' }}>
              <span className="absolute top-0 left-0 right-0 h-0.5" style={{ background: s.c, opacity: 0.7 }} />
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-[#6a8099] uppercase tracking-wider">{s.l}</div>
                  <div className="text-3xl font-bold mt-2" style={{ color: s.c }}>{s.v}</div>
                </div>
                <Icon className="w-4 h-4" style={{ color: s.c, opacity: 0.6 }} />
              </div>
            </div>
          )
        })}
      </motion.div>

      <motion.div variants={fadeUp} className="card-accent-cyan p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent visits</h2>
          <Link href="/timeline" className="text-xs text-[#00e5ff] hover:underline">View all →</Link>
        </div>
        {data.recentVisits.length === 0 ? (
          <EmptyVisits onSeed={seedDemo} />
        ) : (
          <div className="relative pl-6">
            <span className="absolute left-2 top-2 bottom-2 w-px" style={{ background: 'linear-gradient(180deg, #00e5ff, transparent)' }} />
            {data.recentVisits.map(v => (
              <div key={v.id} className="relative pb-5">
                <span className="absolute -left-[18px] top-1.5 w-2.5 h-2.5 rounded-full" style={{ background: '#00e5ff', boxShadow: '0 0 0 3px rgba(0,229,255,0.2)' }} />
                <div className="font-mono text-xs text-[#00e5ff]">{format(new Date(v.visit_date), 'dd MMM yyyy')}</div>
                <div className="font-semibold mt-0.5">{v.hospital?.name || 'Unknown hospital'} · <span className="text-[#6a8099] font-normal">{v.department}</span></div>
                <div className="text-sm text-[#6a8099]">{v.doctor_name || 'Doctor'}</div>
                <div className="flex flex-wrap gap-1 mt-2">{(v.diagnosis || []).map(d => <Tag key={d} tone="cyan">{d}</Tag>)}</div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickAction label="Share MediID" sub="Copy to clipboard" onClick={() => { navigator.clipboard.writeText(me.medi_id); toast.success('MediID copied') }} />
        <Link href={`/emergency/${me.medi_id}`} target="_blank"><QuickActionInner label="Emergency Card" sub="Open public card" /></Link>
        <Link href="/chronic"><QuickActionInner label="Add Reading" sub="Log a metric" /></Link>
        <Link href="/medications"><QuickActionInner label="View Medications" sub="Active rx" /></Link>
      </motion.div>
    </motion.div>
  )
}

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }

function Tag({ tone, children }) {
  const c = tone === 'danger' ? { bg: 'rgba(255,82,82,0.12)', text: '#ff5252', border: '#ff5252' }
          : tone === 'amber' ? { bg: 'rgba(255,171,64,0.12)', text: '#ffab40', border: '#ffab40' }
          : tone === 'success' ? { bg: 'rgba(0,230,118,0.12)', text: '#00e676', border: '#00e676' }
          : { bg: 'rgba(0,229,255,0.12)', text: '#00e5ff', border: '#00e5ff' }
  return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>{children}</span>
}

function QuickAction({ label, sub, onClick }) {
  return (
    <button onClick={onClick} className="text-left p-4 rounded-xl transition hover:-translate-y-0.5" style={{ background: '#111520', border: '1px solid #1e2a40' }}>
      <div className="text-sm font-semibold">{label}</div>
      <div className="text-xs text-[#6a8099] mt-1">{sub}</div>
    </button>
  )
}
function QuickActionInner({ label, sub }) {
  return (
    <div className="p-4 rounded-xl transition hover:-translate-y-0.5 cursor-pointer h-full" style={{ background: '#111520', border: '1px solid #1e2a40' }}>
      <div className="text-sm font-semibold">{label}</div>
      <div className="text-xs text-[#6a8099] mt-1">{sub}</div>
    </div>
  )
}

function EmptyVisits({ onSeed }) {
  return (
    <div className="text-center py-8">
      <div className="text-sm text-[#6a8099] mb-3">No visits yet — your timeline will appear here.</div>
      <button onClick={onSeed} className="btn-secondary text-xs inline-flex items-center gap-2"><Plus className="w-3 h-3" /> Load demo visits</button>
    </div>
  )
}
