import type { CfAuth, ResolvedPrefix, ResourceType, WranglerConfig } from "../types";

export interface HandlerContext {
  auth: CfAuth;
  scriptName: string;
  prefix: ResolvedPrefix;
  dryRun: boolean;
  fetch: typeof globalThis.fetch;
}

export interface ReconcileResult<TLocal> {
  entries: TLocal[];
  results: import("../types").SyncResult[];
}

export interface ResourceHandler<TLocal = unknown> {
  readonly type: ResourceType;
  readonly displayName: string;
  extract(config: WranglerConfig): TLocal[];
  reconcile(entries: TLocal[], ctx: HandlerContext): Promise<ReconcileResult<TLocal>>;
}
