import type { WritePolicy } from "../types.js";

export type WriteAction = "apply" | "append" | "propose" | "reject";

export interface WriteDecision {
  action: WriteAction;
  reason: string;
}

/**
 * Decide how a requested write to a memory file should be handled given its
 * write_policy and whether the user explicitly authorized it.
 *
 * - human_locked   -> always reject
 * - human_approved -> propose, unless explicitly authorized -> apply
 * - agent_editable -> apply
 * - append_only    -> append
 * - generated      -> apply (runtime-owned)
 */
export function decideWrite(
  policy: WritePolicy,
  opts: { explicitlyAuthorized?: boolean } = {},
): WriteDecision {
  switch (policy) {
    case "human_locked":
      return { action: "reject", reason: "file is human_locked (read only)" };
    case "human_approved":
      return opts.explicitlyAuthorized
        ? { action: "apply", reason: "human_approved + explicit user authorization" }
        : { action: "propose", reason: "human_approved requires a proposal" };
    case "agent_editable":
      return { action: "apply", reason: "agent_editable" };
    case "append_only":
      return { action: "append", reason: "append_only" };
    case "generated":
      return { action: "apply", reason: "generated (runtime-owned)" };
  }
}
