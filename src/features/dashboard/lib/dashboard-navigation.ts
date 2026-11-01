export const dashboardPaths = { operasional: "/dashboard/operasional", keuangan: "/dashboard/keuangan" } as const;

export function dashboardHref(path: string, search: string, includeStatus = false) {
  const original = new URLSearchParams(search);
  const params = new URLSearchParams();
  for (const key of ["start", "end", "spk", "plot", ...(includeStatus ? ["status"] : [])]) {
    for (const value of original.getAll(key)) if (value) params.append(key, value);
  }
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`;
}
