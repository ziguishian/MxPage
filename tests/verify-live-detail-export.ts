// Read-only acceptance checks plus local exports; never starts paid model requests.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import sharp from "sharp";
import { stitchDetailImages } from "../lib/detail-runs/long-image";

async function main() {
  const [projectId, outputDirectory] = process.argv.slice(2);
  assert.ok(projectId && outputDirectory, "Usage: tsx tests/verify-live-detail-export.ts PROJECT_ID OUTPUT_DIRECTORY");
  const base = `http://127.0.0.1:3000/api/projects/${encodeURIComponent(projectId)}`;
  const runPayload = await (await fetch(`${base}/detail-runs`)).json();
  const projectPayload = await (await fetch(base)).json();
  assert.equal(runPayload.success, true); assert.equal(projectPayload.success, true);
  const run = runPayload.data, project = projectPayload.data;
  assert.ok(["COMPLETED", "PARTIAL"].includes(run.status), `Run must have finished, got ${run.status}`);
  const heroes = project.sections.filter((s: any) => s.type === "HERO");
  const details = project.sections.filter((s: any) => s.type !== "HERO");
  assert.equal(heroes.length, run.input.heroCount);
  assert.equal(details.length, run.input.detailCount);
  assert.ok(project.sections.every((s: any) => s.imageUrl && s.currentImageAssetId), "All planned images must be present");
  const output = path.resolve(outputDirectory); await mkdir(output, { recursive: true });
  const zipResponse = await fetch(`${base}/export/images`); assert.equal(zipResponse.status, 200);
  const zip = Buffer.from(await zipResponse.arrayBuffer());
  const entries = new Map<string, Buffer>();
  const yauzl = createRequire(import.meta.url)("yauzl");
  await new Promise<void>((resolve, reject) => yauzl.fromBuffer(zip, { lazyEntries: true }, (error: Error | null, archive: any) => {
    if (error) return reject(error);
    archive.on("error", reject); archive.on("end", resolve);
    archive.on("entry", (entry: any) => archive.openReadStream(entry, (error: Error | null, stream: any) => {
      if (error) return reject(error);
      const chunks: Buffer[] = []; stream.on("data", (chunk: Buffer) => chunks.push(chunk)); stream.on("error", reject);
      stream.on("end", () => { entries.set(entry.fileName, Buffer.concat(chunks)); archive.readEntry(); });
    })); archive.readEntry();
  }));
  const manifest = JSON.parse(entries.get("export-manifest.json")!.toString("utf8"));
  assert.equal(manifest.heroImageCount, heroes.length); assert.equal(manifest.detailImageCount, details.length);
  assert.equal(entries.size, project.sections.length + 1);
  const dimensions = [];
  for (const [index, section] of [...heroes, ...details].entries()) {
    const activeVersions = section.versions.filter((version: any) => version.isActive);
    assert.equal(activeVersions.length, 1);
    assert.equal(activeVersions[0].imageAssetId, section.currentImageAssetId);
    const entry = index < heroes.length ? manifest.gallery[index] : manifest.details[index - heroes.length];
    const bytes = entries.get(entry.zipPath)!;
    const assetUrl = new URL(section.imageUrl, base);
    assert.equal(assetUrl.origin, new URL(base).origin);
    const currentBytes = Buffer.from(await (await fetch(assetUrl)).arrayBuffer());
    assert.deepEqual(bytes, currentBytes, "ZIP must contain the current effective version in order");
    const meta = await sharp(bytes).metadata();
    assert.ok(meta.width && meta.height);
    dimensions.push({ title: section.title, type: section.type, width: meta.width, height: meta.height });
  }
  const longResponse = await fetch(`${base}/export/long-image`); assert.equal(longResponse.status, 200);
  const long = Buffer.from(await longResponse.arrayBuffer());
  const longMetadata = await sharp(long).metadata();
  assert.equal(longMetadata.width, 1080);
  assert.deepEqual(long, await stitchDetailImages(manifest.details.map((d: any) => entries.get(d.zipPath)!)), "Long image must exactly match ordered ZIP detail images");
  const result = {
    projectId, runId: run.id, status: run.status, verifiedAt: new Date().toISOString(),
    heroCount: heroes.length, detailCount: details.length, dimensions,
    longImage: { width: longMetadata.width, height: longMetadata.height },
    zipEntries: entries.size, currentVersionsMatch: true, zipAndLongMatch: true,
    totalVersions: project.sections.reduce((total: number, section: any) => total + section.versions.length, 0),
    corrections: run.checkpoint.images.map((i: any) => ({ title: i.title, correctionCount: i.correctionCount, check: i.check })),
  };
  await writeFile(path.join(output, "charger-detail.png"), long);
  await writeFile(path.join(output, "charger-images.zip"), zip);
  await writeFile(path.join(output, "export-verification.json"), JSON.stringify(result, null, 2), "utf8");
  console.log(JSON.stringify(result, null, 2));
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
