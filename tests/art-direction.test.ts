import test from "node:test";
import assert from "node:assert/strict";
import { artDirectionSchema, currentArtDirectionSchema, validateArtDirection, compileArtPrompt, detailSeamsFor } from "../lib/detail-runs/art-direction";
import { artDirectionFixture } from "./art-direction-fixture";
import { commercePlanFixture } from "./commerce-plan-fixture";

const plan = commercePlanFixture();
const targets = plan.sections.map((s, i) => ({ id: `section-${i}`, kind: s.kind, copy: s.copy }));
test("art direction validates complete storyboard and exact text before paid generation", () => {
  const direction = artDirectionSchema.parse(artDirectionFixture(targets));
  assert.deepEqual(validateArtDirection(direction, targets), []);
  direction.sections[0].sectionId = targets[1].id;
  assert.match(validateArtDirection(direction, targets).join(" "), /each section ID exactly once/);
  const changed = artDirectionFixture(targets);
  changed.sections[0].textBlocks[0].text += " 99% effective";
  assert.match(validateArtDirection(changed, targets).join(" "), /Preserve exact copy/);
  const missing = artDirectionFixture(targets);
  missing.sections[0].textBlocks = [];
  assert.match(validateArtDirection(missing, targets).join(" "), /Preserve exact copy/);
});

test("line breaks are flexible but wording, hierarchy and composition diversity are enforced", () => {
  const direction = artDirectionFixture(targets);
  direction.sections[0].textBlocks[0].text = targets[0].copy.replaceAll(" ", "\n");
  assert.deepEqual(validateArtDirection(direction, targets), []);
  direction.sections.forEach(s => { s.composition = "offset_hero"; s.productScale = "dominant"; s.density = "airy"; });
  direction.sections[0].textBlocks[0].size = "body";
  const issues = validateArtDirection(direction, targets).join(" ");
  assert.match(issues, /three HERO compositions/);
  assert.match(issues, /three DETAIL compositions/);
  assert.match(issues, /Vary product scale/);
  assert.match(issues, /Adjacent detail/);
  assert.match(issues, /headline cannot use body size/);
});

test("compiled art prompt overrides the draft layout without leaking other recipes or source copy", () => {
  const direction = artDirectionFixture(targets);
  const section = { ...plan.sections[2], prompt: "Obsolete: white background and always centered." };
  const prompt = compileArtPrompt(plan, section, direction, direction.sections[2]);
  assert.match(prompt, /intentional close crop/);
  assert.match(prompt, /EXACT FINAL VISIBLE COPY/);
  assert.ok(prompt.includes(section.copy));
  assert.ok(!prompt.includes(plan.sections[1].copy));
  assert.ok(!prompt.includes("Obsolete"));
  assert.ok(!prompt.includes("Cocoa and cream"));
  assert.match(prompt, /Product fidelity/);
  assert.match(prompt, /reference|original product inputs/i);
});

test("new storyboards require typography and every actual detail junction; old snapshots remain valid", () => {
  const direction = currentArtDirectionSchema.parse(artDirectionFixture(targets, 2));
  assert.deepEqual(validateArtDirection(direction, targets), []);
  for (const invalid of [
    { ...direction, detailSeams: direction.detailSeams.slice(1) },
    { ...direction, detailSeams: direction.detailSeams.map(() => direction.detailSeams[0]) },
    { ...direction, detailSeams: direction.detailSeams.map(s => ({ ...s, fromSectionId: s.toSectionId, toSectionId: s.fromSectionId })) },
    { ...direction, detailSeams: [{ ...direction.detailSeams[0], fromSectionId: targets[0].id }, ...direction.detailSeams.slice(1)] },
  ]) assert.ok(validateArtDirection(invalid, targets).some(s => s.includes("接缝色")));
  assert.equal(currentArtDirectionSchema.safeParse({ ...direction, detailSeams: [{ ...direction.detailSeams[0], color: "ivory" }] }).success, false);
  const legacy = artDirectionFixture(targets, 2);
  delete legacy.layoutVersion; delete legacy.detailSeams; legacy.sections.forEach(s => { delete s.typography; });
  assert.equal(artDirectionSchema.safeParse(legacy).success, true);
  assert.equal(currentArtDirectionSchema.safeParse(legacy).success, false);
  assert.deepEqual(validateArtDirection(legacy, targets), []);
});

test("adjoining prompts share one edge color while type treatment changes without changing exact copy", () => {
  const direction = currentArtDirectionSchema.parse(artDirectionFixture(targets, 2));
  const seam = direction.detailSeams[0];
  const before = targets.findIndex(s => s.id === seam.fromSectionId), after = targets.findIndex(s => s.id === seam.toSectionId);
  const upper = compileArtPrompt(plan, plan.sections[before], direction, direction.sections[before]);
  const lower = compileArtPrompt(plan, plan.sections[after], direction, direction.sections[after]);
  assert.ok(upper.includes(`BOTTOM JOIN COLOR: ${seam.color}`));
  assert.ok(lower.includes(`TOP JOIN COLOR: ${seam.color}`));
  assert.deepEqual(detailSeamsFor(direction, targets[0].id), { incoming: undefined, outgoing: undefined });
  const hero = compileArtPrompt(plan, plan.sections[0], direction, direction.sections[0]);
  assert.ok(!hero.includes("JOIN COLOR:"));
  assert.ok(hero.includes(direction.sections[0].typography.decoration));
  assert.ok(hero.includes(JSON.stringify(direction.sections[0].textBlocks[0].text)));
  assert.ok(!hero.includes("8–12%"), "new typography is not forced into the old fixed headline size");
  direction.sections[0].typography.fontCharacter = "Elegant editorial serif with a fine geometric supporting sans";
  const restyled = compileArtPrompt(plan, plan.sections[0], direction, direction.sections[0]);
  assert.ok(restyled.includes(direction.sections[0].typography.fontCharacter));
  assert.ok(restyled.includes(JSON.stringify(direction.sections[0].textBlocks[0].text)));
});
