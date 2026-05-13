import twilio from 'twilio'
import { getDb } from './db'

let _client
function client() {
  if (!_client) _client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  return _client
}

// Lazily create + cache a Twilio Verify Service. We persist the SID in Mongo
// so we only create it once per environment.
async function getOrCreateService() {
  // 1) env override
  if (process.env.TWILIO_VERIFY_SERVICE_SID) return process.env.TWILIO_VERIFY_SERVICE_SID

  const db = await getDb()
  const settings = db.collection('app_settings')
  const cached = await settings.findOne({ key: 'twilio_verify_sid' })
  if (cached?.value) return cached.value

  // 2) try to find an existing service named "MediThread"
  try {
    const list = await client().verify.v2.services.list({ limit: 50 })
    const found = list.find(s => s.friendlyName === 'MediThread')
    if (found) {
      await settings.updateOne({ key: 'twilio_verify_sid' }, { $set: { value: found.sid, updated_at: new Date() } }, { upsert: true })
      return found.sid
    }
  } catch (e) {
    console.error('[twilio-verify] list failed', e.message)
  }

  // 3) create a new service
  const svc = await client().verify.v2.services.create({
    friendlyName: 'MediThread',
    codeLength: 6,
  })
  await settings.updateOne({ key: 'twilio_verify_sid' }, { $set: { value: svc.sid, updated_at: new Date() } }, { upsert: true })
  console.log('[twilio-verify] created service', svc.sid)
  return svc.sid
}

function normalizePhone(phone) {
  if (!phone) return phone
  const t = phone.replace(/[^\d+]/g, '')
  if (t.startsWith('+')) return t
  if (t.length === 10) return `+91${t}`
  return `+${t}`
}

/**
 * Sends an OTP. Tries Twilio Verify (SMS) first, falls back to WhatsApp sandbox.
 * Returns { ok, channel, error, mode } where mode = 'verify' | 'whatsapp' | 'none'.
 * When mode='verify', the OTP is stored on Twilio side — caller should use checkOtpVerify().
 * When mode='whatsapp', the OTP is generated locally — caller should pass the local code.
 */
export async function sendOtp(phone) {
  const to = normalizePhone(phone)
  // Try Twilio Verify SMS first
  try {
    const sid = await getOrCreateService()
    const v = await client().verify.v2.services(sid).verifications.create({ to, channel: 'sms' })
    return { ok: true, channel: 'sms', mode: 'verify', sid: v.sid, status: v.status }
  } catch (e) {
    console.error('[twilio-verify send-sms]', e.code, e.message)
    // Trial account: recipient not verified → fall back to email channel? Not useful.
    // Fall back to WhatsApp sandbox (still uses local code)
  }
  // Try Twilio Verify via WhatsApp
  try {
    const sid = await getOrCreateService()
    const v = await client().verify.v2.services(sid).verifications.create({ to, channel: 'whatsapp' })
    return { ok: true, channel: 'whatsapp', mode: 'verify', sid: v.sid, status: v.status }
  } catch (e) {
    console.error('[twilio-verify send-wa]', e.code, e.message)
  }
  return { ok: false, mode: 'none', error: 'Twilio Verify unavailable' }
}

/**
 * Checks an OTP previously sent via sendOtp() with mode='verify'.
 * Returns { ok, status }.
 */
export async function checkOtp(phone, code) {
  const to = normalizePhone(phone)
  try {
    const sid = await getOrCreateService()
    const check = await client().verify.v2.services(sid).verificationChecks.create({ to, code })
    return { ok: check.status === 'approved', status: check.status }
  } catch (e) {
    console.error('[twilio-verify check]', e.code, e.message)
    return { ok: false, status: 'error', error: e.message }
  }
}
