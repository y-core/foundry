import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
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

export function parseWranglerConfig(configPath: string): WranglerConfig {
  const abs = resolve(configPath);
  const raw = readFileSync(abs, "utf-8");
  const json = stripJsonc(raw);
  return JSON.parse(json) as WranglerConfig;
}

export function writeWranglerConfig(configPath: string, config: WranglerConfig): void {
  const abs = resolve(configPath);
  writeFileSync(abs, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}
