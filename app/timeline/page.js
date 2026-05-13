'use client'
import PatientShell from '@/components/PatientShell'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { Search, X, Activity, Pill, FileText, Download, CalendarClock, Sparkles } from 'lucide-react'

export default function TimelinePage() { return <PatientShell><Inner /></PatientShell> }

function Inner() {
  const [data, setData] = useState(null)
  const [filters, setFilters] = useState({ year: '', department: '', hospital: '', q: '' })
  const [expanded, setExpanded] = useState({})

  const load = async () => {
    const qs = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => v && qs.set(k, v))
    qs.set('limit', '50')
    const r = await fetch('/api/visits?' + qs.toString())
    setData(await r.json())
  }
  useEffect(() => { load() }, [filters])

  const years = useMemo(() => {
    if (!data?.visits) return []
    return [...new Set(data.visits.map(v => new Date(v.visit_date).getFullYear()))].sort((a, b) => b - a)
  }, [data])
  const departments = useMemo(() => data ? [...new Set(data.visits.map(v => v.department).filter(Boolean))] : [], [data])
  const hospitals = useMemo(() => data ? [...new Set(data.visits.map(v => v.hospital?.name).filter(Boolean))] : [], [data])

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Timeline</h1>
          <p className="text-[#6a8099] text-sm mt-1">{data?.total || 0} visits · {hospitals.length} hospital{hospitals.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="card-accent-cyan p-4 mb-6">
        <div className="flex flex-wrap gap-2 items-center">
          {years.map(y => (
            <button key={y} onClick={() => setFilters(f => ({ ...f, year: f.year === String(y) ? '' : String(y) }))} className="px-3 py-1.5 rounded-full text-xs transition" style={{ background: filters.year === String(y) ? '#00e5ff' : '#0b0e14', color: filters.year === String(y) ? '#001318' : '#e2e8f4', border: '1px solid #1e2a40' }}>{y}</button>
          ))}
          <select className="input-dark py-1.5 text-xs w-auto" value={filters.department} onChange={e => setFilters(f => ({ ...f, department: e.target.value }))}>
            <option value="">All departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6a8099]" />
            <input className="input-dark pl-9 py-1.5 text-xs" placeholder="Search complaint, diagnosis, notes…" value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} />
          </div>
        </div>
        {(filters.year || filters.department || filters.hospital || filters.q) && (
          <div className="flex gap-2 mt-3">
            {Object.entries(filters).filter(([, v]) => v).map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,229,255,0.12)', color: '#00e5ff', border: '1px solid #00e5ff' }}>
                {k}: {v} <button onClick={() => setFilters(f => ({ ...f, [k]: '' }))}><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {!data ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="shimmer h-24 rounded-xl" />)}</div>
      ) : data.visits.length === 0 ? (
        <div className="card-accent-cyan p-12 text-center">
          <Activity className="w-10 h-10 mx-auto text-[#6a8099] mb-3" />
          <div className="text-lg font-semibold mb-1">No visits yet</div>
          <div className="text-sm text-[#6a8099]">Your hospital visits will appear here.</div>
        </div>
      ) : (
        <div className="relative pl-6">
          <span className="absolute left-2 top-0 bottom-0 w-px" style={{ background: 'linear-gradient(180deg, #00e5ff, transparent)' }} />
          {data.visits.map(v => (
            <motion.div key={v.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative pb-5">
              <span className="absolute -left-[18px] top-3 w-2.5 h-2.5 rounded-full" style={{ background: '#00e5ff', boxShadow: '0 0 0 3px rgba(0,229,255,0.2)' }} />
              <div className="card-accent-cyan p-4 transition hover:-translate-y-0.5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-mono text-xs text-[#00e5ff]">{format(new Date(v.visit_date), 'dd MMM yyyy')}</div>
                    <div className="font-semibold mt-0.5">{v.hospital?.name || 'Hospital'} · <span className="text-[#6a8099] font-normal">{v.department}</span></div>
                    <div className="text-sm text-[#6a8099]">{v.doctor_name}</div>
                  </div>
                  {v.follow_up_date && <span className="text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: 'rgba(255,171,64,0.12)', color: '#ffab40', border: '1px solid #ffab40' }}><CalendarClock className="w-3 h-3" /> Follow-up {v.follow_up_date}</span>}
                </div>
                {v.chief_complaint && <div className="text-sm italic text-[#6a8099] mt-2">“{v.chief_complaint}”</div>}
                <div className="flex flex-wrap gap-1 mt-2">{(v.diagnosis || []).map(d => <span key={d} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,229,255,0.12)', color: '#00e5ff', border: '1px solid #00e5ff' }}>{d}</span>)}</div>
                {v.ai_summary && (
                  <div className="mt-3 p-3 rounded-md text-sm flex gap-2" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.3)' }}>
                    <Sparkles className="w-4 h-4 text-[#a855f7] flex-shrink-0 mt-0.5" />
                    <div className="text-[#e2e8f4]">{v.ai_summary}</div>
                  </div>
                )}
                {(v.prescriptions?.length > 0 || v.reports?.length > 0) && (
                  <button onClick={() => setExpanded(e => ({ ...e, [v.id]: !e[v.id] }))} className="text-xs text-[#00e5ff] mt-3 hover:underline">
                    {expanded[v.id] ? 'Hide details' : `View ${v.prescriptions?.length || 0} prescriptions · ${v.reports?.length || 0} reports`}
                  </button>
                )}
                {expanded[v.id] && (
                  <div className="mt-3 grid md:grid-cols-2 gap-3">
                    {v.prescriptions?.length > 0 && (
                      <div className="p-3 rounded-md" style={{ background: '#0b0e14', border: '1px solid #1e2a40' }}>
                        <div className="text-xs uppercase tracking-wider text-[#6a8099] mb-2 inline-flex items-center gap-1"><Pill className="w-3 h-3" /> Prescriptions</div>
                        {v.prescriptions.map(p => (
                          <div key={p.id} className="text-sm py-1 flex items-center justify-between">
                            <div><span className="font-semibold">{p.drug_name}</span> <span className="text-[#6a8099]">· {p.dosage} · {p.frequency}</span></div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: p.is_active ? 'rgba(0,230,118,0.12)' : 'rgba(106,128,153,0.12)', color: p.is_active ? '#00e676' : '#6a8099' }}>{p.is_active ? 'Active' : 'Past'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {v.reports?.length > 0 && (
                      <div className="p-3 rounded-md" style={{ background: '#0b0e14', border: '1px solid #1e2a40' }}>
                        <div className="text-xs uppercase tracking-wider text-[#6a8099] mb-2 inline-flex items-center gap-1"><FileText className="w-3 h-3" /> Reports</div>
                        {v.reports.map(r => (
                          <div key={r.id} className="text-sm py-1 flex items-center justify-between">
                            <div className="truncate">{r.title}</div>
                            <button className="text-[#00e5ff] hover:underline text-xs inline-flex items-center gap-1"><Download className="w-3 h-3" /> {r.report_type}</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
