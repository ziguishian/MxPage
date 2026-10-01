import sharp from "sharp";
import { prisma } from "@/lib/db/prisma";
import { readStorageFile } from "@/lib/storage/asset-manager";

export async function stitchDetailImages(buffers: Buffer[]) {
  if (!buffers.length) throw new Error("没有可导出的详情图片。");
  const overlays: { input: Buffer; top: number; left: number }[] = [];
  let height = 0;
  for (const buffer of buffers) {
    const image = await sharp(buffer, { limitInputPixels: 40000000 }).rotate().resize({ width: 1080 }).png().toBuffer({ resolveWithObject: true });
    overlays.push({ input: image.data, top: height, left: 0 });
    height += image.info.height;
    if (height > 50000) throw new Error("长图高度超过 50000px，请下载分图 ZIP。");
  }
  return sharp({ create: { width: 1080, height, channels: 4, background: "white" } }).composite(overlays).png().toBuffer();
}

export async function exportLongImage(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { sections: { orderBy: { order: "asc" }, include: { currentImageAsset: true } } } });
  const details = project.sections.filter(s => s.type !== "HERO");
  const preview = (project.modelSnapshot as { previewConfig?: { detailSectionCount?: number } } | null)?.previewConfig;
  if (!details.length || details.some(s => !s.currentImageAsset) || (preview?.detailSectionCount && details.length < preview.detailSectionCount)) throw new Error("详情图片尚未补齐，请完成生成后下载完整长图；已有图片可下载 ZIP。");
  return stitchDetailImages(await Promise.all(details.map(s => readStorageFile(s.currentImageAsset!.filePath))));
}
