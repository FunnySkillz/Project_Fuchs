import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

import TabsLayout from "@/app/(tabs)/_layout";

const mockPush = jest.fn();

jest.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({
    text: "#1B2330",
    background: "#F7F9FC",
    backgroundElement: "#EEF2F7",
    backgroundSelected: "#DFE6F0",
    textSecondary: "#66758A",
    border: "#C8D1DE",
    primary: "#4E7FCF",
    danger: "#C54444",
    textOnPrimary: "#F2F6FC",
  }),
}));

jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return {
    Download: (props: any) => <View {...props} />,
    LayoutDashboard: (props: any) => <View {...props} />,
    Plus: (props: any) => <View {...props} />,
    Receipt: (props: any) => <View {...props} />,
    Settings: (props: any) => <View {...props} />,
  };
});

jest.mock("expo-router", () => {
  const ReactModule = require("react");
  const { View } = require("react-native");
  const TabsComponent = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  const TabsWithScreen = Object.assign(TabsComponent, {
    Screen: ({ options }: { options?: { tabBarButton?: (props: unknown) => React.ReactNode } }) => {
      if (typeof options?.tabBarButton !== "function") {
        return null;
      }
      return <>{options.tabBarButton({})}</>;
    },
  });

  return {
    Tabs: TabsWithScreen,
    useRouter: () => ({ push: mockPush }),
  };
});

describe("TabsLayout", () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it("renders center add action and opens add-item flow", () => {
    render(<TabsLayout />);

    const addTabButton = screen.getByTestId("tab-add-center");
    fireEvent.press(addTabButton);

    expect(mockPush).toHaveBeenCalledWith("/item/new");
  });
});
