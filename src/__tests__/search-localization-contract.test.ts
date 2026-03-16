import fs from "node:fs";
import path from "node:path";

function readSource(relativePath: string): string {
  const absolutePath = path.join(process.cwd(), relativePath);
  return fs.readFileSync(absolutePath, "utf8");
}

describe("search localization contract", () => {
  it("keeps item list search scoped to user-entered title/vendor text", () => {
    const source = readSource(path.join("src", "app", "(tabs)", "items.tsx"));
    expect(source).toContain("const searchTerm = search.trim().toLowerCase();");
    expect(source).toContain('const haystack = `${item.title} ${item.vendor ?? ""}`.toLowerCase();');
    expect(source).toContain("return haystack.includes(searchTerm);");
  });

  it("keeps export search scoped to user-entered title/vendor text", () => {
    const source = readSource(path.join("src", "app", "(tabs)", "export.tsx"));
    expect(source).toContain("const searchTerm = search.trim().toLowerCase();");
    expect(source).toContain('const haystack = `${item.title} ${item.vendor ?? ""}`.toLowerCase();');
    expect(source).toContain("return haystack.includes(searchTerm);");
  });
});
