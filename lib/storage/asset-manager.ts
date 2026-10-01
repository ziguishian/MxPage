import fs from "fs/promises";
import path from "path";

import type { AssetType, ProductAsset } from "@prisma/client";
import { nanoid } from "nanoid";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/utils/env";
import { extFromMime, relativeStorageUrl, sanitizeFileName } from "@/lib/utils/files";

function rootDir() {
  return path.resolve(process.cwd(), env.STORAGE_ROOT);
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function ensureStorageScaffold() {
  await Promise.all([
    ensureDir(path.join(rootDir(), "uploads")),
    ensureDir(path.join(rootDir(), "generated")),
    ensureDir(path.join(rootDir(), "exports")),
  ]);
}

function projectDir(projectId: string, kind: "uploads" | "generated" | "exports", sectionId?: string) {
  const base = path.join(rootDir(), kind, projectId);
  return sectionId ? path.join(base, sectionId) : base;
}

export async function saveUploadAsset(params: {
  projectId: string;
  type: AssetType;
  fileName: string;
  mimeType?: string | null;
  fileBuffer: Buffer;
  sortOrder: number;
  isMain?: boolean;
  purpose?: "product_identity" | "style_reference";
}) {
  await ensureStorageScaffold();
  const safeName = `${Date.now()}-${nanoid(6)}-${sanitizeFileName(params.fileName)}`;
  const dir = projectDir(params.projectId, "uploads");
  await ensureDir(dir);
  const relativePath = path.join("uploads", params.projectId, safeName);
  await fs.writeFile(path.join(rootDir(), relativePath), params.fileBuffer);

  return prisma.productAsset.create({
    data: {
      projectId: params.projectId,
      type: params.type,
      filePath: relativePath,
      fileName: params.fileName,
      mimeType: params.mimeType,
      sortOrder: params.sortOrder,
      isMain: params.isMain ?? false,
      metadata: {
        bytes: params.fileBuffer.byteLength,
        ...(params.purpose ? { purpose: params.purpose } : {}),
      },
    },
  });
}

export async function saveGeneratedImage(params: {
  projectId: string;
  sectionId: string;
  prompt: string;
  source: {
    url?: string | null;
    b64Json?: string | null;
    svgText?: string | null;
    mimeType?: string | null;
  };
  metadata?: Record<string, unknown>;
}) {
  await ensureStorageScaffold();
  const dir = projectDir(params.projectId, "generated", params.sectionId);
  await ensureDir(dir);

  const mimeType =
    params.source.svgText ? "image/svg+xml" : params.source.mimeType ?? "image/png";
  const ext = extFromMime(mimeType);
  const fileName = `${Date.now()}-${nanoid(6)}.${ext}`;
  const relativePath = path.join("generated", params.projectId, params.sectionId, fileName);
  const absolutePath = path.join(rootDir(), relativePath);

  if (params.source.svgText) {
    await fs.writeFile(absolutePath, params.source.svgText, "utf8");
  } else if (params.source.b64Json) {
    await fs.writeFile(absolutePath, Buffer.from(params.source.b64Json, "base64"));
  } else if (params.source.url) {
    const response = await fetch(params.source.url);
    if (!response.ok) {
      throw new Error(`Failed to download generated image: ${response.status}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(absolutePath, bytes);
  } else {
    throw new Error("Image generation produced no usable image output.");
  }

  return prisma.productAsset.create({
    data: {
      projectId: params.projectId,
      sectionId: params.sectionId,
      type: "GENERATED",
      filePath: relativePath,
      fileName,
      mimeType,
      sortOrder: 0,
      metadata: {
        prompt: params.prompt,
        ...(params.metadata ?? {}),
      },
    },
  });
}

export async function duplicateExportFile(params: {
  projectId: string;
  fileName: string;
  sourceBuffer: Buffer;
  mimeType: string;
}) {
  await ensureStorageScaffold();
  const ext = extFromMime(params.mimeType);
  const safeName = sanitizeFileName(`${params.fileName}.${ext}`);
  const relativePath = path.join("exports", params.projectId, safeName);
  await ensureDir(projectDir(params.projectId, "exports"));
  await fs.writeFile(path.join(rootDir(), relativePath), params.sourceBuffer);

  return prisma.productAsset.create({
    data: {
      projectId: params.projectId,
      type: "EXPORTED",
      filePath: relativePath,
      fileName: safeName,
      mimeType: params.mimeType,
      sortOrder: 0,
    },
  });
}

export async function deleteAssetRecord(assetId: string) {
  const asset = await prisma.productAsset.findUnique({ where: { id: assetId } });
  if (!asset) {
    return null;
  }

  const absolutePath = path.join(rootDir(), asset.filePath);
  await fs.rm(absolutePath, { force: true });
  await prisma.productAsset.delete({ where: { id: assetId } });
  return asset;
}

export function assetPublicUrl(asset: Pick<ProductAsset, "filePath"> | null | undefined) {
  if (!asset) {
    return null;
  }

  return relativeStorageUrl(asset.filePath);
}

export async function readStorageFile(relativePath: string) {
  return fs.readFile(path.join(rootDir(), relativePath));
}

export async function statStorageFile(relativePath: string) {
  return fs.stat(path.join(rootDir(), relativePath));
}
