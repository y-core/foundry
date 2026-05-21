import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execute } from "@y-core/forge/cli";
import { createReleaseCommand } from "@y-core/forge/pkg";

const cwd = resolve(dirname(fileURLToPath(import.meta.url)), "..");
await execute(createReleaseCommand({ cwd }));
