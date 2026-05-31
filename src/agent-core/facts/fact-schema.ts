import { z } from "zod";

export const FactSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  subject: z.string().min(1),
  predicate: z.string().min(1),
  object: z.string().min(1),
  confidence: z.enum(["low", "medium", "high"]),
  source: z.object({
    type: z.string().min(1),
    run_id: z.string().optional(),
  }),
  valid_from: z.string().min(1),
  created_at: z.string().min(1),
});

export type ValidatedFact = z.infer<typeof FactSchema>;

/**
 * Best-effort extraction of a structured relationship from a natural-language
 * statement, e.g. "Payments is owned by the infra team" ->
 * { subject: service:payments, predicate: owned_by, object: team:infra }.
 * Returns null when no pattern matches (caller falls back to prose memory).
 */
export function extractRelationship(
  text: string,
): { type: string; subject: string; predicate: string; object: string } | null {
  const patterns: Array<{
    re: RegExp;
    type: string;
    predicate: string;
    subjPrefix?: string;
    objPrefix?: string;
  }> = [
    { re: /^(.+?)\s+is owned by\s+(.+?)\.?$/i, type: "ownership", predicate: "owned_by", subjPrefix: "service:", objPrefix: "team:" },
    { re: /^(.+?)\s+owns\s+(.+?)\.?$/i, type: "ownership", predicate: "owns", subjPrefix: "team:", objPrefix: "service:" },
    { re: /^(.+?)\s+depends on\s+(.+?)\.?$/i, type: "dependency", predicate: "depends_on", subjPrefix: "service:", objPrefix: "service:" },
    { re: /^(.+?)\s+reports to\s+(.+?)\.?$/i, type: "org", predicate: "reports_to", subjPrefix: "person:", objPrefix: "person:" },
  ];

  const slug = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/^the\s+/, "")
      .replace(/\s+team$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  for (const p of patterns) {
    const m = text.match(p.re);
    if (m) {
      return {
        type: p.type,
        subject: (p.subjPrefix ?? "") + slug(m[1]),
        predicate: p.predicate,
        object: (p.objPrefix ?? "") + slug(m[2]),
      };
    }
  }
  return null;
}
