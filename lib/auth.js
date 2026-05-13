import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'devsecret')

export const PATIENT_COOKIE = 'mt_session'
export const HOSPITAL_COOKIE = 'mt_hospital_session'

export async function createSessionFor(cookieName, payload, days = 30) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(SECRET)
  cookies().set(cookieName, token, {
    httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * days,
  })
  return token
}

export async function getSessionFor(cookieName) {
  const c = cookies().get(cookieName)
  if (!c) return null
  try {
    const { payload } = await jwtVerify(c.value, SECRET)
    return payload
  } catch { return null }
}

export function clearSessionFor(cookieName) {
  cookies().set(cookieName, '', { path: '/', maxAge: 0 })
}

// Backward-compat helpers used by patient endpoints
export async function createSession(payload) { return createSessionFor(PATIENT_COOKIE, payload) }
export async function getSession() { return getSessionFor(PATIENT_COOKIE) }
export function clearSession() { return clearSessionFor(PATIENT_COOKIE) }
