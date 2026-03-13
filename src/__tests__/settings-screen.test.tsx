import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

import SettingsRoute from "@/app/(tabs)/settings";
import SettingsAppearanceRoute from "@/app/(tabs)/settings/appearance";
import SettingsLegalRoute from "@/app/(tabs)/settings/legal";

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;

jest.mock("@gluestack-ui/themed", () => {
  const {
    Pressable: MockPressable,
    Text: MockText,
    TouchableOpacity: MockTouchableOpacity,
    View: MockView,
  } = require("react-native");

  const Block = ({ children, testID, ...props }: any) => (
    <MockView testID={testID} {...props}>
      {children}
    </MockView>
  );

  return {
    Box: Block,
    Button: ({ children, ...props }: any) => <MockTouchableOpacity {...props}>{children}</MockTouchableOpacity>,
    ButtonText: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Card: Block,
    Heading: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    HStack: Block,
    Pressable: ({ children, ...props }: any) => <MockPressable {...props}>{children}</MockPressable>,
    Text: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    VStack: Block,
  };
});

jest.mock("@/contexts/theme-mode-context", () => ({
  useThemeMode: () => ({
    mode: "system",
    resolvedMode: "light",
    setMode: jest.fn(),
  }),
}));

jest.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({
    text: "#111827",
    textSecondary: "#6B7280",
    textMuted: "#4B5563",
    background: "#FFFFFF",
    backgroundElement: "#F3F4F6",
    backgroundSelected: "#E5E7EB",
    border: "#D1D5DB",
    primary: "#2563EB",
    danger: "#DC2626",
    success: "#059669",
    textOnPrimary: "#FFFFFF",
  }),
}));

jest.mock("expo-router", () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactModule = require("react");
    ReactModule.useEffect(() => callback(), [callback]);
  },
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    canGoBack: () => mockCanGoBack,
  }),
}));

describe("Settings navigation workflow", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockReplace.mockReset();
    mockCanGoBack = true;
  });

  it("routes from Settings main to Appearance and provides no-history fallback back to Settings", async () => {
    render(<SettingsRoute />);

    expect(await screen.findByText("Settings")).toBeTruthy();
    fireEvent.press(screen.getByTestId("settings-nav-appearance"));
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/settings/appearance");

    mockCanGoBack = false;
    render(<SettingsAppearanceRoute />);
    expect(screen.getByTestId("settings-back-to-main-fallback")).toBeTruthy();

    fireEvent.press(screen.getByTestId("settings-back-to-main-fallback"));
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/settings");
  });

  it("prevents duplicate pushes when tapping a settings entry rapidly", async () => {
    render(<SettingsRoute />);

    expect(await screen.findByText("Settings")).toBeTruthy();
    const appearanceEntry = screen.getByTestId("settings-nav-appearance");

    fireEvent.press(appearanceEntry);
    fireEvent.press(appearanceEntry);

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/settings/appearance");
  });

  it("renders legal disclaimer/privacy section and supports fallback navigation", async () => {
    mockCanGoBack = false;
    render(<SettingsLegalRoute />);

    expect(await screen.findByText("Legal & Privacy")).toBeTruthy();
    expect(screen.getByTestId("settings-legal-disclaimer")).toBeTruthy();
    expect(screen.getByTestId("settings-legal-privacy")).toBeTruthy();

    fireEvent.press(screen.getByTestId("settings-back-to-main-fallback"));
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/settings");
  });
});
