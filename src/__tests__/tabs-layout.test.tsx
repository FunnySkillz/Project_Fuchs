import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

import TabsLayout from "@/app/(tabs)/_layout";

const mockPush = jest.fn();
let mockTabsScreenOptions: Record<string, unknown> | undefined;

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
  const { Pressable, View } = require("react-native");
  const TabsComponent = ({
    children,
    screenOptions,
  }: {
    children: React.ReactNode;
    screenOptions?: Record<string, unknown>;
  }) => {
    mockTabsScreenOptions = screenOptions;
    return <View>{children}</View>;
  };
  const TabsWithScreen = Object.assign(TabsComponent, {
    Screen: ({
      name,
      options,
      listeners,
    }: {
      name: string;
      options?: { tabBarButtonTestID?: string };
      listeners?: { tabPress?: (event: { preventDefault: () => void }) => void };
    }) => {
      if (name !== "add") {
        return null;
      }
      return (
        <Pressable
          testID={options?.tabBarButtonTestID ?? "tab-add"}
          onPress={() => listeners?.tabPress?.({ preventDefault: jest.fn() })}
        />
      );
    },
  });

  return {
    Tabs: TabsWithScreen,
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactModule.useEffect(() => callback(), [callback]);
    },
  };
});

describe("TabsLayout", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockTabsScreenOptions = undefined;
  });

  it("opens add-item flow when add tab is pressed", () => {
    render(<TabsLayout />);

    const addTabButton = screen.getByTestId("tab-add");
    fireEvent.press(addTabButton);

    expect(mockPush).toHaveBeenCalledWith("/item/new");
  });

  it("ignores rapid repeated add-tab presses", () => {
    render(<TabsLayout />);

    const addTabButton = screen.getByTestId("tab-add");
    fireEvent.press(addTabButton);
    fireEvent.press(addTabButton);

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/item/new");
  });

  it("uses theme background as scene container background", () => {
    render(<TabsLayout />);

    expect(mockTabsScreenOptions).toMatchObject({
      sceneStyle: {
        backgroundColor: "#F7F9FC",
      },
    });
  });
});
