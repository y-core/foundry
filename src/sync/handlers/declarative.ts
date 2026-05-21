import type { ResourceType, SyncResult, WranglerConfig } from "../types";
import type { ReconcileResult, ResourceHandler } from "./types";

type AnyEntry = { binding?: string; name?: string; [key: string]: unknown };

function getBinding(entry: AnyEntry): string {
  return (entry.binding ?? entry.name ?? "unknown") as string;
}

// Factory for bindings that are declarative-only — just report presence, no API provisioning.
export function createDeclarativeHandler(
  type: ResourceType,
  displayName: string,
  extractFn: (config: WranglerConfig) => AnyEntry[],
): ResourceHandler<AnyEntry> {
  return {
    type,
    displayName,
    extract: extractFn,
    async reconcile(entries, _ctx): Promise<ReconcileResult<AnyEntry>> {
      const results: SyncResult[] = entries.map((entry) => ({
        resourceType: type,
        binding: getBinding(entry),
        action: "exists" as const,
        detail: "declarative — no provisioning needed",
      }));
      return { entries, results };
    },
  };
}

export const rateLimitsHandler = createDeclarativeHandler(
  "ratelimits",
  "Rate Limits",
  (c) => (c.ratelimits ?? []) as unknown as AnyEntry[],
);

export const durableObjectsHandler = createDeclarativeHandler(
  "durable_objects",
  "Durable Objects",
  (c) => (c.durable_objects?.bindings ?? []) as unknown as AnyEntry[],
);

export const hyperdriveHandler = createDeclarativeHandler(
  "hyperdrive",
  "Hyperdrive",
  (c) => (c.hyperdrive ?? []) as unknown as AnyEntry[],
);

export const vectorizeHandler = createDeclarativeHandler(
  "vectorize",
  "Vectorize",
  (c) => (c.vectorize ?? []) as unknown as AnyEntry[],
);

export const aiHandler = createDeclarativeHandler(
  "ai",
  "Workers AI",
  (c) => (c.ai ? [c.ai as AnyEntry] : []),
);

export const browserHandler = createDeclarativeHandler(
  "browser",
  "Browser Rendering",
  (c) => (c.browser ? [c.browser as AnyEntry] : []),
);

export const analyticsEngineHandler = createDeclarativeHandler(
  "analytics_engine_datasets",
  "Analytics Engine",
  (c) => (c.analytics_engine_datasets ?? []) as unknown as AnyEntry[],
);

export const servicesHandler = createDeclarativeHandler(
  "services",
  "Service Bindings",
  (c) => (c.services ?? []) as unknown as AnyEntry[],
);

export const sendEmailHandler = createDeclarativeHandler(
  "send_email",
  "Email Routing",
  (c) => (c.send_email ?? []) as unknown as AnyEntry[],
);

export const dispatchNamespacesHandler = createDeclarativeHandler(
  "dispatch_namespaces",
  "Dispatch Namespaces",
  (c) => (c.dispatch_namespaces ?? []) as unknown as AnyEntry[],
);

export const mtlsCertificatesHandler = createDeclarativeHandler(
  "mtls_certificates",
  "mTLS Certificates",
  (c) => (c.mtls_certificates ?? []) as unknown as AnyEntry[],
);

export const workflowsHandler = createDeclarativeHandler(
  "workflows",
  "Workflows",
  (c) => (c.workflows ?? []) as unknown as AnyEntry[],
);

export const pipelinesHandler = createDeclarativeHandler(
  "pipelines",
  "Pipelines",
  (c) => (c.pipelines ?? []) as unknown as AnyEntry[],
);
