import { describe, expect, it } from "bun:test";
import type { StringFlagDef } from "@y-core/forge/cli";
import { createStatusCommand, createSyncCommand } from "./commands";

describe("createSyncCommand()", () => {
  it("returns a command named sync", () => {
    const cmd = createSyncCommand();
    expect(cmd.name).toBe("sync");
  });

  it("has dry-run and config flags", () => {
    const cmd = createSyncCommand();
    expect(cmd.flags["dry-run"]).toBeDefined();
    expect(cmd.flags.config).toBeDefined();
  });

  it("has account-id and api-token flags", () => {
    const cmd = createSyncCommand();
    expect(cmd.flags["account-id"]).toBeDefined();
    expect(cmd.flags["api-token"]).toBeDefined();
  });
});

describe("createStatusCommand()", () => {
  it("returns a command named status", () => {
    const cmd = createStatusCommand();
    expect(cmd.name).toBe("status");
  });

  it("has config flag with default", () => {
    const cmd = createStatusCommand();
    expect(cmd.flags.config).toBeDefined();
    expect((cmd.flags.config as StringFlagDef).default).toBe("wrangler.jsonc");
  });
});
