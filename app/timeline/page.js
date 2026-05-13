'use client'
import PatientShell from '@/components/PatientShell'
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import {
  Search, X, Activity, Pill, FileText, Download, CalendarClock,
  Sparkles, Filter, Stethoscope, ChevronDown, FilePlus, Loader2,
} from 'lucide-react'

const PAGE_SIZE = 10

export default function TimelinePage() {
  return <PatientShell><Inner /></PatientShell>
}

function Inner() {
  const [data, setData] = useState(null)
  const [filters, setFilters] = useState({ year: '', department: '', hospital: '', q: '' })
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [expanded, setExpanded] = useState({})
  const [accordion, setAccordion] = useState({})  // { [visitId]: 'rx' | 'reports' | null }
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    qs.set('limit', '500')
    if (filters.year) qs.set('year', filters.year)
    if (filters.department) qs.set('department', filters.department)
    if (filters.q) qs.set('q', filters.q)
    const r = await fetch('/api/visits?' + qs.toString())
    setData(await r.json())
    setLoading(false)
    setVisibleCount(PAGE_SIZE)
  }
  useEffect(() => { load() }, [filters.year, filters.department, filters.q])

  // Client-side hospital filter (server has dept/year/q only)
  const filtered = useMemo(() => {
    if (!data?.visits) return []
    if (!filters.hospital) return data.visits
    return data.visits.filter(v => v.hospital?.name === filters.hospital)
  }, [data, filters.hospital])

  const years = useMemo(() => data?.visits ? [...new Set(data.visits.map(v => new Date(v.visit_date).getFullYear()))].sort((a, b) => b - a) : [], [data])
  const departments = useMemo(() => data?.visits ? [...new Set(data.visits.map(v => v.department).filter(Boolean))].sort() : [], [data])
  const hospitals = useMemo(() => data?.visits ? [...new Set(data.visits.map(v => v.hospital?.name).filter(Boolean))].sort() : [], [data])

  const firstVisitYear = years.length ? years[years.length - 1] : null
  const totalVisits = data?.total || 0
  const uniqueHospitals = hospitals.length

  // group visible visits by year for separator headers
  const visible = filtered.slice(0, visibleCount)
  const grouped = useMemo(() => {
    const g = {}
    visible.forEach(v => {
      const y = new Date(v.visit_date).getFullYear()
      g[y] = g[y] || []
      g[y].push(v)
    })
    return Object.entries(g).sort((a, b) => Number(b[0]) - Number(a[0]))
  }, [visible])

  const activeFilters = Object.entries(filters).filter(([, v]) => v)
  const clearFilter = (k) => setFilters(f => ({ ...f, [k]: '' }))
  const clearAll = () => setFilters({ year: '', department: '', hospital: '', q: '' })

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Health Timeline</h1>
          <p className="text-[#6a8099] text-sm mt-1">
            {totalVisits} visit{totalVisits !== 1 ? 's' : ''} across {uniqueHospitals} hospital{uniqueHospitals !== 1 ? 's' : ''}
            {firstVisitYear ? <> · since <span className="text-[#e2e8f4]">{firstVisitYear}</span></> : null}
          </p>
        </div>
        <button onClick={() => toast('PDF export coming soon', { icon: '📄' })} className="btn-secondary text-xs inline-flex items-center gap-2">
          <Download className="w-3 h-3" /> Export
        </button>
      </motion.div>

      {/* Filter bar */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card-accent-cyan p-4 mb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#6a8099] mb-3 font-semibold">
          <Filter className="w-3 h-3" /> Filter
        </div>

        {/* year pills */}
        <div className="flex flex-wrap gap-2 mb-3">
          <FilterPill active={!filters.year} onClick={() => clearFilter('year')}>All time</FilterPill>
          {years.map(y => (
            <FilterPill key={y} active={filters.year === String(y)} onClick={() => setFilters(f => ({ ...f, year: String(y) }))}>
              {y}
            </FilterPill>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* dept dropdown */}
          <Dropdown
            label="Department"
            value={filters.department}
            onChange={v => setFilters(f => ({ ...f, department: v }))}
            options={[{ v: '', l: 'All departments' }, ...departments.map(d => ({ v: d, l: d }))]}
            icon={<Stethoscope className="w-3 h-3" />}
          />
          {/* hospital dropdown */}
          <Dropdown
            label="Hospital"
            value={filters.hospital}
            onChange={v => setFilters(f => ({ ...f, hospital: v }))}
            options={[{ v: '', l: 'All hospitals' }, ...hospitals.map(h => ({ v: h, l: h }))]}
          />
          {/* search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6a8099]" />
            <input
              className="input-dark pl-9 py-2 text-xs"
              placeholder="Search diagnosis, doctor or hospital…"
              value={filters.q}
              onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
            />
          </div>
        </div>

        {/* active filters as removable tags */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t" style={{ borderColor: '#1e2a40' }}>
            {activeFilters.map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full" style={{ background: 'rgba(0,229,255,0.12)', color: '#00e5ff', border: '1px solid #00e5ff' }}>
                <span className="uppercase tracking-wider text-[8px] opacity-70">{k}</span> {v}
                <button onClick={() => clearFilter(k)} className="ml-1 hover:opacity-70"><X className="w-3 h-3" /></button>
              </span>
            ))}
            <button onClick={clearAll} className="text-[10px] text-[#6a8099] hover:text-[#ff5252]">Clear all</button>
          </div>
        )}
      </motion.div>

      {/* Body */}
      {loading && !data ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="shimmer h-28 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState hasFilters={activeFilters.length > 0} onClear={clearAll} />
      ) : (
        <div className="relative pl-8">
          {/* animated cyan-to-transparent vertical line */}
          <motion.span
            initial={{ height: 0 }}
            animate={{ height: '100%' }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="absolute left-2 top-0 w-px"
            style={{ background: 'linear-gradient(180deg, #00e5ff 0%, rgba(0,229,255,0.3) 60%, transparent 100%)' }}
          />

          {grouped.map(([year, visits], gi) => (
            <div key={year}>
              {/* Year separator */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + gi * 0.05 }}
                className="relative my-6 first:mt-0"
              >
                <span className="absolute -left-[26px] top-2 w-3 h-3 rounded-full" style={{ background: '#0b0e14', border: '2px solid #00e5ff' }} />
                <h2 className="text-5xl md:text-6xl font-bold tracking-tight select-none" style={{ color: '#1e2a40' }}>
                  {year}
                </h2>
              </motion.div>

              {visits.map((v, vi) => {
                const isExpanded = expanded[v.id]
                const accord = accordion[v.id]
                return (
                  <motion.div
                    key={v.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + vi * 0.04 }}
                    className="relative pb-5"
                  >
                    {/* dot */}
                    <span
                      className="absolute -left-[26px] top-5 w-3 h-3 rounded-full transition-all"
                      style={{ background: '#00e5ff', boxShadow: '0 0 0 4px rgba(0,229,255,0.15), 0 0 12px rgba(0,229,255,0.4)' }}
                    />

                    <button
                      onClick={() => setExpanded(e => ({ ...e, [v.id]: !e[v.id] }))}
                      className="card-accent-cyan p-4 w-full text-left transition hover:-translate-y-0.5 hover:border-[#00e5ff60]"
                      style={{ borderColor: isExpanded ? 'rgba(0,229,255,0.4)' : '#1e2a40' }}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-xs text-[#00e5ff] uppercase tracking-wider">
                            {format(new Date(v.visit_date), 'dd MMM yyyy').toUpperCase()}
                          </div>
                          <div className="font-semibold text-base mt-1">
                            {v.hospital?.name || 'Hospital'}{v.hospital?.city ? <span className="text-[#6a8099] font-normal text-sm"> · {v.hospital.city}</span> : null}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.4)' }}>{v.department}</span>
                            {v.doctor_name && <span className="text-xs text-[#6a8099]">{v.doctor_name}</span>}
                          </div>
                          {v.chief_complaint && <div className="text-sm italic text-[#6a8099] mt-2">“{v.chief_complaint}”</div>}
                          {v.diagnosis?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {v.diagnosis.map(d => <Tag key={d}>{d}</Tag>)}
                            </div>
                          )}
                        </div>
                        {v.follow_up_date && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 flex-shrink-0" style={{ background: 'rgba(255,171,64,0.12)', color: '#ffab40', border: '1px solid #ffab40' }}>
                            <CalendarClock className="w-3 h-3" /> Follow-up: {format(new Date(v.follow_up_date), 'dd MMM yyyy')}
                          </span>
                        )}
                      </div>

                      {v.ai_summary && (
                        <div className="mt-3 p-3 rounded-md text-sm flex gap-2" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)' }}>
                          <Sparkles className="w-4 h-4 text-[#a855f7] flex-shrink-0 mt-0.5" />
                          <div className="text-[#e2e8f4]">{v.ai_summary}</div>
                        </div>
                      )}

                      {/* Action row */}
                      <div className="flex items-center gap-4 mt-3 pt-3 text-xs flex-wrap" style={{ borderTop: '1px solid #1e2a40' }}>
                        <AccBtn
                          active={accord === 'rx'}
                          onClick={(e) => { e.stopPropagation(); setAccordion(a => ({ ...a, [v.id]: a[v.id] === 'rx' ? null : 'rx' })); setExpanded(e => ({ ...e, [v.id]: true })) }}
                          icon={<Pill className="w-3 h-3" />}
                          count={v.prescriptions?.length || 0}
                        >Prescriptions</AccBtn>
                        <AccBtn
                          active={accord === 'reports'}
                          onClick={(e) => { e.stopPropagation(); setAccordion(a => ({ ...a, [v.id]: a[v.id] === 'reports' ? null : 'reports' })); setExpanded(e => ({ ...e, [v.id]: true })) }}
                          icon={<FileText className="w-3 h-3" />}
                          count={v.reports?.length || 0}
                        >Reports</AccBtn>
                        <span className="ml-auto text-[#6a8099] inline-flex items-center gap-1">
                          {isExpanded ? 'Hide details' : 'View details'} <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </span>
                      </div>

                      <AnimatePresence initial={false}>
                        {isExpanded && accord === 'rx' && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="mt-3 rounded-md p-3" style={{ background: '#0b0e14', border: '1px solid #1e2a40' }}>
                              <div className="text-[10px] uppercase tracking-wider text-[#6a8099] mb-2 inline-flex items-center gap-1"><Pill className="w-3 h-3" /> Prescriptions</div>
                              {v.prescriptions?.length === 0 ? <div className="text-xs text-[#6a8099]">No prescriptions for this visit.</div> :
                                <div className="divide-y" style={{ borderColor: '#1e2a40' }}>
                                  {v.prescriptions.map(p => (
                                    <div key={p.id} className="py-2 grid grid-cols-12 gap-2 text-xs items-center">
                                      <div className="col-span-4 font-semibold text-[#e2e8f4]">{p.drug_name}</div>
                                      <div className="col-span-2 text-[#6a8099] font-mono">{p.dosage}</div>
                                      <div className="col-span-3 text-[#6a8099]">{p.frequency}</div>
                                      <div className="col-span-2 text-[#6a8099]">{p.duration_days ? `${p.duration_days}d` : '—'}</div>
                                      <div className="col-span-1 text-right">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: p.is_active ? 'rgba(0,230,118,0.12)' : 'rgba(106,128,153,0.12)', color: p.is_active ? '#00e676' : '#6a8099' }}>{p.is_active ? 'Active' : 'Past'}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>}
                            </div>
                          </motion.div>
                        )}
                        {isExpanded && accord === 'reports' && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="mt-3 rounded-md p-3" style={{ background: '#0b0e14', border: '1px solid #1e2a40' }}>
                              <div className="text-[10px] uppercase tracking-wider text-[#6a8099] mb-2 inline-flex items-center gap-1"><FileText className="w-3 h-3" /> Reports</div>
                              {v.reports?.length === 0 ? <div className="text-xs text-[#6a8099]">No reports for this visit.</div> :
                                <div className="space-y-2">
                                  {v.reports.map(r => (
                                    <div key={r.id} className="flex items-center gap-3 text-xs p-2 rounded-md hover:bg-[#111520]">
                                      <FileText className="w-4 h-4 text-[#00e5ff]" />
                                      <div className="flex-1 min-w-0">
                                        <div className="font-semibold truncate">{r.title}</div>
                                        <div className="text-[10px] text-[#6a8099] font-mono uppercase">{r.report_type} · {format(new Date(r.report_date), 'dd MMM yyyy')}</div>
                                      </div>
                                      {r.file_data || r.file_url ? (
                                        <a href={r.file_data || r.file_url} download={r.title} onClick={e => e.stopPropagation()} className="text-[#00e5ff] hover:underline inline-flex items-center gap-1"><Download className="w-3 h-3" /> Download</a>
                                      ) : <span className="text-[#6a8099]">No file</span>}
                                    </div>
                                  ))}
                                </div>}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>
                  </motion.div>
                )
              })}
            </div>
          ))}

          {/* Load more */}
          {visibleCount < filtered.length && (
            <div className="text-center pt-4">
              <button onClick={() => setVisibleCount(c => c + PAGE_SIZE)} className="btn-secondary text-sm inline-flex items-center gap-2">
                Load more ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

function FilterPill({ active, onClick, children }) {
  return (
    <button onClick={onClick} className="px-3 py-1.5 rounded-full text-xs transition" style={{ background: active ? '#00e5ff' : 'transparent', color: active ? '#001318' : '#e2e8f4', border: `1px solid ${active ? '#00e5ff' : '#1e2a40'}` }}>
      {children}
    </button>
  )
}

function Tag({ children }) {
  return <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'transparent', color: '#00e5ff', border: '1px solid #00e5ff' }}>{children}</span>
}

function Dropdown({ label, value, onChange, options, icon }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)} className="input-dark py-2 pl-7 pr-7 text-xs appearance-none" style={{ paddingLeft: icon ? '1.75rem' : '0.75rem', minWidth: '140px' }}>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
      {icon && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6a8099] pointer-events-none">{icon}</span>}
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#6a8099] pointer-events-none" />
    </div>
  )
}

function AccBtn({ icon, count, active, onClick, children }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 transition" style={{ color: active ? '#00e5ff' : '#6a8099' }}>
      {icon}
      <span>{children}</span>
      {count > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono" style={{ background: active ? '#00e5ff' : 'rgba(106,128,153,0.2)', color: active ? '#001318' : '#6a8099' }}>{count}</span>}
    </button>
  )
}

function EmptyState({ hasFilters, onClear }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card-accent-cyan p-12 text-center">
      <div className="text-6xl mb-4">🩺</div>
      <h3 className="text-xl font-semibold mb-2">
        {hasFilters ? 'No visits match those filters' : 'No visits recorded yet'}
      </h3>
      <p className="text-sm text-[#6a8099] max-w-md mx-auto mb-4">
        {hasFilters ? 'Try clearing some filters to see more results.' : 'Share your MediID with your doctor at any hospital and your visits will start appearing here automatically.'}
      </p>
      {hasFilters ? (
        <button onClick={onClear} className="btn-secondary text-sm inline-flex items-center gap-2"><X className="w-3 h-3" /> Clear filters</button>
      ) : (
        <a href="/dashboard" className="btn-secondary text-sm inline-flex items-center gap-2"><FilePlus className="w-3 h-3" /> Load demo data on dashboard</a>
      )}
    </motion.div>
  )
}
