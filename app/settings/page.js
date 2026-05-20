'use client'
import PatientShell from '@/components/PatientShell'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { MessageCircle, ShieldCheck, Bell, FileText, Activity, Info, Save, Loader2, LogOut, AlertTriangle } from 'lucide-react'

export default function SettingsPage() { return <PatientShell><Inner /></PatientShell> }

function Inner() {
  const [p, setP] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => setP(d?.patient || null))
  }, [])

  if (!p) return <div className="space-y-3"><div className="shimmer h-12 rounded-xl" /><div className="shimmer h-40 rounded-xl" /><div className="shimmer h-40 rounded-xl" /></div>

  // Defaults: all toggles ON unless explicitly false in DB
  const settings = {
    notify_whatsapp: p.notify_whatsapp !== false,
    notify_record_access: p.notify_record_access !== false,
    notify_visit_added: p.notify_visit_added !== false,
    notify_consent_actions: p.notify_consent_actions !== false,
  }

  const set = (k, v) => setP(prev => ({ ...prev, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        notify_whatsapp: settings.notify_whatsapp,
        notify_record_access: settings.notify_record_access,
        notify_visit_added: settings.notify_visit_added,
        notify_consent_actions: settings.notify_consent_actions,
      }
      const r = await fetch('/api/patient/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error('Failed to save')
      const data = await r.json()
      setP(data.patient)
      toast.success('Notification preferences saved')
    } catch (e) {
      toast.error(e.message || 'Could not save')
    } finally { setSaving(false) }
  }

  const logout = async () => {
    if (!confirm('Sign out of MediThread?')) return
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold">Settings</h1>
        <p className="text-[#6a8099] text-sm mt-1">Control how MediThread communicates with you.</p>
      </div>

      {/* Master WhatsApp toggle */}
      <div className="card-accent-cyan p-5 mb-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.4)' }}>
            <MessageCircle className="w-6 h-6 text-[#25d366]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-semibold text-base">WhatsApp notifications</div>
                <div className="text-xs text-[#6a8099] mt-0.5">Master switch — turning off stops all WhatsApp/SMS messages (except login OTP).</div>
              </div>
              <Toggle on={settings.notify_whatsapp} onChange={v => set('notify_whatsapp', v)} />
            </div>
            <div className="text-[10px] text-[#6a8099] mt-3 font-mono">Phone: {p.phone}</div>
          </div>
        </div>
      </div>

      {/* Per-type toggles */}
      <div className="card-accent-cyan p-5 mb-5">
        <div className="text-xs uppercase tracking-wider text-[#6a8099] mb-4 font-semibold inline-flex items-center gap-2">
          <Bell className="w-3 h-3" /> Notify me when…
        </div>
        <div className={`space-y-1 transition-opacity ${settings.notify_whatsapp ? '' : 'opacity-50 pointer-events-none'}`}>
          <Row
            icon={<ShieldCheck className="w-4 h-4 text-[#00e5ff]" />}
            title="A hospital views my record"
            desc="Get notified the moment any verified staff opens your file."
            on={settings.notify_record_access}
            onChange={v => set('notify_record_access', v)}
          />
          <Row
            icon={<FileText className="w-4 h-4 text-[#a855f7]" />}
            title="A new visit / prescription is added"
            desc="Hear about consultations, lab reports and prescriptions added by hospitals."
            on={settings.notify_visit_added}
            onChange={v => set('notify_visit_added', v)}
          />
          <Row
            icon={<Activity className="w-4 h-4 text-[#ffab40]" />}
            title="Consent is approved, denied or expires"
            desc="Stay in the loop about every access decision."
            on={settings.notify_consent_actions}
            onChange={v => set('notify_consent_actions', v)}
          />
        </div>
      </div>

      {/* Info card */}
      <div className="p-4 mb-5 rounded-xl text-sm" style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.2)' }}>
        <div className="flex gap-3">
          <Info className="w-4 h-4 text-[#00e5ff] flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-[#e2e8f4]">Security messages always go through</div>
            <div className="text-[#6a8099] mt-1 text-xs">Login OTPs and consent-grant approval codes are <span className="text-[#e2e8f4]">always</span> delivered, even if WhatsApp notifications are off — this keeps your account safe.</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save preferences</>}
        </button>
        <a href="/profile" className="btn-secondary text-sm">Edit medical profile</a>
      </div>

      {/* Danger zone */}
      <div className="mt-10 p-5 rounded-xl" style={{ background: 'rgba(255,82,82,0.04)', border: '1px solid rgba(255,82,82,0.25)' }}>
        <div className="text-xs uppercase tracking-wider text-[#ff5252] mb-3 font-semibold inline-flex items-center gap-2">
          <AlertTriangle className="w-3 h-3" /> Account
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-[#6a8099]">Sign out of this device. You can sign in again with your phone.</div>
          <button onClick={logout} className="text-sm inline-flex items-center gap-2 px-3 py-1.5 rounded-md transition" style={{ color: '#ff5252', border: '1px solid #ff5252', background: 'transparent' }}>
            <LogOut className="w-3 h-3" /> Sign out
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function Toggle({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="relative w-11 h-6 rounded-full transition flex-shrink-0"
      style={{ background: on ? '#00e5ff' : '#1e2a40', border: `1px solid ${on ? '#00e5ff' : '#2a3a55'}` }}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-0.5 w-5 h-5 rounded-full"
        style={{ left: on ? '20px' : '2px', background: on ? '#001318' : '#6a8099' }}
      />
    </button>
  )
}

function Row({ icon, title, desc, on, onChange }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-b-0" style={{ borderColor: '#1e2a40' }}>
      <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: '#0b0e14', border: '1px solid #1e2a40' }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-[#e2e8f4]">{title}</div>
        <div className="text-xs text-[#6a8099] mt-0.5">{desc}</div>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  )
}
