'use client'
import PatientShell from '@/components/PatientShell'
import { useEffect, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { Bell, Pill, Calendar, Check } from 'lucide-react'

export default function RemindersPage() { return <PatientShell><Inner /></PatientShell> }

function Inner() {
  const [data, setData] = useState(null)
  const load = async () => setData(await fetch('/api/reminders').then(r => r.json()))
  useEffect(() => { load() }, [])

  const markRead = async (id) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
    await load()
  }

  if (!data) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="shimmer h-24 rounded-xl" />)}</div>

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Reminders</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card-accent-cyan p-4">
          <div className="text-xs uppercase tracking-wider text-[#6a8099] mb-3 font-semibold inline-flex items-center gap-2"><Pill className="w-4 h-4" /> Medication reminders</div>
          {data.medReminders.length === 0 ? <div className="text-sm text-[#6a8099]">No reminders set. Enable on the Medications page.</div>
            : <div className="space-y-2">
                {data.medReminders.map(m => (
                  <div key={m.id} className="p-3 rounded-lg flex items-center justify-between" style={{ background: '#0b0e14', border: '1px solid #1e2a40' }}>
                    <div>
                      <div className="font-semibold">{m.drug_name}</div>
                      <div className="text-xs text-[#6a8099]">{(m.reminder_times || ['08:00']).join(' · ')} · {m.frequency}</div>
                    </div>
                    <Bell className="w-4 h-4 text-[#00e5ff]" />
                  </div>
                ))}
              </div>}
        </div>

        <div className="card-accent-cyan p-4">
          <div className="text-xs uppercase tracking-wider text-[#6a8099] mb-3 font-semibold inline-flex items-center gap-2"><Calendar className="w-4 h-4" /> Upcoming follow-ups</div>
          {data.followUps.length === 0 ? <div className="text-sm text-[#6a8099]">No follow-ups scheduled.</div>
            : <div className="space-y-2">
                {data.followUps.map(v => (
                  <div key={v.id} className="p-3 rounded-lg" style={{ background: '#0b0e14', border: '1px solid #1e2a40' }}>
                    <div className="font-semibold">{v.hospital?.name}</div>
                    <div className="text-xs text-[#6a8099]">{v.department} · {format(new Date(v.follow_up_date), 'dd MMM yyyy')}</div>
                  </div>
                ))}
              </div>}
        </div>
      </div>

      <div className="card-accent-purple p-4 mt-4">
        <div className="text-xs uppercase tracking-wider text-[#a855f7] mb-3 font-semibold inline-flex items-center gap-2"><Bell className="w-4 h-4" /> Notifications</div>
        {data.notifications.length === 0 ? <div className="text-sm text-[#6a8099]">All caught up.</div>
          : <div className="space-y-2">
              {data.notifications.map(n => (
                <div key={n.id} className="p-3 rounded-lg flex items-start justify-between gap-3" style={{ background: '#0b0e14', border: '1px solid #1e2a40', opacity: n.is_read ? 0.5 : 1 }}>
                  <div>
                    <div className="font-semibold text-sm">{n.title}</div>
                    <div className="text-xs text-[#6a8099] mt-0.5">{n.body}</div>
                    <div className="text-[10px] text-[#6a8099] mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</div>
                  </div>
                  {!n.is_read && <button onClick={() => markRead(n.id)} className="text-[#00e5ff] text-xs inline-flex items-center gap-1"><Check className="w-3 h-3" /> Mark read</button>}
                </div>
              ))}
            </div>}
      </div>
    </div>
  )
}
