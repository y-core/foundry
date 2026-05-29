import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { v } from "@y-core/forge/validation";
import type { WranglerConfig } from "../types";

// Minimal JSONC → JSON state machine:
// tracks string vs comment context to strip comments and trailing commas
export function stripJsonc(src: string): string {
  let out = "";
  let i = 0;
  const len = src.length;

  while (i < len) {
    const ch = src[i];

    // String literal — copy verbatim, handle escape sequences
    if (ch === '"') {
      let str = '"';
      i++;
      while (i < len) {
        const c = src[i];
        if (c === "\\") {
          str += c + (src[i + 1] ?? "");
          i += 2;
        } else if (c === '"') {
          str += '"';
          i++;
          break;
        } else {
          str += c;
          i++;
        }
      }
      out += str;
      continue;
    }

    // Line comment
    if (ch === "/" && src[i + 1] === "/") {
      while (i < len && src[i] !== "\n") i++;
      continue;
    }

    // Block comment
    if (ch === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < len) {
        if (src[i] === "*" && src[i + 1] === "/") { i += 2; break; }
        i++;
      }
      continue;
    }

    out += ch;
    i++;
  }

  // Remove trailing commas before ] or }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

// Permissive shape validation — wrangler configs carry many optional fields and
// arbitrary extra keys, so we use loose objects and assert only the pieces the sync
// handlers actually read. `name` is the one hard requirement.
const WranglerConfigSchema = v.looseObject({
  name: v.string('wrangler config must define a string "name"'),
  vars: v.optional(v.record(v.string(), v.unknown())),
  kv_namespaces: v.optional(v.array(v.looseObject({ binding: v.string() }))),
  d1_databases: v.optional(v.array(v.looseObject({ binding: v.string() }))),
  r2_buckets: v.optional(v.array(v.looseObject({ binding: v.string() }))),
  queues: v.optional(
    v.looseObject({
      producers: v.optional(v.array(v.looseObject({ binding: v.string() }))),
      consumers: v.optional(v.array(v.looseObject({ queue: v.string() }))),
    }),
  ),
});

export function parseWranglerConfig(configPath: string): WranglerConfig {
  const abs = resolve(configPath);
  const raw = readFileSync(abs, "utf-8");
  const json = stripJsonc(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(`malformed wrangler config at ${abs}: invalid JSON — ${(err as Error).message}`);
  }

  const result = v.safeParse(WranglerConfigSchema, parsed);
  if (!result.success) {
    const detail = result.issues
      .map((issue) => `${v.getDotPath(issue) ?? "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`malformed wrangler config at ${abs}: ${detail}`);
  }

  // Return the original parsed object (not the validated output) so write-back keeps
  // every field verbatim, including keys the schema does not enumerate.
  return parsed as WranglerConfig;
}

export function writeWranglerConfig(configPath: string, config: WranglerConfig): void {
  const abs = resolve(configPath);
  writeFileSync(abs, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}
