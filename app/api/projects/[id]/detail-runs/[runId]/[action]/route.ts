import { NextRequest } from "next/server";
import { controlDetailRun } from "@/lib/detail-runs/service";
import { withProviderCredentials, readProviderCredentialsFromRequest } from "@/lib/services/provider-runtime";
import { fail, handleRouteError, ok } from "@/lib/utils/route";
export async function POST(request: NextRequest, { params }: { params: { id: string; runId: string; action: string } }) {
  if (params.action !== "answers" && params.action !== "resume" && params.action !== "cancel") return fail("NOT_FOUND", "Unknown action", null, 404);
  const action = params.action;
  try { return await withProviderCredentials(request, async () => ok(await controlDetailRun(params.id, params.runId, action, await request.json(), readProviderCredentialsFromRequest(request)))); }
  catch (error) { return handleRouteError(error); }
}
