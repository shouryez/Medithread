'use client'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { Hospital, Sparkles, ArrowLeft } from 'lucide-react'

export default function HospitalLogin() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0b0e14' }}>
      <div className="max-w-md w-full text-center">
        <Link href="/" className="inline-flex items-center gap-2 text-xs text-[#6a8099] hover:text-[#a855f7] mb-6"><ArrowLeft className="w-3 h-3" /> Back</Link>
        <Logo size="lg" />
        <div className="card-accent-purple p-8 mt-6">
          <Hospital className="w-10 h-10 text-[#a855f7] mx-auto mb-3" />
          <h1 className="text-2xl font-bold mb-2">Hospital Portal</h1>
          <p className="text-sm text-[#6a8099] mb-4">Coming soon — we're onboarding partner hospitals one by one.</p>
          <div className="inline-flex items-center gap-2 text-xs text-[#a855f7] mb-4"><Sparkles className="w-3 h-3" /> Email partnerships@medithread.in to join the pilot</div>
          <Link href="/login" className="btn-secondary text-sm inline-block mt-4">I'm a patient →</Link>
        </div>
      </div>
    </div>
  )
}
