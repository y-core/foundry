import { env } from "node:process";
import { CliError, createCommand } from "@y-core/forge/cli";
import { parseWranglerConfig, writeWranglerConfig } from "./config/parse";
import { syncBindings } from "./engine";
import { defaultHandlers } from "./handlers/registry";
import { renderTable } from "./table";
import type { CfAuth, ResourceType, SyncResult } from "./types";

const syncFlags = {
  config: { type: "string" as const, short: "c", description: "Path to wrangler.jsonc", default: "wrangler.jsonc" },
  "dry-run": { type: "boolean" as const, short: "n", description: "Preview changes without writing" },
  prefix: { type: "string" as const, description: "Custom prefix for remote resource names" },
  "no-prefix": { type: "boolean" as const, description: "Disable prefixing (use binding name as-is)" },
  resources: { type: "string" as const, short: "r", description: "Comma-separated resource types to sync" },
  "account-id": { type: "string" as const, description: "Cloudflare account ID (or CLOUDFLARE_ACCOUNT_ID env)" },
  "api-token": { type: "string" as const, description: "Cloudflare API token (or CLOUDFLARE_API_TOKEN env)" },
};

function resolveAuth(flags: Record<string, string | boolean | undefined>): CfAuth {
  const accountId = (flags["account-id"] as string | undefined) ?? env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = (flags["api-token"] as string | undefined) ?? env.CLOUDFLARE_API_TOKEN;

  if (!accountId) throw new CliError("invalid-args", "Missing account ID. Set --account-id or CLOUDFLARE_ACCOUNT_ID");
  if (!apiToken) throw new CliError("invalid-args", "Missing API token. Set --api-token or CLOUDFLARE_API_TOKEN; https://dash.cloudflare.com/profile/api-tokens");

  return { accountId, apiToken };
}

function printResults(results: SyncResult[]): void {
  if (results.length === 0) {
    console.log("No bindings found.");
    return;
  }
  const rows = results.map((r) => ({
    Type: r.resourceType,
    Binding: r.binding,
    "Remote Name": r.remoteName ?? "",
    Action: r.action,
    "Remote ID": r.remoteId ?? "",
    Detail: r.detail ?? "",
  }));
  console.log(renderTable(rows));
}

export function createSyncCommand() {
  return createCommand({
    name: "sync",
    description: "Reconcile Cloudflare bindings with remote resources",
    flags: syncFlags,
    async run(_args, flags) {
      const auth = resolveAuth(flags as Record<string, string | boolean | undefined>);
      const configPath = (flags.config as string) ?? "wrangler.jsonc";
      const dryRun = Boolean(flags["dry-run"]);

      const config = parseWranglerConfig(configPath);

      const prefixStrategy = flags["no-prefix"]
        ? { kind: "none" as const }
        : flags.prefix
          ? { kind: "custom" as const, prefix: flags.prefix as string }
          : { kind: "project-name" as const };

      const resources = flags.resources
        ? (flags.resources as string).split(",").map((s) => s.trim() as ResourceType)
        : undefined;

      const output = await syncBindings(
        config,
        { auth, dryRun, prefix: prefixStrategy, resources },
        defaultHandlers,
      );

      printResults(output.results);

      if (!dryRun && output.configChanged) {
        writeWranglerConfig(configPath, output.updatedConfig);
        console.log(`\nUpdated ${configPath} with remote IDs.`);
      } else if (dryRun) {
        console.log("\n(dry-run: no changes written)");
      }
    },
  });
}

export function createStatusCommand() {
  return createCommand({
    name: "status",
    description: "Show current binding status (read-only)",
    flags: syncFlags,
    async run(_args, flags) {
      const auth = resolveAuth(flags as Record<string, string | boolean | undefined>);
      const configPath = (flags.config as string) ?? "wrangler.jsonc";

      const config = parseWranglerConfig(configPath);

      const prefixStrategy = flags["no-prefix"]
        ? { kind: "none" as const }
        : flags.prefix
          ? { kind: "custom" as const, prefix: flags.prefix as string }
          : { kind: "project-name" as const };

      const resources = flags.resources
        ? (flags.resources as string).split(",").map((s) => s.trim() as ResourceType)
        : undefined;

      const output = await syncBindings(
        config,
        { auth, dryRun: true, prefix: prefixStrategy, resources },
        defaultHandlers,
      );

      printResults(output.results);
    },
  });
}
