import React from "react";
import { render, screen } from "@testing-library/react-native";

import AddTabRoute from "@/app/(tabs)/add";

jest.mock("expo-router", () => {
  const { Text } = require("react-native");
  return {
    Redirect: ({ href }: { href: string }) => <Text testID="tabs-add-redirect">{href}</Text>,
  };
});

describe("AddTabRoute", () => {
  it("redirects add tab route to add item flow", () => {
    render(<AddTabRoute />);

    expect(screen.getByTestId("tabs-add-redirect").props.children).toBe("/item/new");
  });
});
