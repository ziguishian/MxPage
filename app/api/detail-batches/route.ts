import { NextRequest } from "next/server";
import { startBatch } from "@/lib/detail-runs/batch";
import { readProviderCredentialsFromRequest, withProviderCredentials } from "@/lib/services/provider-runtime";
import { handleRouteError, ok } from "@/lib/utils/route";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try { return await withProviderCredentials(request, async () => ok(await startBatch(await request.json(), readProviderCredentialsFromRequest(request)), { status: 202 })); }
  catch (error) { return handleRouteError(error); }
}
