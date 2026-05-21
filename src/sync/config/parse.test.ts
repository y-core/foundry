import { describe, expect, it } from "bun:test";
import { stripJsonc } from "./parse";

describe("stripJsonc()", () => {
  it("passes plain JSON through unchanged", () => {
    const input = `{"name":"test","value":42}`;
    expect(stripJsonc(input)).toBe(input);
  });

  it("removes line comments", () => {
    const input = `{
  // this is a comment
  "name": "test"
}`;
    const result = JSON.parse(stripJsonc(input));
    expect(result.name).toBe("test");
  });

  it("removes block comments", () => {
    const input = `{"name": /* comment */ "test"}`;
    const result = JSON.parse(stripJsonc(input));
    expect(result.name).toBe("test");
  });

  it("removes trailing commas in objects", () => {
    const input = `{"name": "test",}`;
    const result = JSON.parse(stripJsonc(input));
    expect(result.name).toBe("test");
  });

  it("removes trailing commas in arrays", () => {
    const input = `{"items": [1, 2, 3,]}`;
    const result = JSON.parse(stripJsonc(input));
    expect(result.items).toEqual([1, 2, 3]);
  });

  it("does not strip // inside a string value", () => {
    const input = `{"url": "https://example.com"}`;
    const result = JSON.parse(stripJsonc(input));
    expect(result.url).toBe("https://example.com");
  });

  it("handles escaped quotes inside strings", () => {
    const input = `{"msg": "say \\"hello\\""}`;
    const result = JSON.parse(stripJsonc(input));
    expect(result.msg).toBe(`say "hello"`);
  });

  it("handles multiline block comments", () => {
    const input = `{
  /*
   * multi
   * line
   */
  "ok": true
}`;
    const result = JSON.parse(stripJsonc(input));
    expect(result.ok).toBe(true);
  });

  it("handles nested trailing commas", () => {
    const input = `{
  "a": {
    "b": [1, 2,],
  },
}`;
    const result = JSON.parse(stripJsonc(input));
    expect(result.a.b).toEqual([1, 2]);
  });
});
