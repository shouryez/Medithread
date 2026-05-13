'use client'
import PatientShell from '@/components/PatientShell'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { Plus, X, FileText, Download, Share2, FlaskConical, Activity, Scan, FileSpreadsheet } from 'lucide-react'

const TYPES = [
  { v: 'all', l: 'All' }, { v: 'lab', l: 'Lab' }, { v: 'xray', l: 'X-Ray' },
  { v: 'mri', l: 'MRI' }, { v: 'ecg', l: 'ECG' }, { v: 'ultrasound', l: 'Ultrasound' }, { v: 'other', l: 'Other' },
]

const ICONS = { lab: FlaskConical, xray: Scan, mri: Scan, ecg: Activity, ultrasound: Scan, other: FileText }

export default function ReportsPage() { return <PatientShell><Inner /></PatientShell> }

function Inner() {
  const [type, setType] = useState('all')
  const [data, setData] = useState(null)
  const [showUpload, setShowUpload] = useState(false)

  const load = async () => setData(await fetch(`/api/reports?type=${type}`).then(r => r.json()))
  useEffect(() => { load() }, [type])

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-[#6a8099] text-sm mt-1">{data?.reports?.length || 0} report{data?.reports?.length !== 1 ? 's' : ''} stored</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn-primary inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Upload report</button>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {TYPES.map(t => (
          <button key={t.v} onClick={() => setType(t.v)} className="px-3 py-1.5 rounded-full text-xs transition" style={{ background: type === t.v ? '#00e5ff' : '#111520', color: type === t.v ? '#001318' : '#e2e8f4', border: '1px solid #1e2a40' }}>{t.l}</button>
        ))}
      </div>

      {!data ? <div className="grid md:grid-cols-2 gap-3">{[1,2,3,4].map(i=> <div key={i} className="shimmer h-32 rounded-xl" />)}</div>
        : data.reports.length === 0 ? (
          <div className="card-accent-cyan p-12 text-center">
            <FileText className="w-10 h-10 mx-auto text-[#6a8099] mb-3" />
            <div className="text-lg font-semibold mb-1">No reports yet</div>
            <div className="text-sm text-[#6a8099]">Upload a lab report or hospital scan to store it forever.</div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {data.reports.map(r => {
              const Icon = ICONS[r.report_type] || FileText
              return (
                <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="card-accent-cyan p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,229,255,0.1)' }}>
                        <Icon className="w-5 h-5 text-[#00e5ff]" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{r.title}</div>
                        <div className="text-xs text-[#6a8099]">{format(new Date(r.report_date), 'dd MMM yyyy')} · {r.hospital?.name || 'Self-uploaded'}</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono uppercase" style={{ background: 'rgba(0,229,255,0.12)', color: '#00e5ff', border: '1px solid #00e5ff' }}>{r.report_type}</span>
                  </div>
                  {r.parsed_data && Object.keys(r.parsed_data).length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {Object.entries(r.parsed_data).slice(0, 6).map(([k, val]) => {
                        const v = typeof val === 'object' ? val.value : val
                        const unit = typeof val === 'object' ? val.unit : ''
                        const isHigh = typeof val === 'object' && val.normal?.startsWith('<') && parseFloat(v) >= parseFloat(val.normal.slice(1))
                        const isLow = typeof val === 'object' && val.normal?.startsWith('>') && parseFloat(v) <= parseFloat(val.normal.slice(1))
                        const tone = isHigh || isLow ? '#ff5252' : '#00e676'
                        return (
                          <div key={k} className="p-2 rounded" style={{ background: '#0b0e14', border: '1px solid #1e2a40' }}>
                            <div className="text-[10px] uppercase tracking-wider text-[#6a8099]">{k}</div>
                            <div className="font-mono font-semibold text-sm" style={{ color: tone }}>{v} {unit}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t text-xs" style={{ borderColor: '#1e2a40' }}>
                    {r.file_data || r.file_url ? (
                      <a href={r.file_data || r.file_url} download={r.title} className="text-[#00e5ff] hover:underline inline-flex items-center gap-1"><Download className="w-3 h-3" /> Download</a>
                    ) : (
                      <span className="text-[#6a8099]">No file attached</span>
                    )}
                    <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied') }} className="text-[#6a8099] hover:text-[#00e5ff] inline-flex items-center gap-1"><Share2 className="w-3 h-3" /> Share</button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSaved={async () => { await load(); setShowUpload(false) }} />}
    </div>
  )
}

function UploadModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ title: '', report_type: 'lab', report_date: new Date().toISOString().slice(0, 10), file_data: null })
  const [loading, setLoading] = useState(false)
  const onFile = (f) => {
    if (!f) return
    if (f.size > 4 * 1024 * 1024) return toast.error('File must be < 4MB')
    const reader = new FileReader()
    reader.onload = () => setForm(s => ({ ...s, file_data: reader.result, title: s.title || f.name }))
    reader.readAsDataURL(f)
  }
  const save = async () => {
    if (!form.title) return toast.error('Title required')
    setLoading(true)
    try {
      const r = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!r.ok) throw new Error('Failed')
      toast.success('Report uploaded')
      onSaved()
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md card-accent-cyan p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">Upload report</h2><button onClick={onClose}><X className="w-4 h-4 text-[#6a8099]" /></button></div>
        <div className="space-y-3">
          <Label l="Title"><input className="input-dark" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g., HbA1c report" /></Label>
          <Label l="Type">
            <select className="input-dark" value={form.report_type} onChange={e => setForm({ ...form, report_type: e.target.value })}>
              {TYPES.filter(t => t.v !== 'all').map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </Label>
          <Label l="Report date"><input type="date" className="input-dark" value={form.report_date} onChange={e => setForm({ ...form, report_date: e.target.value })} /></Label>
          <Label l="File (PDF / JPG / PNG · max 4MB)">
            <label className="block p-6 rounded-xl text-center cursor-pointer transition hover:border-[#00e5ff]" style={{ background: '#0b0e14', border: '1px dashed #1e2a40' }}>
              <FileSpreadsheet className="w-6 h-6 mx-auto text-[#6a8099] mb-2" />
              <div className="text-xs text-[#6a8099]">{form.file_data ? 'File selected ✅' : 'Click or drop a file'}</div>
              <input type="file" accept="application/pdf,image/*" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
            </label>
          </Label>
        </div>
        <button onClick={save} disabled={loading} className="btn-primary w-full mt-4">{loading ? 'Uploading…' : 'Save report'}</button>
      </motion.div>
    </div>
  )
}
function Label({ l, children }) { return <div><label className="text-xs uppercase tracking-wider text-[#6a8099] mb-1 block">{l}</label>{children}</div> }
