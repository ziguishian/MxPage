import { NextRequest } from "next/server";
import { z } from "zod";
import { prepareBrief } from "@/lib/detail-runs/brief";
import { BriefPreparationError } from "@/lib/detail-runs/brief-recovery";
import { withProviderCredentials } from "@/lib/services/provider-runtime";
import { fail, handleRouteError, ok } from "@/lib/utils/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const options = z.object({ force: z.boolean().optional(), resume: z.boolean().optional() }).parse(await request.json().catch(() => ({})));
    return await withProviderCredentials(request, async () => ok(await prepareBrief(params.id, options)));
  }
  catch (error) {
    if (error instanceof BriefPreparationError) return fail(error.code, error.message, undefined, error.status);
    return handleRouteError(error);
  }
}
