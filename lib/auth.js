import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'devsecret')
const COOKIE = 'mt_session'

export async function createSession(payload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(SECRET)
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return token
}

export async function getSession() {
  const c = cookies().get(COOKIE)
  if (!c) return null
  try {
    const { payload } = await jwtVerify(c.value, SECRET)
    return payload
  } catch {
    return null
  }
}

export function clearSession() {
  cookies().set(COOKIE, '', { path: '/', maxAge: 0 })
}
