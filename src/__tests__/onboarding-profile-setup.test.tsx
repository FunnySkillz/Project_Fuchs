import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import OnboardingProfileSetupRoute from "@/app/(onboarding)/profile-setup";

const mockRouterReplace = jest.fn();
const mockUpsertSettings = jest.fn();
const mockEmitProfileSettingsSaved = jest.fn();

jest.mock("@gluestack-ui/themed", () => {
  const {
    Text: MockText,
    TextInput: MockTextInput,
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
    Input: Block,
    InputField: (props: any) => <MockTextInput {...props} />,
    Text: ({ children, ...props }: any) => <MockText {...props}>{children}</MockText>,
    VStack: Block,
  };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
  }),
}));

jest.mock("@/repositories/create-profile-settings-repository", () => ({
  getProfileSettingsRepository: async () => ({
    upsertSettings: (...args: unknown[]) => mockUpsertSettings(...args),
  }),
}));

jest.mock("@/services/app-events", () => ({
  emitProfileSettingsSaved: () => mockEmitProfileSettingsSaved(),
}));

describe("OnboardingProfileSetupRoute", () => {
  beforeEach(() => {
    mockRouterReplace.mockReset();
    mockUpsertSettings.mockReset();
    mockEmitProfileSettingsSaved.mockReset();
  });

  it("shows save error and allows retry until persistence succeeds", async () => {
    mockUpsertSettings
      .mockRejectedValueOnce(new Error("Disk write failed"))
      .mockResolvedValueOnce(undefined);

    render(<OnboardingProfileSetupRoute />);
    expect(await screen.findByText("Profile Setup")).toBeTruthy();

    fireEvent.press(screen.getByTestId("onboarding-profile-save"));

    expect(await screen.findByText("Could not save profile settings. Please retry.")).toBeTruthy();
    expect(mockRouterReplace).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Retry Save"));

    await waitFor(() => {
      expect(mockUpsertSettings).toHaveBeenCalledTimes(2);
      expect(mockEmitProfileSettingsSaved).toHaveBeenCalledTimes(1);
      expect(mockRouterReplace).toHaveBeenCalledWith("/(tabs)/home");
    });
  });

  it("shows field error only after submit attempt and disables submit until fixed", async () => {
    mockUpsertSettings.mockResolvedValue(undefined);

    render(<OnboardingProfileSetupRoute />);
    expect(await screen.findByText("Profile Setup")).toBeTruthy();
    expect(screen.queryByTestId("onboarding-profile-error-marginalRatePercent")).toBeNull();

    fireEvent.changeText(screen.getByTestId("onboarding-profile-rate-input"), "");
    fireEvent.press(screen.getByTestId("onboarding-profile-save"));

    await waitFor(() => {
      expect(screen.getByTestId("onboarding-profile-error-marginalRatePercent")).toBeTruthy();
      expect(screen.getByTestId("onboarding-profile-save").props.accessibilityState?.disabled).toBe(true);
    });
    expect(mockUpsertSettings).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId("onboarding-profile-rate-input"), "40");
    await waitFor(() => {
      expect(screen.queryByTestId("onboarding-profile-error-marginalRatePercent")).toBeNull();
      expect(screen.getByTestId("onboarding-profile-save").props.accessibilityState?.disabled).not.toBe(true);
    });
  });
});
