'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ShieldCheck, Activity, QrCode, ArrowRight, Hospital, Lock, Sparkles,
  ScanLine, Brain, Smartphone,
} from 'lucide-react'
import Logo from '@/components/Logo'

export default function Landing() {
  return (
    <div className="relative overflow-x-hidden" style={{ background: '#0b0e14', minHeight: '100vh' }}>
      {/* animated grid background */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(0,229,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.06) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
        maskImage: 'radial-gradient(ellipse at top, black 30%, transparent 70%)',
      }} />
      {/* glow orbs */}
      <motion.div
        className="fixed -top-40 -left-40 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,229,255,0.15), transparent 70%)' }}
        animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="fixed top-20 -right-40 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.12), transparent 70%)' }}
        animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10">
        {/* navbar */}
        <nav className="flex items-center justify-between px-6 md:px-10 py-5 border-b" style={{ borderColor: '#1e2a40' }}>
          <Logo />
          <div className="flex items-center gap-3">
            <Link href="/hospital/login" className="text-sm text-[#6a8099] hover:text-[#a855f7] transition hidden sm:inline">For Hospitals</Link>
            <Link href="/login" className="text-sm text-[#e2e8f4] hover:text-[#00e5ff] transition px-3 py-2">Sign In</Link>
            <Link href="/register" className="btn-primary text-sm">Register Free</Link>
          </div>
        </nav>

        {/* hero */}
        <section className="max-w-5xl mx-auto px-6 md:px-10 pt-16 md:pt-24 pb-12 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring' }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
              style={{ background: '#111520', border: '1px solid #1e2a40' }}
            >
              <Sparkles className="w-4 h-4 text-[#00e5ff]" />
              <span className="text-xs text-[#6a8099]">India's Universal Patient Health Record</span>
            </motion.div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
              One ID.{' '}
              <span className="bg-gradient-to-r from-[#00e5ff] to-[#a855f7] bg-clip-text text-transparent">
                Every hospital.
              </span>
              <br /> Your entire life.
            </h1>
            <p className="text-base md:text-xl text-[#6a8099] max-w-2xl mx-auto mb-10">
              Stop carrying paper files. Your MediID unlocks your complete medical history at any hospital — instantly, securely, and free forever.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
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
        <section className="max-w-5xl mx-auto px-6 md:px-10 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { v: '3.5B', l: 'OPD visits in India each year' },
              { v: '0%', l: 'records shared across hospitals' },
              { v: '₹0', l: 'cost to patients, forever' },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 * i, duration: 0.5 }}
                whileHover={{ y: -4 }}
                className="card-accent-cyan p-6 text-center"
              >
                <div className="text-4xl md:text-5xl font-bold text-[#00e5ff] mb-1">{s.v}</div>
                <div className="text-sm text-[#6a8099]">{s.l}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* features */}
        <section className="max-w-5xl mx-auto px-6 md:px-10 py-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <div className="text-xs uppercase tracking-widest text-[#00e5ff] mb-3">What MediThread does</div>
            <h2 className="text-3xl md:text-4xl font-bold">Built around the patient. Not the paperwork.</h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { I: QrCode, c: '#00e5ff', t: 'MediID Card with QR', d: 'A unique lifelong ID with a QR. Show it at any hospital to give consented access in one tap.' },
              { I: ShieldCheck, c: '#00e676', t: 'Patient-controlled consent', d: 'Hospitals ask before reading anything. Approve or deny in one tap. Auto-expires in 4 hours.' },
              { I: Activity, c: '#a855f7', t: 'AI-powered visit summaries', d: 'Gemini translates doctor notes into plain English so you actually understand your care.' },
              { I: ScanLine, c: '#ffab40', t: 'Scan any medicine', d: 'Snap a photo of a tablet, strip, or syrup — get dosage, side-effects and warnings instantly.' },
              { I: Brain, c: '#a855f7', t: 'Clinical AI for doctors', d: 'Hospitals see a 5-bullet clinical summary the moment you arrive — no time wasted reading old files.' },
              { I: Smartphone, c: '#00e5ff', t: 'WhatsApp consent + alerts', d: 'Approve hospital access requests via WhatsApp OTP. Get notified for every record view.' },
            ].map((f, i) => {
              const Icon = f.I
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.05 * i, duration: 0.5 }}
                  whileHover={{ y: -4 }}
                  className="card-accent-cyan p-6"
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: f.c + '15', border: `1px solid ${f.c}40` }}>
                    <Icon className="w-5 h-5" style={{ color: f.c }} />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{f.t}</h3>
                  <p className="text-sm text-[#6a8099] leading-relaxed">{f.d}</p>
                </motion.div>
              )
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-3xl mx-auto px-6 md:px-10 py-16 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="card-accent-cyan p-8 md:p-12" style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.06), rgba(168,85,247,0.04))' }}>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Your health record, in 60 seconds.</h2>
            <p className="text-[#6a8099] mb-6">Phone number + OTP + 3 simple steps. That's it.</p>
            <Link href="/register" className="btn-primary inline-flex items-center gap-2">
              Create my MediID <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </section>

        {/* footer */}
        <footer className="max-w-5xl mx-auto px-6 md:px-10 py-10 mt-10 border-t flex items-center justify-between flex-wrap gap-4" style={{ borderColor: '#1e2a40' }}>
          <Logo size="sm" />
          <div className="text-xs text-[#6a8099] flex items-center gap-2"><Lock className="w-3 h-3" /> Built for India · Free forever</div>
        </footer>
      </div>
    </div>
  )
}
