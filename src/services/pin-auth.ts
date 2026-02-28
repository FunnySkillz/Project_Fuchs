import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const PIN_RECORD_KEY = "app_lock_pin_v1";
const LOCKOUT_AFTER_FAILURES = 5;
const LOCKOUT_DURATION_MS = 30_000;

interface PinRecord {
  saltHex: string;
  hashHex: string;
  failedAttempts: number;
  lockUntilEpochMs: number | null;
}

function canUseLocalStorage(): boolean {
  return typeof globalThis !== "undefined" && "localStorage" in globalThis;
}

async function getSecureValue(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    if (canUseLocalStorage()) {
      return globalThis.localStorage.getItem(key);
    }
    return null;
  }
}

async function setSecureValue(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
    return;
  } catch {
    if (canUseLocalStorage()) {
      globalThis.localStorage.setItem(key, value);
    }
  }
}

async function deleteSecureValue(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
    return;
  } catch {
    if (canUseLocalStorage()) {
      globalThis.localStorage.removeItem(key);
    }
  }
}

export interface PinVerifyResult {
  success: boolean;
  lockedUntilEpochMs: number | null;
  remainingAttempts: number;
}

export function isValidPin(pin: string): boolean {
  return /^[0-9]{4,6}$/.test(pin);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function computeSaltedHash(pin: string, saltHex: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${saltHex}:${pin}`
  );
}

async function readRecord(): Promise<PinRecord | null> {
  const raw = await getSecureValue(PIN_RECORD_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PinRecord>;
    if (
      typeof parsed.saltHex !== "string" ||
      typeof parsed.hashHex !== "string" ||
      typeof parsed.failedAttempts !== "number"
    ) {
      return null;
    }

    return {
      saltHex: parsed.saltHex,
      hashHex: parsed.hashHex,
      failedAttempts: parsed.failedAttempts,
      lockUntilEpochMs:
        typeof parsed.lockUntilEpochMs === "number" ? parsed.lockUntilEpochMs : null,
    };
  } catch {
    return null;
  }
}

async function writeRecord(record: PinRecord): Promise<void> {
  await setSecureValue(PIN_RECORD_KEY, JSON.stringify(record));
}

export async function hasPinAsync(): Promise<boolean> {
  const record = await readRecord();
  return record !== null;
}

export async function clearPinAsync(): Promise<void> {
  await deleteSecureValue(PIN_RECORD_KEY);
}

export async function setPinAsync(pin: string): Promise<void> {
  if (!isValidPin(pin)) {
    throw new Error("PIN must be 4 to 6 digits.");
  }

  const saltHex = bytesToHex(Crypto.getRandomBytes(16));
  const hashHex = await computeSaltedHash(pin, saltHex);
  await writeRecord({
    saltHex,
    hashHex,
    failedAttempts: 0,
    lockUntilEpochMs: null,
  });
}

export async function verifyPinAsync(pin: string): Promise<PinVerifyResult> {
  const record = await readRecord();
  if (!record) {
    return {
      success: false,
      lockedUntilEpochMs: null,
      remainingAttempts: 0,
    };
  }

  const now = Date.now();
  if (record.lockUntilEpochMs !== null && record.lockUntilEpochMs > now) {
    return {
      success: false,
      lockedUntilEpochMs: record.lockUntilEpochMs,
      remainingAttempts: 0,
    };
  }

  const computedHashHex = await computeSaltedHash(pin, record.saltHex);
  if (computedHashHex === record.hashHex) {
    await writeRecord({
      ...record,
      failedAttempts: 0,
      lockUntilEpochMs: null,
    });
    return {
      success: true,
      lockedUntilEpochMs: null,
      remainingAttempts: LOCKOUT_AFTER_FAILURES,
    };
  }

  const failures = record.failedAttempts + 1;
  const lockedUntilEpochMs =
    failures >= LOCKOUT_AFTER_FAILURES ? now + LOCKOUT_DURATION_MS : null;
  await writeRecord({
    ...record,
    failedAttempts: lockedUntilEpochMs ? 0 : failures,
    lockUntilEpochMs: lockedUntilEpochMs,
  });

  return {
    success: false,
    lockedUntilEpochMs,
    remainingAttempts: lockedUntilEpochMs
      ? 0
      : Math.max(0, LOCKOUT_AFTER_FAILURES - failures),
  };
}
