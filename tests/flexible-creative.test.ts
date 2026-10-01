import test from "node:test";
import assert from "node:assert/strict";
import { intentFixture, flexibleFixture } from "./flexible-creative-fixture";
import { artDirectionFixture } from "./art-direction-fixture";
import { normalizeIntentPlan, intentForDirector, validateFlexibleDirection, applyFlexibleReview, flexibleReviewSchema, compileCreativePrompt, rhythmWarnings, adaptationEligibility, frameReferences } from "../lib/detail-runs/flexible-creative";
import { compileArtPrompt } from "../lib/detail-runs/art-direction";
import { commercePlanFixture } from "./commerce-plan-fixture";
import { validateCommercePlan } from "../lib/detail-runs/merchandising";
import type { ImageProgress } from "../lib/detail-runs/contracts";
import { artDirectionSchema } from "../lib/detail-runs/art-direction";
import { flexibleDirectionSchema, validateCommercialTasks } from "../lib/detail-runs/flexible-creative";
const targets = Array.from({length:7}, (_,i)=>({id:"s"+i, kind:i<3?"HERO":"DETAIL"}));
const plan = normalizeIntentPlan(intentFixture());

test("structured frame counts are not invented buyer-copy requirements", () => {
  const p = structuredClone(plan);
  p.requirements = [{ id: "frame_counts", kind: "information", text: "3 HERO, 4 DETAIL", sourceQuote: '\"heroCount\":3,\"detailCount\":4' }];
  const issues = validateCommercePlan(p, ["asset-a"], "Product description", ["一切由你决定"]);
  assert.ok(issues.some(s => s.includes("Remove this synthetic requirements entry") && s.includes("retain the exact requested HERO/DETAIL slots")));
  p.requirements = [];
  assert.deepEqual(validateCommercePlan(p, ["asset-a"], "Product description", ["一切由你决定"]), []);
});

test("live-planning regression: source uncertainty is not a buyer-facing sales narrative", () => {
  const p = structuredClone(plan);
  p.sections[4].title = "接口开口：能确认与不能确认的信息";
  p.sections[5].buyerQuestion = "65W 印字是否能证明实际输出性能？";
  assert.equal(validateCommercialTasks(p).length, 2);
  p.sections[4].title = "接口局部与连接位置";
  p.sections[5].buyerQuestion = "收纳时如何放置这款产品？";
  p.sections[5].objective = "展示真实使用关系，不推断未确认参数";
  assert.deepEqual(validateCommercialTasks(p), []);
  p.sections[4].title = "选购信息核对";
  p.requirements = [{ id: "requested-audit", kind: "information", text: "展示尚待核实的参数", sourceQuote: "需要一页核实说明" }];
  assert.deepEqual(validateCommercialTasks(p), []);
});

test("live-copy regression: printed-label reporting must not replace commercial content", () => {
  const p = structuredClone(plan);
  p.sections[5].title = "机身上的可见印刷标记";
  assert.equal(validateCommercialTasks(p).length, 1);
  for (const text of ["可见“HAVIT”印刷", "可见“65W”印刷｜作为外观信息呈现", "可见“USB”标记及其他开口"]) {
    const d = flexibleFixture(targets);
    d.sections[0].textBlocks[0].text = text;
    assert.ok(validateFlexibleDirection(d, targets, plan, []).some(e => e.includes("internal evidence")));
  }
  const d = flexibleFixture(targets);
  d.sections[0].textBlocks[0].text = "展开使用，折起收纳";
  assert.deepEqual(validateFlexibleDirection(d, targets, plan, []), []);
});

test("skincare regression: independent parameter rows never form an audit phrase", () => {
  const p = structuredClone(plan);
  p.productInformation = { parameters: [
    { label: "可见包装形态", value: "高身圆角长方形瓶与矮宽圆润罐", factIds: ["visible-color"] },
    { label: "包装外观颜色", value: "青绿色至银灰色渐变", factIds: ["visible-color"] },
    { label: "瓶身正面印字", value: "肌初赋能 · 抗皱精华液（包装标注）", factIds: ["visible-color"] },
  ], sizeChart: null };
  const rows = p.productInformation.parameters.map(row => `${row.label}｜${row.value}`);
  assert.match(rows.join(" "), /可见.*标注/, "reproduce the old cross-row false positive");
  for (const blocks of [rows, [rows.join("\n")], [rows.join("；")]]) {
    const d = flexibleFixture(targets), last = d.sections.at(-1)!;
    last.textBlocks = blocks.map(text => ({ ...last.textBlocks[0], text }));
    assert.deepEqual(validateFlexibleDirection(d, targets, p, []), []);
  }
  for (const text of ["可见容量标注", "保留包装原有标记", "参数未知", "接口信息核对", "容量｜未提供", "图中可见瓶身"]) {
    const d = flexibleFixture(targets);
    d.sections[0].textBlocks[0].text = text;
    const issues = validateFlexibleDirection(d, targets, plan, []);
    assert.ok(issues.some(e => /internal audit|internal evidence/.test(e)), text);
    assert.ok(issues.some(e => e.includes("s0") && e.includes(JSON.stringify(text.split("｜").at(-1)))));
  }
});

test("production brief survives persistence and compiles real evidence, module copy and spatial direction", () => {
  const direction = flexibleFixture(targets), art = direction.sections[0];
  art.production!.supportingModules = [{ purpose: "Explain the visible finish", visual: "One close detail of the same product surface", placement: "Small inset at lower left beneath the main claim", factIds: ["visible-color"], textBlockIndexes: [0] }];
  const stored = artDirectionSchema.parse(JSON.parse(JSON.stringify(direction)));
  const prompt = compileCreativePrompt(plan, plan.sections[0], stored, stored.sections[0]);
  assert.deepEqual(stored.sections[0].production, art.production);
  for (const text of [art.production!.visualProof, art.production!.layoutBlueprint, art.production!.materialTreatment, art.production!.interaction, art.production!.differenceFromPrevious, art.textBlocks[0].text, plan.evidence[0].claim]) assert.ok(prompt.includes(text), text);
  assert.ok(!prompt.includes('"textBlockIndexes"'), "model receives resolved words, not fragile indexes");
  assert.ok(!prompt.includes('"sourceRef"'), "storage IDs do not belong in the image prompt");
  assert.deepEqual(validateFlexibleDirection(direction, targets, plan, []), []);
});

test("new designs require production specificity while saved older V3 designs remain readable", () => {
  const direction = artDirectionSchema.parse(flexibleFixture(targets));
  delete direction.sections[0].production;
  assert.equal(flexibleDirectionSchema.safeParse(direction).success, false);
  assert.equal(artDirectionSchema.safeParse(direction).success, true);
  assert.ok(!compileCreativePrompt(plan, plan.sections[0], direction, direction.sections[0]).includes("undefined"));
});

test("module edits cannot silently lose copy links or introduce nonexistent evidence", () => {
  const direction = flexibleFixture(targets), art = direction.sections[0];
  art.production!.supportingModules = [{ purpose: "Explain the observed surface", visual: "A small close photograph of the finish", placement: "Lower left, subordinate to the main product", factIds: ["invented"], textBlockIndexes: [5] }];
  const issues = validateFlexibleDirection(direction, targets, plan, []);
  assert.ok(issues.some(i => i.includes("existing evidence")));
  assert.ok(issues.some(i => i.includes("missing text block")));
  direction.sections[1].production!.supportingModules = art.production!.supportingModules;
  assert.ok(validateFlexibleDirection(direction, targets, plan, []).some(i => i.includes("Pure photography")));
});

test("photo production notes cannot leak copy architecture or infographic modules into rendering", () => {
  const direction = flexibleFixture(targets), art = direction.sections[1];
  art.production!.copyArchitecture = "INTERNAL_TYPE_INSTRUCTION_SENTINEL";
  const prompt = compileCreativePrompt(plan, plan.sections[1], direction, art);
  assert.ok(!prompt.includes("INTERNAL_TYPE_INSTRUCTION_SENTINEL"));
  assert.ok(!prompt.includes("SUPPORTING MODULES:"));
  assert.ok(prompt.includes("SURFACE AND CONTACT:"));
});
test("a macro brief compiles an actual primary-detail crop instead of another full product portrait", () => {
  const direction = flexibleFixture(targets), art = direction.sections[0];
  art.viewpoint = "macro";
  assert.match(compileCreativePrompt(plan, plan.sections[0], direction, art), /MACRO EXECUTION:.*rest of the product leave the frame/);
  art.viewpoint = "three_quarter"; art.productScale = "dominant";
  assert.ok(!compileCreativePrompt(plan, plan.sections[0], direction, art).includes("MACRO EXECUTION:"));
});

test("V3 intent has no premature copy, fonts or layout; final photo prompt keeps packaging but no type directives", () => {
  const intent = intentForDirector(plan);
  assert.ok(intent.sections.every(s => !("copy" in s) && !("layout" in s))); assert.ok(!("visualSystem" in intent));
  const direction = flexibleFixture(targets), art = direction.sections[1];
  const prompt = compileCreativePrompt(plan, plan.sections[1], direction, art);
  assert.match(prompt,/PURE PHOTOGRAPHY/); assert.match(prompt,/Preserve real printed markings/);
  assert.ok(!prompt.includes("TYPE DESIGN:")); assert.ok(!prompt.includes("EXACT FINAL VISIBLE COPY"));
  assert.ok(!prompt.includes(direction.headlineStyle)); assert.ok(!prompt.includes(art.title));
  assert.deepEqual(validateFlexibleDirection(direction,targets,plan,[]),[]);
});
test("review can remove redundant AI copy but cannot remove a slot or literal user requirement", () => {
  const direction = flexibleFixture(targets);
  const photo = {...direction.sections[0], expression:"photo", typography:null, graphicDevice:null, textBlocks:[]};
  const review = flexibleReviewSchema.parse({passed:false,issues:[{sectionIds:["s0"],kind:"design",message:"摄影已足够表达，无需重复标题"}],changes:[{section:photo,reason:"删除多余标题，让产品摄影承担任务",factIds:[]}]});
  const result = applyFlexibleReview(direction,review,plan,targets,[]);
  assert.deepEqual(result.errors,[]); assert.equal(result.direction.sections.length,7); assert.deepEqual(result.direction.sections[0].textBlocks,[]);
  const required = {...plan,requirements:[{id:"user-line",kind:"exact_copy" as const,text:direction.sections[0].textBlocks[0].text,sourceQuote:"必须出现这句文案"}]};
  direction.sections[0].requirementIds=["user-line"]; direction.sections[0].textBlocks[0].origin="user_required";
  assert.ok(applyFlexibleReview(direction,review,required,targets,[]).errors.some(e=>/requirement|exact user/.test(e)));
  const short = structuredClone(direction); short.sections.pop();
  assert.ok(validateFlexibleDirection(short,targets,plan,[]).some(e=>/each section ID/.test(e)));
});
test("mandatory requirements need actual user source, and cannot be manufactured from AI suggestions", () => {
  const p={...plan,requirements:[{id:"x",kind:"information" as const,text:"Aluminium body",sourceQuote:"用户要求铝合金"}]};
  assert.ok(validateCommercePlan(p,["asset-a"],"普通商品",[]).some(e=>/actual supplied instruction/.test(e)));
});
test("observational filler found in live acceptance cannot become final copy", () => {
  const direction=flexibleFixture(targets);
  direction.sections[0].textBlocks[0].text="可见机身印字：HAVIT / 65W";
  assert.ok(validateFlexibleDirection(direction,targets,plan,[]).some(e=>/audit/.test(e)));
});
test("gaiwan regression: camera reasoning is valid internally but never becomes AI customer copy", () => {
  for (const text of ["手边的相对尺寸", "手边的相对尺度", "从上方看圆形盖面", "泡茶三盖碗，回看外观", "侧面看清上下轮廓"]) {
    const direction = flexibleFixture(targets);
    direction.sections[0].task = text;
    assert.deepEqual(validateFlexibleDirection(direction, targets, plan, []), [], "internal task can describe the shot");
    direction.sections[0].textBlocks[0].text = text;
    assert.ok(validateFlexibleDirection(direction, targets, plan, []).some(issue => issue.includes("camera/reasoning")), text);
  }
  const direction = flexibleFixture(targets);
  direction.sections[0].textBlocks[0].text = "盖碗参数";
  assert.deepEqual(validateFlexibleDirection(direction, targets, plan, []), []);
});
test("literal user copy is preserved while AI reasoning copy is rejected", () => {
  const direction = flexibleFixture(targets);
  direction.sections[0].textBlocks[0] = { ...direction.sections[0].textBlocks[0], text: "回看外观", origin: "user_required" };
  direction.sections[0].requirementIds = ["literal"];
  const p = { ...plan, requirements: [{ id: "literal", kind: "exact_copy" as const, text: "回看外观", sourceQuote: "必须原样写回看外观" }] };
  assert.deepEqual(validateFlexibleDirection(direction, targets, p, []), []);
});
test("AI copy cannot evade review by claiming an unsourced user-required origin", () => {
  const direction=flexibleFixture(targets);
  direction.sections[0].textBlocks[0].origin="user_required";
  assert.ok(validateFlexibleDirection(direction,targets,plan,[]).some(e=>/actual assigned user/.test(e)));
});
test("renaming composition does not conceal identical actual spatial arrangements", () => {
  const direction=flexibleFixture(targets);
  direction.sections[1]={...structuredClone(direction.sections[0]),sectionId:"s1",composition:"different_name"};
  assert.ok(rhythmWarnings(direction).some(w=>w.includes("s1")));
});
test("frame reference roles are conditional, photo cannot inherit reference text layout", () => {
  const direction=flexibleFixture(targets),art=direction.sections[1];
  const refs=[{id:"palette",source:"builtin" as const,title:"A",reason:"Color",url:"/A"},{id:"layout",source:"upload" as const,title:"B",reason:"Layout",url:"/B"}];
  art.referenceUses=[{id:"palette",purpose:"palette"},{id:"layout",purpose:"layout"}];
  assert.deepEqual(frameReferences(direction,art,refs).map(r=>r.reference.id),["palette"]);
  assert.ok(validateFlexibleDirection(direction,targets,plan,refs).some(e=>/no layout references/.test(e)));
});
test("invalid reference feedback distinguishes product IDs from the allowed style IDs", () => {
  const direction = flexibleFixture(targets);
  direction.sections[0].referenceUses = [{ id: "product-asset", purpose: "photography" }];
  const refs = [{ id: "cool-sculpture", source: "builtin" as const, title: "Style", reason: "Lighting", url: "/style.jpg" }];
  const issues = validateFlexibleDirection(direction, targets, plan, refs);
  assert.ok(issues.some(issue => issue.includes('unknown IDs ["product-asset"]') && issue.includes('allowed STYLE IDs ["cool-sculpture"]')));
  direction.sections[0].referenceUses = [];
  assert.deepEqual(validateFlexibleDirection(direction, targets, plan, refs), []);
});
test("adaptation cannot touch attempted, uncertain, generating, completed or explicit retry positions", () => {
  const image=(sectionId:string,more:Partial<ImageProgress>={}):ImageProgress=>({sectionId,title:sectionId,state:"pending",correctionCount:0,...more});
  const images=[image("fresh"),image("busy",{state:"generating"}),image("unknown",{state:"uncertain"}),image("done",{state:"checked",assetId:"asset"}),image("attempted",{attemptKey:"old"}),image("retry",{retryRequested:true}),image("corrected",{correctionCount:1})];
  assert.deepEqual(adaptationEligibility(images),["fresh"]);
  const direction=flexibleFixture(targets),replacement={...direction.sections[0],compositionBrief:"Change this full composition even though it was completed"};
  const review=flexibleReviewSchema.parse({passed:false,issues:[{sectionIds:["s0"],kind:"design",message:"duplicate"}],changes:[{section:replacement,reason:"Try an overhead space",factIds:[]}]});
  assert.ok(applyFlexibleReview(direction,review,plan,targets,[],["s2"]).errors.some(e=>/editable/.test(e)));
});
test("legacy V2 prompt compilation is byte-compatible", () => {
  const old=commercePlanFixture(), direction=artDirectionFixture(targets.map((s,i)=>({...s,copy:old.sections[i].copy})),2);
  assert.equal(compileCreativePrompt(old,old.sections[0],direction,direction.sections[0]),compileArtPrompt(old,old.sections[0],direction,direction.sections[0]));
});
for (const [category,task,expression] of [
 ["electronics","Photograph charger placed within a deep desk scene","photo"],
 ["apparel","Photograph fabric drape and seam texture close up","photo"],
 ["home","Present fragrance bottle among side-lit mineral shadows","statement"],
 ["books","Show page binding and cover typography as real printing","photo"],
 ["food","Explain supplied storage instructions and serving steps","information"],
] as const) test("category contract: "+category,()=>{
  const p={...plan,category},d=flexibleFixture(targets),s=d.sections[1];s.task=task;s.expression=expression;
  if(expression!=="photo"){s.typography=d.sections[0].typography;s.textBlocks=[{...d.sections[0].textBlocks[0],text:task}];}
  assert.deepEqual(validateFlexibleDirection(d,targets,p,[]),[]);
  assert.ok(compileCreativePrompt(p,p.sections[1],d,s).includes(task));
});
