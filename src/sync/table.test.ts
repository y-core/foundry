import { describe, expect, it } from "bun:test";
import { renderTable } from "./table";

describe("renderTable()", () => {
  it("returns empty string for empty rows", () => {
    expect(renderTable([])).toBe("");
  });

  it("renders header and separator", () => {
    const rows = [{ Type: "kv", Binding: "MY_KV", Action: "created" }];
    const out = renderTable(rows);
    const lines = out.split("\n");
    expect(lines[0]).toContain("Type");
    expect(lines[0]).toContain("Binding");
    expect(lines[0]).toContain("Action");
    expect(lines[1]).toMatch(/^-+\s+-+\s+-+$/);
  });

  it("pads columns to the widest value", () => {
    const rows = [
      { Col: "short", Val: "x" },
      { Col: "a-much-longer-value", Val: "y" },
    ];
    const out = renderTable(rows);
    const lines = out.split("\n");
    // All data lines should have equal length (padded)
    expect(lines[2].length).toBe(lines[3].length);
  });

  it("renders all data rows", () => {
    const rows = [
      { Type: "kv", Binding: "KV1", Action: "exists" },
      { Type: "d1", Binding: "DB1", Action: "created" },
    ];
    const out = renderTable(rows);
    expect(out).toContain("KV1");
    expect(out).toContain("DB1");
    expect(out).toContain("exists");
    expect(out).toContain("created");
  });

  it("uses key order from first row for column order", () => {
    const rows = [{ Z: "z", A: "a" }];
    const out = renderTable(rows);
    const header = out.split("\n")[0];
    expect(header.indexOf("Z")).toBeLessThan(header.indexOf("A"));
  });
});
