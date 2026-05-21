import type { ResourceType } from "../types";
import { d1Handler } from "./d1";
import {
  aiHandler,
  analyticsEngineHandler,
  browserHandler,
  dispatchNamespacesHandler,
  durableObjectsHandler,
  hyperdriveHandler,
  mtlsCertificatesHandler,
  pipelinesHandler,
  rateLimitsHandler,
  sendEmailHandler,
  servicesHandler,
  vectorizeHandler,
  workflowsHandler,
} from "./declarative";
import { kvHandler } from "./kv";
import { queuesHandler } from "./queues";
import { r2Handler } from "./r2";
import { secretsHandler } from "./secrets";
import type { ResourceHandler } from "./types";
import { varsHandler } from "./vars";

export const defaultHandlers: ResourceHandler[] = [
  kvHandler,
  d1Handler,
  r2Handler,
  queuesHandler,
  varsHandler,
  secretsHandler,
  rateLimitsHandler,
  durableObjectsHandler,
  hyperdriveHandler,
  vectorizeHandler,
  aiHandler,
  browserHandler,
  analyticsEngineHandler,
  servicesHandler,
  sendEmailHandler,
  dispatchNamespacesHandler,
  mtlsCertificatesHandler,
  workflowsHandler,
  pipelinesHandler,
];

export function findHandler(type: ResourceType): ResourceHandler | undefined {
  return defaultHandlers.find((h) => h.type === type);
}
