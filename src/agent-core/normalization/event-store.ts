import fs from "node:fs";
import path from "node:path";
import { somaPaths } from "../paths.js";
import type { SomaEvent, SourceName } from "../types.js";
import { stableId } from "./ids.js";

export interface RawEventRecord {
  id: string;
  source: SourceName;
  receivedAt: string;
  payload: unknown;
}

function appendJsonl(file: string, rows: unknown[]): void {
  if (rows.length === 0) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
}

function readJsonl<T>(file: string): T[] {
  if (!fs.existsSync(file)) return [];
  const out: T[] = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as T);
    } catch {
      continue;
    }
  }
  return out;
}

export function appendRawEvent(workspace: string, source: SourceName, payload: unknown, receivedAt: string): RawEventRecord {
  const row: RawEventRecord = {
    id: stableId("raw", { source, payload, receivedAt }),
    source,
    receivedAt,
    payload,
  };
  appendJsonl(somaPaths(workspace).rawEventsFile, [row]);
  return row;
}

export function appendNormalizedEvents(workspace: string, events: SomaEvent[]): SomaEvent[] {
  const file = somaPaths(workspace).normalizedEventsFile;
  const existing = new Set(readJsonl<SomaEvent>(file).map((e) => e.dedupeKey));
  const fresh = events.filter((e) => !existing.has(e.dedupeKey));
  appendJsonl(file, fresh);
  return fresh;
}

export function readNormalizedEvents(workspace: string): SomaEvent[] {
  return readJsonl<SomaEvent>(somaPaths(workspace).normalizedEventsFile);
}
