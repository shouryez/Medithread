import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'
import { getDb, clean, cleanAll } from '@/lib/db'
import { createSession, getSession, clearSession, createSessionFor, getSessionFor, clearSessionFor, HOSPITAL_COOKIE } from '@/lib/auth'
import { sendOtpSms, sendWhatsAppNotification } from '@/lib/twilio'
import { sendOtp as verifySendOtp, checkOtp as verifyCheckOtp } from '@/lib/twilio-verify'
import { generateMediId } from '@/lib/medi-id'
import { summarizeVisit, clinicalSummary, drugInteraction, ocrPrescription, faceMatch, medicineScan } from '@/lib/gemini'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}

const J = (data, init = {}) => cors(NextResponse.json(data, init))
const E = (msg, status = 400) => J({ error: msg }, { status })

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 200 }))
}

function normalizePhone(phone) {
  if (!phone) return phone
  const t = phone.replace(/[^\d+]/g, '')
  if (t.startsWith('+')) return t
  if (t.length === 10) return `+91${t}`
  return `+${t}`
}

async function getCurrentPatient(db) {
  const sess = await getSession()
  if (!sess?.userId) return null
  return await db.collection('patients').findOne({ user_id: sess.userId })
}

async function requirePatient(db) {
  const p = await getCurrentPatient(db)
  if (!p) throw new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  return p
}

async function logAudit(db, { patient_id, performed_by = null, performed_by_role = 'patient', hospital_id = null, action_type, metadata = {} }) {
  await db.collection('audit_logs').insertOne({
    id: uuidv4(),
    patient_id,
    performed_by,
    performed_by_role,
    hospital_id,
    action_type,
    ip_address: null,
    metadata,
    created_at: new Date(),
  })
}

async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    const db = await getDb()

    // ===== HEALTH =====
    if (route === '/' && method === 'GET') return J({ ok: true, service: 'MediThread API' })
    if (route === '/root' && method === 'GET') return J({ ok: true })

    // ===== AUTH =====
    if (route === '/auth/send-otp' && method === 'POST') {
      const body = await request.json()
      const phone = normalizePhone(body.phone)
      if (!phone || phone.length < 10) return E('Valid phone required')

      // Try Twilio Verify (real SMS first, WhatsApp fallback)
      const sent = await verifySendOtp(phone)
      if (sent.ok) {
        // Mark this phone as using Verify mode (no local OTP)
        await db.collection('otps').deleteMany({ phone })
        await db.collection('otps').insertOne({ phone, mode: 'verify', created_at: new Date(), expires_at: new Date(Date.now() + 10 * 60 * 1000) })
        console.log(`[OTP] ${phone} -> Twilio Verify via ${sent.channel} status=${sent.status}`)
        return J({ ok: true, channel: sent.channel, _sent: true, mode: 'verify' })
      }

      // Fallback: local OTP + WhatsApp sandbox (best-effort) + dev code for demo
      console.warn(`[OTP] ${phone} -> Twilio Verify failed (${sent.error}); using local OTP`)
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      const expires_at = new Date(Date.now() + 5 * 60 * 1000)
      await db.collection('otps').deleteMany({ phone })
      await db.collection('otps').insertOne({ phone, code, mode: 'local', expires_at, created_at: new Date(), attempts: 0 })
      const waSent = await sendOtpSms(phone, code)
      return J({
        ok: true,
        channel: waSent.channel || null,
        _sent: !!waSent.ok,
        _twilio_error: sent.error || waSent.error || null,
        _dev_code: code,
        mode: 'local',
      })
    }

    if (route === '/auth/verify-otp' && method === 'POST') {
      const body = await request.json()
      const phone = normalizePhone(body.phone)
      const code = (body.code || '').toString().trim()
      if (!phone || !code) return E('Phone and code required')
      if (!/^\d{4,8}$/.test(code)) return E('Invalid code format', 400)

      const rec = await db.collection('otps').findOne({ phone })
      if (!rec) return E('OTP not found, please request a new one', 400)
      if (new Date(rec.expires_at) < new Date()) return E('OTP expired', 400)

      if (rec.mode === 'verify') {
        // Validate via Twilio Verify
        const r = await verifyCheckOtp(phone, code)
        if (!r.ok) return E(r.status === 'pending' ? 'Invalid OTP' : `Verification ${r.status}`, 400)
      } else {
        if (rec.code !== code) return E('Invalid OTP', 400)
      }

      await db.collection('otps').deleteMany({ phone })
      let patient = await db.collection('patients').findOne({ phone })
      const userId = patient?.user_id || uuidv4()
      await createSession({ userId, phone })
      return J({ ok: true, hasPatient: !!patient, userId })
    }

    if (route === '/auth/logout' && method === 'POST') {
      clearSession()
      return J({ ok: true })
    }

    // ===== ME =====
    if (route === '/me' && method === 'GET') {
      const sess = await getSession()
      if (!sess?.userId) return J({ authenticated: false })
      const p = await db.collection('patients').findOne({ user_id: sess.userId })
      return J({ authenticated: true, userId: sess.userId, phone: sess.phone, patient: clean(p) })
    }

    // ===== PATIENT REGISTER =====
    if (route === '/patient/register' && method === 'POST') {
      const sess = await getSession()
      if (!sess?.userId) return E('Unauthorized', 401)
      const existing = await db.collection('patients').findOne({ user_id: sess.userId })
      if (existing) return J({ ok: true, patient: clean(existing), existed: true })
      const body = await request.json()
      const required = ['full_name', 'dob', 'gender', 'blood_group', 'city']
      for (const k of required) if (!body[k]) return E(`${k} is required`)
      const mediId = await generateMediId(body.city)
      const patient = {
        id: uuidv4(),
        user_id: sess.userId,
        medi_id: mediId,
        full_name: body.full_name,
        phone: sess.phone,
        dob: body.dob,
        gender: body.gender,
        blood_group: body.blood_group,
        city: body.city || 'Bangalore',
        photo_url: null,
        aadhaar_hash: null,
        abha_id: null,
        emergency_contact_name: body.emergency_contact_name || null,
        emergency_contact_phone: body.emergency_contact_phone || null,
        allergies: body.allergies || [],
        chronic_conditions: body.chronic_conditions || [],
        created_at: new Date(),
      }
      await db.collection('patients').insertOne(patient)
      await logAudit(db, { patient_id: patient.id, action_type: 'verification_passed', metadata: { reason: 'patient_registered' } })
      return J({ ok: true, patient: clean(patient) })
    }

    // ===== PROFILE UPDATE =====
    if (route === '/patient/profile' && method === 'PUT') {
      const p = await requirePatient(db)
      const body = await request.json()
      const allowed = ['full_name', 'dob', 'gender', 'blood_group', 'city', 'allergies', 'chronic_conditions', 'emergency_contact_name', 'emergency_contact_phone', 'photo_url']
      const upd = {}
      for (const k of allowed) if (k in body) upd[k] = body[k]
      await db.collection('patients').updateOne({ id: p.id }, { $set: upd })
      const updated = await db.collection('patients').findOne({ id: p.id })
      return J({ ok: true, patient: clean(updated) })
    }

    // ===== DASHBOARD STATS =====
    if (route === '/patient/dashboard' && method === 'GET') {
      const p = await requirePatient(db)
      const [visits, activeMeds, reports, pendingConsents, recentVisits] = await Promise.all([
        db.collection('visits').countDocuments({ patient_id: p.id }),
        db.collection('prescriptions').countDocuments({ patient_id: p.id, is_active: true }),
        db.collection('medical_reports').countDocuments({ patient_id: p.id }),
        db.collection('access_consents').countDocuments({ patient_id: p.id, status: 'pending' }),
        db.collection('visits').find({ patient_id: p.id }).sort({ visit_date: -1 }).limit(3).toArray(),
      ])
      // Hydrate hospital names for recent visits
      const hospitalIds = [...new Set(recentVisits.map(v => v.hospital_id).filter(Boolean))]
      const hospitals = hospitalIds.length ? await db.collection('hospitals').find({ id: { $in: hospitalIds } }).toArray() : []
      const hmap = Object.fromEntries(hospitals.map(h => [h.id, h]))
      const visitsHydrated = recentVisits.map(v => ({ ...clean(v), hospital: hmap[v.hospital_id] ? { name: hmap[v.hospital_id].name, city: hmap[v.hospital_id].city } : null }))
      return J({
        stats: { visits, activeMeds, reports, pendingConsents },
        recentVisits: visitsHydrated,
      })
    }

    // ===== VISITS =====
    if (route === '/visits' && method === 'GET') {
      const p = await requirePatient(db)
      const url = new URL(request.url)
      const year = url.searchParams.get('year')
      const department = url.searchParams.get('department')
      const hospital = url.searchParams.get('hospital')
      const q = url.searchParams.get('q')
      const skip = parseInt(url.searchParams.get('skip') || '0', 10)
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100)
      const filter = { patient_id: p.id }
      if (department) filter.department = department
      if (hospital) filter.hospital_id = hospital
      if (year) {
        const start = new Date(`${year}-01-01`)
        const end = new Date(`${parseInt(year, 10) + 1}-01-01`)
        filter.visit_date = { $gte: start, $lt: end }
      }
      if (q) filter.$or = [{ chief_complaint: { $regex: q, $options: 'i' } }, { notes: { $regex: q, $options: 'i' } }, { diagnosis: { $elemMatch: { $regex: q, $options: 'i' } } }]
      const total = await db.collection('visits').countDocuments(filter)
      const visits = await db.collection('visits').find(filter).sort({ visit_date: -1 }).skip(skip).limit(limit).toArray()
      const visitIds = visits.map(v => v.id)
      const [hospitals, rx, reports] = await Promise.all([
        db.collection('hospitals').find({ id: { $in: visits.map(v => v.hospital_id).filter(Boolean) } }).toArray(),
        db.collection('prescriptions').find({ visit_id: { $in: visitIds } }).toArray(),
        db.collection('medical_reports').find({ visit_id: { $in: visitIds } }).toArray(),
      ])
      const hmap = Object.fromEntries(hospitals.map(h => [h.id, h]))
      const visitsHydrated = visits.map(v => ({
        ...clean(v),
        hospital: hmap[v.hospital_id] ? clean(hmap[v.hospital_id]) : null,
        prescriptions: cleanAll(rx.filter(r => r.visit_id === v.id)),
        reports: cleanAll(reports.filter(r => r.visit_id === v.id)),
      }))
      return J({ visits: visitsHydrated, total })
    }

    // ===== CREATE VISIT (used for seed/demo or by hospital staff) =====
    if (route === '/visits' && method === 'POST') {
      const p = await requirePatient(db)
      const body = await request.json()
      let hospital_id = body.hospital_id
      if (!hospital_id && body.hospital_name) {
        // Create or find by name
        let h = await db.collection('hospitals').findOne({ name: body.hospital_name })
        if (!h) {
          h = {
            id: uuidv4(),
            name: body.hospital_name,
            registration_no: `REG-${Date.now()}`,
            address: body.hospital_address || '',
            city: body.hospital_city || p.city,
            contact_phone: '',
            logo_url: null,
            is_verified: true,
            plan_tier: 'free',
            created_at: new Date(),
          }
          await db.collection('hospitals').insertOne(h)
        }
        hospital_id = h.id
      }
      const visit = {
        id: uuidv4(),
        patient_id: p.id,
        hospital_id,
        doctor_id: body.doctor_id || null,
        doctor_name: body.doctor_name || null,
        visit_date: body.visit_date ? new Date(body.visit_date) : new Date(),
        department: body.department || 'General',
        chief_complaint: body.chief_complaint || '',
        diagnosis: body.diagnosis || [],
        notes: body.notes || '',
        ai_summary: null,
        ai_summary_generated_at: null,
        follow_up_date: body.follow_up_date || null,
        // Patient-initiated visits start as "pending" so the hospital can verify them.
        verification_status: 'pending',
        created_by: 'patient',
        created_at: new Date(),
      }
      // Generate AI summary asynchronously (don't block)
      try {
        const summary = await summarizeVisit(visit)
        if (summary) {
          visit.ai_summary = summary
          visit.ai_summary_generated_at = new Date()
        }
      } catch {}
      await db.collection('visits').insertOne(visit)
      await logAudit(db, { patient_id: p.id, action_type: 'visit_created', metadata: { visit_id: visit.id, by: 'patient' } })
      // Notify hospital if linked
      if (hospital_id) {
        const h = await db.collection('hospitals').findOne({ id: hospital_id })
        if (h?.contact_phone) {
          sendWhatsAppNotification(h.contact_phone, `MediThread: ${p.full_name} added a new visit to ${h.name}. Open the portal to approve.`).catch(() => {})
        }
      }
      return J({ ok: true, visit: clean(visit) })
    }

    // ===== MEDICATIONS =====
    if (route === '/medications' && method === 'GET') {
      const p = await requirePatient(db)
      const all = await db.collection('prescriptions').find({ patient_id: p.id }).sort({ created_at: -1 }).toArray()
      const visitIds = [...new Set(all.map(m => m.visit_id).filter(Boolean))]
      const visits = visitIds.length ? await db.collection('visits').find({ id: { $in: visitIds } }).toArray() : []
      const hospitalIds = [...new Set(visits.map(v => v.hospital_id).filter(Boolean))]
      const hospitals = hospitalIds.length ? await db.collection('hospitals').find({ id: { $in: hospitalIds } }).toArray() : []
      const hmap = Object.fromEntries(hospitals.map(h => [h.id, h]))
      const vmap = Object.fromEntries(visits.map(v => [v.id, v]))
      const hydrated = all.map(m => ({
        ...clean(m),
        visit: m.visit_id && vmap[m.visit_id] ? clean(vmap[m.visit_id]) : null,
        hospital: m.visit_id && vmap[m.visit_id] && hmap[vmap[m.visit_id].hospital_id] ? clean(hmap[vmap[m.visit_id].hospital_id]) : null,
      }))
      return J({ active: hydrated.filter(m => m.is_active), past: hydrated.filter(m => !m.is_active) })
    }

    if (route === '/medications' && method === 'POST') {
      const p = await requirePatient(db)
      const body = await request.json()
      const rx = {
        id: uuidv4(),
        visit_id: body.visit_id || null,
        patient_id: p.id,
        drug_name: body.drug_name,
        dosage: body.dosage || '',
        frequency: body.frequency || '',
        duration_days: body.duration_days ? parseInt(body.duration_days, 10) : null,
        instructions: body.instructions || '',
        image_url: null,
        is_active: true,
        reminder_enabled: !!body.reminder_enabled,
        reminder_times: body.reminder_times || [],
        prescribed_by: null, // self-medication
        start_date: body.start_date ? new Date(body.start_date) : new Date(),
        created_at: new Date(),
      }
      await db.collection('prescriptions').insertOne(rx)
      return J({ ok: true, prescription: clean(rx) })
    }

    const medMatch = route.match(/^\/medications\/([^/]+)$/)
    if (medMatch && (method === 'PUT' || method === 'PATCH')) {
      const p = await requirePatient(db)
      const body = await request.json()
      const upd = {}
      if ('is_active' in body) upd.is_active = !!body.is_active
      if ('reminder_enabled' in body) upd.reminder_enabled = !!body.reminder_enabled
      if ('reminder_times' in body) upd.reminder_times = body.reminder_times
      await db.collection('prescriptions').updateOne({ id: medMatch[1], patient_id: p.id }, { $set: upd })
      return J({ ok: true })
    }

    // ===== REPORTS =====
    if (route === '/reports' && method === 'GET') {
      const p = await requirePatient(db)
      const url = new URL(request.url)
      const type = url.searchParams.get('type')
      const filter = { patient_id: p.id }
      if (type && type !== 'all') filter.report_type = type
      const reports = await db.collection('medical_reports').find(filter).sort({ report_date: -1, created_at: -1 }).toArray()
      const hospitalIds = [...new Set(reports.map(r => r.hospital_id).filter(Boolean))]
      const hospitals = hospitalIds.length ? await db.collection('hospitals').find({ id: { $in: hospitalIds } }).toArray() : []
      const hmap = Object.fromEntries(hospitals.map(h => [h.id, h]))
      const hydrated = reports.map(r => ({ ...clean(r), hospital: hmap[r.hospital_id] ? clean(hmap[r.hospital_id]) : null }))
      return J({ reports: hydrated })
    }

    if (route === '/reports' && method === 'POST') {
      const p = await requirePatient(db)
      const body = await request.json()
      const r = {
        id: uuidv4(),
        visit_id: body.visit_id || null,
        patient_id: p.id,
        hospital_id: body.hospital_id || null,
        report_type: body.report_type || 'other',
        title: body.title || 'Report',
        file_url: body.file_url || null,
        file_data: body.file_data || null, // base64 data URL for MVP
        parsed_data: body.parsed_data || {},
        report_date: body.report_date ? new Date(body.report_date) : new Date(),
        uploaded_by: null,
        created_at: new Date(),
      }
      await db.collection('medical_reports').insertOne(r)
      await logAudit(db, { patient_id: p.id, action_type: 'report_uploaded', metadata: { report_id: r.id } })
      return J({ ok: true, report: clean(r) })
    }

    // ===== CONSENTS =====
    if (route === '/consents' && method === 'GET') {
      const p = await requirePatient(db)
      const consents = await db.collection('access_consents').find({ patient_id: p.id }).sort({ created_at: -1 }).toArray()
      const hospitalIds = [...new Set(consents.map(c => c.hospital_id).filter(Boolean))]
      const hospitals = hospitalIds.length ? await db.collection('hospitals').find({ id: { $in: hospitalIds } }).toArray() : []
      const hmap = Object.fromEntries(hospitals.map(h => [h.id, h]))
      const hydrate = c => ({ ...clean(c), hospital: hmap[c.hospital_id] ? clean(hmap[c.hospital_id]) : null })
      const now = new Date()
      const pending = consents.filter(c => c.status === 'pending').map(hydrate)
      const active = consents.filter(c => c.status === 'approved' && (!c.expires_at || new Date(c.expires_at) > now)).map(hydrate)
      const audit = await db.collection('audit_logs').find({ patient_id: p.id }).sort({ created_at: -1 }).limit(50).toArray()
      const auditHosp = [...new Set(audit.map(a => a.hospital_id).filter(Boolean))]
      const auditHosps = auditHosp.length ? await db.collection('hospitals').find({ id: { $in: auditHosp } }).toArray() : []
      const ahmap = Object.fromEntries(auditHosps.map(h => [h.id, h]))
      const auditHydrated = audit.map(a => ({ ...clean(a), hospital: ahmap[a.hospital_id] ? { name: ahmap[a.hospital_id].name } : null }))
      return J({ pending, active, audit: auditHydrated })
    }

    if (route === '/consents' && method === 'POST') {
      // Simulate a hospital requesting consent (for demo)
      const p = await requirePatient(db)
      const body = await request.json()
      let hospital_id = body.hospital_id
      if (!hospital_id && body.hospital_name) {
        let h = await db.collection('hospitals').findOne({ name: body.hospital_name })
        if (!h) {
          h = {
            id: uuidv4(), name: body.hospital_name, registration_no: `REG-${Date.now()}`,
            address: '', city: p.city, contact_phone: '', logo_url: null,
            is_verified: true, plan_tier: 'free', created_at: new Date(),
          }
          await db.collection('hospitals').insertOne(h)
        }
        hospital_id = h.id
      }
      const c = {
        id: uuidv4(),
        patient_id: p.id,
        hospital_id,
        status: 'pending',
        otp_code: Math.floor(100000 + Math.random() * 900000).toString(),
        otp_expires_at: new Date(Date.now() + 10 * 60 * 1000),
        approved_at: null,
        expires_at: null,
        created_at: new Date(),
      }
      await db.collection('access_consents').insertOne(c)
      await db.collection('notifications').insertOne({
        id: uuidv4(), patient_id: p.id,
        title: 'New access request',
        body: `${body.hospital_name || 'A hospital'} is requesting access to your health records.`,
        type: 'info', is_read: false, created_at: new Date(),
      })
      return J({ ok: true, consent: clean(c) })
    }

    const consentMatch = route.match(/^\/consents\/([^/]+)\/(approve|deny|revoke)$/)
    if (consentMatch && method === 'POST') {
      const p = await requirePatient(db)
      const [, cid, action] = consentMatch
      const c = await db.collection('access_consents').findOne({ id: cid, patient_id: p.id })
      if (!c) return E('Consent not found', 404)
      if (action === 'approve') {
        await db.collection('access_consents').updateOne({ id: cid }, { $set: {
          status: 'approved', approved_at: new Date(), expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000),
        } })
        await logAudit(db, { patient_id: p.id, hospital_id: c.hospital_id, action_type: 'consent_granted' })
      } else if (action === 'deny') {
        await db.collection('access_consents').updateOne({ id: cid }, { $set: { status: 'denied' } })
        await logAudit(db, { patient_id: p.id, hospital_id: c.hospital_id, action_type: 'consent_revoked' })
      } else if (action === 'revoke') {
        await db.collection('access_consents').updateOne({ id: cid }, { $set: { status: 'expired', expires_at: new Date() } })
        await logAudit(db, { patient_id: p.id, hospital_id: c.hospital_id, action_type: 'consent_revoked' })
      }
      return J({ ok: true })
    }

    // ===== HEALTH METRICS =====
    if (route === '/metrics' && method === 'GET') {
      const p = await requirePatient(db)
      const url = new URL(request.url)
      const type = url.searchParams.get('type') || 'blood_sugar'
      const range = url.searchParams.get('range') || '1M' // 1W,1M,3M,6M,1Y
      const days = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }[range] || 30
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      const metrics = await db.collection('health_metrics').find({ patient_id: p.id, metric_type: type, recorded_at: { $gte: since } }).sort({ recorded_at: 1 }).toArray()
      return J({ metrics: cleanAll(metrics) })
    }

    if (route === '/metrics' && method === 'POST') {
      const p = await requirePatient(db)
      const body = await request.json()
      const m = {
        id: uuidv4(),
        patient_id: p.id,
        metric_type: body.metric_type,
        value: parseFloat(body.value),
        unit: body.unit || '',
        notes: body.notes || '',
        recorded_at: body.recorded_at ? new Date(body.recorded_at) : new Date(),
        source: 'self',
      }
      await db.collection('health_metrics').insertOne(m)
      return J({ ok: true, metric: clean(m) })
    }

    // ===== NOTIFICATIONS =====
    if (route === '/notifications' && method === 'GET') {
      const p = await requirePatient(db)
      const notifs = await db.collection('notifications').find({ patient_id: p.id }).sort({ created_at: -1 }).limit(50).toArray()
      return J({ notifications: cleanAll(notifs) })
    }
    const notifMatch = route.match(/^\/notifications\/([^/]+)\/read$/)
    if (notifMatch && method === 'POST') {
      const p = await requirePatient(db)
      await db.collection('notifications').updateOne({ id: notifMatch[1], patient_id: p.id }, { $set: { is_read: true } })
      return J({ ok: true })
    }

    // ===== REMINDERS =====
    if (route === '/reminders' && method === 'GET') {
      const p = await requirePatient(db)
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const [medReminders, followUps, notifs] = await Promise.all([
        db.collection('prescriptions').find({ patient_id: p.id, reminder_enabled: true, is_active: true }).toArray(),
        db.collection('visits').find({ patient_id: p.id, follow_up_date: { $gte: today.toISOString().slice(0, 10) } }).toArray(),
        db.collection('notifications').find({ patient_id: p.id }).sort({ created_at: -1 }).limit(20).toArray(),
      ])
      const hospitalIds = [...new Set(followUps.map(v => v.hospital_id).filter(Boolean))]
      const hospitals = hospitalIds.length ? await db.collection('hospitals').find({ id: { $in: hospitalIds } }).toArray() : []
      const hmap = Object.fromEntries(hospitals.map(h => [h.id, h]))
      return J({
        medReminders: cleanAll(medReminders),
        followUps: followUps.map(v => ({ ...clean(v), hospital: hmap[v.hospital_id] ? clean(hmap[v.hospital_id]) : null })),
        notifications: cleanAll(notifs),
      })
    }

    // ===== EMERGENCY (PUBLIC) =====
    const emergMatch = route.match(/^\/emergency\/([^/]+)$/)
    if (emergMatch && method === 'GET') {
      const mediId = decodeURIComponent(emergMatch[1])
      const p = await db.collection('patients').findOne({ medi_id: mediId })
      if (!p) return E('Not found', 404)
      const firstName = (p.full_name || '').split(' ')[0]
      // Log view (anonymous)
      await logAudit(db, { patient_id: p.id, action_type: 'record_viewed', performed_by_role: 'emergency_public', metadata: { surface: 'emergency_page' } })
      return J({
        medi_id: p.medi_id,
        first_name: firstName,
        blood_group: p.blood_group,
        allergies: p.allergies || [],
        chronic_conditions: p.chronic_conditions || [],
        emergency_contact_name: p.emergency_contact_name,
        emergency_contact_phone: p.emergency_contact_phone,
      })
    }

    // ===== PUBLIC HOSPITALS LIST =====
    if (route === '/hospitals/public' && method === 'GET') {
      const hospitals = await db.collection('hospitals').find({ is_verified: true }).sort({ name: 1 }).limit(100).toArray()
      return J({ hospitals: hospitals.map(h => ({ id: h.id, name: h.name, city: h.city, address: h.address || '' })) })
    }

    // ===== AI MEDICINE SCAN (patient) =====
    if (route === '/ai/medicine-scan' && method === 'POST') {
      await requirePatient(db)
      const body = await request.json()
      if (!body.imageBase64) return E('imageBase64 required')
      const result = await medicineScan(body.imageBase64)
      return J(result)
    }

    // ===== SEED DEMO DATA =====
    if (route === '/demo/status' && method === 'GET') {
      const p = await requirePatient(db)
      const visits = await db.collection('visits').countDocuments({ patient_id: p.id })
      return J({ seeded: visits > 0 })
    }
    if (route === '/demo/seed' && method === 'POST') {
      const p = await requirePatient(db)
      // Idempotent: skip if already seeded
      const existing = await db.collection('visits').countDocuments({ patient_id: p.id })
      if (existing > 0) return J({ ok: true, already_seeded: true })
      // create 2 hospitals if not exist
      const h1 = {
        id: uuidv4(), name: 'Apollo Hospitals', registration_no: 'APL-001',
        address: 'Jayanagar', city: 'Bangalore', contact_phone: '+918012345678',
        logo_url: null, is_verified: true, plan_tier: 'pro', created_at: new Date(),
      }
      const h2 = {
        id: uuidv4(), name: 'Manipal Hospital', registration_no: 'MNP-002',
        address: 'HAL Road', city: 'Bangalore', contact_phone: '+918087654321',
        logo_url: null, is_verified: true, plan_tier: 'free', created_at: new Date(),
      }
      await db.collection('hospitals').insertOne(h1)
      await db.collection('hospitals').insertOne(h2)
      // visits
      const v1 = {
        id: uuidv4(), patient_id: p.id, hospital_id: h1.id, doctor_id: null,
        doctor_name: 'Dr. Anita Reddy', visit_date: new Date(Date.now() - 30 * 86400000),
        department: 'General Medicine', chief_complaint: 'Fever and cough for 3 days',
        diagnosis: ['Viral fever', 'Upper respiratory infection'],
        notes: 'Prescribed rest, fluids, and symptomatic treatment. Follow up if symptoms persist beyond 5 days.',
        ai_summary: null, ai_summary_generated_at: null,
        follow_up_date: null, created_at: new Date(),
      }
      const v2 = {
        id: uuidv4(), patient_id: p.id, hospital_id: h2.id, doctor_id: null,
        doctor_name: 'Dr. Rohan Mehta', visit_date: new Date(Date.now() - 90 * 86400000),
        department: 'Endocrinology', chief_complaint: 'Routine diabetes check-up',
        diagnosis: ['Type 2 Diabetes Mellitus - controlled'],
        notes: 'HbA1c at 6.8. Continue current medication. Lifestyle counseling provided.',
        ai_summary: null, ai_summary_generated_at: null,
        follow_up_date: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
        created_at: new Date(),
      }
      try { v1.ai_summary = await summarizeVisit(v1); v1.ai_summary_generated_at = new Date() } catch {}
      try { v2.ai_summary = await summarizeVisit(v2); v2.ai_summary_generated_at = new Date() } catch {}
      await db.collection('visits').insertMany([v1, v2])
      // prescriptions
      await db.collection('prescriptions').insertMany([
        { id: uuidv4(), visit_id: v1.id, patient_id: p.id, drug_name: 'Paracetamol 500mg', dosage: '1 tab', frequency: 'TID after meals', duration_days: 5, instructions: 'Take with water', image_url: null, is_active: false, reminder_enabled: false, prescribed_by: null, start_date: new Date(Date.now() - 30 * 86400000), created_at: new Date() },
        { id: uuidv4(), visit_id: v2.id, patient_id: p.id, drug_name: 'Metformin 500mg', dosage: '1 tab', frequency: 'Twice daily', duration_days: 90, instructions: 'Take with breakfast and dinner', image_url: null, is_active: true, reminder_enabled: true, reminder_times: ['08:00', '20:00'], prescribed_by: null, start_date: new Date(Date.now() - 90 * 86400000), created_at: new Date() },
      ])
      // report
      await db.collection('medical_reports').insertOne({
        id: uuidv4(), visit_id: v2.id, patient_id: p.id, hospital_id: h2.id,
        report_type: 'lab', title: 'HbA1c & Lipid Panel', file_url: null, file_data: null,
        parsed_data: { HbA1c: { value: 6.8, unit: '%', normal: '<7' }, LDL: { value: 110, unit: 'mg/dL', normal: '<100' }, HDL: { value: 48, unit: 'mg/dL', normal: '>40' } },
        report_date: new Date(Date.now() - 90 * 86400000), uploaded_by: null, created_at: new Date(),
      })
      // metrics
      const metricSeed = []
      for (let i = 30; i >= 0; i -= 3) {
        metricSeed.push({ id: uuidv4(), patient_id: p.id, metric_type: 'blood_sugar', value: 95 + Math.floor(Math.random() * 40), unit: 'mg/dL', notes: '', recorded_at: new Date(Date.now() - i * 86400000), source: 'self' })
      }
      await db.collection('health_metrics').insertMany(metricSeed)
      // pending consent demo
      await db.collection('access_consents').insertOne({
        id: uuidv4(), patient_id: p.id, hospital_id: h1.id, status: 'pending',
        otp_code: '123456', otp_expires_at: new Date(Date.now() + 600000),
        approved_at: null, expires_at: null, created_at: new Date(),
      })
      return J({ ok: true })
    }

    // ========================================================================
    // HOSPITAL PORTAL
    // ========================================================================

    async function getCurrentStaff() {
      const sess = await getSessionFor(HOSPITAL_COOKIE)
      if (!sess?.staffId) return null
      const staff = await db.collection('hospital_staff').findOne({ id: sess.staffId })
      if (!staff) return null
      const hospital = await db.collection('hospitals').findOne({ id: staff.hospital_id })
      return { staff, hospital }
    }
    async function requireStaff() {
      const ctx = await getCurrentStaff()
      if (!ctx) throw new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
      return ctx
    }

    // ----- HOSPITAL AUTH -----
    if (route === '/hospital/auth/register' && method === 'POST') {
      const body = await request.json()
      const required = ['hospital_name', 'registration_no', 'city', 'admin_name', 'admin_email', 'password']
      for (const k of required) if (!body[k]) return E(`${k} is required`)
      const existing = await db.collection('hospital_staff').findOne({ email: body.admin_email.toLowerCase() })
      if (existing) return E('An account with this email already exists', 400)
      const hospital = {
        id: uuidv4(), name: body.hospital_name, registration_no: body.registration_no,
        address: body.address || '', city: body.city, contact_phone: body.contact_phone || '',
        logo_url: null, is_verified: true, plan_tier: 'free', created_at: new Date(),
      }
      await db.collection('hospitals').insertOne(hospital)
      const password_hash = await bcrypt.hash(body.password, 10)
      const staff = {
        id: uuidv4(), user_id: uuidv4(), hospital_id: hospital.id,
        full_name: body.admin_name, email: body.admin_email.toLowerCase(),
        role: 'admin', govt_id_url: null, selfie_url: null,
        is_verified: true, password_hash, created_at: new Date(),
      }
      await db.collection('hospital_staff').insertOne(staff)
      await createSessionFor(HOSPITAL_COOKIE, { staffId: staff.id, hospitalId: hospital.id, role: 'admin' })
      return J({ ok: true, hospital: clean(hospital), staff: { ...clean(staff), password_hash: undefined } })
    }

    if (route === '/hospital/auth/login' && method === 'POST') {
      const body = await request.json()
      if (!body.email || !body.password) return E('Email and password required')
      const staff = await db.collection('hospital_staff').findOne({ email: body.email.toLowerCase() })
      if (!staff || !staff.password_hash) return E('Invalid credentials', 401)
      const ok = await bcrypt.compare(body.password, staff.password_hash)
      if (!ok) return E('Invalid credentials', 401)
      await createSessionFor(HOSPITAL_COOKIE, { staffId: staff.id, hospitalId: staff.hospital_id, role: staff.role })
      const hospital = await db.collection('hospitals').findOne({ id: staff.hospital_id })
      return J({ ok: true, hospital: clean(hospital), staff: { ...clean(staff), password_hash: undefined } })
    }

    if (route === '/hospital/auth/logout' && method === 'POST') {
      clearSessionFor(HOSPITAL_COOKIE)
      return J({ ok: true })
    }

    if (route === '/hospital/me' && method === 'GET') {
      const ctx = await getCurrentStaff()
      if (!ctx) return J({ authenticated: false })
      return J({ authenticated: true, staff: { ...clean(ctx.staff), password_hash: undefined }, hospital: clean(ctx.hospital) })
    }

    // ----- HOSPITAL DEMO SEED -----
    if (route === '/hospital/demo/status' && method === 'GET') {
      const { hospital } = await requireStaff()
      const seeded = await db.collection('visits').countDocuments({ hospital_id: hospital.id })
      return J({ seeded: seeded > 0 })
    }
    if (route === '/hospital/demo/seed' && method === 'POST') {
      const { hospital, staff } = await requireStaff()
      const existing = await db.collection('visits').countDocuments({ hospital_id: hospital.id })
      if (existing > 0) return J({ ok: true, already_seeded: true })

      // Create 3 sample patients in this hospital with visits.
      const samplePatients = [
        { name: 'Ananya Iyer', dob: '1988-03-12', gender: 'female', bg: 'A+', allergies: ['Penicillin'], cond: ['Hypertension'], phone: '+919811000111' },
        { name: 'Rahul Verma', dob: '1975-07-22', gender: 'male', bg: 'O+', allergies: [], cond: ['Type 2 Diabetes'], phone: '+919811000222' },
        { name: 'Sneha Kapoor', dob: '1995-11-30', gender: 'female', bg: 'B-', allergies: ['Sulfa'], cond: [], phone: '+919811000333' },
      ]
      const created = []
      for (const sp of samplePatients) {
        const existingP = await db.collection('patients').findOne({ phone: sp.phone })
        if (existingP) { created.push(existingP); continue }
        const mediId = await generateMediId(hospital.city || 'Bangalore')
        const p = {
          id: uuidv4(), user_id: uuidv4(), medi_id: mediId, full_name: sp.name, phone: sp.phone,
          dob: sp.dob, gender: sp.gender, blood_group: sp.bg, city: hospital.city || 'Bangalore',
          photo_url: null, aadhaar_hash: null, abha_id: null,
          emergency_contact_name: 'Family', emergency_contact_phone: sp.phone,
          allergies: sp.allergies, chronic_conditions: sp.cond, created_at: new Date(),
        }
        await db.collection('patients').insertOne(p)
        created.push(p)
      }
      // Visits + 1 patient-initiated pending visit
      const visits = []
      const today = new Date()
      for (let i = 0; i < created.length; i++) {
        const p = created[i]
        const v = {
          id: uuidv4(), patient_id: p.id, hospital_id: hospital.id, doctor_id: staff.id, doctor_name: staff.full_name,
          visit_date: new Date(today.getTime() - i * 86400000),
          department: ['Cardiology', 'Endocrinology', 'General Medicine'][i],
          chief_complaint: ['Chest pain on exertion', 'HbA1c follow-up', 'Mild fever, body ache'][i],
          diagnosis: [['Stable angina'], ['Type 2 DM - controlled'], ['Viral fever']][i],
          notes: 'Routine consultation. Patient stable.', ai_summary: null, ai_summary_generated_at: null,
          follow_up_date: null, verification_status: 'approved', created_by: 'hospital',
          created_at: new Date(),
        }
        visits.push(v)
      }
      // one patient-initiated pending visit (the interlink demo)
      visits.push({
        id: uuidv4(), patient_id: created[0].id, hospital_id: hospital.id, doctor_id: null, doctor_name: null,
        visit_date: new Date(), department: 'General Medicine',
        chief_complaint: 'Self-reported headache; uploaded report',
        diagnosis: [], notes: 'Patient added this visit themselves. Pending hospital review.',
        ai_summary: null, ai_summary_generated_at: null, follow_up_date: null,
        verification_status: 'pending', created_by: 'patient', created_at: new Date(),
      })
      await db.collection('visits').insertMany(visits)
      // prescriptions on the first visit
      await db.collection('prescriptions').insertMany([
        { id: uuidv4(), visit_id: visits[0].id, patient_id: created[0].id, drug_name: 'Atorvastatin 20mg', dosage: '1 tab', frequency: 'OD at night', duration_days: 90, instructions: 'After dinner', image_url: null, is_active: true, reminder_enabled: false, prescribed_by: staff.id, start_date: new Date(), created_at: new Date() },
        { id: uuidv4(), visit_id: visits[1].id, patient_id: created[1].id, drug_name: 'Metformin 500mg', dosage: '1 tab', frequency: 'BD', duration_days: 90, instructions: 'With meals', image_url: null, is_active: true, reminder_enabled: false, prescribed_by: staff.id, start_date: new Date(), created_at: new Date() },
      ])
      // approved consents so hospital can view these patients
      await db.collection('access_consents').insertMany(created.map(p => ({
        id: uuidv4(), patient_id: p.id, hospital_id: hospital.id, status: 'approved',
        otp_code: '000000', otp_expires_at: new Date(),
        approved_at: new Date(), expires_at: new Date(Date.now() + 4 * 3600 * 1000),
        created_at: new Date(), requested_by: staff.id,
      })))
      // audit logs
      await db.collection('audit_logs').insertMany(visits.filter(v => v.verification_status === 'approved').map(v => ({
        id: uuidv4(), patient_id: v.patient_id, performed_by: staff.id, performed_by_role: staff.role,
        hospital_id: hospital.id, action_type: 'visit_created', ip_address: null,
        metadata: { visit_id: v.id, demo: true }, created_at: new Date(),
      })))
      return J({ ok: true, patients: created.length, visits: visits.length })
    }

    // ----- HOSPITAL INBOUND VISITS (patient-initiated, pending verification) -----
    if (route === '/hospital/inbound-visits' && method === 'GET') {
      const { hospital } = await requireStaff()
      const visits = await db.collection('visits').find({
        hospital_id: hospital.id, verification_status: 'pending', created_by: 'patient',
      }).sort({ created_at: -1 }).limit(50).toArray()
      const patientIds = [...new Set(visits.map(v => v.patient_id))]
      const patients = patientIds.length ? await db.collection('patients').find({ id: { $in: patientIds } }).toArray() : []
      const pmap = Object.fromEntries(patients.map(p => [p.id, p]))
      return J({ visits: visits.map(v => ({
        ...clean(v),
        patient: pmap[v.patient_id] ? { id: pmap[v.patient_id].id, medi_id: pmap[v.patient_id].medi_id, full_name: pmap[v.patient_id].full_name, allergies: pmap[v.patient_id].allergies || [] } : null,
      })) })
    }
    const inboundMatch = route.match(/^\/hospital\/inbound-visits\/([^/]+)\/(approve|deny)$/)
    if (inboundMatch && method === 'POST') {
      const { staff, hospital } = await requireStaff()
      const [, vid, action] = inboundMatch
      const v = await db.collection('visits').findOne({ id: vid, hospital_id: hospital.id })
      if (!v) return E('Visit not found', 404)
      const status = action === 'approve' ? 'approved' : 'denied'
      await db.collection('visits').updateOne({ id: vid }, { $set: { verification_status: status, verified_by: staff.id, verified_at: new Date() } })
      await logAudit(db, {
        patient_id: v.patient_id, performed_by: staff.id, performed_by_role: staff.role,
        hospital_id: hospital.id, action_type: action === 'approve' ? 'verification_passed' : 'verification_failed',
        metadata: { visit_id: vid, scope: 'patient_visit' },
      })
      // notify patient via in-app
      await db.collection('notifications').insertOne({
        id: uuidv4(), patient_id: v.patient_id, title: action === 'approve' ? 'Visit verified by hospital' : 'Visit needs more info',
        body: action === 'approve' ? `${hospital.name} confirmed your self-reported visit on ${new Date(v.visit_date).toLocaleDateString()}.` : `${hospital.name} could not verify your self-reported visit. Please contact them or correct details.`,
        type: 'info', is_read: false, created_at: new Date(),
      })
      return J({ ok: true })
    }

    // ----- HOSPITAL DASHBOARD -----
    if (route === '/hospital/dashboard' && method === 'GET') {
      const { staff, hospital } = await requireStaff()
      const now = new Date()
      const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0)
      const endOfToday = new Date(startOfToday); endOfToday.setDate(endOfToday.getDate() + 1)
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const [todayCount, monthCount, todayVisits, recentAudit, pendingUploads, activeSessions] = await Promise.all([
        db.collection('visits').countDocuments({ hospital_id: hospital.id, visit_date: { $gte: startOfToday, $lt: endOfToday } }),
        db.collection('visits').countDocuments({ hospital_id: hospital.id, visit_date: { $gte: startOfMonth } }),
        db.collection('visits').find({ hospital_id: hospital.id, visit_date: { $gte: startOfToday, $lt: endOfToday } }).sort({ visit_date: -1 }).limit(20).toArray(),
        db.collection('audit_logs').find({ hospital_id: hospital.id }).sort({ created_at: -1 }).limit(5).toArray(),
        db.collection('visits').countDocuments({ hospital_id: hospital.id, visit_date: { $gte: startOfToday, $lt: endOfToday } }).then(async (c) => {
          // count today's visits with zero prescriptions
          const visits = await db.collection('visits').find({ hospital_id: hospital.id, visit_date: { $gte: startOfToday, $lt: endOfToday } }).toArray()
          let count = 0
          for (const v of visits) {
            const has = await db.collection('prescriptions').countDocuments({ visit_id: v.id })
            if (!has) count++
          }
          return count
        }),
        db.collection('access_consents').countDocuments({ hospital_id: hospital.id, status: 'approved', expires_at: { $gt: now } }),
      ])
      // hydrate today's patients
      const patientIds = [...new Set(todayVisits.map(v => v.patient_id))]
      const patients = patientIds.length ? await db.collection('patients').find({ id: { $in: patientIds } }).toArray() : []
      const pmap = Object.fromEntries(patients.map(p => [p.id, p]))
      const todayPatients = todayVisits.map(v => ({
        visit_id: v.id, visit_date: v.visit_date, department: v.department,
        patient: pmap[v.patient_id] ? { id: pmap[v.patient_id].id, medi_id: pmap[v.patient_id].medi_id, full_name: pmap[v.patient_id].full_name } : null,
        status: v.notes ? 'completed' : 'in_progress',
      }))
      return J({
        hospital: clean(hospital),
        staff: { full_name: staff.full_name, role: staff.role },
        stats: { todayCount, monthCount, pendingUploads, activeSessions },
        todayPatients,
        recentAudit: cleanAll(recentAudit),
      })
    }

    // ----- HOSPITAL SEARCH (find patient) -----
    if (route === '/hospital/search' && method === 'GET') {
      await requireStaff()
      const url = new URL(request.url)
      const q = (url.searchParams.get('q') || '').trim()
      if (!q) return J({ patient: null })
      const digits = q.replace(/\D/g, '')
      const filter = { $or: [{ medi_id: q.toUpperCase() }] }
      if (digits.length >= 10) {
        filter.$or.push({ phone: `+91${digits.slice(-10)}` })
        filter.$or.push({ phone: digits })
        filter.$or.push({ phone: `+${digits}` })
      }
      const p = await db.collection('patients').findOne(filter)
      if (!p) return J({ patient: null })
      // safe summary card info only
      return J({
        patient: {
          id: p.id, medi_id: p.medi_id, full_name: p.full_name, dob: p.dob, gender: p.gender,
          blood_group: p.blood_group, city: p.city, allergies: p.allergies || [],
          chronic_conditions: p.chronic_conditions || [], phone_masked: p.phone ? `*****${p.phone.slice(-4)}` : null,
        },
      })
    }

    // ----- CONSENT REQUEST + VERIFY (hospital initiates) -----
    if (route === '/consent/request' && method === 'POST') {
      const { staff, hospital } = await requireStaff()
      const body = await request.json()
      const patient = await db.collection('patients').findOne({ id: body.patient_id })
      if (!patient) return E('Patient not found', 404)
      const otp_code = Math.floor(100000 + Math.random() * 900000).toString()
      const now = new Date()
      const consent = {
        id: uuidv4(), patient_id: patient.id, hospital_id: hospital.id,
        status: 'pending', otp_code, otp_expires_at: new Date(now.getTime() + 5 * 60 * 1000),
        approved_at: null, expires_at: new Date(now.getTime() + 4 * 60 * 60 * 1000),
        attempts: 0, created_at: now, requested_by: staff.id,
      }
      await db.collection('access_consents').insertOne(consent)
      const msg = `MediThread: ${hospital.name} is requesting access to your records. Approval code: ${otp_code}. Valid 5 minutes. Ignore if you didn't initiate this.`
      const sent = await sendWhatsAppNotification(patient.phone, msg).catch(e => ({ ok: false, error: e.message }))
      console.log(`[consent OTP] ${patient.phone} -> ${otp_code} (sent=${sent.ok})`)
      // Notify in-app
      await db.collection('notifications').insertOne({
        id: uuidv4(), patient_id: patient.id, title: 'Access request',
        body: `${hospital.name} requested access. Approval code: ${otp_code}`,
        type: 'consent', is_read: false, created_at: new Date(),
      })
      return J({ ok: true, consent_id: consent.id, _dev_otp: otp_code, _sent: !!sent.ok })
    }

    if (route === '/consent/verify' && method === 'POST') {
      const { staff, hospital } = await requireStaff()
      const body = await request.json()
      const c = await db.collection('access_consents').findOne({ id: body.consent_id, hospital_id: hospital.id })
      if (!c) return E('Consent not found', 404)
      if (c.status !== 'pending') return E('Consent already processed', 400)
      if (new Date(c.otp_expires_at) < new Date()) return E('OTP expired', 400)
      if ((c.attempts || 0) >= 3) return E('Too many attempts. Request a new code.', 400)
      if ((body.otp_code || '').toString().trim() !== c.otp_code) {
        await db.collection('access_consents').updateOne({ id: c.id }, { $inc: { attempts: 1 } })
        const remaining = 3 - ((c.attempts || 0) + 1)
        return E(`Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`, 400)
      }
      const expires_at = new Date(Date.now() + 4 * 60 * 60 * 1000)
      await db.collection('access_consents').updateOne({ id: c.id }, { $set: { status: 'approved', approved_at: new Date(), expires_at } })
      await logAudit(db, { patient_id: c.patient_id, performed_by: staff.id, performed_by_role: staff.role, hospital_id: hospital.id, action_type: 'consent_granted' })
      const patient = await db.collection('patients').findOne({ id: c.patient_id })
      return J({ ok: true, consent_id: c.id, patient_id: c.patient_id, medi_id: patient?.medi_id, expires_at })
    }

    // ----- HOSPITAL PATIENT VIEW (gated by approved consent) -----
    const hospPatientMatch = route.match(/^\/hospital\/patient\/([^/]+)$/)
    if (hospPatientMatch && method === 'GET') {
      const { staff, hospital } = await requireStaff()
      const mediId = decodeURIComponent(hospPatientMatch[1])
      const p = await db.collection('patients').findOne({ medi_id: mediId })
      if (!p) return E('Patient not found', 404)
      const now = new Date()
      const consent = await db.collection('access_consents').findOne({ patient_id: p.id, hospital_id: hospital.id, status: 'approved', expires_at: { $gt: now } })
      if (!consent) return E('Access expired or not granted', 403)
      // Log view (rate-limited: only once per minute per staff/patient)
      const lastView = await db.collection('audit_logs').findOne({ patient_id: p.id, performed_by: staff.id, action_type: 'record_viewed', created_at: { $gt: new Date(Date.now() - 60000) } })
      if (!lastView) {
        await logAudit(db, { patient_id: p.id, performed_by: staff.id, performed_by_role: staff.role, hospital_id: hospital.id, action_type: 'record_viewed' })
        // Notify patient via WhatsApp (best-effort)
        const time = new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' })
        sendWhatsAppNotification(p.phone, `MediThread: Your record was accessed by ${staff.full_name} at ${hospital.name} at ${time}. Review at /consent.`).catch(() => {})
      }
      const [visits, medsAll, reports, metrics, audit] = await Promise.all([
        db.collection('visits').find({ patient_id: p.id }).sort({ visit_date: -1 }).toArray(),
        db.collection('prescriptions').find({ patient_id: p.id }).sort({ created_at: -1 }).toArray(),
        db.collection('medical_reports').find({ patient_id: p.id }).sort({ report_date: -1 }).toArray(),
        db.collection('health_metrics').find({ patient_id: p.id }).sort({ recorded_at: -1 }).limit(100).toArray(),
        db.collection('audit_logs').find({ patient_id: p.id }).sort({ created_at: -1 }).limit(100).toArray(),
      ])
      const hospitalIds = [...new Set([...visits.map(v => v.hospital_id), ...reports.map(r => r.hospital_id), ...audit.map(a => a.hospital_id)].filter(Boolean))]
      const hospitals = hospitalIds.length ? await db.collection('hospitals').find({ id: { $in: hospitalIds } }).toArray() : []
      const hmap = Object.fromEntries(hospitals.map(h => [h.id, h]))
      const visitsHydrated = visits.map(v => ({
        ...clean(v),
        hospital: hmap[v.hospital_id] ? clean(hmap[v.hospital_id]) : null,
        is_own: v.hospital_id === hospital.id,
        prescriptions: cleanAll(medsAll.filter(m => m.visit_id === v.id)),
        reports: cleanAll(reports.filter(r => r.visit_id === v.id)),
      }))
      return J({
        patient: clean(p),
        consent: { id: consent.id, expires_at: consent.expires_at },
        visits: visitsHydrated,
        medications: { active: cleanAll(medsAll.filter(m => m.is_active)), past: cleanAll(medsAll.filter(m => !m.is_active)) },
        reports: reports.map(r => ({ ...clean(r), hospital: hmap[r.hospital_id] ? clean(hmap[r.hospital_id]) : null })),
        metrics: cleanAll(metrics),
        audit: audit.map(a => ({ ...clean(a), hospital: hmap[a.hospital_id] ? { name: hmap[a.hospital_id].name } : null })),
      })
    }

    // ----- HOSPITAL CREATE VISIT (gated by consent + staff verification token) -----
    const hospVisitCreate = route.match(/^\/hospital\/patient\/([^/]+)\/visit$/)
    if (hospVisitCreate && method === 'POST') {
      const { staff, hospital } = await requireStaff()
      const mediId = decodeURIComponent(hospVisitCreate[1])
      const p = await db.collection('patients').findOne({ medi_id: mediId })
      if (!p) return E('Patient not found', 404)
      const now = new Date()
      const consent = await db.collection('access_consents').findOne({ patient_id: p.id, hospital_id: hospital.id, status: 'approved', expires_at: { $gt: now } })
      if (!consent) return E('Access expired', 403)
      const body = await request.json()
      if (!body._verification_token) return E('Staff verification required', 403)
      const visit = {
        id: uuidv4(), patient_id: p.id, hospital_id: hospital.id, doctor_id: staff.id, doctor_name: staff.full_name,
        visit_date: body.visit_date ? new Date(body.visit_date) : new Date(),
        department: body.department || 'General',
        chief_complaint: body.chief_complaint || '', diagnosis: body.diagnosis || [], notes: body.notes || '',
        ai_summary: null, ai_summary_generated_at: null,
        follow_up_date: body.follow_up_date || null, created_at: new Date(),
      }
      try { const s = await summarizeVisit(visit); if (s) { visit.ai_summary = s; visit.ai_summary_generated_at = new Date() } } catch {}
      await db.collection('visits').insertOne(visit)
      await logAudit(db, { patient_id: p.id, performed_by: staff.id, performed_by_role: staff.role, hospital_id: hospital.id, action_type: 'visit_created', metadata: { visit_id: visit.id } })
      // prescriptions
      const rxs = (body.prescriptions || []).filter(r => r.drug_name).map(r => ({
        id: uuidv4(), visit_id: visit.id, patient_id: p.id,
        drug_name: r.drug_name, dosage: r.dosage || '', frequency: r.frequency || '',
        duration_days: r.duration_days ? parseInt(r.duration_days, 10) : null,
        instructions: r.instructions || '', image_url: null,
        is_active: true, reminder_enabled: false,
        prescribed_by: staff.id, start_date: new Date(), created_at: new Date(),
      }))
      if (rxs.length) {
        await db.collection('prescriptions').insertMany(rxs)
        await logAudit(db, { patient_id: p.id, performed_by: staff.id, performed_by_role: staff.role, hospital_id: hospital.id, action_type: 'prescription_uploaded', metadata: { count: rxs.length } })
      }
      // reports
      const reps = (body.reports || []).filter(r => r.title).map(r => ({
        id: uuidv4(), visit_id: visit.id, patient_id: p.id, hospital_id: hospital.id,
        report_type: r.report_type || 'other', title: r.title,
        file_url: null, file_data: r.file_data || null, parsed_data: r.parsed_data || {},
        report_date: r.report_date ? new Date(r.report_date) : new Date(),
        uploaded_by: staff.id, created_at: new Date(),
      }))
      if (reps.length) {
        await db.collection('medical_reports').insertMany(reps)
        await logAudit(db, { patient_id: p.id, performed_by: staff.id, performed_by_role: staff.role, hospital_id: hospital.id, action_type: 'report_uploaded', metadata: { count: reps.length } })
      }
      // notify patient
      const msg = `MediThread: Dr ${staff.full_name} at ${hospital.name} added a new visit record with ${rxs.length} prescription${rxs.length !== 1 ? 's' : ''} to your profile.`
      sendWhatsAppNotification(p.phone, msg).catch(() => {})
      await db.collection('notifications').insertOne({ id: uuidv4(), patient_id: p.id, title: 'New visit added', body: msg, type: 'info', is_read: false, created_at: new Date() })
      return J({ ok: true, visit: clean(visit), prescriptions: cleanAll(rxs), reports: cleanAll(reps) })
    }

    // ----- HOSPITAL AUDIT -----
    if (route === '/hospital/audit' && method === 'GET') {
      const { hospital } = await requireStaff()
      const url = new URL(request.url)
      const action = url.searchParams.get('action')
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200)
      const filter = { hospital_id: hospital.id }
      if (action) filter.action_type = action
      const logs = await db.collection('audit_logs').find(filter).sort({ created_at: -1 }).limit(limit).toArray()
      const patientIds = [...new Set(logs.map(l => l.patient_id).filter(Boolean))]
      const staffIds = [...new Set(logs.map(l => l.performed_by).filter(Boolean))]
      const [patients, staffs] = await Promise.all([
        patientIds.length ? db.collection('patients').find({ id: { $in: patientIds } }).toArray() : [],
        staffIds.length ? db.collection('hospital_staff').find({ id: { $in: staffIds } }).toArray() : [],
      ])
      const pmap = Object.fromEntries(patients.map(p => [p.id, p]))
      const smap = Object.fromEntries(staffs.map(s => [s.id, s]))
      const hydrated = logs.map(l => ({
        ...clean(l),
        patient: pmap[l.patient_id] ? { full_name: pmap[l.patient_id].full_name, medi_id: pmap[l.patient_id].medi_id } : null,
        staff: smap[l.performed_by] ? { full_name: smap[l.performed_by].full_name, role: smap[l.performed_by].role } : null,
      }))
      const recentFails = await db.collection('audit_logs').countDocuments({ hospital_id: hospital.id, action_type: 'verification_failed', created_at: { $gt: new Date(Date.now() - 24 * 3600 * 1000) } })
      return J({ logs: hydrated, recentFails })
    }

    // ----- HOSPITAL STAFF MGMT -----
    if (route === '/hospital/staff' && method === 'GET') {
      const { hospital } = await requireStaff()
      const list = await db.collection('hospital_staff').find({ hospital_id: hospital.id }).sort({ created_at: -1 }).toArray()
      return J({ staff: list.map(s => ({ ...clean(s), password_hash: undefined })) })
    }
    if (route === '/hospital/staff' && method === 'POST') {
      const { staff: me, hospital } = await requireStaff()
      if (me.role !== 'admin') return E('Admin role required', 403)
      const body = await request.json()
      if (!body.email || !body.full_name) return E('Email and name required')
      const existing = await db.collection('hospital_staff').findOne({ email: body.email.toLowerCase() })
      if (existing) return E('Staff with this email already exists', 400)
      const password_hash = body.password ? await bcrypt.hash(body.password, 10) : null
      const staff = {
        id: uuidv4(), user_id: uuidv4(), hospital_id: hospital.id,
        full_name: body.full_name, email: body.email.toLowerCase(),
        role: body.role || 'doctor', govt_id_url: null, selfie_url: null,
        is_verified: false, password_hash, created_at: new Date(),
      }
      await db.collection('hospital_staff').insertOne(staff)
      return J({ ok: true, staff: { ...clean(staff), password_hash: undefined } })
    }

    // ----- HOSPITAL ANALYTICS -----
    if (route === '/hospital/analytics' && method === 'GET') {
      const { hospital } = await requireStaff()
      const sinceMonths = 6
      const startMonth = new Date(); startMonth.setMonth(startMonth.getMonth() - sinceMonths); startMonth.setDate(1); startMonth.setHours(0, 0, 0, 0)
      const [totalPatients, totalVisits, totalRx, totalReports, visitsRecent, allRx] = await Promise.all([
        db.collection('visits').distinct('patient_id', { hospital_id: hospital.id }).then(a => a.length),
        db.collection('visits').countDocuments({ hospital_id: hospital.id }),
        db.collection('prescriptions').countDocuments({ prescribed_by: { $ne: null } }).then(async () => {
          // hack: count prescriptions linked to visits at this hospital
          const visits = await db.collection('visits').find({ hospital_id: hospital.id }, { projection: { id: 1 } }).toArray()
          return db.collection('prescriptions').countDocuments({ visit_id: { $in: visits.map(v => v.id) } })
        }),
        db.collection('medical_reports').countDocuments({ hospital_id: hospital.id }),
        db.collection('visits').find({ hospital_id: hospital.id, visit_date: { $gte: startMonth } }).toArray(),
        db.collection('visits').find({ hospital_id: hospital.id }).toArray(),
      ])
      // visits by month
      const byMonth = {}
      visitsRecent.forEach(v => {
        const key = new Date(v.visit_date).toISOString().slice(0, 7)
        byMonth[key] = (byMonth[key] || 0) + 1
      })
      const visitsByMonth = Object.entries(byMonth).sort().map(([m, c]) => ({ month: m, count: c }))
      // by department
      const byDept = {}
      allRx.forEach(v => { byDept[v.department || 'Other'] = (byDept[v.department || 'Other'] || 0) + 1 })
      const visitsByDept = Object.entries(byDept).map(([dept, count]) => ({ dept, count })).sort((a, b) => b.count - a.count)
      // top diagnoses
      const diagCount = {}
      allRx.forEach(v => (v.diagnosis || []).forEach(d => { diagCount[d] = (diagCount[d] || 0) + 1 }))
      const topDiagnoses = Object.entries(diagCount).map(([d, c]) => ({ diagnosis: d, count: c })).sort((a, b) => b.count - a.count).slice(0, 10)
      // staff activity this month
      const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
      const staffActivity = await db.collection('audit_logs').aggregate([
        { $match: { hospital_id: hospital.id, created_at: { $gte: startOfMonth }, performed_by: { $ne: null } } },
        { $group: { _id: '$performed_by', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 10 },
      ]).toArray()
      const sids = staffActivity.map(s => s._id)
      const staffMembers = sids.length ? await db.collection('hospital_staff').find({ id: { $in: sids } }).toArray() : []
      const sm = Object.fromEntries(staffMembers.map(s => [s.id, s.full_name]))
      const staffActivityHydrated = staffActivity.map(s => ({ name: sm[s._id] || 'Unknown', count: s.count }))
      return J({ totals: { totalPatients, totalVisits, totalRx, totalReports }, visitsByMonth, visitsByDept, topDiagnoses, staffActivity: staffActivityHydrated })
    }

    // ========================================================================
    // AI ENDPOINTS
    // ========================================================================

    if (route === '/ai/summarise' && method === 'GET') {
      await requireStaff()
      const url = new URL(request.url)
      const patientId = url.searchParams.get('patientId')
      if (!patientId) return E('patientId required')
      const p = await db.collection('patients').findOne({ id: patientId })
      if (!p) return E('Patient not found', 404)
      const [visits, rx] = await Promise.all([
        db.collection('visits').find({ patient_id: p.id }).sort({ visit_date: -1 }).limit(10).toArray(),
        db.collection('prescriptions').find({ patient_id: p.id, is_active: true }).toArray(),
      ])
      const hospitalIds = [...new Set(visits.map(v => v.hospital_id).filter(Boolean))]
      const hospitals = hospitalIds.length ? await db.collection('hospitals').find({ id: { $in: hospitalIds } }).toArray() : []
      const hmap = Object.fromEntries(hospitals.map(h => [h.id, h.name]))
      const patientData = {
        name: p.full_name, age: p.dob ? Math.floor((Date.now() - new Date(p.dob).getTime()) / (365.25 * 86400000)) : null,
        gender: p.gender, blood_group: p.blood_group, allergies: p.allergies || [],
        chronic_conditions: p.chronic_conditions || [],
        active_medications: rx.map(r => `${r.drug_name} ${r.dosage} ${r.frequency}`),
        recent_visits: visits.map(v => ({
          date: v.visit_date, hospital: hmap[v.hospital_id] || 'Unknown',
          department: v.department, chief_complaint: v.chief_complaint, diagnosis: v.diagnosis,
        })),
      }
      const summary = await clinicalSummary(patientData)
      if (summary && visits[0]) {
        await db.collection('visits').updateOne({ id: visits[0].id }, { $set: { ai_summary: summary, ai_summary_generated_at: new Date() } })
      }
      return J({ summary: summary || 'AI summary unavailable. Please retry.' })
    }

    if (route === '/ai/drug-check' && method === 'POST') {
      await requireStaff()
      const body = await request.json()
      if (!body.newDrug) return E('newDrug required')
      const result = await drugInteraction(body.newDrug, body.currentMedications || [])
      return J(result)
    }

    if (route === '/ai/ocr' && method === 'POST') {
      await requireStaff()
      const body = await request.json()
      if (!body.imageBase64) return E('imageBase64 required')
      const items = await ocrPrescription(body.imageBase64)
      return J({ items })
    }

    if (route === '/verify/face-match' && method === 'POST') {
      const ctx = await getCurrentStaff()
      const body = await request.json()
      if (!body.selfieBase64 || !body.govtIdBase64) return E('Both images required')
      const result = await faceMatch(body.selfieBase64, body.govtIdBase64)
      if (ctx) {
        await logAudit(db, {
          patient_id: null, performed_by: ctx.staff.id, performed_by_role: ctx.staff.role,
          hospital_id: ctx.hospital.id,
          action_type: result.match && result.confidence >= 0.75 ? 'verification_passed' : 'verification_failed',
          metadata: { confidence: result.confidence, reasoning: result.reasoning },
        })
      }
      const ok = result.match && result.confidence >= 0.75
      return J({ ...result, ok, token: ok ? uuidv4() : null })
    }

    if (route === '/notify/otp' && method === 'POST') {
      const body = await request.json()
      if (!body.phone || !body.message) return E('phone and message required')
      const r = await sendWhatsAppNotification(body.phone, body.message).catch(e => ({ ok: false, error: e.message }))
      return J({ ok: true, sent: !!r.ok })
    }

    return E(`Route ${route} not found`, 404)

  } catch (err) {
    if (err instanceof Response) return cors(err)
    console.error('[api error]', err)
    return E(err.message || 'Internal server error', 500)
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
