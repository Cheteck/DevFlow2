/**
 * Application manifest — a Bounded Application Context (Manifest v2).
 */

import type { MosaixArtifactManifest } from "../mosaix-artifact";
import type { ApplicationExperienceContract } from "./application-experience";

export interface ApplicationDomain {
  name?: string;
  entities?: string[];
  commands?: string[];
  events?: string[];
  migrations?: string[];
  [key: string]: unknown;
}

export interface ApplicationRuntime {
  entrypoint: string;
  isolation: "sandbox" | "trusted";
  engine?: "web-worker" | "iframe" | "wasm";
}

export interface ApplicationRouteConfig {
  path: string;
  method?: string;
  handler?: string;
}

export interface ApplicationUIConfig {
  entrypoint?: string;
  slots?: string[];
  theme?: string;
}

export interface ApplicationDatabaseConfig {
  connection?: string;
  schema?: string;
  strategy?: string;
  [key: string]: unknown;
}

export interface ApplicationHealthConfig {
  endpoint?: string;
  intervalMs?: number;
}

export interface ApplicationThemeOverrides {
  slots?: string[];
  tokens?: string;
  layouts?: Record<string, string>;
  routes?: string[];
}

export interface ApplicationManifest extends MosaixArtifactManifest {
  type: "application";
  domain?: string | ApplicationDomain;
  runtime: ApplicationRuntime;
  experience?: ApplicationExperienceContract;
  requires?: Array<{ id: string; version: string }>;
  events?: string[] | { publishes?: string[]; subscribes?: string[] };
  routes?: ApplicationRouteConfig[] | { prefix?: string };
  ui?: ApplicationUIConfig;
  assets?: string[];
  database?: ApplicationDatabaseConfig;
  migrations?: string;
  health?: ApplicationHealthConfig;
  themeContract?: string;
  themeOverrides?: ApplicationThemeOverrides;
}
