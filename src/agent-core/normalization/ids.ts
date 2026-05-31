import crypto from "node:crypto";

export function stableHash(input: unknown, length = 16): string {
  const text = typeof input === "string" ? input : JSON.stringify(input);
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, length);
}

export function stableId(prefix: string, input: unknown): string {
  return `${prefix}_${stableHash(input, 18)}`;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}
