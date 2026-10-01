import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { creativePreferences, isStyleReference } from '../lib/utils/asset-purpose';
import { categoryProfiles } from '../lib/detail-runs/merchandising';
import { selectStyleReferences, styleReferenceImage } from '../lib/detail-runs/style-references';
import { referenceCatalog } from '../lib/detail-runs/reference-catalog';
import { artDirectionFixture } from './art-direction-fixture';
import { commercePlanFixture } from './commerce-plan-fixture';
import { compileArtPrompt, validateArtDirection } from '../lib/detail-runs/art-direction';

test('direction provenance: untouched AI prefills are never explicit constraints', () => {
  assert.equal(creativePreferences({ creationBrief: { visualDirection: 'Do not add scenes' }, agentVisualStyle: 'Do not add scenes' }).userDirection, '');
  assert.equal(creativePreferences({ commercePlan: { style: 'White' }, agentVisualStyle: 'White' }).userDirection, '');
  assert.equal(creativePreferences({ creativePreferences: { version: 2, userDirection: 'Warm stone' }, creationBrief: { visualDirection: 'White' } }).userDirection, 'Warm stone');
  assert.equal(creativePreferences({ creativePreferences: { version: 2, userDirection: '' }, agentVisualStyle: 'Old' }).userDirection, '');
  assert.equal(isStyleReference({}), false);
  assert.equal(isStyleReference({ metadata: { purpose: 'style_reference' } }), true);
});
test('category-specific reference selection, uploaded precedence and actual image bytes', async () => {
  const picks = ['books','electronics','home','food','beauty'].map(category => selectStyleReferences([], category, category === 'home' ? '香氛 暖色 矿物' : ''));
  assert.equal(new Set(picks.map(refs => refs.map(r => r.id).join())).size, 5);
  assert.match(categoryProfiles.books.art, /编辑式大字/);
  assert.match(categoryProfiles.food.art, /食欲/);
  const asset = { id: 'user', fileName: 'Personal reference', filePath: 'uploads/reference.png', metadata: { purpose: 'style_reference' } } as any;
  const chosen = selectStyleReferences([asset], 'books', '');
  assert.equal(chosen.length, 2); assert.equal(chosen[0].id, 'user'); assert.equal(chosen[1].source, 'builtin');
  for (const ref of referenceCatalog) {
    const uri = await styleReferenceImage({id:ref.id,source:'builtin',title:ref.title,reason:ref.lesson,url:''}, []);
    const meta = await sharp(Buffer.from(uri.split(',')[1], 'base64')).metadata();
    assert.ok(meta.width! > 100 && meta.height! > 100);
  }
});
test('V2 compiles a single concrete brief with final copy; recipe boilerplate stays legacy-only', () => {
  const plan = commercePlanFixture();
  const sections = plan.sections.map((s,i) => ({id:String(i),kind:s.kind,copy:s.copy}));
  const art = artDirectionFixture(sections, 2);
  art.recipeId = 'airy_editorial'; art.sections[0].textBlocks[0].text = '留一刻，给自己';
  const compiled = compileArtPrompt(plan,plan.sections[0],art,art.sections[0]);
  assert.match(compiled, /留一刻，给自己/);
  assert.ok(!compiled.includes(plan.sections[0].copy));
  assert.ok(!compiled.includes('Generous warm-white space'));
  assert.deepEqual(validateArtDirection(art,sections), []);
  art.sections[0].textBlocks[0].text = '封面印有文字';
  assert.ok(validateArtDirection(art,sections).some(s => s.includes('audit narration')));
});
