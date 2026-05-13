import twilio from 'twilio'

let _client
function client() {
  if (!_client) {
    _client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  }
  return _client
}

function normalizePhone(phone) {
  // Expect +91XXXXXXXXXX or 10-digit Indian number
  if (!phone) return phone
  const trimmed = phone.replace(/[^\d+]/g, '')
  if (trimmed.startsWith('+')) return trimmed
  if (trimmed.length === 10) return `+91${trimmed}`
  return `+${trimmed}`
}

export async function sendOtpSms(phone, code) {
  const to = normalizePhone(phone)
  try {
    // Try WhatsApp first (free sandbox) since we have whatsapp:+18777804236
    const from = process.env.TWILIO_WHATSAPP_FROM
    if (from && from.startsWith('whatsapp:')) {
      await client().messages.create({
        from,
        to: `whatsapp:${to}`,
        body: `Your MediThread verification code is: ${code}\nValid for 5 minutes. Do not share this code.`,
      })
      return { ok: true, channel: 'whatsapp' }
    }
    // Fallback to SMS
    await client().messages.create({
      from: process.env.TWILIO_PHONE_FROM,
      to,
      body: `MediThread OTP: ${code}. Valid 5 min.`,
    })
    return { ok: true, channel: 'sms' }
  } catch (e) {
    console.error('[twilio] send failed', e.message)
    return { ok: false, error: e.message }
  }
}

export async function sendWhatsAppNotification(phone, body) {
  try {
    const from = process.env.TWILIO_WHATSAPP_FROM
    const to = normalizePhone(phone)
    await client().messages.create({
      from,
      to: `whatsapp:${to}`,
      body,
    })
    return { ok: true }
  } catch (e) {
    console.error('[twilio whatsapp] failed', e.message)
    return { ok: false, error: e.message }
  }
}
