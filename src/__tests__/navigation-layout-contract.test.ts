import fs from "node:fs";
import path from "node:path";

function readScreen(relativePath: string): string {
  const absolutePath = path.resolve(__dirname, "..", relativePath);
  return fs.readFileSync(absolutePath, "utf8");
}

describe("Navigation/Layout contract", () => {
  it("keeps explicit native back buttons on item stack detail/edit/add screens", () => {
    const source = readScreen("app/item/_layout.tsx");

    expect(source).toContain('testID="additem-header-back"');
    expect(source).toContain('testID="itemdetail-header-back"');
    expect(source).toContain('testID="edititem-header-back"');
  });

  it("uses bottom safe-area edges across item/settings stack screens", () => {
    const screens = [
      "app/item/new.tsx",
      "app/item/[id]/index.tsx",
      "app/item/[id]/edit.tsx",
      "app/(tabs)/settings/index.tsx",
      "app/(tabs)/settings/appearance.tsx",
      "app/(tabs)/settings/backup-sync.tsx",
      "app/(tabs)/settings/danger-zone.tsx",
      "app/(tabs)/settings/legal.tsx",
      "app/(tabs)/settings/security.tsx",
      "app/(tabs)/settings/tax-calculation.tsx",
    ];

    for (const screenPath of screens) {
      const source = readScreen(screenPath);
      expect(source).toContain('edges={["bottom"]}');
      expect(source).not.toContain('edges={["top"]}');
      expect(source).not.toContain('edges={["top", "bottom"]}');
    }
  });

  it("disables automatic scroll inset injection on stack scroll screens", () => {
    const scrollScreens = [
      "app/item/new.tsx",
      "app/item/[id]/index.tsx",
      "app/item/[id]/edit.tsx",
      "app/(tabs)/settings/index.tsx",
      "app/(tabs)/settings/backup-sync.tsx",
      "app/(tabs)/settings/legal.tsx",
      "app/(tabs)/settings/security.tsx",
      "app/(tabs)/settings/tax-calculation.tsx",
    ];

    for (const screenPath of scrollScreens) {
      const source = readScreen(screenPath);
      expect(source).toContain('contentInsetAdjustmentBehavior="never"');
      expect(source).toContain("automaticallyAdjustContentInsets={false}");
      expect(source).toContain("paddingTop: 24");
    }
  });
});
