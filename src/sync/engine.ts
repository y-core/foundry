import { defaultHandlers } from "./handlers/registry";
import type { ResourceHandler } from "./handlers/types";
import type { ResolvedPrefix, ResourceType, SyncConfig, SyncOutput, WranglerConfig } from "./types";

function resolvePrefix(config: SyncConfig, scriptName: string): ResolvedPrefix {
  const strategy = config.prefix ?? { kind: "project-name" };
  switch (strategy.kind) {
    case "none":
      return "";
    case "custom":
      return strategy.prefix;
    case "project-name":
      return scriptName.toUpperCase().replace(/-/g, "_");
  }
}

// Deep equality check for primitive-valued configs (sufficient for wrangler config arrays)
function configChanged(original: WranglerConfig, updated: WranglerConfig): boolean {
  return JSON.stringify(original) !== JSON.stringify(updated);
}

export async function syncBindings(
  config: WranglerConfig,
  syncConfig: SyncConfig,
  handlers: ResourceHandler[] = defaultHandlers,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<SyncOutput> {
  const scriptName = syncConfig.scriptName ?? config.name;
  const prefix = resolvePrefix(syncConfig, scriptName);
  const dryRun = syncConfig.dryRun ?? false;

  // Filter to requested resource types if specified
  const resourceFilter = syncConfig.resources;
  const activeHandlers = resourceFilter
    ? handlers.filter((h) => resourceFilter.includes(h.type as ResourceType))
    : handlers;

  let updatedConfig = { ...config };
  const allResults: SyncOutput["results"] = [];

  for (const handler of activeHandlers) {
    const entries = handler.extract(updatedConfig);
    if (entries.length === 0) continue;

    const ctx = {
      auth: syncConfig.auth,
      scriptName,
      prefix,
      dryRun,
      fetch: fetchFn,
    };

    const { entries: reconciled, results } = await (handler as ResourceHandler<unknown>).reconcile(entries, ctx);
    allResults.push(...results);

    // Merge reconciled entries back — only update the specific binding array
    updatedConfig = mergeEntries(updatedConfig, handler.type as ResourceType, reconciled);
  }

  return {
    results: allResults,
    updatedConfig,
    configChanged: configChanged(config, updatedConfig),
  };
}

function mergeEntries(config: WranglerConfig, type: ResourceType, entries: unknown[]): WranglerConfig {
  switch (type) {
    case "kv_namespaces":
      return { ...config, kv_namespaces: entries as WranglerConfig["kv_namespaces"] };
    case "d1_databases":
      return { ...config, d1_databases: entries as WranglerConfig["d1_databases"] };
    case "r2_buckets":
      return { ...config, r2_buckets: entries as WranglerConfig["r2_buckets"] };
    case "queues": {
      type QueueProducer = NonNullable<WranglerConfig["queues"]>["producers"];
      const producers = entries as QueueProducer;
      return { ...config, queues: { ...(config.queues ?? {}), producers } };
    }
    // These resource types have no server-assigned ID to write back into the config.
    case "vars":
    case "secrets":
    case "ratelimits":
    case "durable_objects":
    case "hyperdrive":
    case "vectorize":
    case "ai":
    case "browser":
    case "analytics_engine_datasets":
    case "services":
    case "send_email":
    case "dispatch_namespaces":
    case "mtls_certificates":
    case "workflows":
    case "pipelines":
      return config;
    // Exhaustiveness guard: a new write-back ResourceType added without a case above
    // makes `type` no longer assignable to `never`, surfacing as a compile error here.
    default:
      return ((_exhaustive: never): WranglerConfig => config)(type);
  }
}
