export function uid(prefix = "id"): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function generateRunId(): string {
  return uid("run");
}

