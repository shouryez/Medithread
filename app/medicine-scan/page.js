'use client'
import PatientShell from '@/components/PatientShell'
import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Camera, Upload, Sparkles, Loader2, AlertTriangle, ShieldCheck,
  Pill, FlaskConical, Heart, BookOpen, X, Image as ImageIcon, RotateCw,
} from 'lucide-react'

export default function MedicineScanPage() { return <PatientShell><Inner /></PatientShell> }

function Inner() {
  const [image, setImage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const fileRef = useRef(null)

  const onFile = (f) => {
    if (!f) return
    if (f.size > 5 * 1024 * 1024) return toast.error('Image must be < 5MB')
    const reader = new FileReader()
    reader.onload = () => { setImage(reader.result); setResult(null) }
    reader.readAsDataURL(f)
  }

  const scan = async () => {
    if (!image) return toast.error('Upload an image first')
    setLoading(true); setResult(null)
    try {
      const r = await fetch('/api/ai/medicine-scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: image }) })
      const d = await r.json()
      setResult(d)
      if (d.error) toast.error(d.error)
      else toast.success(`Identified: ${d.name || d.generic_name || 'medicine'}`)
    } catch (e) { toast.error('Scan failed') } finally { setLoading(false) }
  }

  const reset = () => { setImage(null); setResult(null) }

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">Scan Medicine</h1>
            <p className="text-[#6a8099] text-sm mt-1 inline-flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-[#a855f7]" /> Snap a photo of any tablet, strip or syrup bottle — Gemini Vision will tell you what it is.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-4">
          {/* Upload column */}
          <div className="lg:col-span-2 card-accent-cyan p-5">
            <div className="text-xs uppercase tracking-wider text-[#6a8099] mb-3 font-semibold">Image</div>
            {image ? (
              <div className="relative rounded-xl overflow-hidden" style={{ background: '#0b0e14', border: '1px solid #1e2a40' }}>
                <img src={image} alt="medicine" className="w-full h-80 object-contain" />
                <button onClick={reset} className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(11,14,20,0.8)', border: '1px solid #1e2a40' }}>
                  <X className="w-4 h-4 text-[#e2e8f4]" />
                </button>
              </div>
            ) : (
              <label className="block p-8 rounded-xl text-center cursor-pointer transition hover:border-[#00e5ff]" style={{ background: '#0b0e14', border: '1px dashed #1e2a40' }}>
                <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                  <ImageIcon className="w-10 h-10 mx-auto text-[#00e5ff] mb-3" />
                </motion.div>
                <div className="text-sm font-semibold mb-1">Upload medicine photo</div>
                <div className="text-xs text-[#6a8099]">JPG / PNG · max 5MB</div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
              </label>
            )}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <label className="btn-secondary text-sm inline-flex items-center justify-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4" /> Upload
                <input type="file" accept="image/*" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
              </label>
              <label className="btn-secondary text-sm inline-flex items-center justify-center gap-2 cursor-pointer">
                <Camera className="w-4 h-4" /> Camera
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
              </label>
            </div>
            <button onClick={scan} disabled={!image || loading} className="btn-primary w-full mt-3 inline-flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing with Gemini Vision…</> : <><Sparkles className="w-4 h-4" /> Analyze medicine</>}
            </button>
            <div className="mt-4 p-3 rounded-md text-[10px] text-[#6a8099] leading-relaxed" style={{ background: 'rgba(255,82,82,0.06)', border: '1px solid rgba(255,82,82,0.2)' }}>
              ⚠ This AI tool is for general information only. Always verify dosage with a qualified doctor or pharmacist before taking any medicine.
            </div>
          </div>

          {/* Result column */}
          <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
              {loading && (
                <motion.div key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card-accent-cyan p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Loader2 className="w-5 h-5 animate-spin text-[#00e5ff]" />
                    <div className="text-sm text-[#e2e8f4]">Gemini Vision is examining the image…</div>
                  </div>
                  <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="shimmer h-3 rounded" style={{ width: `${70 + Math.random() * 30}%` }} />)}</div>
                </motion.div>
              )}
              {!loading && !result && (
                <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card-accent-cyan p-10 text-center">
                  <Pill className="w-12 h-12 text-[#6a8099] mx-auto mb-3" />
                  <div className="text-lg font-semibold mb-1">Upload a medicine to begin</div>
                  <div className="text-sm text-[#6a8099] max-w-md mx-auto">Clear photos of the package, strip, or bottle work best. Pills alone can be hard to identify.</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-6 max-w-md mx-auto text-[10px] text-[#6a8099]">
                    {['Tablets', 'Capsules', 'Syrup bottles', 'Inhalers'].map(t => <div key={t} className="p-2 rounded" style={{ background: '#0b0e14', border: '1px dashed #1e2a40' }}>{t}</div>)}
                  </div>
                </motion.div>
              )}
              {!loading && result?.error && (
                <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card-accent-cyan p-6 text-center">
                  <AlertTriangle className="w-10 h-10 text-[#ff5252] mx-auto mb-3" />
                  <div className="font-semibold mb-1">Could not identify medicine</div>
                  <div className="text-sm text-[#6a8099] mb-4">{result.error}</div>
                  <button onClick={reset} className="btn-secondary text-sm inline-flex items-center gap-2"><RotateCw className="w-3 h-3" /> Try another image</button>
                </motion.div>
              )}
              {!loading && result && !result.error && <Result data={result} />}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function Result({ data }) {
  const safety = {
    safe: { c: '#00e676', l: 'Safe' }, caution: { c: '#ffab40', l: 'Use with caution' },
    unsafe: { c: '#ff5252', l: 'Avoid' }, unknown: { c: '#6a8099', l: 'Consult doctor' },
  }[data.pregnancy_safety] || null
  const confidence = data.confidence ? Math.round(data.confidence * 100) : null
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Header card */}
      <div className="card-accent-cyan p-5" style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.06), rgba(168,85,247,0.04))' }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-[#00e5ff] mb-1 inline-flex items-center gap-1"><Sparkles className="w-3 h-3" /> Identified by Gemini Vision</div>
            <div className="text-2xl font-bold">{data.name || data.generic_name || 'Unknown'}</div>
            {data.generic_name && data.name !== data.generic_name && <div className="text-sm text-[#6a8099]">Generic: {data.generic_name}</div>}
            <div className="flex flex-wrap gap-2 mt-3 text-xs">
              {data.strength && <span className="font-mono px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,229,255,0.12)', color: '#00e5ff', border: '1px solid #00e5ff' }}>{data.strength}</span>}
              {data.form && <span className="capitalize px-2 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.4)' }}>{data.form}</span>}
              {data.category && <span className="px-2 py-0.5 rounded-full text-[#6a8099]" style={{ border: '1px solid #1e2a40' }}>{data.category}</span>}
            </div>
            {data.manufacturer && <div className="text-xs text-[#6a8099] mt-2">Manufacturer: {data.manufacturer}</div>}
          </div>
          {confidence !== null && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-[#6a8099]">Confidence</div>
              <div className="text-2xl font-bold font-mono" style={{ color: confidence >= 75 ? '#00e676' : confidence >= 50 ? '#ffab40' : '#ff5252' }}>{confidence}%</div>
            </div>
          )}
        </div>
      </div>

      {/* Uses + dosage */}
      <div className="grid md:grid-cols-2 gap-4">
        <Section title="What it's used for" icon={<BookOpen className="w-4 h-4" />} tone="cyan">
          <ul className="space-y-1.5 text-sm">{(data.uses || []).map((u, i) => <li key={i} className="flex gap-2"><span className="text-[#00e5ff]">•</span><span>{u}</span></li>)}</ul>
        </Section>
        <Section title="Typical dosage" icon={<Pill className="w-4 h-4" />} tone="cyan">
          <div className="text-sm text-[#e2e8f4]">{data.typical_dosage || '—'}</div>
          <div className="text-[10px] text-[#6a8099] mt-2">Your doctor's prescription always overrides this.</div>
        </Section>
      </div>

      {/* Side effects */}
      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Common side effects" icon={<Heart className="w-4 h-4" />} tone="amber">
          <div className="flex flex-wrap gap-1.5">{(data.common_side_effects || []).map((e, i) => <span key={i} className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(255,171,64,0.1)', color: '#ffab40', border: '1px solid rgba(255,171,64,0.4)' }}>{e}</span>)}</div>
        </Section>
        <Section title="Serious side effects" icon={<AlertTriangle className="w-4 h-4" />} tone="danger">
          <div className="flex flex-wrap gap-1.5">{(data.serious_side_effects || []).map((e, i) => <span key={i} className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(255,82,82,0.1)', color: '#ff5252', border: '1px solid #ff5252' }}>{e}</span>)}</div>
          <div className="text-[10px] text-[#6a8099] mt-2">Seek immediate help if any of these occur.</div>
        </Section>
      </div>

      {/* Warnings + interactions */}
      <Section title="Warnings" icon={<AlertTriangle className="w-4 h-4" />} tone="danger">
        <ul className="space-y-1.5 text-sm">{(data.warnings || []).map((w, i) => <li key={i} className="flex gap-2"><span className="text-[#ff5252]">!</span><span>{w}</span></li>)}</ul>
      </Section>

      {(data.avoid_with || []).length > 0 && (
        <Section title="Avoid with" icon={<FlaskConical className="w-4 h-4" />} tone="amber">
          <div className="flex flex-wrap gap-1.5">{data.avoid_with.map((w, i) => <span key={i} className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(255,171,64,0.1)', color: '#ffab40', border: '1px solid rgba(255,171,64,0.4)' }}>{w}</span>)}</div>
        </Section>
      )}

      {/* Footer info */}
      <div className="grid md:grid-cols-2 gap-4">
        {safety && (
          <div className="card-accent-cyan p-4">
            <div className="text-[10px] uppercase tracking-wider text-[#6a8099] mb-1">Pregnancy safety</div>
            <div className="text-lg font-semibold" style={{ color: safety.c }}>{safety.l}</div>
          </div>
        )}
        {data.storage && (
          <div className="card-accent-cyan p-4">
            <div className="text-[10px] uppercase tracking-wider text-[#6a8099] mb-1">Storage</div>
            <div className="text-sm">{data.storage}</div>
          </div>
        )}
      </div>

      {data.disclaimer && (
        <div className="p-3 rounded-md text-[11px] text-[#6a8099] leading-relaxed text-center" style={{ background: '#111520', border: '1px solid #1e2a40' }}>
          <ShieldCheck className="w-3 h-3 inline mr-1" /> {data.disclaimer}
        </div>
      )}
    </motion.div>
  )
}

function Section({ title, icon, tone, children }) {
  const tones = {
    cyan: { c: '#00e5ff' }, amber: { c: '#ffab40' }, danger: { c: '#ff5252' },
  }
  const t = tones[tone] || tones.cyan
  return (
    <div className="rounded-xl p-4" style={{ background: '#111520', border: '1px solid #1e2a40', position: 'relative', overflow: 'hidden' }}>
      <span className="absolute top-0 left-0 right-0 h-0.5" style={{ background: t.c, opacity: 0.5 }} />
      <div className="text-xs uppercase tracking-wider mb-2 font-semibold inline-flex items-center gap-2" style={{ color: t.c }}>{icon} {title}</div>
      {children}
    </div>
  )
}
