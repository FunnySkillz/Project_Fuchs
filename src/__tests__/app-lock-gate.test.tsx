import React from "react";
import { render, screen } from "@testing-library/react-native";

jest.mock("@/global.css", () => ({}));

import { AppLockGate } from "@/components/app-lock-gate";

const mockTheme = {
  text: "theme-text",
  background: "theme-background",
  backgroundElement: "theme-background-element",
  backgroundSelected: "theme-background-selected",
  textSecondary: "theme-text-secondary",
  textMuted: "theme-text-muted",
  border: "theme-border",
  primary: "theme-primary",
  danger: "theme-danger",
  success: "theme-success",
  textOnPrimary: "theme-text-on-primary",
};

jest.mock("@/hooks/use-theme", () => ({
  useTheme: () => mockTheme,
}));

jest.mock("@/components/themed-text", () => {
  const { Text } = require("react-native");
  return {
    ThemedText: ({ children, ...props }: any) => <Text {...props}>{children}</Text>,
  };
});

jest.mock("@/components/themed-view", () => {
  const { View } = require("react-native");
  return {
    ThemedView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock("@gluestack-ui/themed", () => {
  const { Pressable, Text } = require("react-native");
  return {
    Button: ({ children, onPress, testID, isDisabled, style, ...props }: any) => (
      <Pressable testID={testID} onPress={onPress} disabled={isDisabled} style={style} {...props}>
        {children}
      </Pressable>
    ),
    ButtonText: ({ children, ...props }: any) => <Text {...props}>{children}</Text>,
  };
});

describe("AppLockGate", () => {
  it("shows primary, secondary, and tertiary actions and removes Retry Authentication", () => {
    render(
      <AppLockGate
        isAuthenticating={false}
        errorMessage={null}
        pinEnabled
        pinValue=""
        onPinValueChange={jest.fn()}
        onPinSubmit={jest.fn()}
        onUseBiometric={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByText("Unlock")).toBeTruthy();
    expect(screen.getByTestId("app-lock-unlock")).toBeTruthy();
    expect(screen.getByTestId("app-lock-use-face-id")).toBeTruthy();
    expect(screen.getByTestId("app-lock-cancel")).toBeTruthy();
    expect(screen.queryByText("Retry Authentication")).toBeNull();
  });

  it("renders auth error text below the PIN input", () => {
    const tree = render(
      <AppLockGate
        isAuthenticating={false}
        errorMessage="Authentication canceled. Use Face ID again or enter your PIN."
        pinEnabled
        pinValue="1234"
        onPinValueChange={jest.fn()}
        onPinSubmit={jest.fn()}
        onUseBiometric={jest.fn()}
        onCancel={jest.fn()}
      />
    ).toJSON();
    const snapshot = JSON.stringify(tree);
    const pinIndex = snapshot.indexOf('"testID":"app-lock-pin-input"');
    const errorIndex = snapshot.indexOf('"testID":"app-lock-error"');

    expect(screen.getByTestId("app-lock-error")).toBeTruthy();
    expect(pinIndex).toBeGreaterThanOrEqual(0);
    expect(errorIndex).toBeGreaterThan(pinIndex);
  });
});
