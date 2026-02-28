const FIXED_TEST_DATE = new Date("2026-01-15T10:30:00.000Z");
const mockRandomUUID = jest.fn();

jest.mock("expo-crypto", () => ({
  __esModule: true,
  randomUUID: mockRandomUUID,
  default: {
    randomUUID: mockRandomUUID,
  },
}));

beforeEach(() => {
  mockRandomUUID.mockReturnValue("00000000-0000-4000-8000-000000000000");
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_TEST_DATE);
});

afterEach(() => {
  jest.useRealTimers();
});

beforeAll(() => {
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});
