import { NextRequest } from "next/server";
import { createDetailRun, getDetailRun } from "@/lib/detail-runs/service";
import { withProviderCredentials, readProviderCredentialsFromRequest } from "@/lib/services/provider-runtime";
import { handleRouteError, ok } from "@/lib/utils/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try { return ok(await getDetailRun(params.id)); } catch (error) { return handleRouteError(error); }
}
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try { return await withProviderCredentials(request, async () => ok(await createDetailRun(params.id, await request.json(), readProviderCredentialsFromRequest(request)), { status: 202 })); }
  catch (error) { return handleRouteError(error); }
}
