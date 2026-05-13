import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb, clean, cleanAll } from '@/lib/db'
import { createSession, getSession, clearSession } from '@/lib/auth'
import { sendOtpSms } from '@/lib/twilio'
import { generateMediId } from '@/lib/medi-id'
import { summarizeVisit } from '@/lib/gemini'

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
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      const expires_at = new Date(Date.now() + 5 * 60 * 1000)
      await db.collection('otps').deleteMany({ phone })
      await db.collection('otps').insertOne({ phone, code, expires_at, created_at: new Date(), attempts: 0 })
      const sent = await sendOtpSms(phone, code)
      console.log(`[OTP] ${phone} -> ${code} (sent=${sent.ok}, ch=${sent.channel || sent.error})`)
      // For demo/MVP since Twilio sandbox may not deliver, return dev_code too
      return J({ ok: true, channel: sent.channel || null, _dev_code: code, _sent: sent.ok, _twilio_error: sent.error || null })
    }

    if (route === '/auth/verify-otp' && method === 'POST') {
      const body = await request.json()
      const phone = normalizePhone(body.phone)
      const code = (body.code || '').toString().trim()
      if (!phone || !code) return E('Phone and code required')
      const rec = await db.collection('otps').findOne({ phone })
      if (!rec) return E('OTP not found, please request a new one', 400)
      if (new Date(rec.expires_at) < new Date()) return E('OTP expired', 400)
      if (rec.code !== code) return E('Invalid OTP', 400)
      await db.collection('otps').deleteMany({ phone })
      // Find or create user_id by phone
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
      await logAudit(db, { patient_id: p.id, action_type: 'visit_created', metadata: { visit_id: visit.id } })
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

    // ===== SEED DEMO DATA =====
    if (route === '/demo/seed' && method === 'POST') {
      const p = await requirePatient(db)
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
