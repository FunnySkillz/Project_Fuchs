import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import SettingsAppearanceRoute from "@/app/(tabs)/settings/appearance";
import { ThemeModeContext } from "@/contexts/theme-mode-context";
import type { ThemeMode, ThemeModeResolved } from "@/theme/theme-mode";

const mockReplace = jest.fn();

jest.mock("@gluestack-ui/themed", () => {
  const {
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
    Text: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    VStack: Block,
  };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
    canGoBack: () => true,
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

function renderAppearance(
  initialMode: ThemeMode,
  systemMode: ThemeModeResolved
) {
  function Harness() {
    const [mode, setMode] = React.useState<ThemeMode>(initialMode);
    const resolvedMode = mode === "system" ? systemMode : mode;

    return (
      <ThemeModeContext.Provider value={{ mode, resolvedMode, setMode }}>
        <SettingsAppearanceRoute />
      </ThemeModeContext.Provider>
    );
  }

  return render(<Harness />);
}

function expectSelected(testId: string, expected: boolean) {
  expect(screen.getByTestId(testId).props.accessibilityState).toEqual({ selected: expected });
}

describe("SettingsAppearanceRoute selection state", () => {
  beforeEach(() => {
    mockReplace.mockReset();
  });

  it("highlights only dark when switching from light to dark", async () => {
    renderAppearance("light", "dark");

    expectSelected("settings-theme-light", true);
    expectSelected("settings-theme-system", false);
    expectSelected("settings-theme-dark", false);

    fireEvent.press(screen.getByTestId("settings-theme-dark"));

    await waitFor(() => {
      expectSelected("settings-theme-light", false);
      expectSelected("settings-theme-system", false);
      expectSelected("settings-theme-dark", true);
    });
  });

  it("highlights only system when switching from light to system in dark system mode", async () => {
    renderAppearance("light", "dark");

    fireEvent.press(screen.getByTestId("settings-theme-system"));

    await waitFor(() => {
      expectSelected("settings-theme-light", false);
      expectSelected("settings-theme-system", true);
      expectSelected("settings-theme-dark", false);
      expect(screen.getByText("Resolved mode now: dark")).toBeTruthy();
    });
  });
});
