import { GoogleGenerativeAI } from '@google/generative-ai'

let _g
function genAI() {
  if (!_g) _g = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  return _g
}

export function geminiPro() {
  return genAI().getGenerativeModel({ model: 'gemini-1.5-pro' })
}

export function geminiFlash() {
  return genAI().getGenerativeModel({ model: 'gemini-1.5-flash' })
}

export async function summarizeVisit(visit) {
  try {
    const model = geminiFlash()
    const prompt = `You are a medical assistant. Summarize this hospital visit in 2-3 plain-English sentences for the patient. Be empathetic and use simple language. Visit data:
- Department: ${visit.department || 'N/A'}
- Chief complaint: ${visit.chief_complaint || 'N/A'}
- Diagnosis: ${(visit.diagnosis || []).join(', ') || 'N/A'}
- Notes: ${visit.notes || 'N/A'}`
    const res = await model.generateContent(prompt)
    return res.response.text().trim()
  } catch (e) {
    console.error('[gemini] summarize failed', e.message)
    return null
  }
}
