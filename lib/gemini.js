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

export async function clinicalSummary(patientData) {
  try {
    const model = geminiPro()
    const prompt = `You are a clinical AI assistant. A doctor is about to see this patient. Generate a concise 5-point clinical summary. Be factual and clinical. Highlight allergies and critical conditions prominently. Patient data: ${JSON.stringify(patientData)}. Return exactly 5 bullet points starting with "• ". Keep each point under 30 words. End the 5th point with any recommended follow-ups based on visit history.`
    const res = await model.generateContent(prompt)
    return res.response.text().trim()
  } catch (e) {
    console.error('[gemini] clinical summary failed', e.message)
    return null
  }
}

export async function drugInteraction(newDrug, currentMeds) {
  try {
    const model = geminiFlash()
    const prompt = `Check drug interactions. New drug: ${newDrug}. Current medications: ${JSON.stringify(currentMeds)}. Return ONLY valid JSON: { "severity": "none"|"mild"|"moderate"|"severe", "interactions": [{"drug": string, "description": string}], "recommendation": string }. Be medically accurate. No markdown fences, just JSON.`
    const res = await model.generateContent(prompt)
    let text = res.response.text().trim()
    text = text.replace(/^```json\s*|\s*```$/g, '').replace(/^```\s*|\s*```$/g, '')
    return JSON.parse(text)
  } catch (e) {
    console.error('[gemini] drug check failed', e.message)
    return { severity: 'none', interactions: [], recommendation: 'Unable to check interactions automatically. Use clinical judgment.' }
  }
}

function stripDataUrl(dataUrl) {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (m) return { mimeType: m[1], data: m[2] }
  return { mimeType: 'image/jpeg', data: dataUrl }
}

export async function ocrPrescription(imageBase64) {
  try {
    const model = geminiFlash()
    const { mimeType, data } = stripDataUrl(imageBase64)
    const res = await model.generateContent([
      { inlineData: { data, mimeType } },
      { text: 'This is a medical prescription. Extract all medications. Return ONLY a JSON array: [{"drug_name": string, "dosage": string, "frequency": string, "duration_days": number|null, "instructions": string|null}]. No markdown fences, just the JSON array.' },
    ])
    let text = res.response.text().trim()
    text = text.replace(/^```json\s*|\s*```$/g, '').replace(/^```\s*|\s*```$/g, '')
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    console.error('[gemini] ocr failed', e.message)
    return []
  }
}

export async function medicineScan(imageBase64) {
  try {
    const model = geminiFlash()
    const m = imageBase64.match(/^data:([^;]+);base64,(.+)$/)
    const mimeType = m ? m[1] : 'image/jpeg'
    const data = m ? m[2] : imageBase64
    const res = await model.generateContent([
      { inlineData: { data, mimeType } },
      { text: `You are a clinical pharmacist. Look at this medicine package or pill image carefully. Identify the medicine and return ONLY valid JSON with these EXACT keys:
{
  "name": "Brand name visible on package",
  "generic_name": "Active ingredient (e.g., paracetamol)",
  "strength": "Dosage strength visible (e.g., 500mg)",
  "form": "tablet|capsule|syrup|injection|cream|inhaler|drops|other",
  "manufacturer": "Pharma company if visible, else null",
  "category": "Drug class (e.g., NSAID, antibiotic, antihypertensive)",
  "uses": ["common use case 1", "use 2", "use 3"],
  "typical_dosage": "Plain-English typical adult dosage (e.g., 1 tablet every 6 hours)",
  "common_side_effects": ["effect 1", "effect 2", "effect 3"],
  "serious_side_effects": ["serious 1", "serious 2"],
  "warnings": ["warning 1", "warning 2"],
  "avoid_with": ["other drugs or conditions to avoid"],
  "pregnancy_safety": "safe|caution|unsafe|unknown",
  "storage": "Brief storage instruction",
  "confidence": 0.8,
  "disclaimer": "Always consult a doctor before starting or stopping any medicine."
}
If you cannot identify the medicine, return {"error": "Could not identify medicine clearly. Try a clearer photo of the package or pill."}.
No markdown fences, just the JSON.`,
      },
    ])
    let text = res.response.text().trim()
    text = text.replace(/^```json\s*|\s*```$/g, '').replace(/^```\s*|\s*```$/g, '')
    return JSON.parse(text)
  } catch (e) {
    console.error('[gemini] medicine scan failed', e.message)
    return { error: 'AI scan unavailable right now. Please try again later.' }
  }
}

export async function faceMatch(selfieBase64, idBase64) {
  try {
    const model = geminiFlash()
    const s = stripDataUrl(selfieBase64)
    const i = stripDataUrl(idBase64)
    const res = await model.generateContent([
      { inlineData: { data: s.data, mimeType: s.mimeType } },
      { inlineData: { data: i.data, mimeType: i.mimeType } },
      { text: 'Compare Image 1 (live selfie) and Image 2 (government ID photo). Are they the same person? Return ONLY valid JSON: {"match": boolean, "confidence": number, "reasoning": string}. Confidence is 0 to 1. Be conservative — only match=true if clearly the same person. No markdown fences.' },
    ])
    let text = res.response.text().trim()
    text = text.replace(/^```json\s*|\s*```$/g, '').replace(/^```\s*|\s*```$/g, '')
    return JSON.parse(text)
  } catch (e) {
    console.error('[gemini] face match failed', e.message)
    return { match: false, confidence: 0, reasoning: 'AI verification unavailable' }
  }
}
