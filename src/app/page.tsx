import { connection } from "next/server";
import { redirect } from "next/navigation";
import { dashboardHref, dashboardPaths } from "@/features/dashboard/lib/dashboard-navigation";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
  }
  redirect(dashboardHref(dashboardPaths.operasional, params.toString(), true));
}
