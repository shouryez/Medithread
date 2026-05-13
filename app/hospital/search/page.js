'use client'
import HospitalShell from '@/components/HospitalShell'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, AlertTriangle, Shield, ArrowRight, Loader2, UserX } from 'lucide-react'

export default function HSearch() { return <HospitalShell><Inner /></HospitalShell> }
function Inner() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState(null)
  const [searched, setSearched] = useState(false)
  const [phase, setPhase] = useState('idle') // idle | otp
  const [consentId, setConsentId] = useState(null)
  const [devOtp, setDevOtp] = useState(null)
  const [otp, setOtp] = useState(['','','','','',''])
  const otpRefs = useRef([])
  const [verifying, setVerifying] = useState(false)

  const search = async (e) => {
    e?.preventDefault()
    if (!q.trim()) return
    setSearching(true); setSearched(true); setResult(null); setPhase('idle')
    try {
      const r = await fetch(`/api/hospital/search?q=${encodeURIComponent(q.trim())}`).then(r => r.json())
      setResult(r.patient)
    } catch (e) { toast.error('Search failed') } finally { setSearching(false) }
  }

  const requestConsent = async () => {
    if (!result) return
    try {
      const r = await fetch('/api/consent/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patient_id: result.id }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed')
      setConsentId(d.consent_id); setDevOtp(d._dev_otp); setPhase('otp')
      toast.success(d._sent ? 'OTP sent to patient’s WhatsApp' : 'OTP generated — ask patient for code')
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch (e) { toast.error(e.message) }
  }

  const onOtp = (i, val) => {
    if (i === 0 && val.length > 1) {
      const d = val.replace(/\D/g, '').slice(0, 6)
      setOtp(d.split('').concat(Array(6 - d.length).fill('')))
      otpRefs.current[Math.min(d.length, 5)]?.focus(); return
    }
    const v = val.replace(/\D/g, '').slice(0, 1)
    const arr = [...otp]; arr[i] = v; setOtp(arr)
    if (v && i < 5) otpRefs.current[i + 1]?.focus()
  }
  const onOtpKey = (i, e) => { if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus() }

  const verify = async () => {
    const code = otp.join('')
    if (code.length !== 6) return toast.error('Enter all 6 digits')
    setVerifying(true)
    try {
      const r = await fetch('/api/consent/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consent_id: consentId, otp_code: code }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed')
      toast.success('Access granted')
      router.push(`/hospital/patient/${d.medi_id}`)
    } catch (e) { toast.error(e.message); setOtp(['','','','','','']); otpRefs.current[0]?.focus() } finally { setVerifying(false) }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Find Patient</h1>
        <p className="text-[#6a8099] text-sm mt-1">Look up by MediID or phone number. The patient will be asked to approve access.</p>
      </div>
      <form onSubmit={search} className="relative max-w-2xl mx-auto mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6a8099]" />
        <input autoFocus className="input-dark pl-12 py-4 text-base" placeholder="MT-2025-BLR-12345678 or 9876543210" value={q} onChange={e => setQ(e.target.value)} style={{ borderColor: q ? '#a855f7' : '#1e2a40' }} />
      </form>

      <AnimatePresence mode="wait">
        {searching && <motion.div key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[#a855f7]" /></motion.div>}
        {!searching && searched && !result && (
          <motion.div key="nf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-md mx-auto text-center card-accent-purple p-8">
            <UserX className="w-10 h-10 text-[#6a8099] mx-auto mb-3" />
            <div className="text-lg font-semibold mb-1">No patient found</div>
            <div className="text-sm text-[#6a8099]">Ask them to register at <span className="font-mono text-[#a855f7]">/register</span></div>
          </motion.div>
        )}
        {!searching && result && (
          <motion.div key="r" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto card-accent-purple p-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl flex-shrink-0" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid #a855f7' }}>
                {result.full_name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xl font-bold">{result.full_name}</div>
                <div className="font-mono text-sm text-[#a855f7]">{result.medi_id}</div>
                <div className="text-xs text-[#6a8099] mt-1 flex flex-wrap gap-x-2"><span>{result.dob}</span>·<span className="capitalize">{result.gender}</span>·<span className="font-mono">{result.blood_group}</span>·<span>{result.phone_masked}</span></div>
              </div>
            </div>
            {result.allergies?.length > 0 && (
              <div className="mt-4 p-3 rounded-lg flex items-center gap-3 pulse-red" style={{ background: 'rgba(255,82,82,0.08)', border: '1px solid #ff5252' }}>
                <AlertTriangle className="w-4 h-4 text-[#ff5252]" />
                <div><div className="text-xs uppercase tracking-wider font-semibold text-[#ff5252]">Allergies</div><div className="text-sm">{result.allergies.join(' · ')}</div></div>
              </div>
            )}
            {result.chronic_conditions?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{result.chronic_conditions.map(c => <span key={c} className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(255,171,64,0.12)', color: '#ffab40', border: '1px solid #ffab40' }}>{c}</span>)}</div>}
            {phase === 'idle' ? (
              <button onClick={requestConsent} className="w-full mt-6 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold" style={{ background: '#a855f7', color: '#0b0e14' }}>
                <Shield className="w-4 h-4" /> Request Access
              </button>
            ) : (
              <div className="mt-6 p-4 rounded-lg" style={{ background: '#0b0e14', border: '1px solid #1e2a40' }}>
                <div className="text-xs uppercase tracking-wider text-[#6a8099] font-semibold mb-2">OTP sent to patient’s WhatsApp</div>
                <div className="text-xs text-[#6a8099] mb-4">Ask the patient to read out the 6-digit code they received.</div>
                <div className="flex gap-2 justify-center">{otp.map((d, i) => <input key={i} ref={el => otpRefs.current[i] = el} value={d} onChange={e => onOtp(i, e.target.value)} onKeyDown={e => onOtpKey(i, e)} inputMode="numeric" maxLength={1} className="w-12 h-14 text-center text-xl font-bold input-dark font-mono" />)}</div>
                {devOtp && <button type="button" onClick={() => { setOtp(devOtp.split('')); otpRefs.current[5]?.focus() }} className="mt-3 w-full text-center text-xs text-[#ffab40] font-mono hover:underline">Tap to auto-fill demo OTP: {devOtp}</button>}
                <button onClick={verify} disabled={verifying} className="w-full mt-4 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold" style={{ background: '#a855f7', color: '#0b0e14' }}>{verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify & Access Record <ArrowRight className="w-4 h-4" /></>}</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
