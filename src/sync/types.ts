// Auth credentials — always from env or flags, never hardcoded
export interface CfAuth {
  readonly apiToken: string;
  readonly accountId: string;
}

export type ResourceType =
  | "kv_namespaces"
  | "d1_databases"
  | "r2_buckets"
  | "queues"
  | "vars"
  | "secrets"
  | "ratelimits"
  | "durable_objects"
  | "hyperdrive"
  | "vectorize"
  | "ai"
  | "browser"
  | "analytics_engine_datasets"
  | "services"
  | "send_email"
  | "dispatch_namespaces"
  | "mtls_certificates"
  | "workflows"
  | "pipelines";

export type PrefixStrategy =
  | { kind: "project-name" }
  | { kind: "custom"; prefix: string }
  | { kind: "none" };

export type ResolvedPrefix = string; // empty string = no prefix

export type SyncAction = "exists" | "created" | "updated" | "skipped" | "unavailable" | "error";

export interface SyncResult {
  resourceType: ResourceType;
  binding: string;
  remoteName?: string;
  action: SyncAction;
  remoteId?: string;
  detail?: string;
}

export interface SyncOutput {
  results: SyncResult[];
  updatedConfig: WranglerConfig;
  configChanged: boolean;
}

export interface SyncConfig {
  auth: CfAuth;
  scriptName?: string;
  resources?: ResourceType[];
  prefix?: PrefixStrategy;
  dryRun?: boolean;
}

// Per-binding config shapes

export interface KvNamespaceConfig {
  binding: string;
  id?: string;
  preview_id?: string;
}

export interface D1DatabaseConfig {
  binding: string;
  database_id?: string;
  database_name?: string;
}

export interface R2BucketConfig {
  binding: string;
  bucket_name?: string;
}

export interface QueueProducerConfig {
  binding: string;
  queue?: string;
  queue_id?: string;
}

export interface QueueConsumerConfig {
  queue: string;
  max_batch_size?: number;
  max_batch_timeout?: number;
  max_retries?: number;
  dead_letter_queue?: string;
}

export interface RateLimitConfig {
  name: string;
  namespace_id: string;
  simple?: { limit: number; period: number };
}

export interface DurableObjectConfig {
  name: string;
  class_name: string;
  script_name?: string;
  environment?: string;
}

export interface HyperdriveConfig {
  binding: string;
  id: string;
}

export interface VectorizeConfig {
  binding: string;
  index_name: string;
}

export interface AnalyticsEngineConfig {
  binding: string;
  dataset?: string;
}

export interface ServiceConfig {
  binding: string;
  service: string;
  environment?: string;
}

export interface SendEmailConfig {
  name: string;
  destination_address?: string;
}

export interface DispatchNamespaceConfig {
  binding: string;
  namespace: string;
}

export interface MtlsCertificateConfig {
  binding: string;
  certificate_id: string;
}

export interface WorkflowConfig {
  binding: string;
  name: string;
  class_name: string;
  script_name?: string;
}

export interface PipelineConfig {
  binding: string;
  pipeline: string;
}

export interface WranglerConfig {
  name: string;
  vars?: Record<string, string>;
  kv_namespaces?: KvNamespaceConfig[];
  d1_databases?: D1DatabaseConfig[];
  r2_buckets?: R2BucketConfig[];
  queues?: {
    producers?: QueueProducerConfig[];
    consumers?: QueueConsumerConfig[];
  };
  ratelimits?: RateLimitConfig[];
  durable_objects?: { bindings?: DurableObjectConfig[] };
  hyperdrive?: HyperdriveConfig[];
  vectorize?: VectorizeConfig[];
  ai?: { binding: string };
  browser?: { binding: string };
  analytics_engine_datasets?: AnalyticsEngineConfig[];
  services?: ServiceConfig[];
  send_email?: SendEmailConfig[];
  dispatch_namespaces?: DispatchNamespaceConfig[];
  mtls_certificates?: MtlsCertificateConfig[];
  workflows?: WorkflowConfig[];
  pipelines?: PipelineConfig[];
  [key: string]: unknown;
}
