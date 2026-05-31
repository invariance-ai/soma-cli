/** Wall-clock helpers isolated here so the core stays deterministic/testable. */
export function nowIso(): string {
  return new Date().toISOString();
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
