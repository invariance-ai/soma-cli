/**
 * Resolve how the CLI/MCP reach the Soma platform backend. Mirrors the
 * dashboard server's contract (Bearer admin token + a workspace id), with the
 * same dev fallbacks so `soma findings` works against a local backend with zero
 * config. In production the admin token must be set explicitly.
 */

export interface PlatformConfig {
  baseUrl: string;
  adminToken: string;
  workspaceId: string;
}

const DEV_BASE_URL = "http://localhost:8787";
const DEV_ADMIN_TOKEN = "dev-soma-admin-token-change-me";
const DEV_WORKSPACE_ID = "ws_test";

export interface PlatformConfigOverrides {
  baseUrl?: string;
  adminToken?: string;
  workspaceId?: string;
}

/**
 * Resolve config from explicit overrides, then env, then dev fallbacks.
 * Env: SOMA_BACKEND_URL, SOMA_ADMIN_TOKEN, SOMA_WORKSPACE_ID.
 */
export function resolvePlatformConfig(overrides: PlatformConfigOverrides = {}): PlatformConfig {
  const isProd = process.env.NODE_ENV === "production";
  const adminToken =
    overrides.adminToken ?? process.env.SOMA_ADMIN_TOKEN ?? (isProd ? "" : DEV_ADMIN_TOKEN);
  return {
    baseUrl: overrides.baseUrl ?? process.env.SOMA_BACKEND_URL ?? DEV_BASE_URL,
    adminToken,
    workspaceId:
      overrides.workspaceId ?? process.env.SOMA_WORKSPACE_ID ?? DEV_WORKSPACE_ID,
  };
}
