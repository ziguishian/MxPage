import test from "node:test";
import assert from "node:assert/strict";
import { detailRunInputSchema, planSchema } from "../lib/detail-runs/contracts";
import { commercePlanSchema } from "../lib/detail-runs/merchandising";
import { artDirectionSchema, currentArtDirectionSchema, validateArtDirection } from "../lib/detail-runs/art-direction";
import { flexibleDirectionSchema, flexibleReviewSchema, normalizeIntentPlan, validateFlexibleDirection } from "../lib/detail-runs/flexible-creative";
import { heroCountOptions, detailCountOptions } from "../lib/utils/image-counts";
import { commercePlanFixture } from "./commerce-plan-fixture";
import { artDirectionFixture } from "./art-direction-fixture";
import { flexibleFixture, intentFixture } from "./flexible-creative-fixture";

test("configuration allows 10 heroes and 20 details, retains defaults and rejects out-of-range counts", () => {
  const request = { idempotencyKey: "count-boundary-test", heroCount: 10, detailCount: 20 };
  assert.equal(detailRunInputSchema.parse(request).heroCount, 10);
  assert.equal(detailRunInputSchema.parse(request).detailCount, 20);
  assert.deepEqual(heroCountOptions, [3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(detailCountOptions, Array.from({ length: 17 }, (_, i) => i + 4));
  for (const change of [{ heroCount: 11 }, { heroCount: 2 }, { detailCount: 21 }, { detailCount: 3 }, { detailCount: 4.5 }]) {
    assert.equal(detailRunInputSchema.safeParse({ ...request, ...change }).success, false);
  }
  const defaults = detailRunInputSchema.parse({ idempotencyKey: request.idempotencyKey });
  assert.equal(defaults.heroCount, 4);
  assert.equal(defaults.detailCount, 6);
});

test("a full 30-frame plan survives all planning schemas and 19 detail junctions", () => {
  const legacy = commercePlanFixture("asset-a", 10, 20);
  const targets = legacy.sections.map((s, i) => ({ id: `frame-${i}`, kind: s.kind, copy: s.copy }));
  assert.equal(planSchema.parse(legacy).sections.length, 30);
  assert.equal(commercePlanSchema.parse(legacy).sections.length, 30);
  const direction = currentArtDirectionSchema.parse(artDirectionFixture(targets, 2));
  assert.equal(direction.detailSeams.length, 19);
  assert.deepEqual(validateArtDirection(direction, targets), []);
  const plan = normalizeIntentPlan(intentFixture("asset-a", 10, 20));
  const flexible = flexibleDirectionSchema.parse(flexibleFixture(targets));
  assert.deepEqual(validateFlexibleDirection(flexible, targets, plan, []), []);
  assert.equal(artDirectionSchema.parse(JSON.parse(JSON.stringify(flexible))).sections.length, 30);
  assert.equal(flexibleReviewSchema.parse({ passed: true, issues: [], changes: flexible.sections.map(section => ({ section, reason: "Adjust local typography", factIds: [] })) }).changes.length, 30);
  assert.equal(planSchema.safeParse({ ...legacy, sections: [...legacy.sections, legacy.sections[0]] }).success, false);
  assert.equal(flexibleDirectionSchema.safeParse({ ...flexible, detailSeams: [...flexible.detailSeams, flexible.detailSeams[0]] }).success, false);
});
