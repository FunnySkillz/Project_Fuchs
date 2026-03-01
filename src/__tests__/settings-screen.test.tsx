import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

import SettingsRoute from "@/app/(tabs)/settings";

const mockPush = jest.fn();

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
    Card: Block,
    Heading: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    Pressable: ({ children, ...props }: any) => <MockPressable {...props}>{children}</MockPressable>,
    Text: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    VStack: Block,
    Button: ({ children, ...props }: any) => <MockTouchableOpacity {...props}>{children}</MockTouchableOpacity>,
    ButtonText: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
  };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("SettingsRoute", () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it("renders section entries and navigates to dedicated settings sub-screens", async () => {
    render(<SettingsRoute />);

    expect(await screen.findByText("Settings")).toBeTruthy();
    expect(screen.getByText("Appearance")).toBeTruthy();
    expect(screen.getByText("Tax & Calculation")).toBeTruthy();
    expect(screen.getByText("Security")).toBeTruthy();
    expect(screen.getByText("Backup & Sync")).toBeTruthy();
    expect(screen.getByText("Danger Zone")).toBeTruthy();

    fireEvent.press(screen.getByTestId("settings-nav-appearance"));
    expect(mockPush).toHaveBeenCalledWith("/settings-appearance");

    fireEvent.press(screen.getByTestId("settings-nav-tax"));
    expect(mockPush).toHaveBeenCalledWith("/settings-tax-calculation");

    fireEvent.press(screen.getByTestId("settings-nav-security"));
    expect(mockPush).toHaveBeenCalledWith("/settings-security");

    fireEvent.press(screen.getByTestId("settings-nav-backup-sync"));
    expect(mockPush).toHaveBeenCalledWith("/settings-backup-sync");

    fireEvent.press(screen.getByTestId("settings-nav-danger-zone"));
    expect(mockPush).toHaveBeenCalledWith("/settings-danger-zone");
  });
});
