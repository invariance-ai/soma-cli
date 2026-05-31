/**
 * Natural-language people questions — "what is andy doing?", "who is bea?",
 * "what's andy working on lately?". Shared by the CLI `ask`/`who` path and the
 * MCP `soma_ask` tool so the two never fork their logic.
 *
 * Flow: pull the person token out of the question → fetch that person's
 * deterministic activity from the backend → ground the local `claude` CLI on it
 * for a prose answer. Falls back to the deterministic formatted view when no
 * model is available, so it always returns something useful.
 */

import { askClaude, claudeCliAvailable } from "../providers/claude-cli.js";
import type { PlatformClient } from "./client.js";
import { formatPersonActivity } from "./format.js";
import type { PersonActivity } from "./types.js";

/** Activity verbs that mark a "what is X doing" question. */
const DOING = /\b(doing|working on|working|up to|been|lately|currently|these days|today|this week|right now)\b/i;
/** "what is X <activity>" — captures X non-greedily before the activity verb. */
const DOING_Q =
  /(?:what(?:'s| is| has| are)?|how(?:'s| is)?|tell me what|show me what)\s+(.+?)\s+(?:is\s+|has\s+|been\s+)?(?:doing|working on|working|up to|lately|currently|these days|today|this week|right now|been)\b/i;
/** "who is X" — direct identity question. */
const WHO_Q = /(?:^|\b)who(?:'s| is)\s+(.+)$/i;

/** Trim filler and reject anything that isn't a plausible person token. */
function cleanPerson(raw: string): string | null {
  let core = raw
    .trim()
    .replace(/^(?:soma[,\s]+)?(?:hey[,\s]+)?/i, "")
    .replace(/['’]s\b/, "")
    .replace(/\s+(?:is|are)$/i, "")
    .trim();
  if (!core) return null;
  // Articles or >3 words → almost certainly a thing, not a person.
  if (/^(?:the|a|an)\b/i.test(core)) return null;
  if (core.split(/\s+/).length > 3) return null;
  return core;
}

/**
 * Best-effort extraction of the person a question is about. Returns null when
 * the text doesn't look like a person question. Conservative on purpose — the
 * caller falls back to a general (memory-grounded) answer when this is null.
 */
export function extractPersonQuery(question: string): string | null {
  const q = question.trim().replace(/[?]+$/, "");
  if (DOING.test(q)) {
    const m = q.match(DOING_Q);
    if (m?.[1]) return cleanPerson(m[1]);
  }
  const w = q.match(WHO_Q);
  if (w?.[1]) return cleanPerson(w[1]);
  return null;
}

export interface PersonAnswer {
  question: string;
  person: string;
  /** Deterministic activity grounding, or null when the person wasn't found. */
  activity: PersonActivity | null;
  /** Prose answer (model-written when available, else the formatted view). */
  answer: string;
  /** "claude" when a model wrote the answer, "deterministic" otherwise. */
  source: "claude" | "deterministic";
}

const SYSTEM = [
  "You are Soma, the engineering context layer. Answer concisely what a teammate is currently doing,",
  "grounded ONLY in the activity JSON provided. Lead with a one-sentence summary, then 2-5 bullets of",
  "the most significant recent items (PRs, commits, tickets, incidents, messages). Cite specifics",
  "(titles, repos, ticket ids) from the data. Do not invent activity that isn't in the JSON.",
].join(" ");

export interface AnswerOpts {
  since?: string;
  limit?: number;
  model?: string;
  /** Force the deterministic path even if `claude` is available (tests). */
  noModel?: boolean;
}

/**
 * Answer a person question end-to-end. The caller is expected to have already
 * decided this is a person question (via extractPersonQuery) and pass the
 * resolved `person` token.
 */
export async function answerPersonQuestion(
  client: PlatformClient,
  question: string,
  person: string,
  opts: AnswerOpts = {},
): Promise<PersonAnswer> {
  const activity = await client.getPersonActivity(person, { since: opts.since, limit: opts.limit });

  if (!activity) {
    return {
      question,
      person,
      activity: null,
      answer: `No recent activity found for "${person}" in workspace ${client.workspaceId}.`,
      source: "deterministic",
    };
  }

  const grounding = formatPersonActivity(activity, { json: true });
  const useModel = !opts.noModel && (await claudeCliAvailable());
  if (useModel) {
    try {
      const answer = await askClaude(
        `Question: ${question}\n\nActivity JSON:\n${grounding}`,
        SYSTEM,
        { model: opts.model },
      );
      return { question, person, activity, answer: answer || formatPersonActivity(activity), source: "claude" };
    } catch {
      // fall through to deterministic on any model error
    }
  }
  return {
    question,
    person,
    activity,
    answer: formatPersonActivity(activity),
    source: "deterministic",
  };
}
