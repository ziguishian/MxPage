import test from "node:test";
import assert from "node:assert/strict";
import { applyCreativeReview, creativeReviewSchema, type CreativeReview } from "../lib/detail-runs/design-review";
import { currentArtDirectionSchema, validateArtDirection, compileArtPrompt, productViewRules } from "../lib/detail-runs/art-direction";
import { artDirectionFixture } from "./art-direction-fixture";
import { commercePlanFixture } from "./commerce-plan-fixture";
import { contentPlanningGuide, commerceContentModules } from "../lib/detail-runs/merchandising";

const plan = commercePlanFixture();
const targets = plan.sections.map((s, i) => ({ id: `frame-${i}`, kind: s.kind, copy: s.copy }));
const direction = currentArtDirectionSchema.parse(artDirectionFixture(targets, 2));
const review: CreativeReview = { passed: false, issues: [{ sectionIds: [targets[0].id], kind: "fact", message: "以有依据的信息替换未证实的广告语" }], patches: [{ sectionId: targets[0].id, field: "text", textBlockIndex: 0, before: direction.sections[0].textBlocks[0].text, after: "色彩，让日常更鲜明", factIds: [plan.evidence[0].id] }] };

test("local factual repair preserves all frames, block counts, buyer tasks and unaffected fields", () => {
  const original = structuredClone(direction);
  const result = applyCreativeReview(direction, review, plan.evidence.map(e => e.id));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(direction, original, "original draft stays intact for inspection");
  const expected = structuredClone(direction);
  expected.sections[0].textBlocks[0].text = review.patches[0].after;
  assert.deepEqual(result.direction, expected, "only the exact disputed field changes");
  assert.equal(result.issues[0].resolved, true);
  assert.ok(compileArtPrompt(plan, plan.sections[0], result.direction, result.direction.sections[0]).includes(review.patches[0].after));
});

test("review cannot delete text, patch unrelated frames, invent evidence or leave factual issues unaddressed", () => {
  assert.equal(creativeReviewSchema.safeParse({ ...review, patches: [{ ...review.patches[0], after: "  " }] }).success, false);
  for (const invalid of [
    { ...review, patches: [] },
    { ...review, patches: [{ ...review.patches[0], sectionId: targets[1].id }] },
    { ...review, patches: [{ ...review.patches[0], factIds: ["style-reference"] }] },
    { ...review, patches: [{ ...review.patches[0], before: "not the actual text" }] },
    { ...review, patches: [{ ...review.patches[0], textBlockIndex: 12 }] },
    { ...review, patches: [review.patches[0], review.patches[0]] },
  ]) assert.ok(applyCreativeReview(direction, invalid, plan.evidence.map(e => e.id)).errors.length > 0);
  const warning = applyCreativeReview(direction, { passed: false, issues: [{ sectionIds: [targets[0].id], kind: "design", message: "可进一步优化排版" }], patches: [] }, []);
  assert.deepEqual(warning.errors, []);
  assert.deepEqual(warning.direction, direction);
  assert.equal(warning.issues[0].resolved, false);
});

test("new storyboards plan actual angle diversity; old saved storyboards stay valid", () => {
  assert.deepEqual(validateArtDirection(direction, targets), []);
  const identical = structuredClone(direction);
  identical.sections.forEach(s => { s.viewpoint = "front"; });
  assert.ok(validateArtDirection(identical, targets).some(i => i.includes("camera viewpoints")));
  assert.match(productViewRules, /three-quarter view is a real oblique camera view/);
  assert.ok(!productViewRules.includes("mild front-dominant"));
  assert.ok(compileArtPrompt(plan, plan.sections[0], direction, direction.sections[0]).includes("VIEWPOINT: three_quarter"));
  const old = artDirectionFixture(targets, 2);
  delete old.viewVersion; old.sections.forEach(s => { delete s.viewpoint; });
  assert.deepEqual(validateArtDirection(old, targets), []);
});

test("content modules cover the buying journey and supply evidence-aware fallbacks", () => {
  for (const role of ["positioning", "benefits", "scenario", "detail", "evidence", "selection", "specifications", "usage", "contents", "faq"]) assert.ok(commerceContentModules.some(m => m.role === role && m.evidence && m.fallback));
  assert.match(contentPlanningGuide(4), /combine identity/);
  assert.match(contentPlanningGuide(6), /expand distinct supported benefits/);
  assert.match(contentPlanningGuide(4), /never delete panels/);
});
