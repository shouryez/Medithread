'use client'
import HospitalShell from '@/components/HospitalShell'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { Sparkles, AlertTriangle, RefreshCw, Plus, ArrowLeft, Pill, FileText, Activity, ShieldCheck, Loader2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function HPatient() { return <HospitalShell><Inner /></HospitalShell> }
function Inner() {
  const { mediId } = useParams()
  const router = useRouter()
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('visits')
  const [aiSummary, setAiSummary] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [drugCheck, setDrugCheck] = useState({ drug: '', result: null, loading: false })
  const [now, setNow] = useState(new Date())

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  const load = async () => {
    const r = await fetch(`/api/hospital/patient/${encodeURIComponent(mediId)}`)
    if (!r.ok) { const d = await r.json(); toast.error(d.error || 'Access denied'); router.push('/hospital/search'); return }
    setData(await r.json())
  }
  useEffect(() => { load() }, [mediId])

  const fetchAI = async () => {
    if (!data?.patient?.id) return
    setAiLoading(true)
    try {
      const r = await fetch(`/api/ai/summarise?patientId=${data.patient.id}`).then(r => r.json())
      setAiSummary(r.summary)
    } finally { setAiLoading(false) }
  }
  useEffect(() => { if (data?.patient) fetchAI() }, [data?.patient?.id])

  const runDrugCheck = async () => {
    if (!drugCheck.drug) return
    setDrugCheck(d => ({ ...d, loading: true, result: null }))
    try {
      const r = await fetch('/api/ai/drug-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newDrug: drugCheck.drug, currentMedications: data.medications.active.map(m => m.drug_name) }) }).then(r => r.json())
      setDrugCheck(d => ({ ...d, result: r, loading: false }))
    } catch { setDrugCheck(d => ({ ...d, loading: false })) }
  }

  if (!data) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[#a855f7]" /></div>

  const p = data.patient
  const exp = new Date(data.consent.expires_at)
  const left = Math.max(0, Math.floor((exp - now) / 1000))
  const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), s = left % 60
  const age = p.dob ? Math.floor((Date.now() - new Date(p.dob).getTime()) / (365.25 * 86400000)) : '—'

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-6 md:-mx-10 px-6 md:px-10 py-4 mb-6" style={{ background: 'rgba(11,14,20,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #1e2a40' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link href="/hospital/search" className="text-xs text-[#6a8099] hover:text-[#a855f7] inline-flex items-center gap-1 mb-2"><ArrowLeft className="w-3 h-3" /> Search</Link>
            <div className="text-2xl font-bold">{p.full_name}</div>
            <div className="font-mono text-xs text-[#a855f7]">{p.medi_id}</div>
            <div className="text-xs text-[#6a8099] mt-1">{age} yrs · <span className="capitalize">{p.gender}</span> · <span className="font-mono font-semibold text-[#e2e8f4]">{p.blood_group}</span></div>
            {p.allergies?.length > 0 && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-md" style={{ background: 'rgba(255,82,82,0.1)', border: '1px solid #ff5252' }}>
                <AlertTriangle className="w-3 h-3 text-[#ff5252]" />
                <span className="text-xs font-semibold text-[#ff5252]">Allergies: {p.allergies.join(' · ')}</span>
              </div>
            )}
            {p.chronic_conditions?.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{p.chronic_conditions.map(c => <span key={c} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,229,255,0.12)', color: '#00e5ff', border: '1px solid #00e5ff' }}>{c}</span>)}</div>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs" style={{ background: 'rgba(255,171,64,0.1)', color: '#ffab40', border: '1px solid #ffab40' }}>
              <ShieldCheck className="w-3 h-3" /> Access expires in {h}h {m}m {s}s
            </div>
            <Link href={`/hospital/visit/new?mediId=${encodeURIComponent(p.medi_id)}`} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-sm" style={{ background: '#a855f7', color: '#0b0e14' }}><Plus className="w-4 h-4" /> New Visit</Link>
          </div>
        </div>
      </div>

      <div className="card-accent-purple p-5 mb-6" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.06), rgba(0,229,255,0.04))' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4 text-[#a855f7]" /> AI Clinical Summary</div>
          <button onClick={fetchAI} disabled={aiLoading} className="text-xs text-[#6a8099] hover:text-[#a855f7] inline-flex items-center gap-1"><RefreshCw className={`w-3 h-3 ${aiLoading ? 'animate-spin' : ''}`} /> Regenerate</button>
        </div>
        {aiLoading ? <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="shimmer h-4 rounded" style={{ width: `${85 + Math.random() * 15}%` }} />)}</div>
          : <div className="text-sm text-[#e2e8f4] whitespace-pre-line">{aiSummary || 'No summary available.'}</div>}
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {[{v:'visits',l:'Visits'},{v:'meds',l:'Medications'},{v:'reports',l:'Reports'},{v:'trends',l:'Trends'},{v:'audit',l:'Audit'}].map(t => (
          <button key={t.v} onClick={() => setTab(t.v)} className="px-3 py-1.5 rounded-full text-xs whitespace-nowrap" style={{ background: tab === t.v ? '#a855f7' : '#111520', color: tab === t.v ? '#0b0e14' : '#e2e8f4', border: '1px solid #1e2a40' }}>{t.l}</button>
        ))}
      </div>

      {tab === 'visits' && (
        <div className="relative pl-6">
          <span className="absolute left-2 top-0 bottom-0 w-px" style={{ background: 'linear-gradient(180deg, #a855f7, transparent)' }} />
          {data.visits.map(v => (
            <div key={v.id} className="relative pb-4">
              <span className="absolute -left-[18px] top-3 w-2.5 h-2.5 rounded-full" style={{ background: v.is_own ? '#a855f7' : '#6a8099' }} />
              <div className="p-3 rounded-lg" style={{ background: '#111520', border: `1px solid ${v.is_own ? 'rgba(168,85,247,0.3)' : '#1e2a40'}` }}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-mono text-xs" style={{ color: v.is_own ? '#a855f7' : '#6a8099' }}>{format(new Date(v.visit_date), 'dd MMM yyyy')}</div>
                    <div className="font-semibold">{v.hospital?.name} · <span className="text-[#6a8099] font-normal">{v.department}</span></div>
                    <div className="text-xs text-[#6a8099]">{v.doctor_name}</div>
                  </div>
                  {v.is_own && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid #a855f7' }}>This hospital</span>}
                </div>
                {v.chief_complaint && <div className="text-xs italic text-[#6a8099] mt-2">“{v.chief_complaint}”</div>}
                {(v.diagnosis?.length > 0) && <div className="flex flex-wrap gap-1 mt-2">{v.diagnosis.map(d => <span key={d} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,229,255,0.12)', color: '#00e5ff', border: '1px solid #00e5ff' }}>{d}</span>)}</div>}
                {v.ai_summary && <div className="text-xs text-[#e2e8f4] mt-2 p-2 rounded" style={{ background: 'rgba(168,85,247,0.06)' }}><Sparkles className="w-3 h-3 inline text-[#a855f7]" /> {v.ai_summary}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'meds' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#6a8099] mb-2 font-semibold">Active medications</div>
            {data.medications.active.length === 0 ? <div className="text-sm text-[#6a8099]">No active medications.</div> :
              data.medications.active.map(m => <div key={m.id} className="p-3 rounded-lg mb-2" style={{ background: '#111520', border: '1px solid #1e2a40' }}><div className="font-semibold">{m.drug_name}</div><div className="text-xs text-[#6a8099]">{m.dosage} · {m.frequency} {m.duration_days ? `· ${m.duration_days}d` : ''}</div></div>)}
          </div>
          <div className="card-accent-purple p-4">
            <div className="text-xs uppercase tracking-wider text-[#a855f7] mb-2 font-semibold inline-flex items-center gap-2"><Pill className="w-3 h-3" /> Drug Interaction Checker</div>
            <div className="text-xs text-[#6a8099] mb-3">Enter a new drug to check against active medications.</div>
            <div className="flex gap-2 mb-3"><input className="input-dark flex-1" placeholder="e.g., Warfarin" value={drugCheck.drug} onChange={e => setDrugCheck(d => ({ ...d, drug: e.target.value }))} /><button onClick={runDrugCheck} disabled={drugCheck.loading} className="rounded-lg px-3 py-1 text-xs font-semibold" style={{ background: '#a855f7', color: '#0b0e14' }}>{drugCheck.loading ? '…' : 'Check'}</button></div>
            {drugCheck.result && <SeverityBlock r={drugCheck.result} />}
          </div>
        </div>
      )}

      {tab === 'reports' && (
        <div className="grid md:grid-cols-2 gap-3">
          {data.reports.length === 0 ? <div className="text-sm text-[#6a8099]">No reports.</div> :
            data.reports.map(r => <div key={r.id} className="p-3 rounded-lg" style={{ background: '#111520', border: '1px solid #1e2a40' }}><div className="flex items-center justify-between"><div className="font-semibold">{r.title}</div><span className="text-[10px] px-2 py-0.5 rounded-full uppercase font-mono" style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7' }}>{r.report_type}</span></div><div className="text-xs text-[#6a8099]">{format(new Date(r.report_date), 'dd MMM yyyy')} · {r.hospital?.name || 'Self'}</div>{r.file_data && <a href={r.file_data} download className="text-xs text-[#a855f7] hover:underline mt-2 inline-block">Download</a>}</div>)}
        </div>
      )}

      {tab === 'trends' && <TrendsView metrics={data.metrics} />}

      {tab === 'audit' && (
        <div className="card-accent-purple overflow-hidden">
          <table className="w-full text-sm"><thead><tr className="text-left text-[10px] uppercase tracking-wider text-[#6a8099]" style={{ borderBottom: '1px solid #1e2a40' }}><th className="px-3 py-2">Time</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Hospital</th></tr></thead><tbody>
            {data.audit.map(a => <tr key={a.id} style={{ borderBottom: '1px solid #1e2a40' }}><td className="px-3 py-2 font-mono text-xs text-[#a855f7]">{format(new Date(a.created_at), 'dd MMM HH:mm:ss')}</td><td className="px-3 py-2 text-xs capitalize">{a.action_type.replace(/_/g, ' ')}</td><td className="px-3 py-2 text-xs">{a.hospital?.name || '—'}</td></tr>)}
          </tbody></table>
        </div>
      )}
    </div>
  )
}

function SeverityBlock({ r }) {
  const sev = r.severity || 'none'
  const c = sev === 'severe' ? '#ff5252' : sev === 'moderate' ? '#ff8a40' : sev === 'mild' ? '#ffab40' : '#00e676'
  return (
    <div className="p-3 rounded-lg" style={{ background: c + '10', border: `1px solid ${c}` }}>
      <div className="inline-block text-[10px] px-2 py-0.5 rounded uppercase font-semibold mb-2" style={{ background: c, color: '#0b0e14' }}>{sev}</div>
      <div className="text-sm text-[#e2e8f4]">{r.recommendation}</div>
      {(r.interactions || []).length > 0 && <ul className="text-xs text-[#6a8099] mt-2 list-disc pl-5">{r.interactions.map((i, k) => <li key={k}><b>{i.drug}:</b> {i.description}</li>)}</ul>}
    </div>
  )
}

function TrendsView({ metrics }) {
  const groups = metrics.reduce((acc, m) => { (acc[m.metric_type] = acc[m.metric_type] || []).push(m); return acc }, {})
  if (Object.keys(groups).length === 0) return <div className="text-sm text-[#6a8099]">No metrics recorded.</div>
  return <div className="grid md:grid-cols-2 gap-4">{Object.entries(groups).map(([type, arr]) => {
    const data = arr.slice().reverse().map(m => ({ ts: format(new Date(m.recorded_at), 'dd MMM'), value: m.value }))
    return <div key={type} className="card-accent-purple p-4"><div className="text-xs uppercase tracking-wider text-[#a855f7] mb-2 font-semibold capitalize">{type.replace(/_/g, ' ')}</div>
      <div style={{ width: '100%', height: 180 }}><ResponsiveContainer><LineChart data={data}><CartesianGrid stroke="#1e2a40" strokeDasharray="3 3" /><XAxis dataKey="ts" stroke="#6a8099" fontSize={10} /><YAxis stroke="#6a8099" fontSize={10} /><Tooltip contentStyle={{ background: '#0b0e14', border: '1px solid #1e2a40', borderRadius: 8 }} /><Line type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={2} dot={{ fill: '#a855f7', r: 3 }} /></LineChart></ResponsiveContainer></div>
    </div>
  })}</div>
}
