import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

jest.mock("@/constants/theme", () => ({
  Spacing: {
    two: 8,
    three: 12,
    four: 16,
  },
}));

jest.mock("@/components/themed-text", () => ({
  ThemedText: ({ children }: { children: React.ReactNode }) => {
    const { Text: MockText } = require("react-native");
    return <MockText>{children}</MockText>;
  },
}));

jest.mock("@/components/themed-view", () => ({
  ThemedView: ({ children }: { children: React.ReactNode }) => {
    const { View: MockView } = require("react-native");
    return <MockView>{children}</MockView>;
  },
}));

jest.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({
    border: "#ccc",
    backgroundElement: "#fff",
    danger: "#f00",
    backgroundSelected: "#eee",
  }),
}));

const { InitErrorScreen } = require("@/components/init-error-screen");

describe("InitErrorScreen", () => {
  it("triggers retry action", () => {
    const onRetry = jest.fn();

    render(
      <InitErrorScreen
        message="Database failed."
        onRetry={onRetry}
        onExportDebugInfo={jest.fn()}
        onResetData={jest.fn()}
      />
    );

    fireEvent.press(screen.getByTestId("init-error-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("requires confirmation before resetting local data", async () => {
    const onResetData = jest.fn().mockResolvedValue(undefined);

    render(
      <InitErrorScreen
        message="Database failed."
        onRetry={jest.fn()}
        onExportDebugInfo={jest.fn()}
        onResetData={onResetData}
      />
    );

    fireEvent.press(screen.getByTestId("init-error-reset-open-confirm"));
    expect(screen.getByText("This will delete all local data on this device. Continue?")).toBeTruthy();

    fireEvent.press(screen.getByTestId("init-error-reset-cancel"));
    expect(onResetData).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId("init-error-reset-open-confirm"));
    fireEvent.press(screen.getByTestId("init-error-reset-confirm"));

    await waitFor(() => {
      expect(onResetData).toHaveBeenCalledTimes(1);
    });
  });

  it("exports debug info and shows success feedback", async () => {
    const onExportDebugInfo = jest.fn().mockResolvedValue(undefined);

    render(
      <InitErrorScreen
        message="Database failed."
        onRetry={jest.fn()}
        onExportDebugInfo={onExportDebugInfo}
        onResetData={jest.fn()}
      />
    );

    fireEvent.press(screen.getByTestId("init-error-export-debug"));

    await waitFor(() => {
      expect(onExportDebugInfo).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Debug report created.")).toBeTruthy();
    });
  });
});
