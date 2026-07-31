/**
 * Key manager for the web client.
 * Handles unit key creation/registration and patient key wrapping/unwrapping.
 * Mirrors the iOS PatientKeyCoordinator + UnitKeyStore flow.
 */

import {
  generatePatientKeyBytes,
  exportKeyRaw,
  importKeyFromBuffer,
  wrapPatientKey,
  unwrapPatientKey,
  hospitalNumberLookupHash,
  getUnitKeyById,
  getActiveUnitKey,
  storePatientKeyById,
  getPatientKeyById,
  setActivePatientKeyId,
  getActivePatientKeyId,
} from './crypto'
import { establishEncryptionReadiness } from './deviceAuth'
import type { ClinicalCipherEnvelope } from '@/types'

// --- Types matching the Supabase patient_key_versions table ---

export interface PatientKeyVersionRow {
  id: string
  unit_id: string
  patient_id: string
  unit_key_id: string
  version: number
  status: string
  nonce: string
  wrapped_key: string
  created_by: string | null
}

// --- REST helpers (inline to avoid circular dep with api.ts) ---

import { supabase } from './supabase'

async function restGet<T>(table: string, select: string, filters: Record<string, string>): Promise<T[]> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const params = new URLSearchParams({ select, ...filters })
  const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/${table}?${params}`
  const res = await fetch(url, {
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
  })
  if (!res.ok) throw new Error(`REST GET ${table} failed: ${res.status}`)
  return res.json()
}

async function restPost(table: string, row: Record<string, unknown>, onConflict?: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const headers: Record<string, string> = {
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  }
  const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/${table}`)
  if (onConflict) url.searchParams.set('on_conflict', onConflict)
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify([row]),
  })
  if (!res.ok) throw new Error(`REST POST ${table} failed: ${res.status}`)
}

// --- Unit key management ---

/**
 * Gets the active unit key for a unit, or null if none exists locally.
 */
export async function getUnitKeyForUnit(unitId: string): Promise<{ keyId: string; key: CryptoKey } | null> {
  return getActiveUnitKey(unitId)
}

/**
 * Ensures the web client has the unit key for a unit.
 * The web client never creates unit keys — it receives them from the mobile app
 * via ECDH key wrapping (device authorization flow).
 * This function delegates to deviceAuth.establishEncryptionReadiness which:
 *   1. Checks if we already have the unit key locally
 *   2. Checks if there's a wrapped key for this device on the server
 *   3. Unwraps it using ECDH + HKDF + AES-GCM
 * Throws if the device is not yet authorized (no wrapped key available).
 */
export async function ensureUnitKey(unitId: string, _userId: string): Promise<{ keyId: string; key: CryptoKey }> {
  const result = await establishEncryptionReadiness(unitId)
  if (result.state !== 'ready') {
    throw new Error(result.message ?? 'Device not authorized for this unit')
  }
  const key = await getUnitKeyById(result.unitKeyId!)
  if (!key) throw new Error('Unit key not found after readiness check')
  return { keyId: result.unitKeyId!, key }
}

// --- Patient key management ---

/**
 * Fetches patient key versions from the server and unwraps them locally.
 */
async function syncPatientKeys(unitId: string, patientId: string): Promise<void> {
  const rows = await restGet<PatientKeyVersionRow>(
    'patient_key_versions',
    'id,unit_id,patient_id,unit_key_id,version,status,nonce,wrapped_key',
    {
      unit_id: `eq.${unitId}`,
      patient_id: `eq.${patientId}`,
    },
  )

  for (const row of rows) {
    const unitKey = await getUnitKeyById(row.unit_key_id)
    if (!unitKey) continue

    const envelope: ClinicalCipherEnvelope = {
      version: 1,
      algorithm: 'A256GCM',
      key_id: row.unit_key_id,
      nonce: row.nonce,
      ciphertext: row.wrapped_key,
    }

    try {
      const patientKeyBytes = await unwrapPatientKey(
        envelope,
        unitKey,
        unitId,
        patientId,
        row.id,
        row.unit_key_id,
      )
      await storePatientKeyById(row.id, patientKeyBytes)
      if (row.status === 'ACTIVE') {
        await setActivePatientKeyId(patientId, row.id)
      }
    } catch {
      // Skip keys we can't unwrap (e.g. wrapped by a different unit key version)
    }
  }
}

/**
 * Ensures a patient has an active key. Syncs from server first, then
 * mints a new one if none exists.
 */
export async function ensurePatientKey(
  unitId: string,
  patientId: string,
  userId: string,
): Promise<{ keyId: string; key: CryptoKey }> {
  // Sync existing keys from server
  await syncPatientKeys(unitId, patientId)

  // Check if we now have an active key
  const active = await getActivePatientKeyId(patientId)
  if (active) {
    const key = await getPatientKeyById(active)
    if (key) return { keyId: active, key }
  }

  // Need to mint a new patient key
  const unitKeyInfo = await ensureUnitKey(unitId, userId)
  const patientKeyBytes = await generatePatientKeyBytes()
  const patientKeyId = crypto.randomUUID()

  const envelope = await wrapPatientKey(
    patientKeyBytes,
    unitKeyInfo.key,
    unitKeyInfo.keyId,
    unitId,
    patientId,
    patientKeyId,
  )

  await restPost('patient_key_versions', {
    id: patientKeyId,
    unit_id: unitId,
    patient_id: patientId,
    unit_key_id: unitKeyInfo.keyId,
    version: 1,
    status: 'ACTIVE',
    nonce: envelope.nonce,
    wrapped_key: envelope.ciphertext,
    created_by: userId,
  }, 'patient_id,version')

  await storePatientKeyById(patientKeyId, patientKeyBytes)
  await setActivePatientKeyId(patientId, patientKeyId)

  const key = await importKeyFromBuffer(patientKeyBytes)
  return { keyId: patientKeyId, key }
}

// --- Convenience encrypt/decrypt helpers ---

import {
  encryptWithAAD,
  decryptWithAAD,
  isEncrypted,
  patientAAD,
  unitAAD,
  fieldAAD,
} from './crypto'

/**
 * Encrypts a patient-scoped clinical field.
 * AAD: rounds:v1|{unitId}|{recordId}|{patientId}|{table}.{field}
 */
export async function encryptPatientField(
  plaintext: string,
  unitId: string,
  patientId: string,
  recordId: string,
  table: string,
  field: string,
  patientKey: CryptoKey,
  patientKeyId: string,
): Promise<string> {
  if (isEncrypted(plaintext)) return plaintext
  const aad = patientAAD(unitId, recordId, patientId, table, field)
  return encryptWithAAD(plaintext, patientKey, patientKeyId, aad)
}

/**
 * Decrypts a patient-scoped clinical field.
 */
export async function decryptPatientField(
  encryptedValue: string,
  unitId: string,
  patientId: string,
  recordId: string,
  table: string,
  field: string,
): Promise<string> {
  if (!isEncrypted(encryptedValue)) return encryptedValue
  const envelope = JSON.parse(encryptedValue) as ClinicalCipherEnvelope
  const key = await getPatientKeyById(envelope.key_id)
  if (!key) return encryptedValue // can't decrypt — return as-is
  const aad = patientAAD(unitId, recordId, patientId, table, field)
  try {
    return await decryptWithAAD(encryptedValue, key, aad)
  } catch {
    return encryptedValue // decryption failed — return as-is
  }
}

/**
 * Encrypts a patient demographic field (initials, hospital_number, etc.)
 * Uses the UNIT key, not the patient key.
 * AAD: rounds:v1|{unitId}|{patientId}|{fieldName}
 * Returns base64-encoded envelope (matching iOS patientField helper).
 */
export async function encryptPatientDemographic(
  plaintext: string,
  unitId: string,
  patientId: string,
  fieldName: string,
  unitKey: CryptoKey,
  unitKeyId: string,
): Promise<string> {
  if (isEncrypted(plaintext)) return plaintext
  const aad = fieldAAD(unitId, patientId, fieldName)
  const envelope = await encryptWithAAD(plaintext, unitKey, unitKeyId, aad)
  // iOS encodes as Data then base64 — we encode the JSON string as base64
  return btoa(envelope)
}

/**
 * Decrypts a patient demographic field (base64-encoded envelope).
 */
export async function decryptPatientDemographic(
  encodedValue: string,
  unitId: string,
  patientId: string,
  fieldName: string,
): Promise<string> {
  let jsonStr: string
  try {
    jsonStr = atob(encodedValue)
  } catch {
    return encodedValue // not base64 — return as-is (plaintext fallback)
  }
  if (!isEncrypted(jsonStr)) return encodedValue
  const envelope = JSON.parse(jsonStr) as ClinicalCipherEnvelope
  const key = await getUnitKeyById(envelope.key_id)
  if (!key) return encodedValue
  const aad = fieldAAD(unitId, patientId, fieldName)
  try {
    return await decryptWithAAD(jsonStr, key, aad)
  } catch {
    return encodedValue
  }
}

/**
 * Encrypts a unit-scoped field (e.g. coordination event body without patient).
 */
export async function encryptUnitField(
  plaintext: string,
  unitId: string,
  recordId: string,
  table: string,
  field: string,
  unitKey: CryptoKey,
  unitKeyId: string,
): Promise<string> {
  if (isEncrypted(plaintext)) return plaintext
  const aad = unitAAD(unitId, recordId, table, field)
  return encryptWithAAD(plaintext, unitKey, unitKeyId, aad)
}

/**
 * Decrypts a unit-scoped field.
 */
export async function decryptUnitField(
  encryptedValue: string,
  unitId: string,
  recordId: string,
  table: string,
  field: string,
): Promise<string> {
  if (!isEncrypted(encryptedValue)) return encryptedValue
  const envelope = JSON.parse(encryptedValue) as ClinicalCipherEnvelope
  const key = await getUnitKeyById(envelope.key_id)
  if (!key) return encryptedValue
  const aad = unitAAD(unitId, recordId, table, field)
  try {
    return await decryptWithAAD(encryptedValue, key, aad)
  } catch {
    return encryptedValue
  }
}

export { hospitalNumberLookupHash, exportKeyRaw }
