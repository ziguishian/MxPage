import test from "node:test";
import assert from "node:assert/strict";
import { intentFixture, flexibleFixture } from "./flexible-creative-fixture";
import { commercePlanSchema, validateCommercePlan } from "../lib/detail-runs/merchandising";
import { intentPlanSchema, normalizeIntentPlan, intentForDirector, validateFlexibleDirection, compileCreativePrompt, applyFlexibleReview, flexibleReviewSchema } from "../lib/detail-runs/flexible-creative";
import { validateCategoryContent } from "../lib/detail-runs/category-content";

const targets = Array.from({ length: 7 }, (_, i) => ({ id: "s" + i, kind: i < 3 ? "HERO" : "DETAIL" }));

test("new planning requires structured information, older saved V3 plans still load", () => {
  const plan = normalizeIntentPlan(intentFixture());
  delete plan.productInformation;
  assert.ok(commercePlanSchema.safeParse(plan).success);
  assert.equal(intentPlanSchema.safeParse(plan).success, false);
  assert.deepEqual(validateCategoryContent(plan), []);
});

test("gaiwan and every category retain a final known-parameter page even without numeric dimensions", () => {
  for (const category of ["home", "everyday", "electronics", "appliances", "food", "beauty", "books"] as const) {
    const plan = normalizeIntentPlan(intentFixture()); plan.category = category;
    assert.deepEqual(validateCommercePlan(plan, ["asset-a"], null, []), []);
    plan.sections[6].role = "detail"; plan.sections[6].contentKind = "general";
    assert.ok(validateCategoryContent(plan).some(issue => issue.includes("final DETAIL")));
  }
});

test("explicitly sourced request can omit a specification page without changing the default", () => {
  const plan = normalizeIntentPlan(intentFixture());
  plan.sections[6].role = "scenario"; plan.sections[6].contentKind = "general";
  plan.sections[6].sellingPointIds = ["desk-accent"];
  plan.requirements = [{ id: "omit", kind: "information", text: "不要规格参数页", sourceQuote: "不要规格参数页" }];
  assert.deepEqual(validateCommercePlan(plan, ["asset-a"], "不要规格参数页", []), []);
  assert.ok(validateCommercePlan(plan, ["asset-a"], "普通商品", []).some(issue => issue.includes("actual supplied instruction")));
});

test("apparel needs an on-body task and retains its real size chart through compilation", () => {
  const plan = normalizeIntentPlan(intentFixture()); plan.category = "apparel";
  assert.ok(validateCategoryContent(plan).some(issue => issue.includes("on_body")));
  plan.sections[1].contentKind = "on_body";
  plan.evidence.push({ id: "size-table", claim: "M: chest 96 cm, length 65 cm; L: chest 100 cm, length 67 cm", source: "user", sourceRef: "user_description" });
  plan.productInformation!.sizeChart = { columns: ["Size", "Chest (cm)", "Length (cm)"], rows: [{ cells: ["M", "96", "65"], factIds: ["size-table"] }, { cells: ["L", "100", "67"], factIds: ["size-table"] }] };
  assert.deepEqual(validateCategoryContent(plan), []);
  const intent = intentForDirector(plan);
  assert.deepEqual(intent.productInformation, plan.productInformation);
  assert.equal(intent.sections[1].contentKind, "on_body");
  assert.equal(intent.sections[6].role, "specifications");
  const direction = flexibleFixture(targets);
  assert.match(compileCreativePrompt(plan, plan.sections[1], direction, direction.sections[1]), /ON-BODY EXECUTION/);
  assert.ok(validateFlexibleDirection(direction, targets, plan, []).some(issue => issue.includes("parameter labels/values")));
  direction.sections[6].textBlocks[0].text += "\nSize | Chest (cm) | Length (cm)\nM | 96 | 65\nL | 100 | 67";
  assert.deepEqual(validateFlexibleDirection(direction, targets, plan, []), []);
  const prompt = compileCreativePrompt(plan, plan.sections[6], direction, direction.sections[6]);
  assert.match(prompt, /SPECIFICATIONS LAYOUT/);
  assert.ok(prompt.includes('[["M","96","65"],["L","100","67"]]'));
  assert.ok(prompt.includes("M: chest 96 cm"), "the specification's own supporting evidence reaches the image prompt");
  direction.sections[6].textBlocks[0].text = direction.sections[6].textBlocks[0].text.replace("L | 100 | 67", "L | 1100 | 67");
  assert.ok(validateFlexibleDirection(direction, targets, plan, []).some(issue => issue.includes("parameter labels/values")), "a larger number containing the right digits is still wrong");
});

test("unknown measurements produce no invented size chart and malformed/unsupported rows fail", () => {
  const plan = normalizeIntentPlan(intentFixture()); plan.category = "apparel"; plan.sections[1].contentKind = "on_body";
  assert.equal(plan.productInformation!.sizeChart, null);
  assert.deepEqual(validateCategoryContent(plan), []);
  plan.productInformation!.sizeChart = { columns: ["Size", "Chest (cm)"], rows: [{ cells: ["M", "96", "extra"], factIds: ["invented"] }] };
  const issues = validateCategoryContent(plan);
  assert.ok(issues.some(issue => issue.includes("existing evidence")));
  assert.ok(issues.some(issue => issue.includes("column count")));
});

test("review cannot turn the final specification page into a photo or delete known parameters", () => {
  const plan = normalizeIntentPlan(intentFixture()), direction = flexibleFixture(targets);
  const closing = { ...direction.sections[6], expression: "photo", typography: null, graphicDevice: null, textBlocks: [] };
  const review = flexibleReviewSchema.parse({ passed: false, issues: [{ sectionIds: ["s6"], kind: "design", message: "Simplify the closing" }], changes: [{ section: closing, reason: "Try a quieter photographic ending", factIds: ["visible-color"] }] });
  assert.ok(applyFlexibleReview(direction, review, plan, targets, []).errors.some(issue => issue.includes("final DETAIL")));
  direction.sections[6].textBlocks[0].text = "Product overview";
  assert.ok(validateFlexibleDirection(direction, targets, plan, []).some(issue => issue.includes("parameter labels/values")));
});
