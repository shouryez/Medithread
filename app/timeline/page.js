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
  const [patient, setPatient] = useState(null)
  const [filters, setFilters] = useState({ year: '', department: '', hospital: '', q: '' })
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [expanded, setExpanded] = useState({})
  const [accordion, setAccordion] = useState({})  // { [visitId]: 'rx' | 'reports' | null }
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

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

  useEffect(() => {
    fetch('/api/patient/me').then(r => r.json()).then(d => setPatient(d?.patient || null)).catch(() => {})
  }, [])

  const exportPdf = async () => {
    if (!filtered.length) {
      toast.error('No visits to export')
      return
    }
    setExporting(true)
    try {
      const [{ default: jsPDF }, autoTableMod] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])
      const autoTable = autoTableMod.default || autoTableMod
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 40

      // Header
      doc.setFillColor(11, 14, 20)
      doc.rect(0, 0, pageWidth, 70, 'F')
      doc.setTextColor(0, 229, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.text('MediThread', margin, 35)
      doc.setFontSize(10)
      doc.setTextColor(226, 232, 244)
      doc.setFont('helvetica', 'normal')
      doc.text('Universal Patient Health Record', margin, 52)
      doc.setFontSize(9)
      doc.setTextColor(106, 128, 153)
      doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, pageWidth - margin, 35, { align: 'right' })
      doc.text('CONFIDENTIAL', pageWidth - margin, 52, { align: 'right' })

      // Patient block
      let y = 100
      doc.setTextColor(20, 24, 32)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text(patient?.full_name || 'Patient', margin, y)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(80, 90, 100)
      const meta = []
      if (patient?.medi_id) meta.push(`MediID: ${patient.medi_id}`)
      if (patient?.dob) meta.push(`DOB: ${format(new Date(patient.dob), 'dd MMM yyyy')}`)
      if (patient?.gender) meta.push(patient.gender)
      if (patient?.blood_group) meta.push(`Blood: ${patient.blood_group}`)
      doc.text(meta.join('  ·  '), margin, y + 14)

      if (patient?.allergies?.length) {
        doc.setTextColor(220, 53, 69)
        doc.text(`Allergies: ${patient.allergies.join(', ')}`, margin, y + 28)
      }
      if (patient?.chronic_conditions?.length) {
        doc.setTextColor(255, 138, 0)
        doc.text(`Chronic: ${patient.chronic_conditions.join(', ')}`, margin, y + 42)
      }

      y += 60
      doc.setDrawColor(220, 224, 230)
      doc.line(margin, y, pageWidth - margin, y)
      y += 18

      // Title
      doc.setTextColor(20, 24, 32)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text(`Health Timeline (${filtered.length} visit${filtered.length !== 1 ? 's' : ''})`, margin, y)
      y += 4

      // Filters applied
      const appliedFilters = []
      if (filters.year) appliedFilters.push(`Year: ${filters.year}`)
      if (filters.department) appliedFilters.push(`Dept: ${filters.department}`)
      if (filters.hospital) appliedFilters.push(`Hospital: ${filters.hospital}`)
      if (filters.q) appliedFilters.push(`Search: "${filters.q}"`)
      if (appliedFilters.length) {
        doc.setFontSize(8)
        doc.setTextColor(106, 128, 153)
        doc.setFont('helvetica', 'italic')
        doc.text(`Filters — ${appliedFilters.join(' · ')}`, margin, y + 12)
        y += 6
      }
      y += 14

      // Visit table
      const rows = filtered.map(v => [
        format(new Date(v.visit_date), 'dd MMM yyyy'),
        v.hospital?.name || '—',
        v.department || '—',
        v.doctor_name || '—',
        (v.diagnosis || []).join(', ') || '—',
        v.chief_complaint || '—',
      ])
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Hospital', 'Dept', 'Doctor', 'Diagnosis', 'Complaint']],
        body: rows,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 5, textColor: [30, 30, 30] },
        headStyles: { fillColor: [0, 229, 255], textColor: [0, 19, 24], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 250, 252] },
        columnStyles: { 0: { cellWidth: 65 }, 2: { cellWidth: 70 }, 4: { cellWidth: 100 } },
      })

      // Per-visit details — prescriptions & reports
      let curY = doc.lastAutoTable.finalY + 24
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(20, 24, 32)
      doc.text('Visit Details', margin, curY)
      curY += 12

      for (const v of filtered) {
        if (curY > 740) { doc.addPage(); curY = 50 }
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 100, 130)
        doc.text(`${format(new Date(v.visit_date), 'dd MMM yyyy')} — ${v.hospital?.name || 'Hospital'} (${v.department || ''})`, margin, curY)
        curY += 6
        doc.setDrawColor(0, 229, 255)
        doc.line(margin, curY, pageWidth - margin, curY)
        curY += 12

        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(50, 50, 50)
        if (v.doctor_name) {
          doc.text(`Doctor: ${v.doctor_name}`, margin, curY); curY += 12
        }
        if (v.chief_complaint) {
          const lines = doc.splitTextToSize(`Complaint: ${v.chief_complaint}`, pageWidth - margin * 2)
          doc.text(lines, margin, curY); curY += lines.length * 11
        }
        if (v.diagnosis?.length) {
          const lines = doc.splitTextToSize(`Diagnosis: ${v.diagnosis.join(', ')}`, pageWidth - margin * 2)
          doc.text(lines, margin, curY); curY += lines.length * 11
        }
        if (v.notes) {
          const lines = doc.splitTextToSize(`Notes: ${v.notes}`, pageWidth - margin * 2)
          doc.text(lines, margin, curY); curY += lines.length * 11
        }
        if (v.ai_summary) {
          doc.setTextColor(120, 60, 180)
          const lines = doc.splitTextToSize(`AI Summary: ${v.ai_summary}`, pageWidth - margin * 2)
          doc.text(lines, margin, curY); curY += lines.length * 11
          doc.setTextColor(50, 50, 50)
        }

        if (v.prescriptions?.length) {
          if (curY > 720) { doc.addPage(); curY = 50 }
          curY += 4
          autoTable(doc, {
            startY: curY,
            head: [['Prescriptions', 'Dosage', 'Frequency', 'Duration', 'Status']],
            body: v.prescriptions.map(p => [
              p.drug_name || '—',
              p.dosage || '—',
              p.frequency || '—',
              p.duration_days ? `${p.duration_days} days` : '—',
              p.is_active ? 'Active' : 'Past',
            ]),
            margin: { left: margin, right: margin },
            styles: { fontSize: 8, cellPadding: 4 },
            headStyles: { fillColor: [168, 85, 247], textColor: [255, 255, 255], fontStyle: 'bold' },
            theme: 'striped',
          })
          curY = doc.lastAutoTable.finalY + 8
        }

        if (v.reports?.length) {
          if (curY > 720) { doc.addPage(); curY = 50 }
          autoTable(doc, {
            startY: curY,
            head: [['Reports', 'Type', 'Date']],
            body: v.reports.map(r => [
              r.title || '—',
              (r.report_type || '').toUpperCase(),
              r.report_date ? format(new Date(r.report_date), 'dd MMM yyyy') : '—',
            ]),
            margin: { left: margin, right: margin },
            styles: { fontSize: 8, cellPadding: 4 },
            headStyles: { fillColor: [0, 150, 180], textColor: [255, 255, 255], fontStyle: 'bold' },
            theme: 'striped',
          })
          curY = doc.lastAutoTable.finalY + 8
        }

        curY += 8
      }

      // Footer on every page
      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text('MediThread — Confidential health record. Share only with trusted providers.', margin, doc.internal.pageSize.getHeight() - 20)
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 20, { align: 'right' })
      }

      const fname = `medithread-timeline-${patient?.medi_id || 'patient'}-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`
      doc.save(fname)
      toast.success('PDF exported')
    } catch (e) {
      console.error('PDF export failed', e)
      toast.error('Could not export PDF')
    } finally {
      setExporting(false)
    }
  }

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
        <button onClick={exportPdf} disabled={exporting || !filtered.length} className="btn-secondary text-xs inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {exporting ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</> : <><Download className="w-3 h-3" /> Export PDF</>}
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
