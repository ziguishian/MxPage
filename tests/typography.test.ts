import test from "node:test";
import assert from "node:assert/strict";
import { typesettingSchema, validateTypesetting } from "../lib/detail-runs/typography";
import { artDirectionSchema } from "../lib/detail-runs/art-direction";
import { flexibleFixture, intentFixture } from "./flexible-creative-fixture";
import { applyFlexibleReview, compileCreativePrompt, normalizeIntentPlan, validateFlexibleDirection } from "../lib/detail-runs/flexible-creative";

const targets = Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, kind: i < 3 ? "HERO" : "DETAIL" }));
const plan = normalizeIntentPlan(intentFixture());
const type = (lines: string[]) => typesettingSchema.parse({ lines, x: 7, y: 8, width: 70, fontSize: 32, weight: "semibold", lineHeight: 1.15, align: "left" });

test("planned line breaks survive storage and reach exact-copy image instructions", () => {
  const d = flexibleFixture(targets), b = d.sections[0].textBlocks[0];
  b.text = "给日常桌面，添一抹亮色";
  b.typesetting = type(["给日常桌面，", "添一抹亮色"]);
  const saved = artDirectionSchema.parse(JSON.parse(JSON.stringify(d)));
  assert.deepEqual(validateFlexibleDirection(saved, targets, plan, []), []);
  const prompt = compileCreativePrompt(plan, plan.sections[0], saved, saved.sections[0]);
  const exact = prompt.split("\n").find(line => line.startsWith("EXACT FINAL VISIBLE COPY"))!;
  assert.ok(exact.includes(JSON.stringify(b.typesetting)));
  assert.match(prompt, /375px-wide 375px-high/);
  assert.match(prompt, /TOP LEFT/);
  assert.match(prompt, /not every line/);
});

test("typesetting cannot silently change copy, punctuation, parameter units or canvas bounds", () => {
  const block = { text: "重量300g", role: "support", size: "body", typesetting: type(["重量", "300g"]) };
  assert.deepEqual(validateTypesetting([block], "DETAIL", "spec"), []);
  for (const lines of [["净含量300g"], ["重量300kg"], ["重量300g。"]]) {
    block.typesetting.lines = lines;
    assert.ok(validateTypesetting([block], "DETAIL", "spec").some(s => s.includes("exact text")));
  }
  block.typesetting = { ...type(["重量300g"]), x: 80, width: 30, y: 99 };
  const issues = validateTypesetting([block], "DETAIL", "spec");
  assert.ok(issues.some(s => s.includes("right canvas")));
  assert.ok(issues.some(s => s.includes("bottom canvas")));
  assert.equal(typesettingSchema.safeParse({ ...type(["text"]), fontSize: 7 }).success, false);
});

test("typography review must make a real local text/layout repair", () => {
  const d = flexibleFixture(targets), section = structuredClone(d.sections[0]);
  const review = { passed: false, issues: [{ sectionIds: ["s0"], kind: "typography" as const, message: "标题拥挤，应按语义分行并降低字重" }], changes: [] as Array<{ section: typeof section; reason: string; factIds: string[] }> };
  assert.ok(applyFlexibleReview(d, review, plan, targets, []).errors.some(s => s.includes("flagged typography")));
  review.changes = [{ section, reason: "调整字块而保留信息", factIds: [] }];
  section.camera = "Change the viewpoint without touching any text";
  assert.ok(applyFlexibleReview(d, review, plan, targets, []).errors.some(s => s.includes("no-op")));
  section.textBlocks[0].typesetting = type([section.textBlocks[0].text]);
  const result = applyFlexibleReview(d, review, plan, targets, []);
  assert.deepEqual(result.errors, []);
  assert.equal(result.issues[0].resolved, true);
  assert.deepEqual(result.direction.sections.slice(1), d.sections.slice(1));
});

test("specifications use table typography; photography and old checkpoints stay compatible", () => {
  const d = flexibleFixture(targets);
  const spec = compileCreativePrompt(plan, plan.sections[6], d, d.sections[6]);
  assert.match(spec, /PARAMETER TABLE:.*comparable 14-17px/);
  assert.match(spec, /every supplied row and size-chart cell/);
  assert.match(spec, /375px-wide 500px-high/);
  const photo = compileCreativePrompt(plan, plan.sections[1], d, d.sections[1]);
  assert.ok(!photo.includes("TYPESETTING EXECUTION"));
  assert.ok(!photo.includes("fontSize"));
  assert.deepEqual(validateFlexibleDirection(artDirectionSchema.parse(d), targets, plan, []), []);
});

test("durian inspection headings need buyer copy; labels and exact user wording remain valid", () => {
  for (const text of ["先看果肉形态", "选购时先看果肉形态", "外壳与剖面，都是选购参考"]) {
    const d = flexibleFixture(targets), b = d.sections[0].textBlocks[0]; b.text = text;
    assert.ok(validateFlexibleDirection(d, targets, plan, []).some(s => s.includes("appearance-report")));
    b.role = "label";
    assert.deepEqual(validateFlexibleDirection(d, targets, plan, []), []);
    b.role = "headline"; b.origin = "user_required"; d.sections[0].requirementIds = ["literal"];
    const required = { ...plan, requirements: [{ id: "literal", kind: "exact_copy" as const, text, sourceQuote: text }] };
    assert.deepEqual(validateFlexibleDirection(d, targets, required, []), []);
  }
});
