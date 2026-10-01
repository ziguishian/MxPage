import { NextRequest } from "next/server";
import { resolveAgentConnection } from "@/lib/detail-runs/provider";
import { withProviderCredentials } from "@/lib/services/provider-runtime";
import { handleRouteError, ok } from "@/lib/utils/route";
export async function POST(request: NextRequest) {
  try { return await withProviderCredentials(request, async () => {
    const { baseUrl, modelId, transport } = await resolveAgentConnection(true);
    return ok({ baseUrl, modelId, transport, compatible: true });
  }); } catch (error) { return handleRouteError(error); }
}
