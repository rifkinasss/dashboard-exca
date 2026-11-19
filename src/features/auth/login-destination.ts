export function loginDestination(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/dashboard/operasional";
  try {
    const url = new URL(value, "https://local.invalid");
    return url.origin === "https://local.invalid" && url.pathname !== "/login" ? `${url.pathname}${url.search}${url.hash}` : "/dashboard/operasional";
  } catch {
    return "/dashboard/operasional";
  }
}
