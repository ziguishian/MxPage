import test from "node:test";
import assert from "node:assert/strict";
import { groupProductFiles } from "../lib/detail-runs/batch-files";
const file = (path: string, size = 1024) => ({ name: path.split("/").at(-1)!, webkitRelativePath: path, size, type: "image/png" });
test("flat directory maps each image to a separate product with natural ordering", () => {
  const result = groupProductFiles([file("root/10.png"), file("root/2.png"), file("root/notes.txt")]);
  assert.equal(result.ignored, 1);
  assert.deepEqual(result.groups.map(g => [g.name, g.files.length]), [["2", 1], ["10", 1]]);
});
test("subfolders keep multiview products separate, including deeper view folders and loose root files", () => {
  const result = groupProductFiles([file("root/B/front.png"), file("root/A/views/2.png"), file("root/A/1.png"), file("root/loose.png")]);
  assert.equal(result.groups.length, 3);
  const a = result.groups.find(g => g.name === "A")!;
  assert.equal(a.files.length, 2);
  assert.equal(a.files[0].name, "1.png");
  assert.equal(result.groups.find(g => g.name === "B")!.files.length, 1);
});
test("unsupported files are ignored; excessive images, products and bytes are rejected, never silently truncated", () => {
  assert.equal(groupProductFiles([file("root/readme.md")]).groups.length, 0);
  assert.throws(() => groupProductFiles([file("root/big.png", 10 * 1024 * 1024 + 1)]), /10MB/);
  assert.throws(() => groupProductFiles(Array.from({ length: 9 }, (_, i) => file(`root/A/${i}.png`))), /最多 8/);
  assert.throws(() => groupProductFiles(Array.from({ length: 51 }, (_, i) => file(`root/${i}.png`))), /50/);
});
test("translation folders allow up to thirty ordered detail images per set", () => {
  const images = Array.from({ length: 30 }, (_, i) => file(`root/product/${i+1}.png`));
  const result = groupProductFiles(images, 30);
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].files.length, 30);
  assert.equal(result.groups[0].files[9].name, "10.png");
  assert.throws(() => groupProductFiles([...images, file("root/product/31.png")], 30), /30/);
});
