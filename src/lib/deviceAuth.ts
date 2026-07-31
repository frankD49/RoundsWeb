/**
 * Device authorization flow for the web client.
 *
 * 1. On sign-in, the web client generates a P-256 ECDH key pair and registers
 *    itself in encryption_devices with platform="WEB".
 * 2. The user approves the web session from their mobile device (which wraps
 *    the unit key to the web client's public key via authorize_unit_device RPC).
 * 3. The web client polls wrapped_unit_keys for its device ID, unwraps the
 *    unit key using ECDH + HKDF + AES-GCM, and stores it in IndexedDB.
 */

import { supabase } from './supabase'
import {
  generateDeviceKeyPair,
  storeDeviceKeyPair,
  loadDevicePrivateKey,
  getDeviceId,
  unwrapUnitKey,
  storeUnitKeyById,
  setActiveUnitKeyId,
  getActiveUnitKey,
  clearAllKeys,
  type WrappedUnitKeyEnvelope,
} from './crypto'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return session.access_token
}

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// --- Types ---

export interface EncryptionDeviceRow {
  id: string
  user_id: string
  platform: string
  display_name: string
  public_key_x963: string
  status: string
}

export interface UnitKeyVersionRow {
  id: string
  unit_id: string
  version: number
  status: string
  created_by: string
}

export interface WrappedUnitKeyRow {
  id: string
  unit_id: string
  unit_key_id: string
  recipient_device_id: string
  ephemeral_public_key_x963: string
  nonce: string
  wrapped_key: string
  created_by: string
}

export type DeviceAuthState = 'ready' | 'awaiting-authorization' | 'no-unit-key'

export interface DeviceAuthResult {
  state: DeviceAuthState
  deviceId: string
  unitKeyId?: string
  message?: string
}

// --- REST helpers ---

async function restGet<T>(path: string, query: Record<string, string>): Promise<T> {
  const token = await getAccessToken()
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`)
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`REST GET ${path} failed: ${res.status}`)
  const text = await res.text()
  if (!text) return [] as unknown as T
  return JSON.parse(text) as T
}

async function restPost(path: string, body: unknown, prefer?: string, query?: Record<string, string>): Promise<void> {
  const token = await getAccessToken()
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`)
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  const headers: Record<string, string> = {
    apikey: PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
  if (prefer) headers['Prefer'] = prefer
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`REST POST ${path} failed: ${res.status}: ${text}`)
  }
}

// --- Device registration ---

/**
 * Registers the web browser as an encryption device.
 * Generates a P-256 key pair (or reuses an existing one), upserts the device
 * row in encryption_devices, and stores the private key + device ID in IndexedDB.
 */
export async function registerWebDevice(): Promise<{ deviceId: string; publicKeyX963: string }> {
  const userId = await getUserId()

  // Check if we already have a device key pair stored
  let privateKey = await loadDevicePrivateKey()
  let deviceId = await getDeviceId()

  if (!privateKey || !deviceId) {
    // Generate new key pair
    const { privateKey: newPrivateKey, publicKeyX963 } = await generateDeviceKeyPair()
    deviceId = crypto.randomUUID()
    await storeDeviceKeyPair(deviceId, newPrivateKey)
    privateKey = newPrivateKey

    // Register in encryption_devices
    await restPost('encryption_devices', [{
      id: deviceId,
      user_id: userId,
      platform: 'WEB',
      display_name: getBrowserDisplayName(),
      public_key_x963: bytesToBase64Url(publicKeyX963),
      public_key_algorithm: 'P256',
      status: 'ACTIVE',
    }], 'resolution=merge-duplicates,return=minimal', { on_conflict: 'id' })

    return { deviceId, publicKeyX963: bytesToBase64Url(publicKeyX963) }
  }

  // Device already registered — look up the existing device row from server
  try {
    const rows = await restGet<EncryptionDeviceRow[]>('encryption_devices', {
      id: `eq.${deviceId}`,
      select: 'id,public_key_x963',
      limit: '1',
    })
    if (rows && rows.length > 0) {
      return { deviceId, publicKeyX963: rows[0].public_key_x963 }
    }
  } catch {
    // fall through to re-registration
  }

  // Device ID not found on server — generate new key pair and register
  const { privateKey: freshPrivateKey, publicKeyX963: freshPubKey } = await generateDeviceKeyPair()
  deviceId = crypto.randomUUID()
  await storeDeviceKeyPair(deviceId, freshPrivateKey)
  privateKey = freshPrivateKey

  await restPost('encryption_devices', [{
    id: deviceId,
    user_id: userId,
    platform: 'WEB',
    display_name: getBrowserDisplayName(),
    public_key_x963: bytesToBase64Url(freshPubKey),
    public_key_algorithm: 'P256',
    status: 'ACTIVE',
  }], 'resolution=merge-duplicates,return=minimal', { on_conflict: 'id' })

  return { deviceId, publicKeyX963: bytesToBase64Url(freshPubKey) }
}

function getBrowserDisplayName(): string {
  const ua = navigator.userAgent
  let browser = 'Web Browser'
  if (ua.includes('Chrome')) browser = 'Chrome'
  else if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Safari')) browser = 'Safari'
  else if (ua.includes('Edge')) browser = 'Edge'

  let os = 'Unknown OS'
  if (ua.includes('Mac')) os = 'macOS'
  else if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Linux')) os = 'Linux'
  else if (ua.includes('Android')) os = 'Android'
  else if (/iPhone|iPad/.test(ua)) os = 'iOS'

  return `${browser} on ${os}`
}

// --- Unit key sync ---

/**
 * Fetches the active unit key version for a unit.
 */
async function fetchActiveUnitKeyVersion(unitId: string): Promise<UnitKeyVersionRow | null> {
  const rows = await restGet<UnitKeyVersionRow[]>('unit_key_versions', {
    unit_id: `eq.${unitId}`,
    status: 'eq.ACTIVE',
    select: 'id,unit_id,version,status,created_by',
    limit: '1',
  })
  return rows && rows.length > 0 ? rows[0] : null
}

/**
 * Fetches the wrapped unit key for a specific device and unit key version.
 */
async function fetchWrappedUnitKey(unitKeyId: string, deviceId: string): Promise<WrappedUnitKeyRow | null> {
  const rows = await restGet<WrappedUnitKeyRow[]>('wrapped_unit_keys', {
    unit_key_id: `eq.${unitKeyId}`,
    recipient_device_id: `eq.${deviceId}`,
    revoked_at: 'is.null',
    select: 'id,unit_id,unit_key_id,recipient_device_id,ephemeral_public_key_x963,nonce,wrapped_key,created_by',
    limit: '1',
  })
  return rows && rows.length > 0 ? rows[0] : null
}

/**
 * Attempts to establish encryption readiness for a unit.
 * - If we already have the unit key locally, returns 'ready'.
 * - If there's an active unit key on the server and a wrapped key for this device,
 *   unwraps it and stores it locally, then returns 'ready'.
 * - If there's an active unit key but no wrapped key for this device,
 *   returns 'awaiting-authorization'.
 * - If there's no active unit key at all, returns 'no-unit-key'.
 */
export async function establishEncryptionReadiness(unitId: string): Promise<DeviceAuthResult> {
  const deviceId = await getDeviceId()
  if (!deviceId) throw new Error('Device not registered. Call registerWebDevice() first.')

  // Check if we already have the unit key locally
  const existing = await getActiveUnitKey(unitId)
  if (existing) {
  return { state: 'ready', deviceId, unitKeyId: existing.keyId }
  }

  // Fetch active unit key version from server
  const activeVersion = await fetchActiveUnitKeyVersion(unitId)
  if (!activeVersion) {
    return {
      state: 'no-unit-key',
      deviceId,
      message: 'No active encryption key for this unit. A unit owner must create one from the mobile app.',
    }
  }

  // Check if there's a wrapped key for this device
  const wrapped = await fetchWrappedUnitKey(activeVersion.id, deviceId)
  if (!wrapped) {
    return {
      state: 'awaiting-authorization',
      deviceId,
      unitKeyId: activeVersion.id,
      message: 'Approve this web session from your mobile device to grant encryption access.',
    }
  }

  // Unwrap the unit key
  const privateKey = await loadDevicePrivateKey()
  if (!privateKey) throw new Error('Device private key not found. Re-registration required.')

  const envelope: WrappedUnitKeyEnvelope = {
    version: 1,
    algorithm: 'P256-HKDF-SHA256-A256GCM',
    unit_id: wrapped.unit_id,
    unit_key_id: wrapped.unit_key_id,
    recipient_device_id: wrapped.recipient_device_id,
    ephemeral_public_key_x963: wrapped.ephemeral_public_key_x963,
    nonce: wrapped.nonce,
    wrapped_key: wrapped.wrapped_key,
  }

  const unitKey = await unwrapUnitKey(envelope, privateKey, unitId, activeVersion.id, deviceId)
  await storeUnitKeyById(activeVersion.id, unitKey)
  await setActiveUnitKeyId(unitId, activeVersion.id)

  return { state: 'ready', deviceId, unitKeyId: activeVersion.id }
}

/**
 * Polls for encryption readiness. Used by the DeviceAuthorizationScreen
 * while the user approves from their mobile device.
 */
export async function pollEncryptionReadiness(unitId: string, intervalMs = 3000, maxAttempts = 60): Promise<DeviceAuthResult> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await establishEncryptionReadiness(unitId)
    if (result.state === 'ready') return result
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  // Return last state after timeout
  return establishEncryptionReadiness(unitId)
}

// --- Sign out cleanup ---

/**
 * Clears all locally stored keys. Called on sign out.
 */
export async function clearDeviceKeys(): Promise<void> {
  await clearAllKeys()
}
