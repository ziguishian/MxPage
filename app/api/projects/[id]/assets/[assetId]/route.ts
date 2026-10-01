import { prisma } from "@/lib/db/prisma";
import { assertProjectIdle } from "@/lib/detail-runs/service";
import { deleteAssetRecord } from "@/lib/storage/asset-manager";
import { isStyleReference } from "@/lib/utils/asset-purpose";
import { ok, handleRouteError } from "@/lib/utils/route";

export async function DELETE(_request: Request, { params }: { params: { id: string; assetId: string } }) {
  try {
    await assertProjectIdle(params.id);
    const asset = await prisma.productAsset.findFirstOrThrow({ where: { id: params.assetId, projectId: params.id } });
    if (!isStyleReference(asset)) throw new Error("此入口只用于移除未使用的风格参考。");
    const runs = await prisma.detailRun.findMany({ where: { projectId: params.id }, select: { checkpoint: true } });
    if (runs.some(r => (r.checkpoint as any).styleReferences?.some((ref: any) => ref.id === asset.id))) throw new Error("此参考已用于生成，保留它以支持任务恢复与历史修改。");
    await deleteAssetRecord(asset.id);
    return ok({ deleted: true });
  } catch (error) { return handleRouteError(error); }
}
