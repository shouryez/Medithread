'use client'
import PatientShell from '@/components/PatientShell'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts'
import { Plus, X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { format } from 'date-fns'

const METRICS = [
  { v: 'blood_sugar', l: 'Blood Sugar', unit: 'mg/dL', normal: { min: 70, max: 140 } },
  { v: 'blood_pressure', l: 'Blood Pressure', unit: 'mmHg', normal: { min: 60, max: 130 } },
  { v: 'hba1c', l: 'HbA1c', unit: '%', normal: { min: 4, max: 7 } },
  { v: 'weight', l: 'Weight', unit: 'kg', normal: { min: 50, max: 90 } },
  { v: 'heart_rate', l: 'Heart Rate', unit: 'bpm', normal: { min: 60, max: 100 } },
  { v: 'spo2', l: 'SpO2', unit: '%', normal: { min: 95, max: 100 } },
]

const RECS = {
  blood_sugar: 'Aim for 70–140 mg/dL post-meal. Reduce refined sugar, walk after meals, and stay hydrated.',
  blood_pressure: 'Target <130/80 mmHg. Reduce salt, manage stress, exercise 30 min/day.',
  hba1c: 'Below 7% is target for most adults with diabetes. Consistency in diet and meds is key.',
  weight: 'BMI in 18.5–24.9 is ideal. Focus on protein, sleep and resistance training.',
  heart_rate: 'Resting 60–100 bpm is normal. Athletes may be lower.',
  spo2: 'Above 95% is normal. Below 92% sustained warrants medical attention.',
}

export default function ChronicPage() { return <PatientShell><Inner /></PatientShell> }

function Inner() {
  const [metric, setMetric] = useState('blood_sugar')
  const [range, setRange] = useState('1M')
  const [data, setData] = useState([])
  const [show, setShow] = useState(false)
  const cur = METRICS.find(m => m.v === metric)

  const load = async () => {
    const r = await fetch(`/api/metrics?type=${metric}&range=${range}`).then(r => r.json())
    setData(r.metrics || [])
  }
  useEffect(() => { load() }, [metric, range])

  const chart = data.map(d => ({ ts: format(new Date(d.recorded_at), 'dd MMM'), value: d.value }))
  const vals = data.map(d => d.value)
  const latest = vals[vals.length - 1]
  const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—'
  const min = vals.length ? Math.min(...vals) : '—'
  const max = vals.length ? Math.max(...vals) : '—'
  const trend = vals.length >= 2 ? (vals[vals.length - 1] > vals[vals.length - 2] ? 'up' : vals[vals.length - 1] < vals[vals.length - 2] ? 'down' : 'flat') : 'flat'

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Chronic Tracker</h1>
          <p className="text-[#6a8099] text-sm mt-1">Plot your health metrics over time</p>
        </div>
        <button onClick={() => setShow(true)} className="btn-primary inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Log reading</button>
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {METRICS.map(m => (
          <button key={m.v} onClick={() => setMetric(m.v)} className="px-3 py-1.5 rounded-full text-xs transition" style={{ background: metric === m.v ? '#00e5ff' : '#111520', color: metric === m.v ? '#001318' : '#e2e8f4', border: '1px solid #1e2a40' }}>{m.l}</button>
        ))}
      </div>

      <div className="card-accent-cyan p-4 mb-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <div className="text-xs text-[#6a8099] uppercase tracking-wider">{cur.l} · {cur.unit}</div>
            <div className="text-2xl font-bold font-mono text-[#00e5ff]">{latest ?? '—'} <span className="text-xs text-[#6a8099] font-normal">latest</span></div>
          </div>
          <div className="flex gap-1">{['1W','1M','3M','6M','1Y'].map(r => (
            <button key={r} onClick={() => setRange(r)} className="px-2 py-1 rounded text-[10px]" style={{ background: range === r ? '#00e5ff' : 'transparent', color: range === r ? '#001318' : '#6a8099' }}>{r}</button>
          ))}</div>
        </div>
        <div style={{ width: '100%', height: 280 }}>
          {chart.length === 0 ? <div className="flex items-center justify-center h-full text-sm text-[#6a8099]">No readings yet — log your first one</div> :
            <ResponsiveContainer>
              <LineChart data={chart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#1e2a40" strokeDasharray="3 3" />
                <XAxis dataKey="ts" stroke="#6a8099" fontSize={10} />
                <YAxis stroke="#6a8099" fontSize={10} />
                <Tooltip contentStyle={{ background: '#0b0e14', border: '1px solid #1e2a40', borderRadius: 8, color: '#e2e8f4' }} />
                <ReferenceArea y1={cur.normal.min} y2={cur.normal.max} fill="#00e676" fillOpacity={0.05} />
                <ReferenceLine y={cur.normal.min} stroke="#00e676" strokeDasharray="4 4" strokeOpacity={0.5} />
                <ReferenceLine y={cur.normal.max} stroke="#00e676" strokeDasharray="4 4" strokeOpacity={0.5} />
                <Line type="monotone" dataKey="value" stroke="#00e5ff" strokeWidth={2.5} dot={{ fill: '#00e5ff', r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat l="Average" v={avg} unit={cur.unit} />
        <Stat l="Min" v={min} unit={cur.unit} />
        <Stat l="Max" v={max} unit={cur.unit} />
        <Stat l="Trend" v={trend === 'up' ? <span className="text-[#ff5252] inline-flex items-center gap-1"><TrendingUp className="w-4 h-4" /> Up</span> : trend === 'down' ? <span className="text-[#00e676] inline-flex items-center gap-1"><TrendingDown className="w-4 h-4" /> Down</span> : <span className="text-[#6a8099] inline-flex items-center gap-1"><Minus className="w-4 h-4" /> Flat</span>} />
      </div>

      <div className="card-accent-purple p-4">
        <div className="text-xs uppercase tracking-wider text-[#a855f7] mb-2 font-semibold">Recommendation</div>
        <div className="text-sm text-[#e2e8f4]">{RECS[metric]}</div>
      </div>

      {show && <LogModal metric={metric} unit={cur.unit} onClose={() => setShow(false)} onSaved={async () => { await load(); setShow(false) }} />}
    </div>
  )
}

function Stat({ l, v, unit }) {
  return <div className="card-accent-cyan p-3">
    <div className="text-[10px] text-[#6a8099] uppercase tracking-wider">{l}</div>
    <div className="text-lg font-bold font-mono mt-1">{v} {typeof v === 'number' || typeof v === 'string' ? <span className="text-[10px] text-[#6a8099]">{unit}</span> : null}</div>
  </div>
}

function LogModal({ metric, unit, onClose, onSaved }) {
  const [form, setForm] = useState({ value: '', recorded_at: new Date().toISOString().slice(0, 16), notes: '' })
  const [loading, setLoading] = useState(false)
  const save = async () => {
    if (!form.value) return toast.error('Enter a value')
    setLoading(true)
    try {
      const r = await fetch('/api/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ metric_type: metric, unit, ...form }) })
      if (!r.ok) throw new Error('Failed')
      toast.success('Reading saved')
      onSaved()
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm card-accent-cyan p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">Log {METRICS.find(m=>m.v===metric)?.l}</h2><button onClick={onClose}><X className="w-4 h-4 text-[#6a8099]" /></button></div>
        <div className="space-y-3">
          <Label l={`Value (${unit})`}><input type="number" step="0.1" className="input-dark" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} autoFocus /></Label>
          <Label l="When"><input type="datetime-local" className="input-dark" value={form.recorded_at} onChange={e => setForm({ ...form, recorded_at: e.target.value })} /></Label>
          <Label l="Notes"><input className="input-dark" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="optional" /></Label>
        </div>
        <button onClick={save} disabled={loading} className="btn-primary w-full mt-4">{loading ? 'Saving…' : 'Save reading'}</button>
      </motion.div>
    </div>
  )
}
function Label({ l, children }) { return <div><label className="text-xs uppercase tracking-wider text-[#6a8099] mb-1 block">{l}</label>{children}</div> }
