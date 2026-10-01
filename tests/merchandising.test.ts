import test from "node:test";
import assert from "node:assert/strict";
import { commercePlanSchema, validateCommercePlan, compileSectionBrief, userEvidenceSources, normalizeUserEvidenceSources } from "../lib/detail-runs/merchandising";
import { commercePlanFixture } from "./commerce-plan-fixture";

test("commercial plan requires real evidence references and varied purchase narratives", () => {
  const plan = commercePlanSchema.parse(commercePlanFixture());
  assert.deepEqual(validateCommercePlan(plan, ["asset-a"], null, []), []);
  plan.evidence[0].sourceRef = "invented-asset";
  plan.sections[0].factIds = ["invented-fact"];
  assert.match(validateCommercePlan(plan, ["asset-a"], null, []).join(" "), /Unsupported evidence source.*Unknown fact reference/);
  const repetitive = commercePlanFixture();
  repetitive.sections.forEach(s => { s.layout = "full_bleed"; s.copy = "Same copy"; s.buyerQuestion = "Same question"; });
  const issues = validateCommercePlan(repetitive, ["asset-a"], null, []).join(" ");
  assert.match(issues, /three DETAIL layouts/);
  assert.match(issues, /distinct buyer question/);
  assert.match(issues, /identical promotional copy/);
});

test("only supplied descriptions or indexed answers can support user facts", () => {
  const plan = commercePlanFixture();
  Object.assign(plan.evidence[0], { source: "user", sourceRef: "user_description" });
  assert.ok(validateCommercePlan(plan, [], "", []).length);
  assert.deepEqual(validateCommercePlan(plan, [], "Red product", []), []);
  plan.evidence[0].sourceRef = "user_answer_0";
  assert.deepEqual(validateCommercePlan(plan, [], "", ["Red product"]), []);
  assert.ok(validateCommercePlan(plan, [], "", []).length);
});

test("durian answer quotes resolve to real source IDs without changing claims or facts", () => {
  const plan = commercePlanFixture();
  const answers = ["产地云南，保质期一个月，重量300g"];
  const quotes = ["产地云南", "保质期一个月", "重量300g"];
  for (const [index, quote] of quotes.entries()) plan.evidence.push({ id: `answer-${index}`, claim: quote, source: "user", sourceRef: quote });
  const normalized = normalizeUserEvidenceSources(plan, "榴莲", answers);
  assert.deepEqual(normalized.evidence.slice(1).map(e => e.sourceRef), ["user_answer_0", "user_answer_0", "user_answer_0"]);
  assert.deepEqual(normalized.evidence.map(e => e.claim), plan.evidence.map(e => e.claim));
  assert.deepEqual(normalized.sections, plan.sections);
  assert.equal(plan.evidence[1].sourceRef, quotes[0], "normalization does not mutate the saved draft");
  assert.deepEqual(validateCommercePlan(normalized, ["asset-a"], "榴莲", answers), []);
  assert.deepEqual(userEvidenceSources("", ["", answers[0]]).map(s => s.sourceRef), ["user_answer_1"], "empty answers must not shift source IDs");
});

test("ambiguous quotes and invented IDs stay invalid with actionable allowed-ID feedback", () => {
  for (const sourceRef of ["云南", "不存在的描述", "user_answer_9", "g"]) {
    const plan = commercePlanFixture();
    plan.evidence[0] = { id: "visible-color", source: "user", sourceRef, claim: "A supplied fact" };
    const normalized = normalizeUserEvidenceSources(plan, "云南", ["产地云南"]);
    assert.equal(normalized.evidence[0].sourceRef, sourceRef);
    const issues = validateCommercePlan(normalized, [], "云南", ["产地云南"]);
    assert.ok(issues.some(s => s.includes('allowed IDs: ["user_description","user_answer_0"]')));
  }
  const plan = commercePlanFixture(); plan.evidence[0].sourceRef = "产地云南";
  assert.equal(normalizeUserEvidenceSources(plan, "", ["产地云南"]).evidence[0].source, "image", "never reclassify image provenance");
});

test("compiled image brief includes exact copy, category system and source facts", () => {
  const plan = commercePlanFixture();
  const prompt = compileSectionBrief(plan, plan.sections[0]);
  assert.match(prompt, /EXACT FINAL VISIBLE COPY/);
  assert.match(prompt, /HERO exact copy 0/);
  assert.match(prompt, /electronics/);
  assert.match(prompt, /asset-a/);
  assert.match(prompt, /not a reproduction of the uploaded background/);
});
