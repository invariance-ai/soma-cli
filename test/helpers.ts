import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { initSoma } from "../src/agent-core/index.js";

export const NOW = "2026-05-30T00:00:00.000Z";
export const DATE = "2026-05-30";

/** Create a temp workspace with a fresh `.soma/`. */
export function tmpWorkspace(): string {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "soma-test-"));
  initSoma(ws, NOW);
  return ws;
}

export function cleanup(ws: string): void {
  fs.rmSync(ws, { recursive: true, force: true });
}
