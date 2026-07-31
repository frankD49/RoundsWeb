import { CRYPTO_CONSTANTS, type ClinicalCipherEnvelope } from '@/types'

/**
 * Web Crypto implementation matching ClinicalCipherEnvelope format.
 * Uses AES-GCM with 256-bit keys, 12-byte nonces, and 16-byte auth tags.
 * The ciphertext field includes the GCM tag appended (Web Crypto convention).
 */

const subtle = globalThis.crypto.subtle

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64.replace(/-/g, '+').replace(/_/g, '/'))
  const buf = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function generateRandomBytes(count: number): ArrayBuffer {
  const arr = new Uint8Array(count)
  crypto.getRandomValues(arr)
  return arr.buffer
}

// --- AAD construction ---

export function fieldAAD(unitId: string, recordId: string, fieldName: string): Uint8Array {
  return new TextEncoder().encode(`rounds:v1|${unitId}|${recordId}|${fieldName}`)
}

export function patientAAD(unitId: string, recordId: string, patientId: string, table: string, field: string): Uint8Array {
  return fieldAAD(unitId, recordId, `${patientId}|${table}.${field}`)
}

export function unitAAD(unitId: string, recordId: string, table: string, field: string): Uint8Array {
  return fieldAAD(unitId, recordId, `${table}.${field}`)
}

export function patientKeyWrapAAD(unitId: string, patientId: string, patientKeyId: string, unitKeyId: string): Uint8Array {
  return new TextEncoder().encode(`rounds:patient-key-wrap:v1|${unitId}|${patientId}|${patientKeyId}|${unitKeyId}`)
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function generatePatientKeyBytes(): Promise<ArrayBuffer> {
  return generateRandomBytes(CRYPTO_CONSTANTS.keyByteCount)
}

export async function importKeyFromBuffer(raw: ArrayBuffer): Promise<CryptoKey> {
  return subtle.importKey('raw', raw as BufferSource, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function generateUnitKey(): Promise<CryptoKey> {
  return subtle.importKey(
    'raw',
    generateRandomBytes(CRYPTO_CONSTANTS.keyByteCount) as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function exportKeyRaw(key: CryptoKey): Promise<Uint8Array> {
  const raw = await subtle.exportKey('raw', key)
  return new Uint8Array(raw)
}

export async function importKeyRaw(raw: Uint8Array): Promise<CryptoKey> {
  return subtle.importKey('raw', raw.buffer as BufferSource, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export function isEncrypted(value: string): boolean {
  try {
    const envelope = JSON.parse(value) as ClinicalCipherEnvelope
    return (
      envelope.version === CRYPTO_CONSTANTS.envelopeVersion &&
      envelope.algorithm === CRYPTO_CONSTANTS.algorithm &&
      !!envelope.key_id &&
      !!envelope.nonce &&
      !!envelope.ciphertext
    )
  } catch {
    return false
  }
}

export async function encrypt(
  plaintext: string,
  key: CryptoKey,
  keyId: string,
): Promise<string> {
  const nonce = generateRandomBytes(CRYPTO_CONSTANTS.nonceByteCount)
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertextBuf = await subtle.encrypt(
    { name: 'AES-GCM', iv: nonce as BufferSource, tagLength: 128 },
    key,
    encoded as BufferSource,
  )
  const envelope: ClinicalCipherEnvelope = {
    version: CRYPTO_CONSTANTS.envelopeVersion,
    algorithm: CRYPTO_CONSTANTS.algorithm,
    key_id: keyId,
    nonce: bytesToBase64(new Uint8Array(nonce)),
    ciphertext: bytesToBase64(new Uint8Array(ciphertextBuf)),
  }
  return JSON.stringify(envelope)
}

export async function decrypt(
  encryptedValue: string,
  key: CryptoKey,
): Promise<string> {
  const envelope = JSON.parse(encryptedValue) as ClinicalCipherEnvelope
  if (envelope.version !== CRYPTO_CONSTANTS.envelopeVersion) {
    throw new Error(`Unsupported envelope version: ${envelope.version}`)
  }
  if (envelope.algorithm !== CRYPTO_CONSTANTS.algorithm) {
    throw new Error(`Unsupported algorithm: ${envelope.algorithm}`)
  }
  const nonce = base64ToBytes(envelope.nonce)
  const ciphertext = base64ToBytes(envelope.ciphertext)
  const plaintextBuf = await subtle.decrypt(
    { name: 'AES-GCM', iv: nonce.buffer as BufferSource, tagLength: 128 },
    key,
    ciphertext.buffer as BufferSource,
  )
  return new TextDecoder().decode(plaintextBuf)
}

// --- Encrypt / Decrypt with AAD ---

export async function encryptWithAAD(
  plaintext: string,
  key: CryptoKey,
  keyId: string,
  aad: Uint8Array,
): Promise<string> {
  const nonce = generateRandomBytes(CRYPTO_CONSTANTS.nonceByteCount)
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertextBuf = await subtle.encrypt(
    { name: 'AES-GCM', iv: nonce as BufferSource, additionalData: aad as BufferSource, tagLength: 128 },
    key,
    encoded as BufferSource,
  )
  const envelope: ClinicalCipherEnvelope = {
    version: CRYPTO_CONSTANTS.envelopeVersion,
    algorithm: CRYPTO_CONSTANTS.algorithm,
    key_id: keyId,
    nonce: bytesToBase64(new Uint8Array(nonce)),
    ciphertext: bytesToBase64(new Uint8Array(ciphertextBuf)),
  }
  return JSON.stringify(envelope)
}

export async function decryptWithAAD(
  encryptedValue: string,
  key: CryptoKey,
  aad: Uint8Array,
): Promise<string> {
  const envelope = JSON.parse(encryptedValue) as ClinicalCipherEnvelope
  if (envelope.version !== CRYPTO_CONSTANTS.envelopeVersion) {
    throw new Error(`Unsupported envelope version: ${envelope.version}`)
  }
  if (envelope.algorithm !== CRYPTO_CONSTANTS.algorithm) {
    throw new Error(`Unsupported algorithm: ${envelope.algorithm}`)
  }
  const nonce = base64ToBytes(envelope.nonce)
  const ciphertext = base64ToBytes(envelope.ciphertext)
  const plaintextBuf = await subtle.decrypt(
    { name: 'AES-GCM', iv: nonce.buffer as BufferSource, additionalData: aad as BufferSource, tagLength: 128 },
    key,
    ciphertext.buffer as BufferSource,
  )
  return new TextDecoder().decode(plaintextBuf)
}

// --- Patient key wrapping ---

export async function wrapPatientKey(
  patientKeyBytes: ArrayBuffer,
  unitKey: CryptoKey,
  unitKeyId: string,
  unitId: string,
  patientId: string,
  patientKeyId: string,
): Promise<ClinicalCipherEnvelope> {
  const nonce = generateRandomBytes(CRYPTO_CONSTANTS.nonceByteCount)
  const aad = patientKeyWrapAAD(unitId, patientId, patientKeyId, unitKeyId)
  const ciphertextBuf = await subtle.encrypt(
    { name: 'AES-GCM', iv: nonce as BufferSource, additionalData: aad as BufferSource, tagLength: 128 },
    unitKey,
    patientKeyBytes as BufferSource,
  )
  return {
    version: CRYPTO_CONSTANTS.envelopeVersion,
    algorithm: CRYPTO_CONSTANTS.algorithm,
    key_id: unitKeyId,
    nonce: bytesToBase64(new Uint8Array(nonce)),
    ciphertext: bytesToBase64(new Uint8Array(ciphertextBuf)),
  }
}

export async function unwrapPatientKey(
  envelope: ClinicalCipherEnvelope,
  unitKey: CryptoKey,
  unitId: string,
  patientId: string,
  patientKeyId: string,
  unitKeyId: string,
): Promise<ArrayBuffer> {
  if (envelope.key_id !== unitKeyId) {
    throw new Error('Patient key wrap envelope key_id mismatch')
  }
  const nonce = base64ToBytes(envelope.nonce)
  const ciphertext = base64ToBytes(envelope.ciphertext)
  const aad = patientKeyWrapAAD(unitId, patientId, patientKeyId, unitKeyId)
  const plaintextBuf = await subtle.decrypt(
    { name: 'AES-GCM', iv: nonce.buffer as BufferSource, additionalData: aad as BufferSource, tagLength: 128 },
    unitKey,
    ciphertext.buffer as BufferSource,
  )
  if (plaintextBuf.byteLength !== CRYPTO_CONSTANTS.keyByteCount) {
    throw new Error(`Unwrapped patient key has invalid size: ${plaintextBuf.byteLength}`)
  }
  return plaintextBuf
}

// --- Hospital number lookup hash ---

export async function hospitalNumberLookupHash(
  unitKey: CryptoKey,
  unitId: string,
  hospitalNumber: string,
): Promise<string> {
  const unitKeyRaw = await exportKeyRaw(unitKey)
  const ikm = unitKeyRaw.buffer as BufferSource
  const salt = new Uint8Array(32).buffer as BufferSource
  const info = new TextEncoder().encode('rounds:hospital-number-lookup:v1')
  const derivedKeyRaw = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: info as BufferSource },
    await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']),
    256,
  )
  const hmacKey = await subtle.importKey(
    'raw',
    derivedKeyRaw as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const canonical = `${unitId}:${hospitalNumber.trim().toUpperCase()}`
  const mac = await subtle.sign('HMAC', hmacKey, new TextEncoder().encode(canonical) as BufferSource)
  return bytesToHex(new Uint8Array(mac))
}

// --- IndexedDB key storage ---
// Keys are stored by their key ID, with a separate index mapping unit/patient
// to their active key ID. This mirrors the iOS Keychain approach.

const KEY_DB = 'rounds-web'
const KEY_STORE = 'clinical-keys'
const DB_VERSION = 2

const K_UNIT_KEY = 'unit-key:'
const K_ACTIVE_UNIT = 'active-unit:'
const K_PATIENT_KEY = 'patient-key:'
const K_ACTIVE_PATIENT = 'active-patient:'

function openKeyDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KEY_DB, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(KEY_STORE)) {
        db.createObjectStore(KEY_STORE)
      }
      if (db.objectStoreNames.contains('unit-keys')) {
        db.deleteObjectStore('unit-keys')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readwrite')
    tx.objectStore(KEY_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readonly')
    const req = tx.objectStore(KEY_STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readwrite')
    tx.objectStore(KEY_STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Unit key storage

export async function storeUnitKeyById(unitKeyId: string, key: CryptoKey): Promise<void> {
  const db = await openKeyDB()
  const raw = await exportKeyRaw(key)
  await idbPut(db, `${K_UNIT_KEY}${unitKeyId}`, raw.buffer)
}

export async function getUnitKeyById(unitKeyId: string): Promise<CryptoKey | null> {
  const db = await openKeyDB()
  const buf = await idbGet<ArrayBuffer>(db, `${K_UNIT_KEY}${unitKeyId}`)
  if (!buf) return null
  return importKeyFromBuffer(buf)
}

export async function setActiveUnitKeyId(unitId: string, unitKeyId: string): Promise<void> {
  const db = await openKeyDB()
  await idbPut(db, `${K_ACTIVE_UNIT}${unitId}`, unitKeyId)
}

export async function getActiveUnitKeyId(unitId: string): Promise<string | null> {
  const db = await openKeyDB()
  const id = await idbGet<string>(db, `${K_ACTIVE_UNIT}${unitId}`)
  return id ?? null
}

export async function getActiveUnitKey(unitId: string): Promise<{ keyId: string; key: CryptoKey } | null> {
  const keyId = await getActiveUnitKeyId(unitId)
  if (!keyId) return null
  const key = await getUnitKeyById(keyId)
  if (!key) return null
  return { keyId, key }
}

// Patient key storage

export async function storePatientKeyById(patientKeyId: string, keyBytes: ArrayBuffer): Promise<void> {
  const db = await openKeyDB()
  await idbPut(db, `${K_PATIENT_KEY}${patientKeyId}`, keyBytes)
}

export async function getPatientKeyById(patientKeyId: string): Promise<CryptoKey | null> {
  const db = await openKeyDB()
  const buf = await idbGet<ArrayBuffer>(db, `${K_PATIENT_KEY}${patientKeyId}`)
  if (!buf) return null
  return importKeyFromBuffer(buf)
}

export async function setActivePatientKeyId(patientId: string, patientKeyId: string): Promise<void> {
  const db = await openKeyDB()
  await idbPut(db, `${K_ACTIVE_PATIENT}${patientId}`, patientKeyId)
}

export async function getActivePatientKeyId(patientId: string): Promise<string | null> {
  const db = await openKeyDB()
  const id = await idbGet<string>(db, `${K_ACTIVE_PATIENT}${patientId}`)
  return id ?? null
}

export async function getActivePatientKey(patientId: string): Promise<{ keyId: string; key: CryptoKey } | null> {
  const keyId = await getActivePatientKeyId(patientId)
  if (!keyId) return null
  const key = await getPatientKeyById(keyId)
  if (!key) return null
  return { keyId, key }
}

// Legacy compat (used by older code paths)
export async function storeUnitKey(unitId: string, key: CryptoKey): Promise<void> {
  const raw = await exportKeyRaw(key)
  const keyId = crypto.randomUUID()
  await storeUnitKeyById(keyId, key)
  await setActiveUnitKeyId(unitId, keyId)
  void raw // suppress unused
}

export async function loadUnitKey(unitId: string): Promise<CryptoKey | null> {
  const active = await getActiveUnitKey(unitId)
  return active?.key ?? null
}

export async function removeUnitKey(unitId: string): Promise<void> {
  const keyId = await getActiveUnitKeyId(unitId)
  const db = await openKeyDB()
  if (keyId) await idbDelete(db, `${K_UNIT_KEY}${keyId}`)
  await idbDelete(db, `${K_ACTIVE_UNIT}${unitId}`)
}

// --- Device key pair (P-256 ECDH) ---
// Used for unit key unwrapping. The private key never leaves IndexedDB.
// The public key is registered in encryption_devices as X9.63 uncompressed.

const K_DEVICE_KEY = 'device-key:private'
const K_DEVICE_ID = 'device-key:id'

/**
 * Generates a P-256 ECDH key pair for device registration.
 * Private key is non-extractable (stays in Web Crypto key store).
 * Public key is exported as X9.63 uncompressed (0x04 || X[32] || Y[32]).
 */
export async function generateDeviceKeyPair(): Promise<{ privateKey: CryptoKey; publicKeyX963: Uint8Array }> {
  const keyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )
  const spki = await subtle.exportKey('spki', keyPair.publicKey)
  const spkiBytes = new Uint8Array(spki)
  // SPKI for P-256 ECDH has a 26-byte ASN.1 header before the 65-byte X9.63 point
  const x963 = spkiBytes.slice(26)
  if (x963.length !== 65 || x963[0] !== 0x04) {
    throw new Error(`Unexpected SPKI format: got ${x963.length} bytes after header`)
  }
  return { privateKey: keyPair.privateKey, publicKeyX963: x963 }
}

/**
 * Stores the device private key and device ID in IndexedDB.
 * The private key is exported as raw PKCS8 and stored as ArrayBuffer.
 */
export async function storeDeviceKeyPair(deviceId: string, privateKey: CryptoKey): Promise<void> {
  const db = await openKeyDB()
  const pkcs8 = await subtle.exportKey('pkcs8', privateKey)
  await idbPut(db, K_DEVICE_KEY, pkcs8)
  await idbPut(db, K_DEVICE_ID, deviceId)
}

/**
 * Loads the device private key from IndexedDB and reimports it as ECDH key.
 */
export async function loadDevicePrivateKey(): Promise<CryptoKey | null> {
  const db = await openKeyDB()
  const pkcs8 = await idbGet<ArrayBuffer>(db, K_DEVICE_KEY)
  if (!pkcs8) return null
  return subtle.importKey('pkcs8', pkcs8 as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
}

/**
 * Gets the stored device ID from IndexedDB.
 */
export async function getDeviceId(): Promise<string | null> {
  const db = await openKeyDB()
  const id = await idbGet<string>(db, K_DEVICE_ID)
  return id ?? null
}

/**
 * Clears all device keys and clinical keys from IndexedDB.
 * Called on sign out.
 */
export async function clearAllKeys(): Promise<void> {
  const db = await openKeyDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readwrite')
    tx.objectStore(KEY_STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// --- Unit key unwrapping (P256-HKDF-SHA256-A256GCM) ---
// Mirrors iOS UnitKeyWrapping and Android PortableUnitKeyWrapping.

export interface WrappedUnitKeyEnvelope {
  version: number
  algorithm: string
  unit_id: string
  unit_key_id: string
  recipient_device_id: string
  ephemeral_public_key_x963: string
  nonce: string
  wrapped_key: string
}

const UNIT_KEY_WRAP_INFO = 'rounds:unit-key-wrap:v1'
const UNIT_KEY_WRAP_AAD_PREFIX = 'rounds:keywrap:v1'

function unitKeyWrapAAD(unitId: string, keyId: string, recipientDeviceId: string): Uint8Array {
  return new TextEncoder().encode(`${UNIT_KEY_WRAP_AAD_PREFIX}|${unitId}|${keyId}|${recipientDeviceId}`)
}

/**
 * Imports an X9.63 uncompressed public key (0x04 || X[32] || Y[32]) as a Web Crypto ECDH public key.
 */
async function importPublicKeyX963(x963: Uint8Array): Promise<CryptoKey> {
  if (x963.length !== 65 || x963[0] !== 0x04) {
    throw new Error(`Invalid X9.63 public key: ${x963.length} bytes`)
  }
  // Reconstruct SPKI: 26-byte ASN.1 header + 65-byte X9.63 point
  const spkiHeader = new Uint8Array([
    0x30, 0x59, // SEQUENCE, 89 bytes
    0x30, 0x13, // SEQUENCE, 19 bytes (AlgorithmIdentifier)
    0x06, 0x07, // OID, 7 bytes
    0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // OID 1.2.840.10045.2.1 (EC)
    0x06, 0x08, // OID, 8 bytes
    0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID 1.2.840.10045.3.1.7 (P-256)
    0x03, 0x42, // BIT STRING, 66 bytes
    0x00,       // unused bits = 0
  ])
  const spki = new Uint8Array(spkiHeader.length + x963.length)
  spki.set(spkiHeader, 0)
  spki.set(x963, spkiHeader.length)
  return subtle.importKey('spki', spki.buffer as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
}

/**
 * Derives a 256-bit AES key from an ECDH shared secret via HKDF-SHA256.
 * Matches iOS/Android: salt = 32 zero bytes, info = "rounds:unit-key-wrap:v1"
 */
async function deriveWrappingKey(sharedSecret: ArrayBuffer): Promise<CryptoKey> {
  const salt = new Uint8Array(32).buffer as BufferSource
  const info = new TextEncoder().encode(UNIT_KEY_WRAP_INFO)
  const baseKey = await subtle.importKey('raw', sharedSecret as BufferSource, 'HKDF', false, ['deriveKey'])
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: info as BufferSource },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )
}

/**
 * Unwraps a unit key from a WrappedUnitKeyEnvelope using the device's ECDH private key.
 * Performs ECDH with the envelope's ephemeral public key, derives a wrapping key via
 * HKDF-SHA256, and decrypts the unit key via AES-GCM with AAD.
 */
export async function unwrapUnitKey(
  envelope: WrappedUnitKeyEnvelope,
  devicePrivateKey: CryptoKey,
  expectedUnitId: string,
  expectedUnitKeyId: string,
  expectedDeviceId: string,
): Promise<CryptoKey> {
  if (envelope.version !== 1) throw new Error(`Unsupported wrap version: ${envelope.version}`)
  if (envelope.algorithm !== 'P256-HKDF-SHA256-A256GCM') {
    throw new Error(`Unsupported wrap algorithm: ${envelope.algorithm}`)
  }
  if (envelope.unit_id !== expectedUnitId) throw new Error('Unit ID mismatch in wrap envelope')
  if (envelope.unit_key_id !== expectedUnitKeyId) throw new Error('Unit key ID mismatch in wrap envelope')
  if (envelope.recipient_device_id !== expectedDeviceId) throw new Error('Device ID mismatch in wrap envelope')

  const ephemeralPublicKey = await importPublicKeyX963(base64ToBytes(envelope.ephemeral_public_key_x963))
  const sharedSecret = await subtle.deriveBits(
    { name: 'ECDH', public: ephemeralPublicKey },
    devicePrivateKey,
    256,
  )
  const wrappingKey = await deriveWrappingKey(sharedSecret)
  const nonce = base64ToBytes(envelope.nonce)
  const ciphertext = base64ToBytes(envelope.wrapped_key)
  const aad = unitKeyWrapAAD(envelope.unit_id, envelope.unit_key_id, envelope.recipient_device_id)
  const unitKeyBytes = await subtle.decrypt(
    { name: 'AES-GCM', iv: nonce.buffer as BufferSource, additionalData: aad as BufferSource, tagLength: 128 },
    wrappingKey,
    ciphertext.buffer as BufferSource,
  )
  if (unitKeyBytes.byteLength !== CRYPTO_CONSTANTS.keyByteCount) {
    throw new Error(`Unwrapped unit key has invalid size: ${unitKeyBytes.byteLength}`)
  }
  return subtle.importKey('raw', unitKeyBytes as BufferSource, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
