import { prisma } from "@/lib/db/prisma";

const runtime = globalThis as typeof globalThis & { assetUploadLocks?: Map<string, Promise<void>> };
const uploads = runtime.assetUploadLocks ??= new Map();
// The app runs a single service. Serialize count + write across concurrent uploads,
// including Next dev module reloads, without holding a database transaction over I/O.
export async function withAssetUploadLock<T>(projectId: string, work: () => Promise<T>): Promise<T> {
  const previous = uploads.get(projectId) || Promise.resolve();
  let release!: () => void;
  const ticket = new Promise<void>(resolve => { release = resolve; });
  const tail = previous.then(() => ticket);
  uploads.set(projectId, tail);
  await previous;
  try { return await work(); }
  finally { release(); if (uploads.get(projectId) === tail) uploads.delete(projectId); }
}

export async function assertNoDetailRun(projectId: string, allowWaiting = false) {
  const active = await prisma.detailRun.findFirst({ where: { projectId, OR: [
    ...(allowWaiting ? [] : [{ status: "WAITING_INPUT" }]),
    { status: { in: ["PENDING", "RUNNING"] }, leaseUntil: { gt: new Date() } },
    { leaseToken: { not: null }, leaseUntil: { gt: new Date() } },
  ] } });
  if (active) throw new Error("详情页任务仍在运行，请停止并等待当前请求结束后再修改。");
}
