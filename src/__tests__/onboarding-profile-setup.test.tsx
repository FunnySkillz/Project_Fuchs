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
});
