import test from "node:test";
import assert from "node:assert/strict";
import { intentFixture, flexibleFixture } from "./flexible-creative-fixture";
import { commercePlanSchema } from "../lib/detail-runs/merchandising";
import { normalizeIntentPlan, intentPlanSchema, intentForDirector, compileCreativePrompt, applyFlexibleReview, flexibleReviewSchema } from "../lib/detail-runs/flexible-creative";
import { validateSellingPoints } from "../lib/detail-runs/selling-points";

const targets = Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, kind: i < 3 ? "HERO" : "DETAIL" }));

test("new plans require value reasoning; historical V3 drafts keep their saved contract", () => {
  const plan = normalizeIntentPlan(intentFixture());
  assert.deepEqual(validateSellingPoints(plan), []);
  delete plan.sellingPoints;
  for (const section of plan.sections) delete section.sellingPointIds;
  assert.ok(commercePlanSchema.safeParse(plan).success);
  assert.equal(intentPlanSchema.safeParse(plan).success, false);
  assert.deepEqual(validateSellingPoints(plan), []);
});

test("a selling point must link evidence, buyer benefit and the sales frames", () => {
  const plan = normalizeIntentPlan(intentFixture()), point = plan.sellingPoints![0];
  point.benefit = point.feature;
  point.factIds = ["fabricated-evidence"];
  plan.sellingPoints!.push(structuredClone(point));
  plan.sections[0].sellingPointIds = ["invented-point"];
  plan.sections[1].sellingPointIds = [];
  const issues = validateSellingPoints(plan);
  for (const message of ["unique", "existing product evidence", "repeats a feature", "Unknown selling-point", "Section 2 needs a purchase reason"]) assert.ok(issues.some(i => i.includes(message)), message);
  assert.ok(!issues.some(i => i.includes("Section 7 needs")), "the parameter table does not need a slogan");
});

const cases = [
  { category: "beauty", feature: "瓶身清晰标注抗皱精华液", need: "为日常护理选择相关品类", benefit: "把抗老护理融入日常", boundary: "不得声称淡纹效果、见效时间或未知成分" },
  { category: "everyday", feature: "盖碗有宽口、碗盖与承托底碟", need: "从容准备一席茶", benefit: "宽口投茶更从容", boundary: "不得声称防烫、恒温或未知容量" },
  { category: "apparel", feature: "衬衫具有宽松廓形与纽扣开襟", need: "日常多种穿搭选择", benefit: "单穿叠搭都有型", boundary: "不推断透气面料或显瘦效果" },
  { category: "electronics", feature: "用户确认充电器插脚可折叠", need: "出门时便于收纳携带", benefit: "折起就收好，出门少一份累赘", boundary: "不推断充电速度、功率或兼容协议" },
] as const;

for (const sample of cases) test(`${sample.category}: assigned value and its factual basis survive director and prompt compilation`, () => {
  const plan = normalizeIntentPlan(intentFixture()); plan.category = sample.category;
  plan.evidence.push({ id: "product-feature", claim: sample.feature, source: "user", sourceRef: "user_description" });
  plan.sellingPoints![0] = { id: "desk-accent", feature: sample.feature, buyerNeed: sample.need, benefit: sample.benefit, basis: "inferred", factIds: ["product-feature"], claimBoundary: sample.boundary };
  assert.deepEqual(validateSellingPoints(plan), []);
  const stored = commercePlanSchema.parse(JSON.parse(JSON.stringify(plan)));
  const intent = intentForDirector(stored);
  assert.deepEqual(intent.sellingPoints, plan.sellingPoints);
  assert.deepEqual(intent.sections[0].sellingPointIds, ["desk-accent"]);
  const direction = flexibleFixture(targets), art = direction.sections[0];
  art.textBlocks[0].text = sample.benefit;
  const prompt = compileCreativePrompt(stored, stored.sections[0], direction, art);
  assert.match(prompt, /PURCHASE REASONS \(reasoning only, never paint as extra text\)/);
  const facts = prompt.split("\n").find(line => line.startsWith("SOURCE FACTS"))!;
  assert.ok(facts.includes(sample.feature), "include the selling point's own evidence, not only the frame's prior fact IDs");
  const copy = prompt.split("\n").find(line => line.startsWith("EXACT FINAL VISIBLE COPY"))!;
  assert.ok(copy.includes(sample.benefit));
  assert.ok(!copy.includes(sample.boundary) && !copy.includes("claimBoundary"), "reasoning boundaries are not added copy");
});

test("appearance-only copy review must actually rewrite copy while retaining parameters and other pages", () => {
  const plan = normalizeIntentPlan(intentFixture()), direction = flexibleFixture(targets);
  direction.sections[0].textBlocks[0].text = "高瓶与矮罐，同框呈现";
  const review = flexibleReviewSchema.parse({ passed: false, issues: [{ sectionIds: ["s0"], kind: "copy", message: "标题仅描述外观，没有传达买家利益。" }], changes: [] });
  assert.ok(applyFlexibleReview(direction, review, plan, targets, []).errors.some(i => i.includes("flagged appearance-only")));
  const section = structuredClone(direction.sections[0]);
  review.changes = [{ section, reason: "将画面描述改为实际买家价值", factIds: ["visible-color"] }];
  assert.ok(applyFlexibleReview(direction, review, plan, targets, []).errors.some(i => i.includes("flagged appearance-only")), "no-op patches cannot resolve a copy issue");
  section.textBlocks[0].text = "给日常桌面，添一抹亮色";
  const result = applyFlexibleReview(direction, review, plan, targets, []);
  assert.deepEqual(result.errors, []); assert.equal(result.issues[0].resolved, true);
  assert.deepEqual(result.direction.sections.slice(1), direction.sections.slice(1));
  assert.equal(result.direction.sections.at(-1)!.expression, "information");
});
