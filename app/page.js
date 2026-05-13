'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ShieldCheck, Activity, QrCode, ArrowRight, Hospital, Lock, Sparkles } from 'lucide-react'
import Logo from '@/components/Logo'

export default function Landing() {
  return (
    <div style={{ background: '#0b0e14', minHeight: '100vh' }}>
      {/* navbar */}
      <nav className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: '#1e2a40' }}>
        <Logo />
        <div className="flex items-center gap-3">
          <Link href="/hospital/login" className="text-sm text-[#6a8099] hover:text-[#a855f7] transition">For Hospitals</Link>
          <Link href="/login" className="text-sm text-[#e2e8f4] hover:text-[#00e5ff] transition px-3 py-2">Sign In</Link>
          <Link href="/register" className="btn-primary text-sm">Register Free</Link>
        </div>
      </nav>

      {/* hero */}
      <section className="max-w-5xl mx-auto px-8 pt-20 pb-16 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8" style={{ background: '#111520', border: '1px solid #1e2a40' }}>
            <Sparkles className="w-4 h-4 text-[#00e5ff]" />
            <span className="text-xs text-[#6a8099]">India's Universal Patient Health Record</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
            One ID. <span className="text-[#00e5ff]">Every hospital.</span><br /> Your entire life.
          </h1>
          <p className="text-lg md:text-xl text-[#6a8099] max-w-2xl mx-auto mb-10">
            Stop carrying paper files. Your MediID unlocks your complete medical history at any hospital — instantly, securely, and free forever.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/register" className="btn-primary inline-flex items-center gap-2">
              Get your MediID <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/hospital/login" className="btn-secondary inline-flex items-center gap-2">
              <Hospital className="w-4 h-4" /> For Hospitals
            </Link>
          </div>
        </motion.div>
      </section>

      {/* stats */}
      <section className="max-w-5xl mx-auto px-8 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { v: '3.5B', l: 'OPD visits in India each year' },
            { v: '0%', l: 'records shared across hospitals' },
            { v: '₹0', l: 'cost to patients, forever' },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }}
              className="card-accent-cyan p-6 text-center">
              <div className="text-4xl font-bold text-[#00e5ff] mb-1">{s.v}</div>
              <div className="text-sm text-[#6a8099]">{s.l}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* features */}
      <section className="max-w-5xl mx-auto px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { I: QrCode, t: 'MediID Card with QR', d: 'A unique lifelong ID with a QR. Show it at any hospital to give consented access.' },
            { I: ShieldCheck, t: 'Patient-controlled consent', d: 'Hospitals ask before reading anything. Approve or deny in one tap. Auto-expires in 4 hours.' },
            { I: Activity, t: 'AI-powered visit summaries', d: 'Gemini translates doctor notes into plain English so you actually understand your care.' },
          ].map((f, i) => {
            const Icon = f.I
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.1 }}
                className="card-accent-cyan p-6">
                <Icon className="w-7 h-7 text-[#00e5ff] mb-4" />
                <h3 className="font-semibold text-lg mb-2">{f.t}</h3>
                <p className="text-sm text-[#6a8099] leading-relaxed">{f.d}</p>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* footer */}
      <footer className="max-w-5xl mx-auto px-8 py-10 mt-10 border-t flex items-center justify-between" style={{ borderColor: '#1e2a40' }}>
        <Logo size="sm" />
        <div className="text-xs text-[#6a8099] flex items-center gap-2"><Lock className="w-3 h-3" /> Built for India · Free forever</div>
      </footer>
    </div>
  )
}
