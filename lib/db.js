import { MongoClient } from 'mongodb'

let client
let db

export async function getDb() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME || 'medithread')

    // Create indexes (best-effort, safe to re-run)
    try {
      await db.collection('patients').createIndex({ user_id: 1 }, { unique: true })
      await db.collection('patients').createIndex({ medi_id: 1 }, { unique: true })
      await db.collection('patients').createIndex({ phone: 1 }, { unique: true })
      await db.collection('otps').createIndex({ phone: 1 })
      await db.collection('otps').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 })
      await db.collection('visits').createIndex({ patient_id: 1, visit_date: -1 })
      await db.collection('prescriptions').createIndex({ patient_id: 1, is_active: 1 })
      await db.collection('medical_reports').createIndex({ patient_id: 1, report_date: -1 })
      await db.collection('access_consents').createIndex({ patient_id: 1, status: 1 })
      await db.collection('health_metrics').createIndex({ patient_id: 1, metric_type: 1, recorded_at: -1 })
      await db.collection('audit_logs').createIndex({ patient_id: 1, created_at: -1 })
      await db.collection('notifications').createIndex({ patient_id: 1, created_at: -1 })
    } catch (e) {
      // ignore
    }
  }
  return db
}

export function clean(doc) {
  if (!doc) return doc
  const { _id, ...rest } = doc
  return rest
}

export function cleanAll(docs) {
  return docs.map(clean)
}
