'use client'
import { useRef, useState } from 'react'
import Webcam from 'react-webcam'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { Camera, Upload, ShieldCheck, X, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'

export default function StaffVerification({ onVerified, onCancel }) {
  const [step, setStep] = useState(1) // 1 selfie, 2 id, 3 match
  const [selfie, setSelfie] = useState(null)
  const [govtId, setGovtId] = useState(null)
  const [matching, setMatching] = useState(false)
  const [result, setResult] = useState(null)
  const [attempts, setAttempts] = useState(0)
  const camRef = useRef(null)

  const capture = () => {
    const img = camRef.current?.getScreenshot()
    if (img) { setSelfie(img); }
  }

  const onFile = (f) => {
    if (!f) return
    if (f.size > 4 * 1024 * 1024) return toast.error('File must be < 4MB')
    const reader = new FileReader()
    reader.onload = () => setGovtId(reader.result)
    reader.readAsDataURL(f)
  }

  const runMatch = async () => {
    setMatching(true); setResult(null)
    try {
      const r = await fetch('/api/verify/face-match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selfieBase64: selfie, govtIdBase64: govtId }) })
      const d = await r.json()
      setResult(d)
      if (d.ok && d.token) {
        setTimeout(() => onVerified(d.token), 700)
      } else {
        const a = attempts + 1; setAttempts(a)
        if (a >= 3) { toast.error('Verification failed. This attempt has been logged.'); setTimeout(onCancel, 1200) }
      }
    } catch (e) { toast.error('Verification service unavailable') } finally { setMatching(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-lg my-8 card-accent-purple p-6">
        <div className="flex items-center justify-between mb-4">
          <div><h2 className="text-xl font-bold inline-flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[#a855f7]" /> Staff Verification</h2><p className="text-xs text-[#6a8099] mt-1">Required before creating a visit record.</p></div>
          <button onClick={onCancel}><X className="w-4 h-4 text-[#6a8099]" /></button>
        </div>
        <div className="flex items-center gap-2 mb-5">
          {[1, 2, 3].map(n => <div key={n} className="flex-1 h-1 rounded-full" style={{ background: step >= n ? '#a855f7' : '#1e2a40' }} />)}
        </div>

        {step === 1 && (
          <div>
            <div className="text-sm font-semibold mb-1">1. Live selfie</div>
            <div className="text-xs text-[#6a8099] mb-4">Look at camera and blink once.</div>
            <div className="rounded-xl overflow-hidden" style={{ background: '#0b0e14', border: '1px solid #1e2a40' }}>
              {selfie ? <img src={selfie} alt="selfie" className="w-full h-64 object-cover" /> : <Webcam ref={camRef} screenshotFormat="image/jpeg" mirrored audio={false} videoConstraints={{ facingMode: 'user' }} className="w-full h-64 object-cover" />}
            </div>
            <div className="flex gap-2 mt-3">
              {selfie ? <><button onClick={() => setSelfie(null)} className="btn-secondary flex-1 text-sm">Retake</button><button onClick={() => setStep(2)} className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: '#a855f7', color: '#0b0e14' }}>Continue</button></>
                       : <button onClick={capture} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: '#a855f7', color: '#0b0e14' }}><Camera className="w-4 h-4" /> Capture</button>}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="text-sm font-semibold mb-1">2. Government ID</div>
            <div className="text-xs text-[#6a8099] mb-4">Upload Aadhaar or Medical Council License (JPG/PNG/PDF, max 4MB)</div>
            {govtId ? <div className="rounded-xl overflow-hidden mb-3" style={{ background: '#0b0e14', border: '1px solid #1e2a40' }}>
              {govtId.startsWith('data:application/pdf') ? <div className="h-40 flex items-center justify-center text-[#6a8099] text-sm">PDF uploaded ✓</div> : <img src={govtId} alt="id" className="w-full h-40 object-contain" />}
            </div> : (
              <label className="block p-8 rounded-xl text-center cursor-pointer mb-3" style={{ background: '#0b0e14', border: '1px dashed #1e2a40' }}>
                <Upload className="w-6 h-6 mx-auto text-[#6a8099] mb-2" />
                <div className="text-xs text-[#6a8099]">Click or drop file</div>
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
              </label>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="btn-secondary flex-1 text-sm">Back</button>
              <button disabled={!govtId} onClick={() => setStep(3)} className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: govtId ? '#a855f7' : '#1e2a40', color: govtId ? '#0b0e14' : '#6a8099' }}>Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="text-sm font-semibold mb-1">3. Face match</div>
            <div className="text-xs text-[#6a8099] mb-4">Gemini Vision compares your selfie with the ID photo.</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="rounded-lg overflow-hidden" style={{ background: '#0b0e14', border: '1px solid #1e2a40' }}><img src={selfie} className="w-full h-32 object-cover" /></div>
              <div className="rounded-lg overflow-hidden" style={{ background: '#0b0e14', border: '1px solid #1e2a40' }}>{govtId?.startsWith('data:application/pdf') ? <div className="h-32 flex items-center justify-center text-[#6a8099] text-xs">PDF</div> : <img src={govtId} className="w-full h-32 object-contain" />}</div>
            </div>
            {result && (
              <div className="p-3 rounded-lg mb-3" style={{ background: result.ok ? 'rgba(0,230,118,0.08)' : 'rgba(255,82,82,0.08)', border: `1px solid ${result.ok ? '#00e676' : '#ff5252'}` }}>
                {result.ok ? <div className="inline-flex items-center gap-2 text-[#00e676]"><CheckCircle2 className="w-4 h-4" /> Identity verified ✓ ({Math.round(result.confidence * 100)}%)</div>
                           : <div className="inline-flex items-center gap-2 text-[#ff5252]"><AlertTriangle className="w-4 h-4" /> Face match failed ({Math.round((result.confidence || 0) * 100)}%). Attempts remaining: {Math.max(0, 3 - attempts)}</div>}
                <div className="text-xs text-[#6a8099] mt-1">{result.reasoning}</div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="btn-secondary flex-1 text-sm">Back</button>
              <button onClick={runMatch} disabled={matching || (result?.ok)} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: '#a855f7', color: '#0b0e14' }}>
                {matching ? <><Loader2 className="w-4 h-4 animate-spin" /> Comparing…</> : 'Verify identity'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
