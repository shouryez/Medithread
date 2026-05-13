'use client'
import HospitalShell from '@/components/HospitalShell'
import { useEffect, useState } from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { Users, Activity, Pill, FileText } from 'lucide-react'

const COLORS = ['#a855f7', '#00e5ff', '#00e676', '#ffab40', '#ff5252', '#5cf0ff', '#c4b5fd']

export default function HAnalytics() { return <HospitalShell><Inner /></HospitalShell> }
function Inner() {
  const [d, setD] = useState(null)
  useEffect(() => { fetch('/api/hospital/analytics').then(r => r.json()).then(setD) }, [])
  if (!d) return <div className="shimmer h-64 rounded-xl" />
  const stats = [
    { l: 'Total patients', v: d.totals.totalPatients, I: Users },
    { l: 'Total visits', v: d.totals.totalVisits, I: Activity },
    { l: 'Prescriptions', v: d.totals.totalRx, I: Pill },
    { l: 'Reports', v: d.totals.totalReports, I: FileText },
  ]
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Analytics</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">{stats.map(s => { const I = s.I; return (
        <div key={s.l} className="p-4 rounded-xl relative overflow-hidden" style={{ background: '#111520', border: '1px solid #1e2a40' }}>
          <span className="absolute top-0 left-0 right-0 h-0.5" style={{ background: '#a855f7', opacity: 0.7 }} />
          <I className="w-4 h-4 text-[#a855f7] mb-2 opacity-60" />
          <div className="text-xs text-[#6a8099] uppercase tracking-wider">{s.l}</div>
          <div className="text-3xl font-bold mt-1 text-[#a855f7]">{s.v}</div>
        </div>
      )})}</div>
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="card-accent-purple p-4"><div className="text-xs uppercase tracking-wider text-[#a855f7] mb-2 font-semibold">Visits last 6 months</div>
          <div style={{ width: '100%', height: 240 }}><ResponsiveContainer><BarChart data={d.visitsByMonth}><CartesianGrid stroke="#1e2a40" strokeDasharray="3 3" /><XAxis dataKey="month" stroke="#6a8099" fontSize={10} /><YAxis stroke="#6a8099" fontSize={10} /><Tooltip contentStyle={{ background: '#0b0e14', border: '1px solid #1e2a40', borderRadius: 8 }} /><Bar dataKey="count" fill="#a855f7" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </div>
        <div className="card-accent-purple p-4"><div className="text-xs uppercase tracking-wider text-[#a855f7] mb-2 font-semibold">Visits by department</div>
          <div style={{ width: '100%', height: 240 }}><ResponsiveContainer><PieChart><Pie data={d.visitsByDept} dataKey="count" nameKey="dept" innerRadius={50} outerRadius={80} paddingAngle={2}>{d.visitsByDept.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ background: '#0b0e14', border: '1px solid #1e2a40', borderRadius: 8 }} /><Legend wrapperStyle={{ fontSize: 11, color: '#6a8099' }} /></PieChart></ResponsiveContainer></div>
        </div>
      </div>
      <div className="card-accent-purple p-4 mb-4"><div className="text-xs uppercase tracking-wider text-[#a855f7] mb-2 font-semibold">Staff activity this month</div>
        <div style={{ width: '100%', height: 200 }}><ResponsiveContainer><BarChart data={d.staffActivity} layout="vertical"><CartesianGrid stroke="#1e2a40" strokeDasharray="3 3" /><XAxis type="number" stroke="#6a8099" fontSize={10} /><YAxis dataKey="name" type="category" stroke="#6a8099" fontSize={10} width={100} /><Tooltip contentStyle={{ background: '#0b0e14', border: '1px solid #1e2a40', borderRadius: 8 }} /><Bar dataKey="count" fill="#00e5ff" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div>
      </div>
      <div className="card-accent-purple p-4"><div className="text-xs uppercase tracking-wider text-[#a855f7] mb-3 font-semibold">Common diagnoses</div>
        <div className="space-y-2">{d.topDiagnoses.length === 0 ? <div className="text-sm text-[#6a8099]">Not enough data yet.</div> :
          d.topDiagnoses.map((t, i) => { const pct = (t.count / d.topDiagnoses[0].count) * 100; return (
            <div key={i} className="text-sm"><div className="flex items-center justify-between mb-1"><span>{t.diagnosis}</span><span className="text-xs text-[#6a8099]">{t.count}</span></div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#0b0e14' }}><div className="h-full" style={{ width: `${pct}%`, background: '#00e5ff' }} /></div>
            </div>
          )})
        }</div>
      </div>
    </div>
  )
}
