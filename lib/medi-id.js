import { getDb } from './db'

const CITY_CODES = {
  Bangalore: 'BLR',
  Bengaluru: 'BLR',
  Mumbai: 'MUM',
  Delhi: 'DEL',
  Chennai: 'CHN',
  Hyderabad: 'HYD',
  Indore: 'IND',
}

export function cityCode(city) {
  if (!city) return 'BLR'
  return CITY_CODES[city] || city.slice(0, 3).toUpperCase()
}

export async function generateMediId(city) {
  const db = await getDb()
  const year = new Date().getFullYear()
  const code = cityCode(city)
  for (let i = 0; i < 8; i++) {
    const num = Math.floor(Math.random() * 99999999)
      .toString()
      .padStart(8, '0')
    const id = `MT-${year}-${code}-${num}`
    const exists = await db.collection('patients').findOne({ medi_id: id })
    if (!exists) return id
  }
  throw new Error('Failed to generate unique MediID')
}
