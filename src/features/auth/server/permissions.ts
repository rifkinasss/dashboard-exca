import "server-only";
import { isAllowedGoogleAccount, isManagedAdministrator } from "../allowlist";
import { readAccessUsers } from "@/features/settings/data/viewer-access";

export async function isAdministrator(email: unknown): Promise<boolean> {
  if (isAllowedGoogleAccount(email, true, process.env.AUTH_GOOGLE_ALLOWED_EMAILS)) return true;
  if (typeof email !== "string" || !email.trim()) return false;
  return readAccessUsers().then((users) => isManagedAdministrator(email, users)).catch(() => false);
}
