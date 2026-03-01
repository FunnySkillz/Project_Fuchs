const FIXED_TEST_DATE = new Date("2026-01-15T10:30:00.000Z");
const mockRandomUUID = jest.fn();

jest.mock("expo-crypto", () => ({
  __esModule: true,
  randomUUID: mockRandomUUID,
  default: {
    randomUUID: mockRandomUUID,
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: { children: any }) => children,
  SafeAreaView: ({ children }: { children: any }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("@react-navigation/bottom-tabs", () => ({
  useBottomTabBarHeight: () => 64,
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
