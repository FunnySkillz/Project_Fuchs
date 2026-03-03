import React from "react";
import { render, screen } from "@testing-library/react-native";

import AddTabRoute from "@/app/(tabs)/add";

describe("AddTabRoute", () => {
  it("renders a placeholder screen with no redirect side effects", () => {
    render(<AddTabRoute />);

    expect(screen.queryByTestId("tabs-add-redirect")).toBeNull();
  });
});
