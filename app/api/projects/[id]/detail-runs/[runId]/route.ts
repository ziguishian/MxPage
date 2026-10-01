import { NextRequest } from "next/server";
import { getDetailRun } from "@/lib/detail-runs/service";
import { handleRouteError, ok } from "@/lib/utils/route";
export const dynamic = "force-dynamic";
export async function GET(_request: NextRequest, { params }: { params: { id: string; runId: string } }) {
  try { return ok(await getDetailRun(params.id, params.runId)); } catch (error) { return handleRouteError(error); }
}
