import { createCfClient } from "../api/client";
import type { CfD1Database } from "../api/types";
import type { D1DatabaseConfig, SyncResult } from "../types";
import type { ReconcileResult, ResourceHandler } from "./types";

export const d1Handler: ResourceHandler<D1DatabaseConfig> = {
  type: "d1_databases",
  displayName: "D1 Databases",

  extract(config) {
    return config.d1_databases ?? [];
  },

  async reconcile(entries, ctx): Promise<ReconcileResult<D1DatabaseConfig>> {
    if (entries.length === 0) return { entries: [], results: [] };

    const client = createCfClient(ctx.auth, ctx.fetch);
    const listResult = await client.get<CfD1Database[]>(
      `/accounts/${ctx.auth.accountId}/d1/database?per_page=100`,
    );

    const updated: D1DatabaseConfig[] = [];
    const results: SyncResult[] = [];

    if (!listResult.ok) {
      for (const entry of entries) {
        results.push({ resourceType: "d1_databases", binding: entry.binding, action: "error", detail: listResult.error.message });
        updated.push(entry);
      }
      return { entries: updated, results };
    }

    const remoteByName = new Map(listResult.data.map((db) => [db.name, db]));

    for (const entry of entries) {
      const remoteName = ctx.prefix ? `${ctx.prefix}_${entry.binding}` : (entry.database_name ?? entry.binding);

      const existing_ = remoteByName.get(remoteName);
      if (existing_ || entry.database_id) {
        const id = existing_ ? existing_.uuid : (entry.database_id as string);
        results.push({ resourceType: "d1_databases", binding: entry.binding, remoteName, action: "exists", remoteId: id });
        updated.push({ ...entry, database_id: id, database_name: remoteName });
        continue;
      }

      if (ctx.dryRun) {
        results.push({ resourceType: "d1_databases", binding: entry.binding, remoteName, action: "unavailable" });
        updated.push(entry);
        continue;
      }

      const createResult = await client.post<CfD1Database>(
        `/accounts/${ctx.auth.accountId}/d1/database`,
        { name: remoteName },
      );

      if (!createResult.ok) {
        results.push({ resourceType: "d1_databases", binding: entry.binding, remoteName, action: "error", detail: createResult.error.message });
        updated.push(entry);
      } else {
        results.push({ resourceType: "d1_databases", binding: entry.binding, remoteName, action: "created", remoteId: createResult.data.uuid });
        updated.push({ ...entry, database_id: createResult.data.uuid, database_name: remoteName });
      }
    }

    return { entries: updated, results };
  },
};
