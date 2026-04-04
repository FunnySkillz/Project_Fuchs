import { clearPinAsync, hasPinAsync, isValidPin, setPinAsync, verifyPinAsync } from "@/services/pin-auth";

const mockSecureStore = new Map<string, string>();
const mockGetItemAsync = jest.fn();
const mockSetItemAsync = jest.fn();
const mockDeleteItemAsync = jest.fn();
const mockDigestStringAsync = jest.fn();
const mockGetRandomBytes = jest.fn();

jest.mock("expo-secure-store", () => ({
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...args),
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
  deleteItemAsync: (...args: unknown[]) => mockDeleteItemAsync(...args),
}));

jest.mock("expo-crypto", () => ({
  __esModule: true,
  CryptoDigestAlgorithm: {
    SHA256: "SHA256",
  },
  getRandomBytes: (...args: unknown[]) => mockGetRandomBytes(...args),
  digestStringAsync: (...args: unknown[]) => mockDigestStringAsync(...args),
}));

describe("pin-auth service", () => {
  beforeEach(async () => {
    mockSecureStore.clear();
    mockGetItemAsync.mockImplementation(async (key: string) => mockSecureStore.get(key) ?? null);
    mockSetItemAsync.mockImplementation(async (key: string, value: string) => {
      mockSecureStore.set(key, value);
    });
    mockDeleteItemAsync.mockImplementation(async (key: string) => {
      mockSecureStore.delete(key);
    });
    mockGetRandomBytes.mockImplementation((size: number) =>
      Uint8Array.from({ length: size }, (_, index) => index + 1)
    );
    mockDigestStringAsync.mockImplementation(async (_algorithm: string, input: string) => `hash:${input}`);
    await clearPinAsync();
  });

  it("validates expected PIN format", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("123456")).toBe(true);
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("1234567")).toBe(false);
    expect(isValidPin("12ab")).toBe(false);
  });

  it("stores and verifies PIN successfully", async () => {
    await setPinAsync("1234");

    expect(await hasPinAsync()).toBe(true);

    const verifyOk = await verifyPinAsync("1234");
    expect(verifyOk.success).toBe(true);
    expect(verifyOk.lockedUntilEpochMs).toBeNull();
    expect(verifyOk.remainingAttempts).toBe(5);
  });

  it("locks temporary access after 5 failed attempts", async () => {
    await setPinAsync("1234");

    const now = Date.now();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = await verifyPinAsync("0000");
      expect(result.success).toBe(false);
      expect(result.lockedUntilEpochMs).toBeNull();
    }

    const lockResult = await verifyPinAsync("0000");
    expect(lockResult.success).toBe(false);
    expect(lockResult.lockedUntilEpochMs).toBe(now + 30_000);
    expect(lockResult.remainingAttempts).toBe(0);

    const lockedCheck = await verifyPinAsync("1234");
    expect(lockedCheck.success).toBe(false);
    expect(lockedCheck.lockedUntilEpochMs).toBe(now + 30_000);
    expect(lockedCheck.remainingAttempts).toBe(0);

    jest.setSystemTime(new Date(now + 30_001));
    const afterLockWindow = await verifyPinAsync("1234");
    expect(afterLockWindow.success).toBe(true);
    expect(afterLockWindow.lockedUntilEpochMs).toBeNull();
  });

  it("clears stored PIN", async () => {
    await setPinAsync("1234");
    expect(await hasPinAsync()).toBe(true);

    await clearPinAsync();
    expect(await hasPinAsync()).toBe(false);
  });
});
