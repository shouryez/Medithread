'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { AlertTriangle, Phone, Loader2, ShieldAlert } from 'lucide-react'

export default function EmergencyPage() {
  const { mediId } = useParams()
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    fetch(`/api/emergency/${encodeURIComponent(mediId)}`)
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Not found'); setData(d) })
      .catch(e => setErr(e.message))
  }, [mediId])

  if (err) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#0b0e14' }}>
        <ShieldAlert className="w-16 h-16 text-[#ff5252] mb-4" />
        <div className="text-xl font-bold mb-2">MediID not found</div>
        <div className="text-sm text-[#6a8099]">{err}</div>
      </div>
    )
  }
  if (!data) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b0e14' }}><Loader2 className="w-6 h-6 animate-spin text-[#ff5252]" /></div>
  }

  return (
    <div className="min-h-screen p-6" style={{ background: '#0b0e14' }}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6 p-4 rounded-xl" style={{ background: 'rgba(255,82,82,0.1)', border: '2px solid #ff5252' }}>
          <AlertTriangle className="w-8 h-8 text-[#ff5252]" />
          <div>
            <div className="text-xl font-extrabold text-[#ff5252] tracking-wide">🚨 MEDICAL EMERGENCY INFORMATION</div>
            <div className="text-xs text-[#e2e8f4] mt-1">For first-responders & ER staff · Verified MediThread record</div>
          </div>
        </div>

        <div className="mb-6 text-center">
          <div className="text-xs uppercase tracking-widest text-[#6a8099] mb-1">Patient</div>
          <div className="text-3xl font-bold">{data.first_name}</div>
          <div className="text-xs font-mono text-[#6a8099] mt-1">{data.medi_id}</div>
        </div>

        <div className="mb-6 p-6 rounded-xl text-center" style={{ background: 'rgba(255,82,82,0.12)', border: '2px solid #ff5252' }}>
          <div className="text-xs uppercase tracking-widest text-[#ff5252] mb-2 font-semibold">Blood Group</div>
          <div className="text-6xl md:text-7xl font-extrabold font-mono text-[#ff5252]">{data.blood_group || 'Unknown'}</div>
        </div>

        <div className="mb-6 p-5 rounded-xl" style={{ background: 'rgba(255,82,82,0.08)', border: '2px solid #ff5252' }}>
          <div className="text-xs uppercase tracking-widest text-[#ff5252] mb-3 font-semibold">⚠️ Allergies</div>
          {data.allergies?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {data.allergies.map(a => (
                <span key={a} className="text-lg md:text-xl font-bold px-4 py-2 rounded-lg" style={{ background: '#ff5252', color: '#0b0e14' }}>{a}</span>
              ))}
            </div>
          ) : <div className="text-[#6a8099]">No known allergies</div>}
        </div>

        <div className="mb-6 p-5 rounded-xl" style={{ background: 'rgba(255,171,64,0.06)', border: '1px solid #ffab40' }}>
          <div className="text-xs uppercase tracking-widest text-[#ffab40] mb-3 font-semibold">Chronic conditions</div>
          {data.chronic_conditions?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {data.chronic_conditions.map(a => (
                <span key={a} className="text-sm font-semibold px-3 py-1.5 rounded-md" style={{ background: 'rgba(255,171,64,0.2)', color: '#ffab40', border: '1px solid #ffab40' }}>{a}</span>
              ))}
            </div>
          ) : <div className="text-[#6a8099]">None recorded</div>}
        </div>

        {data.emergency_contact_phone && (
          <a href={`tel:${data.emergency_contact_phone}`} className="block p-5 rounded-xl text-center transition hover:scale-[1.01]" style={{ background: '#00e676', color: '#001d10' }}>
            <div className="text-xs uppercase tracking-widest mb-1 font-semibold">Tap to call emergency contact</div>
            <div className="text-2xl font-bold inline-flex items-center gap-2"><Phone className="w-5 h-5" /> {data.emergency_contact_name || 'Contact'}</div>
            <div className="text-lg font-mono mt-1">{data.emergency_contact_phone}</div>
          </a>
        )}

        <div className="text-[10px] text-[#6a8099] text-center mt-8 leading-relaxed">
          This information is provided by MediThread to assist emergency responders. It is not a substitute for clinical evaluation. Full medical history requires patient consent.
        </div>
      </motion.div>
    </div>
  )
}
