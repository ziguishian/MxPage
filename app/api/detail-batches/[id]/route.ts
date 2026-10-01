import { NextRequest } from "next/server";
import { z } from "zod";
import { getBatch, controlBatch } from "@/lib/detail-runs/batch";
import { readProviderCredentialsFromRequest, withProviderCredentials } from "@/lib/services/provider-runtime";
import { handleRouteError, ok } from "@/lib/utils/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try { return ok(await getBatch(params.id)); } catch (error) { return handleRouteError(error); }
}
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try { const { action } = z.object({ action: z.enum(["cancel", "resume"]) }).parse(await request.json()); return await withProviderCredentials(request, async () => ok(await controlBatch(params.id, action, readProviderCredentialsFromRequest(request)))); }
  catch (error) { return handleRouteError(error); }
}
