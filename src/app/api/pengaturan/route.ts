import { getAppearance } from "@/features/settings/data/appearance-source";

export async function GET() {
  const appearance = await getAppearance();
  return Response.json({ appearance }, { status: appearance ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
