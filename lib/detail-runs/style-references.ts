import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import type { ProductAsset } from "@prisma/client";
import { readStorageFile, assetPublicUrl } from "@/lib/storage/asset-manager";
import { isStyleReference } from "@/lib/utils/asset-purpose";
import { referenceCatalog, builtinReferenceUrl, type StyleReference } from "./reference-catalog";

export function selectStyleReferences(assets: ProductAsset[], category: string, direction: string): StyleReference[] {
  const uploads = assets.filter(isStyleReference).slice(0, 2).map(a => ({ id: a.id, source: "upload" as const, title: a.fileName, reason: "用户指定的视觉参考；仅借鉴摄影、颜色和排版。", url: assetPublicUrl(a)! }));
  const ranked = [...referenceCatalog].map((r, index) => ({ r, index, score: (r.categories as readonly string[]).includes(category) ? 10 : 0 })).map(item => ({ ...item, score: item.score + item.r.keywords.split(" ").filter(k => direction.includes(k)).length * 2 })).sort((a, b) => b.score - a.score || a.index - b.index);
  return [...uploads, ...ranked.slice(0, 2 - uploads.length).map(({ r }) => ({ id: r.id, source: "builtin" as const, title: r.title, reason: `${r.photography}；${r.layout}。${r.lesson}。`, url: builtinReferenceUrl(r.id), expressions: r.expressions }))];
}

export async function styleReferenceImage(reference: StyleReference, assets: ProductAsset[]) {
  let bytes: Buffer;
  if (reference.source === "upload") {
    const asset = assets.find(a => a.id === reference.id && isStyleReference(a));
    if (!asset) throw new Error("风格参考已失效，请恢复参考素材后继续。");
    bytes = await readStorageFile(asset.filePath);
  } else {
    if (!referenceCatalog.some(r => r.id === reference.id)) throw new Error("未知的内置风格参考。");
    bytes = await fs.readFile(path.join(process.cwd(), "public", "ecommerce-references", `${reference.id}.jpg`));
  }
  const image = await sharp(bytes).rotate().resize({ width: 1200, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  return `data:image/jpeg;base64,${image.toString("base64")}`;
}
