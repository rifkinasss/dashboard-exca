export function administratorEmails(allowedEmails: string | undefined): string[] {
  return [...new Set((allowedEmails ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

export function isAllowedGoogleAccount(email: unknown, verified: unknown, allowedEmails: string | undefined): boolean {
  if (verified !== true || typeof email !== "string" || !allowedEmails) return false;
  const normalized = email.trim().toLowerCase();
  return normalized !== "" && administratorEmails(allowedEmails).includes(normalized);
}

export function isViewerAccount(email: unknown, verified: unknown, viewers: string[]): boolean {
  return verified === true && typeof email === "string" && viewers.includes(email.trim().toLowerCase());
}

export function canInputTransactions(email: string, users: { email: string; role: "viewer" | "operator" | "admin" }[]): boolean {
  return users.some((user) => user.email === email.trim().toLowerCase() && user.role === "operator");
}

export function activeViewerRow(rows: unknown[][], email: string): number | null {
  const matching = rows.flatMap((row, index) => typeof row[0] === "string" && row[0].trim().toLowerCase() === email && (row[1] === "viewer" || row[1] === "operator" || row[1] === "admin") ? [index + 1] : []);
  return matching.length === 1 && matching[0] > 1 ? matching[0] : null;
}

export function isManagedAdministrator(email: unknown, users: { email: string; role: "viewer" | "operator" | "admin" }[]): boolean {
  return typeof email === "string" && users.some((user) => user.email === email.trim().toLowerCase() && user.role === "admin");
}
