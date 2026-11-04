export function isAllowedGoogleAccount(email: unknown, verified: unknown, allowedEmails: string | undefined): boolean {
  if (verified !== true || typeof email !== "string" || !allowedEmails) return false;
  const normalized = email.trim().toLowerCase();
  return normalized !== "" && allowedEmails.split(",").some((entry) => entry.trim().toLowerCase() === normalized);
}
