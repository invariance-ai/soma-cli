import type { ImportanceDecision, SomaEvent, SomaSession } from "../types.js";

const SEVERITY_WORDS = /\b(error|incident|broken|failing|failed|timeout|regression|rollback|blocked|stuck|urgent|sev[0-3])\b/i;

function bucket(score: number): ImportanceDecision["bucket"] {
  if (score >= 0.9) return "surface";
  if (score >= 0.75) return "study";
  if (score >= 0.55) return "summarize";
  if (score >= 0.3) return "session";
  return "store";
}

export function scoreEventImportance(event: SomaEvent): ImportanceDecision {
  const reasons: string[] = [];
  let score = 0.12;
  const text = `${event.title ?? ""}\n${event.text ?? ""}`;

  if (event.actor) {
    score += 0.12;
    reasons.push("has_actor");
  }
  if (event.mentions.length > 0 || event.targets.length > 0) {
    score += Math.min(0.28, (event.mentions.length + event.targets.length) * 0.07);
    reasons.push("linked_entities");
  }
  if (event.mentions.some((m) => m.entity.kind === "ticket") || event.targets.some((t) => t.kind === "ticket")) {
    score += 0.15;
    reasons.push("ticket_link");
  }
  if (SEVERITY_WORDS.test(text)) {
    score += 0.2;
    reasons.push("severity_language");
  }
  if (event.source === "linear" || event.source === "agent") {
    score += 0.08;
    reasons.push("high_signal_source");
  }

  const clamped = Math.min(1, Number(score.toFixed(2)));
  return { eventId: event.id, score: clamped, bucket: bucket(clamped), reasons };
}

export function scoreSessionImportance(session: SomaSession, events: SomaEvent[]): ImportanceDecision {
  const eventScores = events.map((e) => scoreEventImportance(e));
  const max = Math.max(0, ...eventScores.map((e) => e.score));
  const recurrence = Math.min(0.15, Math.max(0, events.length - 1) * 0.03);
  const crossSource = new Set(events.map((e) => e.source)).size > 1 ? 0.12 : 0;
  const score = Math.min(1, Number((max + recurrence + crossSource).toFixed(2)));
  const reasons = [...new Set(eventScores.flatMap((e) => e.reasons))];
  if (recurrence > 0) reasons.push("repeated_activity");
  if (crossSource > 0) reasons.push("cross_source");
  return { sessionId: session.id, score, bucket: bucket(score), reasons };
}
