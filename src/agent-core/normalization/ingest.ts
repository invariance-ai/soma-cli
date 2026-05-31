import { appendNormalizedEvents, appendRawEvent, readNormalizedEvents } from "./event-store.js";
import { scoreEventImportance } from "./importance.js";
import { normalizePayload } from "./normalizers.js";
import { buildSessions, writeSessions } from "./sessionize.js";
import type { ImportanceDecision, SomaEvent, SomaSession, SourceName } from "../types.js";

export interface IngestResult {
  rawEventId: string;
  normalized: SomaEvent[];
  fresh: SomaEvent[];
  sessions: SomaSession[];
  decisions: ImportanceDecision[];
}

export function ingestPayload(
  workspace: string,
  source: SourceName,
  payload: unknown,
  receivedAt: string,
): IngestResult {
  const raw = appendRawEvent(workspace, source, payload, receivedAt);
  const normalized = normalizePayload(source, payload, { receivedAt });
  const fresh = appendNormalizedEvents(workspace, normalized);
  const allEvents = readNormalizedEvents(workspace);
  const sessions = buildSessions(allEvents);
  writeSessions(workspace, sessions);
  return {
    rawEventId: raw.id,
    normalized,
    fresh,
    sessions,
    decisions: fresh.map(scoreEventImportance),
  };
}
