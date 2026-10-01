import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assetPublicUrl } from "@/lib/storage/asset-manager";
import { runWithProviderCredentials, type RequestProviderCredentials } from "@/lib/services/provider-runtime";
import { createDetailRun, controlDetailRun, getDetailRun } from "./service";
import { detailRunInputSchema } from "./contracts";
import { resolveAgentConnection } from "./provider";
import { contentLanguageOptions, type ContentLanguage } from "@/lib/utils/content-language";
import { prepareTranslationProject, translationProjectId } from "./translation";
import { isStyleReference } from "@/lib/utils/asset-purpose";

export const batchInputSchema = z.object({
  id: z.string().uuid(),
  projectIds: z.array(z.string().min(1)).min(1).max(50).refine(ids => new Set(ids).size === ids.length),
  options: detailRunInputSchema.pick({ language: true, quality: true, heroCount: true, detailCount: true }),
  translations: z.array(z.enum(contentLanguageOptions)).min(1).max(10).refine(values => new Set(values).size === values.length).optional(),
  translationInstruction: z.string().max(4000).optional(),
});
type BatchInput = z.infer<typeof batchInputSchema> & { workflow: "detail-batch-v1" };
type Item = { projectId: string; sourceProjectId?: string; language?: ContentLanguage; runId?: string; status: string; message: string };
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const state = globalThis as typeof globalThis & { detailBatchWorkers?: Set<string> };
const workers = state.detailBatchWorkers ??= new Set();
const systemId = "mxpage-detail-batch-system";
const pause = () => new Promise(resolve => setTimeout(resolve, 500));

async function findBatch(id: string) {
  const task = await prisma.generationTask.findUniqueOrThrow({ where: { id } });
  if ((task.inputPayload as unknown as BatchInput)?.workflow !== "detail-batch-v1") throw new Error("批量任务不存在。");
  return task;
}
export async function getBatch(id: string) {
  let task = await findBatch(id);
  if (["PENDING", "RUNNING"].includes(task.status) && task.updatedAt.getTime() < Date.now() - 60000) {
    await prisma.generationTask.updateMany({ where: { id, status: task.status, updatedAt: task.updatedAt }, data: { status: "FAILED", errorMessage: "任务已中断，点击继续可恢复未完成商品。" } });
    task = await findBatch(id);
  }
  const items = (task.outputPayload as unknown as { items: Item[] }).items;
  // Read status first so COMPLETED never accompanies an older image snapshot.
  const runs = await prisma.detailRun.findMany({ where: { id: { in: items.flatMap(i => i.runId ? [i.runId] : []) } } });
  const projects = await prisma.project.findMany({ where: { id: { in: items.flatMap(i => [i.projectId, ...(i.sourceProjectId ? [i.sourceProjectId] : [])]) } }, include: { sections: { orderBy: { order: "asc" }, include: { currentImageAsset: true } } } });
  const visibleItems = items.map(item => {
    const project = projects.find(p => p.id === item.projectId);
    const run = runs.find(r => r.id === item.runId);
    return { ...item, ready: Boolean(project), status: run?.status || item.status, message: run?.stage || item.message, name: project?.name || projects.find(p => p.id === item.sourceProjectId)?.name || "商品已删除", images: project?.sections.filter(s => s.currentImageAsset).map(s => ({ id: s.id, type: s.type, url: assetPublicUrl(s.currentImageAsset) })) || [] };
  });
  const allDone = visibleItems.every(i => i.status === "COMPLETED");
  return { id, status: allDone ? "SUCCESS" : task.status, error: allDone ? null : task.errorMessage, items: visibleItems };
}
export async function startBatch(raw: unknown, credentials: RequestProviderCredentials) {
  const parsed = batchInputSchema.parse(raw);
  const input: BatchInput = { ...parsed, workflow: "detail-batch-v1" };
  const existing = await prisma.generationTask.findUnique({ where: { id: input.id } });
  if (existing) {
    if (JSON.stringify(existing.inputPayload) !== JSON.stringify(input)) throw new Error("此批次标识已用于其他配置。");
    return getBatch(input.id);
  }
  const projects = await prisma.project.findMany({ where: { id: { in: input.projectIds } }, include: { assets: { where: { type: { in: ["MAIN", "ANGLE", "DETAIL", "REFERENCE"] } } } } });
  const maxAssets = input.translations ? 30 : 8;
  if (projects.length !== input.projectIds.length || projects.some(p => { const count = p.assets.filter(a => !isStyleReference(a)).length; return count < 1 || count > maxAssets; })) throw new Error(`每套须上传 1–${maxAssets} 张素材后再开始。`);
  await resolveAgentConnection();
  await prisma.project.upsert({ where: { id: systemId }, create: { id: systemId, name: "详情页批量任务", platform: "__mxpage_system_task__", style: "system" }, update: {} });
  try {
    const items: Item[] = input.projectIds.flatMap(sourceId => input.translations ? input.translations.map(language => ({ projectId: translationProjectId(input.id, sourceId, language), sourceProjectId: sourceId, language, status: "QUEUED", message: "等待翻译" })) : [{ projectId: sourceId, status: "QUEUED", message: "等待生成" }]);
    await prisma.generationTask.create({ data: { id: input.id, projectId: systemId, taskType: "BATCH_CREATE", inputPayload: json(input), outputPayload: json({ items }) } });
  } catch (error) {
    if (!await prisma.generationTask.findUnique({ where: { id: input.id } })) throw error;
    return startBatch(raw, credentials);
  }
  launch(input.id, credentials);
  return getBatch(input.id);
}
export async function controlBatch(id: string, action: "cancel" | "resume", credentials: RequestProviderCredentials) {
  const task = await findBatch(id);
  const items = (task.outputPayload as unknown as { items: Item[] }).items;
  if (action === "cancel") {
    await prisma.generationTask.updateMany({ where: { id, status: { in: ["PENDING", "RUNNING"] } }, data: { status: "CANCELED" } });
    for (const item of items.filter(i => i.runId && i.status === "RUNNING")) await controlDetailRun(item.projectId, item.runId!, "cancel", {}, credentials);
  } else {
    await getBatch(id);
    if (workers.has(id)) throw new Error("当前批次仍在结束，请稍后再继续。");
    await resolveAgentConnection();
    const claimed = await prisma.generationTask.updateMany({ where: { id, status: { in: ["FAILED", "CANCELED"] } }, data: { status: "PENDING", errorMessage: null } });
    if (claimed.count) launch(id, credentials);
  }
  return getBatch(id);
}
function launch(id: string, credentials: RequestProviderCredentials) {
  if (workers.has(id)) return;
  workers.add(id);
  void runWithProviderCredentials(credentials, () => execute(id, credentials)).catch(async () => {
    await prisma.generationTask.updateMany({ where: { id, status: { in: ["PENDING", "RUNNING"] } }, data: { status: "FAILED", errorMessage: "批量任务中断，可继续处理剩余商品。" } });
  }).finally(() => workers.delete(id));
}
async function execute(id: string, credentials: RequestProviderCredentials) {
  const claimed = await prisma.generationTask.updateMany({ where: { id, status: "PENDING" }, data: { status: "RUNNING", startedAt: new Date() } });
  if (!claimed.count) return;
  const task = await findBatch(id);
  const input = task.inputPayload as unknown as BatchInput;
  const items = (task.outputPayload as unknown as { items: Item[] }).items;
  const heartbeat = setInterval(() => { void prisma.generationTask.updateMany({ where: { id, status: "RUNNING" }, data: { updatedAt: new Date() } }).catch(() => undefined); }, 15000);
  const active = async () => (await findBatch(id)).status === "RUNNING";
  const save = () => prisma.generationTask.update({ where: { id }, data: { outputPayload: json({ items }) } });
  try {
    for (const item of items) {
      if (!await active()) break;
      if (["COMPLETED", "PARTIAL", "WAITING_INPUT"].includes(item.status) || (item.status === "FAILED" && item.runId)) continue;
      try {
        item.status = "RUNNING"; item.message = item.language ? "准备独立语言版本" : "理解商品并规划详情页"; await save();
        if (item.sourceProjectId && item.language) await prepareTranslationProject(item.projectId, item.sourceProjectId, item.language, input.options.quality);
        if (!await active()) break;
        // Deterministic child key recovers a run even if the parent crashed before saving its id.
        const key = `batch:${id}`;
        const known = await prisma.detailRun.findUnique({ where: { projectId_idempotencyKey: { projectId: item.projectId, idempotencyKey: key } } });
        let run = known ? await getDetailRun(item.projectId, known.id) : await createDetailRun(item.projectId, { ...input.options, ...(item.language ? { language: item.language, mode: "translate", instruction: input.translationInstruction || "" } : {}), idempotencyKey: key }, credentials);
        if (!run) throw new Error("子任务未创建。");
        item.runId = run.id; await save();
        if (!await active()) { await controlDetailRun(item.projectId, run.id, "cancel", {}, credentials); break; }
        if (["INTERRUPTED", "CANCELED"].includes(run.status)) run = await controlDetailRun(item.projectId, run.id, "resume", {}, credentials);
        while (run && ["PENDING", "RUNNING"].includes(run.status)) {
          if (!await active()) { await controlDetailRun(item.projectId, run.id, "cancel", {}, credentials); break; }
          item.message = run.stage; await save(); await pause();
          run = await getDetailRun(item.projectId, run.id);
        }
        if (!await active()) break;
        item.status = run?.status || "FAILED";
        item.message = run?.stage || "子任务不可用";
      } catch (error) {
        item.status = "FAILED";
        item.message = error instanceof Error ? error.message : "生成失败，请打开商品处理";
      }
      await save();
    }
    if (await active()) {
      const complete = items.every(i => i.status === "COMPLETED");
      await prisma.generationTask.updateMany({ where: { id, status: "RUNNING" }, data: { status: complete ? "SUCCESS" : "FAILED", completedAt: new Date(), errorMessage: complete ? null : "批次已处理，部分商品需要补充信息或检查，请打开对应作品。" } });
    }
  } finally { clearInterval(heartbeat); }
}
