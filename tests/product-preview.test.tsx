import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { imageReview, ProductPhonePreview, type PreviewSection } from "../components/editor/product-phone-preview";

test("phone renders only current section images in order, without invented sales data", () => {
  const sections: PreviewSection[] = [
    { id: "hero", type: "HERO", title: "Cover", order: 0, imageUrl: "/active-hero.png" },
    { id: "detail-a", type: "CUSTOM", title: "First", order: 1, imageUrl: "/active-detail.png" },
    { id: "detail-b", type: "CUSTOM", title: "Second", order: 2 },
  ];
  const html = renderToStaticMarkup(<ProductPhonePreview name="Product" platform="通用电商" sections={sections} progress={[]} selected="hero" onSelect={() => {}} onExpand={() => {}}/>);
  assert.match(html, /\/active-hero.png/);
  assert.match(html, /\/active-detail.png/);
  assert.match(html, /等待生成/);
  assert.ok(html.indexOf('查看详情图：First') < html.indexOf('查看详情图：Second'));
  assert.doesNotMatch(html.replace(/<[^>]*>/g, ""), /39\.90|4\.9|真实反馈/);
  assert.doesNotMatch(html, /object-cover|max-h-\[1000px\]/);
  assert.match(html, /加入购物车/);
  assert.match(html, /暂无真实评价数据/);
  assert.match(html, /mx-taobao-viewport/);
});

test("review belongs to the active image version, survives unrelated runs, ignores stale checks", () => {
  const failed = { passed: false, issues: ["Unreadable label"], assetId: "old" };
  const section: PreviewSection = { id: "a", type: "CUSTOM", title: "A", order: 0, currentImageAssetId: "new", currentImageAsset: { metadata: { visualCheck: failed } } };
  const stale = [{ sectionId: "a", title: "A", state: "checked" as const, assetId: "old", correctionCount: 0, check: failed }];
  assert.equal(imageReview(section, stale), undefined);
  section.currentImageAssetId = "old";
  assert.deepEqual(imageReview(section, []), failed);
  assert.deepEqual(imageReview(section, stale), failed);
});
