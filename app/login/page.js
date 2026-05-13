'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { ArrowRight, Loader2 } from 'lucide-react'

export default function Login() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [devCode, setDevCode] = useState(null)
  const inputsRef = useRef([])

  const sendOtp = async () => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length !== 10) return toast.error('Enter a valid 10-digit mobile number')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: digits }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      if (data._dev_code) setDevCode(data._dev_code)
      toast.success(data._sent ? `OTP sent via ${data.channel}` : 'OTP generated — check below for code')
      setStep(2)
      setTimeout(() => inputsRef.current[0]?.focus(), 100)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  const onOtpChange = (i, val) => {
    const v = val.replace(/\D/g, '').slice(0, 1)
    const next = [...otp]; next[i] = v; setOtp(next)
    if (v && i < 5) inputsRef.current[i + 1]?.focus()
  }
  const onOtpKey = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) inputsRef.current[i - 1]?.focus()
  }

  const verifyOtp = async () => {
    const code = otp.join('')
    if (code.length !== 6) return toast.error('Enter the 6-digit code')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phone.replace(/\D/g, ''), code }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invalid OTP')
      toast.success('Welcome to MediThread')
      router.push(data.hasPatient ? '/dashboard' : '/register')
    } catch (e) { toast.error(e.message); setOtp(['', '', '', '', '', '']); inputsRef.current[0]?.focus() } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0b0e14' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/"><Logo size="lg" /></Link>
          <p className="text-[#6a8099] mt-3 text-sm">Sign in to access your health record</p>
        </div>
        <div className="card-accent-cyan p-8">
          {step === 1 ? (
            <div>
              <label className="text-xs uppercase tracking-wider text-[#6a8099] mb-2 block">Mobile number</label>
              <div className="flex gap-2">
                <span className="input-dark font-mono w-20 text-center flex items-center justify-center">+91</span>
                <input className="input-dark flex-1" inputMode="numeric" maxLength={10} placeholder="9876543210" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} onKeyDown={e => e.key === 'Enter' && sendOtp()} autoFocus />
              </div>
              <button onClick={sendOtp} disabled={loading} className="btn-primary w-full mt-6 inline-flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send OTP <ArrowRight className="w-4 h-4" /></>}
              </button>
              <div className="mt-6 text-center text-sm text-[#6a8099]">New here? <Link href="/register" className="text-[#00e5ff] hover:underline">Create MediID</Link></div>
            </div>
          ) : (
            <div>
              <button onClick={() => setStep(1)} className="text-xs text-[#6a8099] hover:text-[#00e5ff] mb-4">← Change number</button>
              <label className="text-xs uppercase tracking-wider text-[#6a8099] mb-2 block">Enter 6-digit code</label>
              <div className="text-xs text-[#6a8099] mb-4">Sent to +91 {phone}</div>
              <div className="flex gap-2 justify-center">
                {otp.map((d, i) => (
                  <input key={i} ref={el => inputsRef.current[i] = el} value={d} onChange={e => onOtpChange(i, e.target.value)} onKeyDown={e => onOtpKey(i, e)}
                    inputMode="numeric" maxLength={1}
                    className="w-12 h-14 text-center text-xl font-bold input-dark font-mono" />
                ))}
              </div>
              {devCode && (
                <div className="mt-4 text-center text-xs text-[#ffab40] font-mono">Dev code: {devCode}</div>
              )}
              <button onClick={verifyOtp} disabled={loading} className="btn-primary w-full mt-6 inline-flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify & Continue <ArrowRight className="w-4 h-4" /></>}
              </button>
              <button onClick={sendOtp} disabled={loading} className="w-full mt-3 text-xs text-[#6a8099] hover:text-[#00e5ff]">Resend OTP</button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
