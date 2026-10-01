import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import sharp from "sharp";
import { commercePlanFixture } from "./commerce-plan-fixture";
import { artDirectionFixture } from "./art-direction-fixture";
import { flexibleFixture, intentFixture } from "./flexible-creative-fixture";

test("official SDK detail workflow: images, idempotency, questions, recovery, cancellation and exports", { timeout: 120000 }, async t => {
  const dir = await mkdtemp(path.join(tmpdir(), "mxpage-agent-test-"));
  process.env.DATABASE_URL = `file:${path.join(dir, "test.db").replaceAll("\\", "/")}`;
  process.env.STORAGE_ROOT = path.join(dir, "storage");
  process.env.APP_SECRET = "test-secret-no-real-credentials";
  delete process.env.LOCK_BASE_URL; delete process.env.FORCED_API_BASE; delete process.env.FORCED_API_BASE_URL;
  const require = createRequire(import.meta.url);
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(path.join(dir, "test.db"));
  for (const migration of (await readdir("prisma/migrations")).sort()) db.exec(await readFile(`prisma/migrations/${migration}/migration.sql`, "utf8"));
  db.close();
  const { prisma } = await import("../lib/db/prisma");
  const { createDetailRun, getDetailRun, controlDetailRun, assertProjectIdle } = await import("../lib/detail-runs/service");
  const { runWithProviderCredentials } = await import("../lib/services/provider-runtime");
  const { saveUploadAsset, readStorageFile } = await import("../lib/storage/asset-manager");
  const { exportLongImage, stitchDetailImages } = await import("../lib/detail-runs/long-image");
  const { mayGenerate } = await import("../lib/detail-runs/contracts");
  const pixels = await sharp({ create: { width: 120, height: 160, channels: 3, background: "red" } }).png().toBuffer();
  let imageRequests = 0;
  let failNextImage = false;
  let cancelNextImage = false;
  let correctFirst = true;
  let duplicateOnce = true;
  let visualInputs = 0;
  let toolCalls = 0;
  let rejectChat = 0;
  let disconnectPlanner = 0;
  let alwaysRejectImage = false;
  let rejectCoverOnly = false;
  let rejectPage = false;
  let pageReviews = 0;
  let failPageReview = false;
  let artDesignCalls = 0;
  let failArtDesign = false;
  let failDesignReview = false;
  let invalidCopyAlways = false;
  let previousDraftInput: unknown;
  let invalidArtOnce = false;
  let malformedArt: "once" | "always" | undefined;
  let noArtTool = false;
  let failCorrection = false;
  let rejectDesign = false;
  let patchFact = false;
  let patchCopy = false;
  let patchTypography = false;
  let invalidPlan: "once" | "always" | undefined;
  let planningDraftInput: unknown;
  let quoteAnswerSources = false;
  let failImageReview = false;
  let designReviews = 0;
  let repeatRhythm = false;
  let adaptiveCalls = 0;
  let adaptiveFailure = false;
  let cancelAdaptive = false;
  const designInputs = new Map<string, { images: unknown[]; roles: unknown[] }>();
  let rejectComposition = false;
  let rejectSeam = false;
  let holdBatchImage: Promise<void> | undefined;
  let batchImageWaiting = false;
  let textOnlyImageRequests = 0;
  let briefCalls = 0;
  let reviewCalls = 0;
  let failBrief = false;
  let failReview = false;
  let disconnectBrief = 0;
  let disconnectReview = 0;
  let briefImageWidth = 0;
  let chatRequests = 0;
  let wrongProbeColor = false;
  let wrongRoundtrip: "token" | "image" | undefined;
  const credentials = { apiKey: "fake-key-for-local-fixture-only", baseUrl: "" };
  const inCredentials = <T,>(fn: () => Promise<T>) => runWithProviderCredentials(credentials, fn);
  const server = createServer(async (request, response) => {
    try {
      const requestHeaders = request.headers["content-type"];
      const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
      if (request.url === "/v1/models") { response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify({ data: [{ id: "gpt-5-mini" }, { id: "gpt-image-2" }, { id: "gpt-6-luna" }] })); return; }
      if (request.url === "/v1/responses") { response.writeHead(404); response.end('{"error":{"message":"unsupported endpoint"}}'); return; }
      if (request.url === "/v1/images/generations") {
        const body = JSON.parse(Buffer.concat(chunks).toString());
        assert.equal(body.model, "gpt-image-2.5-sunburst");
        assert.equal(body.n, 1);
        assert.equal(body.size, "1152x1536", "3:4 must not be sent as the old 2:3 portrait preset");
        assert.match(body.prompt, /Xiaohongshu/);
        imageRequests++; textOnlyImageRequests++;
        response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify({ data: [{ b64_json: pixels.toString("base64") }] })); return;
      }
      if (request.url === "/v1/images/edits") {
        assert.match(Buffer.concat(chunks).toString(), /gpt-image-2\.5-sunburst/);
        const activeRun = await prisma.detailRun.findFirstOrThrow({ where: { status: "RUNNING" } });
        if ((activeRun.input as any).mode === "translate") {
          assert.match(Buffer.concat(chunks).toString(), /Translate all readable marketing text/);
          assert.ok(Buffer.concat(chunks).toString().includes('name="size"\r\n\r\nauto'));
          assert.ok(!Buffer.concat(chunks).toString().includes("Art direction:"));
        } else {
          assert.match(Buffer.concat(chunks).toString(), /Target platform:/);
          assert.match(Buffer.concat(chunks).toString(), /Product fidelity:/);
          const rendering = (activeRun.checkpoint as any).images.find((image: any) => image.state === "generating");
          const section = await prisma.pageSection.findUniqueOrThrow({ where: { id: rendering.sectionId } });
          const cp = activeRun.checkpoint as any;
          if (cp.artDirection?.sections.some((s: any) => s.sectionId === section.id)) {
            const request = Buffer.concat(chunks).toString();
            assert.match(request, new RegExp(cp.creativeVersion === 3 ? "MXPAGE CREATIVE v3" : `MXPAGE ART DIRECTION v${cp.artDirection.version}`));
            assert.match(request, /REFERENCE INPUT MAP/);
            assert.match(request, /CAMERA:/);
            if (cp.creativeVersion === 3) {
              assert.match(request, /BUYER CONTEXT/);
              assert.match(request, /SOURCE FACTS/);
              assert.match(request, /LAYOUT BLUEPRINT/);
              assert.match(request, /VISIBLE PROOF/);
              assert.match(request, /SURFACE AND CONTACT/);
              assert.ok((section.editableData as any).artDirection.production, "production brief survives design, storage and actual adapter request");
              if ((section.editableData as any).commerceBrief.sellingPointIds?.length) {
                assert.match(request, /PURCHASE REASONS \(reasoning only/);
                const strategy = cp.plan || (await prisma.project.findUniqueOrThrow({ where: { id: section.projectId } })).modelSnapshot as any;
                const points = strategy.sellingPoints || strategy.commercePlan.sellingPoints;
                assert.ok(request.includes(points[0].benefit), "buyer value reaches the actual image adapter, including later edits");
              }
              if ((section.editableData as any).commerceBrief.contentKind === "specifications") {
                assert.match(request, /SPECIFICATIONS LAYOUT/);
                assert.ok(request.includes('"parameters":[{"label":"Color","value":"Red"}]'), "known table fields reach the real adapter request");
              }
            }
            assert.ok(!request.includes("Keep the product prominent and complete"));
            assert.ok((section.editableData as any).artDirection, "storyboard must be persisted before the image request");
            assert.ok(cp.events.some((e: any) => e.tool === "save_art_direction" ) || (activeRun.input as any).mode !== "create");
            if (cp.artDirection.layoutVersion === 1) {
              if (cp.creativeVersion === 3) { const art = cp.artDirection.sections.find((s: any) => s.sectionId === section.id); if (art.expression === "photo") { assert.match(request, /PURE PHOTOGRAPHY/); assert.ok(!request.includes("TYPE DESIGN:")); assert.equal(section.copy, ""); } else assert.match(request, /TYPE DESIGN:/); assert.ok(!request.includes("approved STYLE only")); } else assert.match(request, /INTEGRATED TYPE DESIGN/);
              const seam = cp.artDirection.detailSeams.find((s: any) => s.toSectionId === section.id);
              if (seam) {
                assert.ok(request.includes(`TOP JOIN COLOR: ${seam.color.toUpperCase()}`));
                const previous = await prisma.pageSection.findUniqueOrThrow({ where: { id: seam.fromSectionId } });
                if (previous.currentImageAssetId) {
                  assert.match(request, /PREVIOUS (?:DETAIL: its )?bottom(?: edge)? joins this top/);
                  if (cp.creativeVersion === 3) {
                    const form = await new Response(Buffer.concat(chunks), {headers:{"Content-Type":String(requestHeaders)}}).formData();
                    const files = [...form.values()].filter((v): v is File=>typeof v!=="string");
                    const dimensions = await Promise.all(files.map(async f=>sharp(Buffer.from(await f.arrayBuffer())).metadata()));
                    assert.ok(dimensions.some(m=>m.height===4 && m.width===120), "send terminal 2% alongside the full saved neighbor");
                    const role = String(form.get("prompt")).split("\n").find(line => line.startsWith("Image ") && line.includes("PREVIOUS DETAIL FULL FRAME"));
                    assert.ok(role, "the actual full previous detail is a labeled reference, including corrections");
                    const referenceIndex = Number(role.match(/^Image (\d+):/)![1]) - 1;
                    const asset = await prisma.productAsset.findUniqueOrThrow({ where: { id: previous.currentImageAssetId } });
                    assert.deepEqual(Buffer.from(await files[referenceIndex].arrayBuffer()), await readStorageFile(asset.filePath), "reference uses the current active previous image bytes");
                    assert.match(String(form.get("prompt")), /Actual saved neighbor pixels override planned TOP\/BOTTOM JOIN COLOR/);
                  }
                }
              }
              const outgoing = cp.artDirection.detailSeams.find((s: any) => s.fromSectionId === section.id);
              if (outgoing) {
                const next = await prisma.pageSection.findUniqueOrThrow({ where: { id: outgoing.toSectionId } });
                if (next.currentImageAssetId) {
                  assert.match(request, /NEXT (?:DETAIL: its )?top(?: edge)? joins this bottom/);
                  if (cp.creativeVersion === 3) assert.match(request, /NEXT DETAIL FULL FRAME/);
                }
              }
            }
          }
          assert.ok(Buffer.concat(chunks).toString().includes(`name="size"\r\n\r\n${section.type === "HERO" ? "1024x1024" : "1152x1536"}`), "use the exact planned 1:1 or 3:4 size");
        }
        assert.ok(Buffer.concat(chunks).toString().includes(`name="quality"\r\n\r\n${(activeRun.input as any).quality}`));
        imageRequests++;
        if (failCorrection && (activeRun.checkpoint as any).images.some((i: any) => i.state === "generating" && i.correctionCount === 1)) { failCorrection = false; response.writeHead(500); response.end('{"error":{"message":"uncertain correction"}}'); return; }
        const activeProject = await prisma.project.findUniqueOrThrow({ where: { id: activeRun.projectId } });
        if (holdBatchImage && activeProject.description === "BATCH_HOLD") { batchImageWaiting = true; await holdBatchImage; holdBatchImage = undefined; }
        if (failNextImage) { failNextImage = false; response.writeHead(500); response.end('{"error":{"message":"uncertain image request"}}'); return; }
        if (cancelNextImage) {
          cancelNextImage = false;
          const running = await prisma.detailRun.findFirstOrThrow({ where: { status: "RUNNING" } });
          await controlDetailRun(running.projectId, running.id, "cancel", {}, credentials);
          await assert.rejects(() => assertProjectIdle(running.projectId));
        }
        response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify({ data: [{ b64_json: pixels.toString("base64") }] })); return;
      }
      const body = JSON.parse(Buffer.concat(chunks).toString());
      const isBrief = body.tools?.some((v: any) => ["save_creation_brief", "submit_brief_review"].includes(v.function?.name));
      const isProbe = body.tools?.some((v: any) => v.function?.name === "verify_image");
      chatRequests++;
      if (isProbe) assert.ok(["gpt-6-luna", "gpt-6-luna-vision-fixture"].includes(body.model));
      else assert.equal(body.model, isBrief ? "gpt-6-luna-vision-fixture" : "gpt-6-luna");
      assert.equal(body.reasoning_effort, "none", "Luna chat tools require reasoning none");
      if (rejectChat) { response.writeHead(rejectChat); response.end('{"error":{"message":"fixture rejection"}}'); return; }
      const messages = body.messages;
      assert.ok(!body.tools?.some((v: any) => ["generate_image", "correct_image", "finish"].includes(v.function?.name)), "fixed workflow operations must not be exposed to the Agent");
      if (!messages) throw new Error(`Unexpected endpoint ${request.url}`);
      let message: any;
      if (body.tools?.some((v: any) => v.function?.name === "verify_image")) {
        const results = messages.filter((m: any) => m.role === "tool");
        // This vision model supports image input + submission, not tool-result roundtrips.
        if (body.model === "gpt-6-luna-vision-fixture" && results.length) {
          response.writeHead(400); response.end('{"error":{"message":"tool result messages unsupported"}}'); return;
        }
        const imgs = messages.flatMap((m: any) => Array.isArray(m.content) ? m.content.filter((c: any) => c.type === "image_url") : []);
        visualInputs += imgs.length;
        const raw = Buffer.from(imgs.at(-1).image_url.url.split(",")[1], "base64");
        const { data } = await sharp(raw).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        const color = data[0] > data[1] && data[0] > data[2] ? "red" : data[2] > data[0] ? "blue" : "green";
        if (!results.length) message = call("verify_image", { color: wrongProbeColor ? color === "red" ? "blue" : "red" : color });
        else {
          const token = JSON.stringify(results).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0];
          message = call("verify_result", { token: wrongRoundtrip === "token" ? "invalid" : token, color: wrongRoundtrip === "image" ? color === "red" ? "blue" : "red" : color });
        }
      } else if (body.tools?.some((v: any) => v.function?.name === "save_creation_brief")) {
        assert.ok(!messages.some((m: any) => m.role === "tool"), "preparation must finish after saving instead of requesting another model reply");
        if (disconnectBrief > 0) { disconnectBrief--; response.destroy(); return; }
        if (failBrief) { response.writeHead(500); response.end('{"error":{"message":"fixture analysis failure"}}'); return; }
        const imgs = messages.flatMap((m: any) => Array.isArray(m.content) ? m.content.filter((part: any) => part.type === "image_url") : []);
        assert.ok(imgs.length > 0);
        assert.ok(imgs.every((part: any) => part.image_url.detail === "high"));
        briefImageWidth = (await sharp(Buffer.from(imgs[0].image_url.url.split(",")[1], "base64")).metadata()).width!;
        if (!messages.some((m: any) => m.role === "tool")) briefCalls++;
        message = call("save_creation_brief", { name: "Observed product", description: "Red product", category: "books", uncertainties: ["Dimensions unknown"] });
      } else if (body.tools?.some((v: any) => v.function?.name === "submit_brief_review")) {
        assert.ok(!messages.some((m: any) => m.role === "tool"), "review must stop after its submission");
        const parts = messages.find((m: any) => m.role === "user").content;
        const context = JSON.parse(parts.find((p: any) => p.type === "text").text);
        const imgs = parts.filter((p: any) => p.type === "image_url");
        assert.equal(imgs.length, context.originalImageCount + 4, "review includes source images and four detail views");
        assert.equal(context.draft.name, "Observed product");
        assert.ok(imgs.every((p: any) => p.image_url.detail === "high"));
        for (const crop of imgs.slice(-4)) {
          const meta = await sharp(Buffer.from(crop.image_url.url.split(",")[1], "base64")).metadata();
          assert.equal(Math.max(meta.width!, meta.height!), 1024);
        }
        reviewCalls++;
        if (disconnectReview > 0) { disconnectReview--; response.destroy(); return; }
        if (failReview) { response.writeHead(500); response.end('{"error":{"message":"fixture review failure"}}'); return; }
        assert.ok(!body.tools[0].function.parameters.properties.visualDirection, "facts reviewer cannot rewrite art direction");
        message = call("submit_brief_review", { name: "Observed product", description: "Red product, reviewed", category: "books", uncertainties: ["Dimensions unknown"], corrections: ["Removed an unverified claim"] });
      } else if (body.tools?.some((v: any) => v.function?.name === "save_art_direction")) {
        artDesignCalls++;
        if (failArtDesign) { response.writeHead(400); response.end('{"error":{"message":"fixture art direction unavailable"}}'); return; }
        assert.equal(body.tools.length, 1, "prompt designer cannot schedule paid image tools");
        const parts = messages.find((m: any) => m.role === "user").content;
        const context = JSON.parse(parts.find((part: any) => part.type === "text").text);
        const active = await prisma.detailRun.findFirstOrThrow({ where: { status: "RUNNING" } });
        previousDraftInput = context.previousDraft;
        const savedDirection = (active.checkpoint as any).userVisualDirection;
        if (savedDirection) assert.equal(context.userVisualDirection, savedDirection, "original user direction must not be overwritten by the planner's draft style");
        assert.ok(parts.some((part: any) => part.type === "image_url"), "designer sees product images");
        assert.equal(parts.filter((part: any) => part.type === "image_url").length, context.imageRoles.length);
        assert.equal(context.imageRoles.filter((r: any) => r.role.startsWith("STYLE ONLY")).length, 2, "designer receives actual style references");
        designInputs.set(context.sections[0].id, { images: parts.filter((part: any) => part.type === "image_url"), roles: context.imageRoles });
        const direction = context.plan.version === 3 ? flexibleFixture(context.sections) : artDirectionFixture(context.sections, 2);
        assert.equal(body.tool_choice, "required");
        direction.sections[0].textBlocks[0].text = "A considered everyday object";
        if (patchCopy) direction.sections[0].textBlocks[0].text = "高瓶与矮罐，同框呈现";
        if (patchTypography) direction.sections[0].textBlocks[0].typesetting = { lines: [direction.sections[0].textBlocks[0].text], x: 7, y: 8, width: 86, fontSize: 64, weight: "bold", lineHeight: 1.1, align: "left" };
        if (invalidCopyAlways) direction.sections[0].textBlocks[0].text = "参数未知";
        if (invalidArtOnce) { invalidArtOnce = false; direction.sections.forEach(s => { s.composition = "offset_hero"; s.compositionBrief = direction.sections[0].compositionBrief; s.subjectPlacement = direction.sections[0].subjectPlacement; s.camera = direction.sections[0].camera; s.productScale = "dominant"; s.density = "airy"; s.textBlocks = []; s.expression = "photo"; s.typography = null; s.graphicDevice = null; }); }
        if (malformedArt) { direction.sections[0].camera = ""; if (malformedArt === "once") malformedArt = undefined; }
        message = noArtTool ? { role: "assistant", content: "Here is a proposed design, without submitting the required tool." } : call("save_art_direction", direction);
      } else if (body.tools?.some((v: any) => v.function?.name === "submit_design_review")) {
        const parts = messages.find((m: any) => m.role === "user").content;
        assert.ok(Array.isArray(parts), "design review must inspect actual product and style images, not just a text summary");
        const context = JSON.parse(parts.find((part: any) => part.type === "text").text);
        const images = parts.filter((part: any) => part.type === "image_url");
        assert.equal(images.length, context.imageRoles.length);
        assert.ok(images.every((part: any) => part.image_url.detail === "high"));
        assert.deepEqual(images, designInputs.get(context.sectionIds[0])?.images, "review sees original pixels and references");
        assert.deepEqual(context.imageRoles.map((r: any) => r.id), (designInputs.get(context.sectionIds[0])?.roles as any[]).map(r => r.id));
        assert.ok(context.imageRoles.some((role: any) => role.role.startsWith("product identity")));
        const styleIds = context.imageRoles.filter((role: any) => role.role.startsWith("STYLE ONLY")).map((role: any) => role.id);
        assert.ok(context.productEvidence.evidence.every((fact: any) => !styleIds.includes(fact.sourceRef)), "style images are not product fact evidence");
        assert.equal(context.finalDirection.version, 3);
        assert.ok(!('plan' in context), "review must not enforce superseded draft copy or visual tasks");
        assert.ok(context.finalDirection.sections.every((s: any) => s.task && s.title));
        if (context.sellingPoints) {
          assert.equal(context.sellingPoints[0].id, "desk-accent");
          assert.deepEqual(context.contentJobs[0].sellingPointIds, ["desk-accent"], "copy reviewer receives the frame's mapped purchase reason");
        }
        designReviews++;
        if (failDesignReview) { response.writeHead(400); response.end('{"error":{"message":"fixture design review unavailable"}}'); return; }
        message = call("submit_design_review", { passed: !rejectDesign && !patchFact, issues: patchFact ? [{ sectionIds: [context.sectionIds[0]], kind: "fact", message: "仅局部修正有争议的文案" }] : rejectDesign ? [{ sectionIds: context.sectionIds.slice(0, 2), kind: "design", message: "相邻画面重复同一观察，需要不同的构图与信息任务" }] : [], changes: patchFact ? [{ section: { ...context.finalDirection.sections[0], textBlocks: [{ ...context.finalDirection.sections[0].textBlocks[0], text: "色彩，让日常更鲜明" }] }, reason: "仅修正文案中的事实问题", factIds: [context.productEvidence.evidence[0].id] }] : [] });
        if (patchCopy) message = call("submit_design_review", { passed: false, issues: [{ sectionIds: [context.sectionIds[0]], kind: "copy", message: "外观描述缺少买家价值" }], changes: [{ section: { ...context.finalDirection.sections[0], textBlocks: [{ ...context.finalDirection.sections[0].textBlocks[0], text: "给日常桌面，添一抹亮色" }] }, reason: "以已映射的桌面搭配价值改写主张", factIds: context.sellingPoints[0].factIds }] });
        if (patchTypography) {
          const section = structuredClone(context.finalDirection.sections[0]);
          section.textBlocks[0].typesetting = { ...section.textBlocks[0].typesetting, lines: ["A considered", "everyday object"], fontSize: 32, weight: "semibold" };
          message = call("submit_design_review", { passed: false, issues: [{ sectionIds: [section.sectionId], kind: "typography", message: "整句字号过大，需分成两个有主次的短行" }], changes: [{ section, reason: "保留文案，按语义分行并调整字号字重", factIds: [] }] });
        }
      } else if (body.tools?.some((v: any) => v.function?.name === "adapt_storyboard")) {
        adaptiveCalls++;
        if (adaptiveFailure) { response.writeHead(400); response.end('{"error":{"message":"fixture adaptive outage"}}'); return; }
        const context = JSON.parse(messages.find((m: any) => m.role === "user").content.find((p: any) => p.type === "text").text);
        const running = await prisma.detailRun.findFirstOrThrow({ where: { status: "RUNNING" } });
        const cp = running.checkpoint as any;
        assert.ok(Object.values(cp.adaptations).some((r: any) => r.status === "claimed"), "claim is durable before model call");
        assert.ok(context.editableIds.every((id: string) => cp.images.some((i: any) => i.sectionId === id && !i.assetId && !i.attemptKey && i.state === "pending")));
        assert.ok(context.imageRoles.some((r: any) => r.role.startsWith("ACTUAL completed")));
        if (cancelAdaptive) { cancelAdaptive = false; await controlDetailRun(running.projectId, running.id, "cancel", {}, credentials); }
        const section = structuredClone(context.finalDirection.sections.find((s: any) => s.sectionId === context.editableIds[0]));
        section.expression = "photo"; section.typography = null; section.graphicDevice = null; section.textBlocks = [];
        section.compositionBrief = "A distant overhead composition with small product at the bottom right; no title zone.";
        section.expressionReason = "The preceding two results repeated the same title zone; let photography carry this task.";
        message = call("adapt_storyboard", { passed: false, issues: [{ sectionIds: [section.sectionId], kind: "design", message: "调整后续图，避免延续已出现的重复版式" }], changes: [{ section, reason: "改为远景摄影，让阅读节奏有疏密变化", factIds: [] }] });
      } else if (body.tools?.some((v: any) => v.function?.name === "submit_page_review")) {
        if (failPageReview) { response.writeHead(400); response.end('{"error":{"message":"fixture page review unavailable"}}'); return; }
        const parts = messages.find((m: any) => m.role === "user").content;
        const context = JSON.parse(parts.find((part: any) => part.type === "text").text);
        const active = await prisma.detailRun.findFirstOrThrow({ where: { status: "RUNNING" } });
        assert.equal(parts.filter((part: any) => part.type === "image_url").length, context.imageOrder.length + ((active.checkpoint as any).styleReferences?.length || 0));
        pageReviews++;
        message = call("submit_page_review", { passed: !rejectPage, issues: rejectPage ? [{ sectionIds: [context.imageOrder[0].sectionId], message: "Fixture repeated page composition" }] : [] });
      } else if (body.tools?.some((v: any) => v.function?.name === "submit_check") && !body.tools?.some((v: any) => v.function?.name === "save_plan")) {
        if (failImageReview) { response.writeHead(400); response.end('{"error":{"message":"fixture individual review unavailable"}}'); return; }
        const reviewContext = JSON.parse(messages.find((m: any) => m.role === "user").content.find((part: any) => part.type === "text").text);
        const reviewSection = await prisma.pageSection.findUniqueOrThrow({ where: { id: reviewContext.sectionId } });
        assert.equal(reviewContext.actualDimensions.width, 120); assert.equal(reviewContext.actualDimensions.height, 160);
        assert.equal(reviewContext.generationBrief, reviewSection.visualPrompt, "review must receive the same complete brief, including planned headlines");
        const running = await prisma.detailRun.findFirstOrThrow({ where: { status: "RUNNING" } });
        const cp: any = running.checkpoint;
        const image = cp.images.find((i: any) => i.state === "generated" && i.viewedAssetId === i.assetId);
        assert.ok(image, "workflow must provide the generated image before review");
        const reviewedProject = await prisma.project.findUniqueOrThrow({ where: { id: running.projectId } });
        const pass = !alwaysRejectImage && !((rejectCoverOnly || reviewedProject.description === "REJECT_COVER") && image === cp.images[0]) && !(correctFirst && image.correctionCount === 0);
        if (!pass) correctFirst = false;
        const directed = cp.artDirection?.sections.some((s: any) => s.sectionId === image.sectionId);
        assert.equal(Boolean(reviewContext.artDirection), Boolean(directed));
        if (cp.creativeVersion === 2) {
          assert.equal(reviewContext.imageRoles.filter((r: any) => r.role.startsWith("STYLE ONLY")).length, 2);
          const earlierCount = cp.images.slice(0, cp.images.indexOf(image)).filter((i: any) => i.assetId).slice(-2).length;
          assert.equal(reviewContext.imageRoles.filter((r: any) => r.role.startsWith("earlier generated")).length, earlierCount);
        }
        const rhythmFailed = repeatRhythm && [1, 4].includes(cp.images.indexOf(image));
        const seamFailed = Boolean(rejectSeam && reviewContext.detailSeams?.incoming && cp.artDirection.detailSeams[0].toSectionId === image.sectionId);
        if (reviewContext.detailSeams?.incoming) {
          const previous = await prisma.pageSection.findUniqueOrThrow({ where: { id: reviewContext.detailSeams.incoming.fromSectionId } });
          if (previous.currentImageAssetId) assert.ok(reviewContext.imageRoles.some((r: any) => r.id === previous.id && r.role.includes("SEAM comparison")), "review compares actual neighboring pixels, not only the written palette");
        }
        message = call("submit_check", { sectionId: image.sectionId, passed: pass, issues: rhythmFailed ? ["实际画面的主体比例和标题位置重复，请调整未生成图的镜头距离"] : seamFailed ? ["顶部与上一屏底部有明显色差，请将顶部衔接色调整为计划中的共享色"] : rejectComposition ? ["Fixture composition does not match storyboard"] : pass ? [] : ["Fixture typography issue"], visualQuality: directed ? { hierarchy: true, composition: !rejectComposition, lighting: true, typography: reviewContext.artDirection?.expression === "photo" ? "not_applicable" : pass, ...((cp.creativeVersion || 0) >= 2 ? { referenceStyle: true, distinctness: !rhythmFailed } : {}), ...(cp.artDirection?.layoutVersion === 1 ? { continuity: !seamFailed } : {}) } : null });
      } else {
        const running = await prisma.detailRun.findFirstOrThrow({ where: { status: "RUNNING" }, include: { project: true } });
        const cp: any = running.checkpoint;
        const input: any = running.input;
        if (disconnectPlanner > 0 && cp.events.some((e: any) => e.tool === "read_product")) {
          disconnectPlanner--;
          response.writeHead(200, { "Content-Type": "application/json", "Content-Length": "10000" });
          response.write('{"id":"interrupted-model-result",');
          setTimeout(() => response.destroy(), 10);
          return;
        }
        if (!cp.events.some((e: any) => e.tool === "read_product")) message = call("read_product", {});
        else if (["ASK", "BLOCK"].includes(running.project.description ?? "") && !cp.answers.length) message = call("ask_user", { questions: [{ text: "确认商品规格", blocking: running.project.description === "BLOCK", requiresImage: running.project.description === "BLOCK" }] });
        else if (!cp.plan && input.mode === "xhs") message = call("save_plan", { productName: "Small space organization", facts: [], style: "Consistent cream background, dark typography and simple editorial illustrations.", sections: Array.from({ length: 5 }, (_, i) => ({ kind: "DETAIL", title: `Page ${i+1}`, copy: "Useful organizing advice", prompt: "Xiaohongshu editorial illustration, exact short title and useful organization steps, cream and charcoal style." })), post: { title: "Small space, more room", caption: "Start with one drawer. Sort by everyday use and keep frequently used objects accessible.", hashtags: ["organization", "smallspace", "home"], language: "en-US" } });
        else if (!cp.plan && input.mode === "create") {
          const source = await prisma.productAsset.findFirstOrThrow({ where: { projectId: running.projectId, type: "MAIN" } });
          const initial = messages.find((m: any) => m.role === "user").content;
          planningDraftInput = JSON.parse(typeof initial === "string" ? initial : initial.find((p: any) => p.type === "text").text).checkpoint.planDraft;
          const plan = cp.creativeVersion === 3 ? intentFixture(source.id, input.heroCount, input.detailCount) : commercePlanFixture(source.id, input.heroCount, input.detailCount);
          if (quoteAnswerSources) for (const [i, quote] of ["产地云南", "保质期一个月", "重量300g"].entries()) plan.evidence.push({ id: `user-${i}`, claim: quote, source: "user", sourceRef: quote });
          if (invalidPlan) { plan.sections[0].factIds = ["missing-fact"]; if (invalidPlan === "once") invalidPlan = undefined; }
          message = call("save_plan", plan);
        }
        else {
          const image = cp.images.find((i: any) => i.state !== "uncertain" && (i.state !== "checked" || (!i.check?.passed && i.correctionCount < 1)));
          if (!image) message = call("finish", { summary: "All available images checked." });
          else if (image.state === "pending") message = call("generate_image", { sectionId: image.sectionId, prompt: "Generate the planned product photograph with clear typography." });
          else if (image.state === "generated" && duplicateOnce) { duplicateOnce = false; message = call("generate_image", { sectionId: image.sectionId, prompt: "Duplicate request must return existing result without charging." }); }
          else if (image.viewedAssetId !== image.assetId) message = call("read_image", { sectionId: image.sectionId });
          else if (image.state !== "checked") { const pass = !alwaysRejectImage && !(correctFirst && image.correctionCount === 0); if (!pass) correctFirst = false; message = call("submit_check", { sectionId: image.sectionId, passed: pass, issues: pass ? [] : ["Fixture typography issue"], visualQuality: null }); }
          else message = call("correct_image", { sectionId: image.sectionId, prompt: "Fix the typography while preserving the reference product." });
        }
      }
      response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify({ id: `chat-${toolCalls}`, object: "chat.completion", created: 1, model: "fixture-agent", choices: [{ index: 0, finish_reason: message.tool_calls ? "tool_calls" : "stop", message }], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } }));
    } catch (error) { response.writeHead(500); response.end(JSON.stringify({ error: { message: String(error) } })); }
  });
  function call(name: string, args: unknown) { toolCalls++; return { role: "assistant", content: null, tool_calls: [{ id: `call-${toolCalls}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] }; }
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  credentials.baseUrl = `http://127.0.0.1:${(server.address() as any).port}/v1`;
  const provider = await prisma.providerConfig.create({ data: { name: "Fixture", baseUrl: credentials.baseUrl, apiKeyEncrypted: "", isActive: true } });
  await prisma.modelProfile.create({ data: { providerConfigId: provider.id, modelId: "gpt-6-luna", label: "Fixture", capabilities: { text: true, vision: true }, roles: [], isDefaultPlanning: true } });
  const visionModel = await prisma.modelProfile.create({ data: { providerConfigId: provider.id, modelId: "gpt-6-luna-vision-fixture", label: "Fixture vision", capabilities: { text: true, vision: true }, roles: [], isDefaultAnalysis: true } });
  await prisma.modelProfile.create({ data: { providerConfigId: provider.id, modelId: "gpt-image-2.5-sunburst", label: "Fixture image", capabilities: { image_gen: true, image_edit: true }, roles: [], isDefaultDetailImage: true, isDefaultImageEdit: true } });
  async function project(description = "", image = pixels) {
    const p = await prisma.project.create({ data: { name: "Fixture product", platform: "general_ecommerce", style: "generic_clean", description } });
    await saveUploadAsset({ projectId: p.id, type: "MAIN", fileName: "fixture.png", fileBuffer: image, mimeType: "image/png", sortOrder: 0, isMain: true });
    return p;
  }
  async function settled(projectId: string, status?: string) {
    for (let n = 0; n < 500; n++) {
      const run = await getDetailRun(projectId);
      if (run && (status ? run.status === status : !["RUNNING", "PENDING"].includes(run.status))) { await new Promise(r => setTimeout(r, 30)); return run; }
      await new Promise(r => setTimeout(r, 20));
    }
    throw new Error(`Run did not settle: ${JSON.stringify(await getDetailRun(projectId))}`);
  }
  const input = { idempotencyKey: "fixture-create-1", heroCount: 3, detailCount: 4 };
  try {
    await t.test("authentication and rate-limit errors block startup without image requests", async () => {
      const p = await project();
      for (const status of [401, 429]) {
        rejectChat = status;
        await assert.rejects(() => inCredentials(() => createDetailRun(p.id, input, credentials)));
        assert.equal(await prisma.detailRun.count({ where: { projectId: p.id } }), 0);
        assert.equal(imageRequests, 0);
      }
      rejectChat = 0;
    });
    await t.test("SDK planning and review, deterministic generation, one correction and idempotent startup", async () => {
      const p = await project();
      const a = await inCredentials(() => createDetailRun(p.id, input, credentials));
      const b = await inCredentials(() => createDetailRun(p.id, input, credentials));
      assert.equal(a!.id, b!.id);
      const done = await settled(p.id);
      assert.equal(done.status, "COMPLETED", JSON.stringify(done));
      assert.equal(imageRequests, 8, "7 images + one correction, no duplicate request");
      assert.equal(pageReviews, 1);
      assert.equal(artDesignCalls, 1, "one prompt-design call for the whole set");
      assert.equal((done.checkpoint as any).artDirection.sections.length, 7);
      assert.equal((done.checkpoint as any).setReview.passed, true);
      const planned = await prisma.pageSection.findFirstOrThrow({ where: { projectId: p.id } });
      assert.ok((planned.editableData as any).commerceBrief.factIds.length);
      assert.match(planned.visualPrompt, /EXACT FINAL VISIBLE COPY/);
      assert.ok(visualInputs >= 2);
      assert.equal(await prisma.sectionVersion.count({ where: { section: { projectId: p.id } } }), 8);
      const savedImages = await prisma.productAsset.findMany({ where: { projectId: p.id, type: "GENERATED" } });
      assert.ok(savedImages.length > 0);
      assert.ok(savedImages.every(asset => (asset.metadata as any)?.visualCheck?.assetId === asset.id), "checks persist on each version, not only the latest run");
      const first = await prisma.pageSection.findFirstOrThrow({ where: { projectId: p.id }, orderBy: { order: "asc" }, include: { versions: true } });
      assert.equal(first.copy, "A considered everyday object", "director's audited copy replaces draft copy");
      assert.equal((first.editableData as any).commerceBrief.copy, first.copy);
      assert.equal((done.checkpoint as any).plan.sections[0].copy, first.copy);
      assert.equal((done.checkpoint as any).artDirection.sections[0].textBlocks[0].text, first.copy);
      assert.ok(first.versions.every(v => v.copySnapshot === first.copy));
      assert.equal((done.checkpoint as any).styleReferences.length, 2);
      assert.ok(!JSON.stringify(await prisma.detailRun.findMany()).includes(credentials.apiKey));
      const image = await exportLongImage(p.id); const meta = await sharp(image).metadata();
      assert.equal(meta.width, 1080); assert.equal(meta.height, 5760);
    });
    await t.test("a disconnected planning request retries without replaying prior tools or images", async () => {
      const p = await project(), before = imageRequests; disconnectPlanner = 1;
      try {
        await inCredentials(() => createDetailRun(p.id, input, credentials));
        const done = await settled(p.id), cp = done.checkpoint as any;
        assert.equal(done.status, "COMPLETED"); assert.equal(disconnectPlanner, 0);
        assert.equal(cp.events.filter((e: any) => e.tool === "read_product").length, 1);
        assert.equal(cp.events.filter((e: any) => e.tool === "save_plan").length, 1);
        assert.equal(imageRequests - before, 7);
      } finally { disconnectPlanner = 0; }
    });
    await t.test("persistent planning disconnect preserves answers and resumes the same run", async () => {
      const p = await project("ASK"), before = imageRequests;
      await inCredentials(() => createDetailRun(p.id, input, credentials));
      const waiting = await settled(p.id); disconnectPlanner = 2;
      try {
        await inCredentials(() => controlDetailRun(p.id, waiting.id, "answers", { answer: "Keep these supplied facts" }, credentials));
        const failed = await settled(p.id), cp = failed.checkpoint as any;
        assert.equal(failed.status, "FAILED"); assert.equal(disconnectPlanner, 0);
        assert.equal(cp.failure.code, "PROVIDER_CONNECTION_INTERRUPTED");
        assert.deepEqual(cp.answers, ["Keep these supplied facts"]);
        assert.equal(imageRequests, before);
        await inCredentials(() => controlDetailRun(p.id, waiting.id, "resume", {}, credentials));
        const done = await settled(p.id);
        assert.equal(done.id, waiting.id); assert.equal(done.status, "COMPLETED");
        assert.deepEqual((done.checkpoint as any).answers, cp.answers);
        assert.equal(imageRequests - before, 7);
      } finally { disconnectPlanner = 0; }
    });
    await t.test("rejected planning drafts retain exact feedback and resume repairs the saved draft", async () => {
      const p = await project(), before = imageRequests;
      invalidPlan = "always";
      try {
        await inCredentials(() => createDetailRun(p.id, input, credentials));
        const failed = await settled(p.id), cp = failed.checkpoint as any;
        assert.equal(failed.status, "FAILED");
        assert.equal(failed.stage, "商品卖点方案待修正");
        assert.equal(cp.failure.code, "PLANNING_REVIEW_FAILED");
        assert.equal(cp.failure.phase, "商品卖点方案需调整");
        assert.equal(cp.plan, undefined); assert.ok(cp.planDraft);
        assert.ok(cp.planningReview.issues.some((s: string) => s.includes("Unknown fact reference")));
        assert.equal(cp.events.filter((e: any) => e.tool === "save_plan").length, 2);
        assert.equal(imageRequests, before);
        invalidPlan = undefined;
        await inCredentials(() => controlDetailRun(p.id, failed.id, "resume", {}, credentials));
        const done = await settled(p.id), saved = done.checkpoint as any;
        assert.equal(done.status, "COMPLETED");
        assert.deepEqual(planningDraftInput, cp.planDraft);
        assert.equal(saved.planDraft, undefined); assert.equal(saved.planningReview, undefined);
        assert.equal(imageRequests - before, 7);
      } finally { invalidPlan = undefined; }
    });
    await t.test("literal user-answer provenance is repaired before saving without a planner retry", async () => {
      const p = await project("ASK"), before = imageRequests;
      try {
        await inCredentials(() => createDetailRun(p.id, input, credentials));
        const waiting = await settled(p.id); assert.equal(waiting.status, "WAITING_INPUT");
        quoteAnswerSources = true;
        await inCredentials(() => controlDetailRun(p.id, waiting.id, "answers", { answer: "产地云南，保质期一个月，重量300g" }, credentials));
        const done = await settled(p.id), cp = done.checkpoint as any;
        assert.equal(done.status, "COMPLETED");
        assert.deepEqual(cp.plan.evidence.filter((e: any) => e.source === "user").map((e: any) => e.sourceRef), ["user_answer_0", "user_answer_0", "user_answer_0"]);
        assert.equal(cp.events.filter((e: any) => e.tool === "save_plan").length, 1);
        assert.equal(cp.planningReview, undefined); assert.equal(imageRequests - before, 7);
      } finally { quoteAnswerSources = false; }
    });
    await t.test("one invalid plan can be corrected in the same run", async () => {
      const p = await project(); invalidPlan = "once";
      try {
        await inCredentials(() => createDetailRun(p.id, input, credentials));
        const done = await settled(p.id), cp = done.checkpoint as any;
        assert.equal(done.status, "COMPLETED");
        assert.equal(cp.events.filter((e: any) => e.tool === "save_plan").length, 2);
        assert.equal(cp.planningReview, undefined);
      } finally { invalidPlan = undefined; }
    });
    await t.test("questions persist and answers resume without duplicate run", async () => {
      const p = await project("ASK");
      const run = await inCredentials(() => createDetailRun(p.id, input, credentials));
      const waiting = await settled(p.id); assert.equal(waiting.status, "WAITING_INPUT");
      await inCredentials(() => controlDetailRun(p.id, run!.id, "answers", { skip: true }, credentials));
      assert.equal((await settled(p.id)).status, "COMPLETED");
    });
    await t.test("preparation uses selected vision model with high detail, preserves resolution, caches and deduplicates", async () => {
      const { prepareBrief } = await import("../lib/detail-runs/brief");
      const original = await sharp({ create: { width: 1800, height: 1400, channels: 3, background: "red" } }).png().toBuffer();
      const p = await project("", original);
      await saveUploadAsset({ projectId: p.id, type: "REFERENCE", purpose: "style_reference", fileName: "style.png", fileBuffer: pixels, mimeType: "image/png", sortOrder: 1 });
      const before = imageRequests;
      const callsBefore = briefCalls;
      const reviewsBefore = reviewCalls;
      const [a, b] = await inCredentials(() => Promise.all([prepareBrief(p.id), prepareBrief(p.id)]));
      assert.deepEqual(a, b);
      assert.equal(a.name, "Observed product");
      assert.equal(briefCalls - callsBefore, 1);
      assert.equal(reviewCalls - reviewsBefore, 1, "one fixed review per analysis, shared by concurrent requests");
      assert.equal(a.description, "Red product, reviewed", "only the reviewed brief is returned");
      assert.match(a.recommendedVisualDirection!, /编辑式大字/);
      assert.equal(briefImageWidth, 1800, "recognition must not reduce the original to the old 1200px cap");
      assert.equal(a.recognition?.modelId, visionModel.modelId);
      assert.equal(a.recognition?.imageCount, 1);
      assert.equal(a.recognition?.detail, "high");
      assert.equal(a.recognition?.reviewed, true);
      assert.equal(a.recognition?.detailViewCount, 4);
      assert.deepEqual(await inCredentials(() => prepareBrief(p.id)), a);
      assert.equal(briefCalls - callsBefore, 1, "cached preparation must not charge again");
      assert.equal(reviewCalls - reviewsBefore, 1, "cached preparation must not review again");
      assert.equal(imageRequests, before);
      const saved = await prisma.project.findUniqueOrThrow({ where: { id: p.id } });
      assert.deepEqual((saved.modelSnapshot as any).creationBrief, a);
      assert.ok(!JSON.stringify(saved).includes(credentials.apiKey));
    });
    await t.test("brief recovers socket failures in recognition and review without generating images", async () => {
      const { prepareBrief } = await import("../lib/detail-runs/brief");
      const p = await project();
      const before = imageRequests, recognizedBefore = briefCalls, reviewedBefore = reviewCalls;
      disconnectBrief = 1; disconnectReview = 1;
      try {
        const result = await inCredentials(() => prepareBrief(p.id));
        assert.equal(result.recognition?.reviewed, true);
        assert.equal(disconnectBrief, 0); assert.equal(disconnectReview, 0);
        assert.equal(briefCalls - recognizedBefore, 1, "only one successful analysis");
        assert.equal(reviewCalls - reviewedBefore, 2, "review is retried once");
        assert.equal(imageRequests, before);
      } finally { disconnectBrief = 0; disconnectReview = 0; }
    });
    await t.test("failed review persists a private draft; repeated resume completes only review", async () => {
      const { prepareBrief } = await import("../lib/detail-runs/brief");
      const { BriefPreparationError } = await import("../lib/detail-runs/brief-recovery");
      const p = await project();
      const before = imageRequests, recognizedBefore = briefCalls, reviewedBefore = reviewCalls;
      failReview = true;
      try {
        await assert.rejects(() => inCredentials(() => prepareBrief(p.id)), (e: unknown) => e instanceof BriefPreparationError && /继续复核/.test(e.message));
      } finally { failReview = false; }
      const saved = await prisma.project.findUniqueOrThrow({ where: { id: p.id } });
      assert.equal((saved.modelSnapshot as any).creationBriefDraft.observations.name, "Observed product");
      assert.ok(!(saved.modelSnapshot as any).creationBrief, "unreviewed observations are not published");
      assert.ok(!JSON.stringify(saved.modelSnapshot).includes(credentials.apiKey));
      assert.ok(!JSON.stringify(saved.modelSnapshot).includes("data:image"));
      assert.equal(reviewCalls - reviewedBefore, 2, "automatic retry has a hard limit");
      (globalThis as any).creationBriefJobs.clear(); // Recovery uses persisted data, not the previous job.
      const [a, b] = await inCredentials(() => Promise.all([prepareBrief(p.id, { resume: true }), prepareBrief(p.id, { resume: true })]));
      assert.deepEqual(a, b);
      assert.equal(briefCalls - recognizedBefore, 1, "resume must not repeat completed recognition");
      assert.equal(reviewCalls - reviewedBefore, 3, "duplicate clicks share one review");
      assert.equal(imageRequests, before);
      const final = await prisma.project.findUniqueOrThrow({ where: { id: p.id } });
      assert.equal((final.modelSnapshot as any).creationBriefDraft, null);
      assert.equal((final.modelSnapshot as any).creationBrief.recognition.reviewed, true);
    });
    await t.test("changed product inputs invalidate a pending recognition draft", async () => {
      const { prepareBrief } = await import("../lib/detail-runs/brief");
      const p = await project();
      const before = briefCalls;
      failReview = true;
      try { await assert.rejects(() => inCredentials(() => prepareBrief(p.id))); }
      finally { failReview = false; }
      await prisma.project.update({ where: { id: p.id }, data: { description: "A newly supplied product fact" } });
      await inCredentials(() => prepareBrief(p.id, { resume: true }));
      assert.equal(briefCalls - before, 2, "old facts must not be reused for changed input");
    });
    await t.test("explicit reanalysis refreshes legacy cache once; failures retain it and missing vision selection never falls back", async () => {
      const { prepareBrief } = await import("../lib/detail-runs/brief");
      const p = await project();
      const legacy = { name: "Legacy result", description: "Old observations", visualDirection: "Old style", uncertainties: [] };
      await prisma.project.update({ where: { id: p.id }, data: { modelSnapshot: { creationBrief: legacy } } });
      const before = briefCalls;
      assert.deepEqual(await inCredentials(() => prepareBrief(p.id)), legacy);
      assert.equal(briefCalls, before);
      const [a, b] = await inCredentials(() => Promise.all([prepareBrief(p.id, { force: true }), prepareBrief(p.id, { force: true })]));
      assert.deepEqual(a, b);
      assert.equal(a.name, "Observed product");
      assert.equal(briefCalls - before, 1);
      assert.equal(a.recognition?.modelId, visionModel.modelId);
      failBrief = true;
      try { await assert.rejects(() => inCredentials(() => prepareBrief(p.id, { force: true }))); }
      finally { failBrief = false; }
      assert.deepEqual(await inCredentials(() => prepareBrief(p.id)), a, "failed reanalysis must preserve the last saved result");
      failReview = true;
      try { await assert.rejects(() => inCredentials(() => prepareBrief(p.id, { force: true }))); }
      finally { failReview = false; }
      assert.deepEqual(await inCredentials(() => prepareBrief(p.id)), a, "failed review must not publish the unreviewed draft");
      await prisma.modelProfile.update({ where: { id: visionModel.id }, data: { isDefaultAnalysis: false } });
      try { await assert.rejects(() => inCredentials(() => prepareBrief(p.id, { force: true })), /图像识别模型/); }
      finally { await prisma.modelProfile.update({ where: { id: visionModel.id }, data: { isDefaultAnalysis: true } }); }
    });
    await t.test("vision-only compatibility does not bypass the planner roundtrip check for the same model", async () => {
      const { resolveAgentConnection } = await import("../lib/detail-runs/provider");
      assert.equal((await inCredentials(() => resolveAgentConnection(false, "analysis"))).modelId, visionModel.modelId);
      await prisma.modelProfile.updateMany({ where: { providerConfigId: provider.id }, data: { isDefaultPlanning: false } });
      await prisma.modelProfile.update({ where: { id: visionModel.id }, data: { isDefaultPlanning: true } });
      try {
        await assert.rejects(() => inCredentials(() => resolveAgentConnection()), /HTTP 400/);
      } finally {
        await prisma.modelProfile.update({ where: { id: visionModel.id }, data: { isDefaultPlanning: false } });
        await prisma.modelProfile.updateMany({ where: { providerConfigId: provider.id, modelId: "gpt-6-luna" }, data: { isDefaultPlanning: true } });
      }
    });
    await t.test("vision checks report HTTP reasons, stop on auth/rate limits and reject incorrect image observations", async () => {
      const { resolveAgentConnection } = await import("../lib/detail-runs/provider");
      const rootUrl = credentials.baseUrl.replace(/\/v1$/, "");
      const beforeRoot = chatRequests;
      const rooted = await runWithProviderCredentials({ ...credentials, baseUrl: rootUrl }, () => resolveAgentConnection(true, "analysis"));
      assert.equal(rooted.baseUrl, credentials.baseUrl);
      assert.equal(chatRequests - beforeRoot, 1, "bare gateway URL should use /v1 directly, without two failing root requests");
      for (const status of [401, 429]) {
        const before = chatRequests;
        rejectChat = status;
        try { await assert.rejects(() => inCredentials(() => resolveAgentConnection(true, "analysis")), new RegExp(`HTTP ${status}`)); }
        finally { rejectChat = 0; }
        assert.equal(chatRequests - before, 1, "authentication and quota failures must not fan out to other endpoints");
      }
      wrongProbeColor = true;
      try { await assert.rejects(() => inCredentials(() => resolveAgentConnection(true, "analysis")), /未正确识别输入图片/); }
      finally { wrongProbeColor = false; }
    });
    await t.test("SDK network denial is logged, reported accurately and never fans out", async () => {
      const { resolveAgentConnection } = await import("../lib/detail-runs/provider");
      const { handleRouteError } = await import("../lib/utils/route");
      const originalFetch = globalThis.fetch;
      let attempts = 0;
      globalThis.fetch = async () => {
        attempts++;
        throw new TypeError("fetch failed", { cause: new AggregateError([{ code: "EACCES" }]) });
      };
      try {
        await assert.rejects(() => inCredentials(() => resolveAgentConnection(true, "analysis")), error => {
          assert.equal(handleRouteError(error).status, 503);
          assert.match((error as Error).message, /外网访问被运行环境限制/);
          return true;
        });
      } finally { globalThis.fetch = originalFetch; }
      assert.equal(attempts, 1);
      const records = (await readFile(path.join(dir, "storage", "monitor", "api-usage.jsonl"), "utf8")).trim().split("\n").map(line => JSON.parse(line));
      assert.equal(records.at(-1).statusCode, 0);
      assert.equal(records.at(-1).success, false);
      assert.match(records.at(-1).errorMessage, /EACCES/);
      assert.ok(!JSON.stringify(records.at(-1)).includes(credentials.apiKey));
    });
    await t.test("planner validates returned image and token through structured tool results", async () => {
      const { resolveAgentConnection } = await import("../lib/detail-runs/provider");
      for (const mismatch of ["token", "image"] as const) {
        wrongRoundtrip = mismatch;
        try { await assert.rejects(() => inCredentials(() => resolveAgentConnection(true)), mismatch === "token" ? /未正确回传工具返回的校验值/ : /返回图片或校验文本未通过/); }
        finally { wrongRoundtrip = undefined; }
      }
      assert.equal((await inCredentials(() => resolveAgentConnection(true))).transport, "chat");
    });
    await t.test("uncertain requests are not retried until explicit user action", async () => {
      const p = await project(); failNextImage = true;
      const count = imageRequests;
      const run = await inCredentials(() => createDetailRun(p.id, input, credentials));
      assert.equal((await settled(p.id)).status, "PARTIAL"); assert.equal(imageRequests - count, 7, "an uncertain first hero cannot erase the remaining six requests");
      await inCredentials(() => controlDetailRun(p.id, run!.id, "resume", {}, credentials));
      await settled(p.id); assert.equal(imageRequests - count, 7, "resume skips uncertain requests without explicit approval");
      await exportLongImage(p.id); // All DETAIL images exist even when one HERO is missing.
      await inCredentials(() => controlDetailRun(p.id, run!.id, "resume", { retryUncertain: true }, credentials));
      assert.equal((await settled(p.id)).status, "COMPLETED"); assert.equal(imageRequests - count, 8);
    });
    await t.test("cancel saves in-flight image; resume only generates remaining images", async () => {
      const p = await project(); cancelNextImage = true; const count = imageRequests;
      const run = await inCredentials(() => createDetailRun(p.id, input, credentials));
      assert.equal((await settled(p.id)).status, "CANCELED");
      await new Promise(r => setTimeout(r, 100));
      assert.equal(imageRequests - count, 1);
      await inCredentials(() => controlDetailRun(p.id, run!.id, "resume", {}, credentials));
      assert.equal((await settled(p.id)).status, "COMPLETED"); assert.equal(imageRequests - count, 7);
    });
    await t.test("expired execution lease becomes interrupted", async () => {
      const p = await project();
      await prisma.detailRun.create({ data: { projectId: p.id, idempotencyKey: "expired-run", input, checkpoint: { images: [], answers: [], events: [], toolCalls: 0 }, status: "RUNNING", leaseToken: "expired", leaseUntil: new Date(0) } });
      assert.equal((await getDetailRun(p.id))!.status, "INTERRUPTED");
    });
    await t.test("long image order and correction budget", async () => {
      const blue = await sharp({ create: { width: 120, height: 60, channels: 3, background: "blue" } }).png().toBuffer();
      const result = await stitchDetailImages([pixels, blue]);
      const { data, info } = await sharp(result).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(info.width, 1080); assert.equal(info.height, 1980);
      assert.ok(data[0] > 200); assert.ok(data[(info.height - 1) * info.width * 3 + 2] > 200);
      assert.equal(mayGenerate({ sectionId: "x", title: "x", state: "checked", assetId: "a", correctionCount: 1, check: { passed: false, issues: [], assetId: "a" } }, true), false);
    });
    await t.test("blocking questions require new materials and cannot be skipped", async () => {
      const p = await project("BLOCK");
      const run = await inCredentials(() => createDetailRun(p.id, input, credentials));
      assert.equal((await settled(p.id)).status, "WAITING_INPUT");
      await assert.rejects(() => inCredentials(() => controlDetailRun(p.id, run!.id, "answers", { skip: true }, credentials)));
      await assert.rejects(() => inCredentials(() => controlDetailRun(p.id, run!.id, "answers", { answer: "Product" }, credentials)));
      await saveUploadAsset({ projectId: p.id, type: "ANGLE", fileName: "extra.png", fileBuffer: pixels, mimeType: "image/png", sortOrder: 1, isMain: false });
      await inCredentials(() => controlDetailRun(p.id, run!.id, "answers", { answer: "Product" }, credentials));
      assert.equal((await settled(p.id)).status, "COMPLETED");
    });
    await t.test("detail seam failure uses one correction and remains partial instead of adding paid retries", async () => {
      const p = await project(); const before = imageRequests; rejectSeam = true; correctFirst = false;
      try {
        await inCredentials(() => createDetailRun(p.id, input, credentials));
        const done = await settled(p.id); const cp = done.checkpoint as any;
        assert.equal(done.status, "PARTIAL");
        assert.equal(imageRequests - before, 8, "seven images plus only one seam correction");
        const target = cp.images.find((s: any) => s.sectionId === cp.artDirection.detailSeams[0].toSectionId);
        assert.equal(target.correctionCount, 1);
        assert.equal(target.check.visualQuality.continuity, false);
        assert.equal(target.check.passed, false);
        await inCredentials(() => controlDetailRun(p.id, done.id, "resume", {}, credentials));
        await settled(p.id);
        assert.equal(imageRequests - before, 8, "resume does not reset the seam correction budget");
      } finally { rejectSeam = false; }
    });
    await t.test("failed visual reviews preserve the complete set with at most one correction per frame", async () => {
      const p = await project(); const count = imageRequests; alwaysRejectImage = true;
      try {
        await inCredentials(() => createDetailRun(p.id, input, credentials));
        const done = await settled(p.id);
        assert.equal(done.status, "PARTIAL");
        assert.equal(imageRequests - count, 14, "seven initial requests + at most one correction for each");
        assert.equal((done.checkpoint as any).images[0].correctionCount, 1);
        assert.equal((done.checkpoint as any).firstHeroGate.passed, false);
        assert.ok((done.checkpoint as any).images.every((i: any) => i.correctionCount === 1 && i.assetId));
        await exportLongImage(p.id);
        await inCredentials(() => controlDetailRun(p.id, done.id, "resume", {}, credentials));
        await settled(p.id);
        assert.equal(imageRequests - count, 14, "resume must not reset correction budgets");
      } finally { alwaysRejectImage = false; }
    });
    await t.test("art direction failure blocks image charges and resume designs the saved plan", async () => {
      const p = await project(); const before = imageRequests; failArtDesign = true;
      await prisma.project.update({ where: { id: p.id }, data: { modelSnapshot: { agentVisualStyle: "Original user direction: warm editorial lighting" } } });
      const run = await inCredentials(() => createDetailRun(p.id, input, credentials));
      try {
        const failed = await settled(p.id);
        assert.equal(failed.status, "FAILED");
        assert.equal((failed.checkpoint as any).failure.code, "PROVIDER_HTTP_ERROR");
        assert.match(failed.error!, /HTTP 400/);
        assert.ok((failed.checkpoint as any).plan);
        assert.equal((failed.checkpoint as any).artDirection, undefined);
        assert.equal(imageRequests, before, "no image is charged without a valid storyboard");
        assert.equal((failed.checkpoint as any).userVisualDirection, "Original user direction: warm editorial lighting");
      } finally { failArtDesign = false; }
      const ids = (await prisma.pageSection.findMany({ where: { projectId: p.id }, orderBy: { order: "asc" } })).map(s => s.id);
      await assert.rejects(() => inCredentials(() => createDetailRun(p.id, {...input,idempotencyKey:"bypass-storyboard",mode:"regenerate",sectionId:ids[0]},credentials)), /定稿/);
      await inCredentials(() => controlDetailRun(p.id, run!.id, "resume", {}, credentials));
      const done = await settled(p.id);
      assert.equal(done.status, "COMPLETED");
      assert.deepEqual((done.checkpoint as any).images.map((s: any) => s.sectionId), ids, "saved merchandising sections are reused");
      assert.equal(imageRequests - before, 7);
    });
    await t.test("resume revalidates and reviews a saved valid draft without another designer call", async () => {
      const p = await project(), before = imageRequests;
      failDesignReview = true;
      try {
        await inCredentials(() => createDetailRun(p.id, input, credentials));
        const failed = await settled(p.id), cp = failed.checkpoint as any;
        assert.equal(failed.status, "FAILED");
        assert.ok(cp.designDraft); assert.equal(cp.artDirection, undefined);
        assert.equal(imageRequests, before);
        const designs = artDesignCalls, audits = designReviews;
        failDesignReview = false;
        failArtDesign = true; // Resuming a valid draft must not need the designer.
        await inCredentials(() => controlDetailRun(p.id, failed.id, "resume", {}, credentials));
        const done = await settled(p.id), saved = done.checkpoint as any;
        assert.equal(done.status, "COMPLETED");
        assert.equal(artDesignCalls, designs); assert.equal(designReviews - audits, 1);
        assert.deepEqual(saved.artDirection, cp.designDraft);
        assert.equal(imageRequests - before, 7);
        assert.equal(saved.events.filter((e: any) => e.tool === "save_plan").length, 1);
      } finally { failDesignReview = false; failArtDesign = false; }
    });
    await t.test("invalid saved draft is supplied for targeted repair and cannot bypass review", async () => {
      const p = await project(), before = imageRequests;
      invalidCopyAlways = true;
      try {
        await inCredentials(() => createDetailRun(p.id, input, credentials));
        const failed = await settled(p.id), cp = failed.checkpoint as any;
        assert.equal(failed.status, "FAILED");
        assert.equal(failed.stage, "文案与分镜待修正");
        assert.equal(cp.failure.code, "DESIGN_REVIEW_FAILED");
        assert.equal(imageRequests, before);
        const designs = artDesignCalls;
        invalidCopyAlways = false;
        await inCredentials(() => controlDetailRun(p.id, failed.id, "resume", {}, credentials));
        const done = await settled(p.id);
        assert.equal(done.status, "COMPLETED");
        assert.equal(artDesignCalls - designs, 1);
        assert.deepEqual(previousDraftInput, cp.designDraft);
        assert.equal(imageRequests - before, 7);
      } finally { invalidCopyAlways = false; }
    });
    await t.test("HTTP 200 with invalid tool arguments is repaired once without repeating planning", async () => {
      const p = await project(); const before = imageRequests; const beforeDesign = artDesignCalls;
      malformedArt = "once";
      try {
        await inCredentials(() => createDetailRun(p.id, input, credentials));
        const done = await settled(p.id); const cp = done.checkpoint as any;
        assert.equal(done.status, "COMPLETED");
        assert.equal(artDesignCalls - beforeDesign, 2);
        assert.equal(imageRequests - before, 7);
        assert.equal(cp.events.filter((e: any) => e.tool === "save_plan").length, 1);
        assert.equal(cp.events.filter((e: any) => e.tool === "repair_design_format").length, 1);
        assert.equal(cp.failure, undefined);
      } finally { malformedArt = undefined; }
    });
    await t.test("repeated invalid arguments stop before image charges and retain safe field diagnostics", async () => {
      const p = await project(); const before = imageRequests; const beforeDesign = artDesignCalls;
      malformedArt = "always";
      try {
        await inCredentials(() => createDetailRun(p.id, input, credentials));
        const done = await settled(p.id); const cp = done.checkpoint as any;
        assert.equal(done.status, "FAILED"); assert.equal(imageRequests, before);
        assert.equal(artDesignCalls - beforeDesign, 2);
        assert.equal(cp.failure.code, "INVALID_TOOL_INPUT");
        assert.match(done.error!, /sections\.0\.camera/);
        assert.ok(!JSON.stringify(cp).includes(credentials.apiKey));
      } finally { malformedArt = undefined; }
    });
    await t.test("HTTP 200 prose without a saved design reports the missing result, not API configuration", async () => {
      const p = await project(); const before = imageRequests; noArtTool = true;
      try {
        await inCredentials(() => createDetailRun(p.id, input, credentials));
        const done = await settled(p.id);
        assert.equal(done.status, "FAILED"); assert.equal(imageRequests, before);
        assert.equal((done.checkpoint as any).failure.code, "AGENT_RESULT_MISSING");
        assert.match(done.error!, /没有提交/); assert.ok(!done.error?.includes("API 配置"));
      } finally { noArtTool = false; }
    });
    await t.test("creative review warnings preserve every frame and never block the full set", async () => {
      const p = await project(); const before = imageRequests; const audits = designReviews; rejectDesign = true;
      try {
        await inCredentials(() => createDetailRun(p.id, input, credentials));
        const done = await settled(p.id);
        assert.equal(done.status, "PARTIAL"); assert.equal(imageRequests - before, 7);
        assert.equal(designReviews - audits, 1);
        assert.equal((done.checkpoint as any).designReview.passed, false);
        assert.equal((done.checkpoint as any).failure, undefined);
        assert.deepEqual((done.checkpoint as any).artDirection, (done.checkpoint as any).designDraft, "review cannot rewrite or delete unflagged fields");
        assert.ok((done.checkpoint as any).images.every((i: any) => i.assetId));
        rejectDesign = false; failArtDesign = true;
        await inCredentials(() => controlDetailRun(p.id, done.id, "resume", {}, credentials));
        const resumed = await settled(p.id);
        assert.equal((resumed.checkpoint as any).failure, undefined, "resume keeps the saved complete design instead of redesigning");
        assert.equal(imageRequests - before, 7);
      } finally { rejectDesign = false; failArtDesign = false; }
    });
    await t.test("factual review patches one block and final copy stays consistent in plan, prompt and versions", async () => {
      const p = await project(); const before = imageRequests; patchFact = true;
      try {
        await inCredentials(() => createDetailRun(p.id, input, credentials));
        const done = await settled(p.id); const cp = done.checkpoint as any;
        assert.equal(done.status, "COMPLETED"); assert.equal(imageRequests - before, 7);
        assert.equal(cp.flexibleReview.changes.length, 1);
        assert.equal(cp.plan.sections[0].copy, "色彩，让日常更鲜明");
        assert.deepEqual(cp.artDirection.sections.slice(1), cp.designDraft.sections.slice(1));
        assert.equal(cp.plan.sections[0].buyerQuestion, "HERO purchase question 0");
        const sections = await prisma.pageSection.findMany({ where: { projectId: p.id }, orderBy: { order: "asc" }, include: { versions: true } });
        assert.equal(sections.length, 7);
        for (const [i, section] of sections.entries()) {
          assert.equal(section.copy, cp.plan.sections[i].copy);
          assert.equal(section.versions[0].copySnapshot, section.copy);
          // Multi-line parameter tables are JSON-escaped inside the exact-copy block.
          for (const block of cp.artDirection.sections[i].textBlocks) assert.ok(section.visualPrompt.includes(JSON.stringify(block.text)));
        }
      } finally { patchFact = false; }
    });
    await t.test("copy review replaces appearance narration before image generation and preserves the parameter page", async () => {
      const p = await project(), before = imageRequests;
      patchCopy = true;
      try {
        await inCredentials(() => createDetailRun(p.id, input, credentials));
        const done = await settled(p.id), cp = done.checkpoint as any;
        assert.equal(done.status, "COMPLETED"); assert.equal(imageRequests - before, 7);
        assert.equal(cp.designDraft.sections[0].textBlocks[0].text, "高瓶与矮罐，同框呈现");
        assert.equal(cp.plan.sections[0].copy, "给日常桌面，添一抹亮色");
        assert.equal(cp.flexibleReview.issues[0].kind, "copy");
        assert.equal(cp.designReview.issues[0].resolved, true);
        assert.deepEqual(cp.artDirection.sections.slice(1), cp.designDraft.sections.slice(1));
        assert.equal(cp.artDirection.sections.at(-1).expression, "information");
        assert.ok(cp.plan.sections[0].prompt.includes("PURCHASE REASONS"));
        const first = await prisma.pageSection.findFirstOrThrow({ where: { projectId: p.id }, orderBy: { order: "asc" }, include: { versions: true } });
        assert.equal(first.versions[0].copySnapshot, cp.plan.sections[0].copy);
        assert.ok(!first.visualPrompt!.includes("高瓶与矮罐，同框呈现"));
      } finally { patchCopy = false; }
    });
    await t.test("typography review reaches persisted image prompts without changing copy or other frames", async () => {
      const p = await project(), before = imageRequests; patchTypography = true;
      try {
        await inCredentials(() => createDetailRun(p.id, input, credentials));
        const done = await settled(p.id), cp = done.checkpoint as any;
        assert.equal(done.status, "COMPLETED"); assert.equal(imageRequests - before, 7);
        assert.equal(cp.designDraft.sections[0].textBlocks[0].typesetting.fontSize, 64);
        assert.equal(cp.artDirection.sections[0].textBlocks[0].typesetting.fontSize, 32);
        assert.equal(cp.designReview.issues[0].kind, "typography");
        assert.equal(cp.designReview.issues[0].resolved, true);
        assert.deepEqual(cp.artDirection.sections.slice(1), cp.designDraft.sections.slice(1));
        const first = await prisma.pageSection.findFirstOrThrow({ where: { projectId: p.id }, orderBy: { order: "asc" }, include: { versions: true } });
        assert.equal(first.versions[0].copySnapshot, "A considered everyday object");
        assert.ok(first.visualPrompt!.includes('"fontSize":32'));
        assert.ok(first.visualPrompt!.includes('"lines":["A considered","everyday object"]'));
      } finally { patchTypography = false; }
    });
    await t.test("visual review outage never drops frames or triggers paid corrections; resume reviews saved images", async () => {
      const p = await project(); const before = imageRequests; failImageReview = true;
      const run = await inCredentials(() => createDetailRun(p.id, input, credentials));
      try {
        const done = await settled(p.id); const cp = done.checkpoint as any;
        assert.equal(done.status, "PARTIAL"); assert.equal(imageRequests - before, 7);
        assert.ok(cp.images.every((i: any) => i.assetId && i.correctionCount === 0));
        assert.equal(Object.keys(cp.reviewErrors).length, 7);
      } finally { failImageReview = false; }
      await inCredentials(() => controlDetailRun(p.id, run!.id, "resume", {}, credentials));
      const done = await settled(p.id);
      assert.equal(done.status, "COMPLETED"); assert.equal(imageRequests - before, 7);
      assert.deepEqual((done.checkpoint as any).reviewErrors, {});
    });
    await t.test("uncertain correction retries only by explicit request without resetting correction budget", async () => {
      const p = await project(); const before = imageRequests; correctFirst = true; failCorrection = true;
      const run = await inCredentials(() => createDetailRun(p.id, input, credentials));
      const paused = await settled(p.id);
      assert.equal(paused.status, "PARTIAL"); assert.equal(imageRequests - before, 8);
      assert.equal((paused.checkpoint as any).images[0].state, "uncertain");
      assert.equal((paused.checkpoint as any).images[0].correctionCount, 1);
      await inCredentials(() => controlDetailRun(p.id, run!.id, "resume", { retryUncertain: true }, credentials));
      const done = await settled(p.id);
      assert.equal(done.status, "COMPLETED"); assert.equal(imageRequests - before, 9);
      assert.equal((done.checkpoint as any).images[0].correctionCount, 1);
    });
    await t.test("changed cover is rechecked before resuming the parent; restart and duplicate resume preserve versions", async () => {
      const p = await project(); const before = imageRequests; rejectCoverOnly = true;
      const run = await inCredentials(() => createDetailRun(p.id, input, credentials));
      await settled(p.id); rejectCoverOnly = false;
      const cover = await prisma.pageSection.findFirstOrThrow({ where: { projectId: p.id }, orderBy: { order: "asc" } });
      await inCredentials(() => createDetailRun(p.id, { ...input, idempotencyKey: "manual-cover-adjust", mode: "edit", sectionId: cover.id, instruction: "Fix first cover typography" }, credentials));
      for (let i = 0; i < 300; i++) { if ((await getDetailRun(p.id))?.id === run!.id) break; await new Promise(r => setTimeout(r, 20)); }
      assert.equal((await getDetailRun(p.id))?.id, run!.id, "workbench returns to unfinished parent after manual edit");
      await new Promise(r => setTimeout(r, 50));
      const edited = await prisma.pageSection.findUniqueOrThrow({ where: { id: cover.id } });
      assert.notEqual(edited.currentImageAssetId, cover.currentImageAssetId);
      // Simulate service restart with a stale execution lease before resume.
      await prisma.detailRun.update({ where: { id: run!.id }, data: { status: "RUNNING", leaseToken: "stale", leaseUntil: new Date(0) } });
      assert.equal((await getDetailRun(p.id, run!.id))?.status, "INTERRUPTED");
      await inCredentials(() => Promise.all([controlDetailRun(p.id, run!.id, "resume", {}, credentials), controlDetailRun(p.id, run!.id, "resume", {}, credentials)]));
      const done = await settled(p.id);
      assert.equal(done.status, "COMPLETED"); assert.equal(imageRequests - before, 9, "two cover attempts + six original remaining images + one manual edit; resume generates nothing");
      assert.equal((done.checkpoint as any).firstHeroGate.assetId, edited.currentImageAssetId);
      assert.equal((done.checkpoint as any).images[0].correctionCount, 1);
      assert.equal(await prisma.sectionVersion.count({ where: { sectionId: cover.id } }), 3);
    });
    await t.test("repetitive storyboard is rejected and repaired before generation", async () => {
      const p = await project(); const before = imageRequests; const designs = artDesignCalls; invalidArtOnce = true;
      await inCredentials(() => createDetailRun(p.id, input, credentials));
      const done = await settled(p.id);
      assert.equal(done.status, "COMPLETED");
      assert.equal(artDesignCalls - designs, 2, "validation feedback produces one corrected design");
      assert.equal(imageRequests - before, 7);
      const cp = done.checkpoint as any;
      assert.equal(cp.events.filter((e: any) => e.tool === "save_art_direction").length, 2);
      assert.ok(new Set(cp.artDirection.sections.map((s: any) => s.composition)).size >= 3);
    });
    await t.test("historical checkpoint resumes without V2 redesign or rewriting finished images", async () => {
      const p = await project(); cancelNextImage = true;
      const run = await inCredentials(() => createDetailRun(p.id, input, credentials));
      await settled(p.id); await new Promise(r => setTimeout(r, 80));
      const stored = await prisma.detailRun.findUniqueOrThrow({where:{id:run!.id}});
      const cp = structuredClone(stored.checkpoint) as any;
      delete cp.creativeVersion; delete cp.styleReferences; delete cp.firstHeroGate;
      delete cp.artDirection; delete cp.designReview;
      const before = imageRequests; const designs = artDesignCalls;
      const savedAsset = cp.images[0].assetId;
      await prisma.detailRun.update({where:{id:run!.id},data:{checkpoint:cp,status:"INTERRUPTED",leaseToken:null,leaseUntil:null}});
      await inCredentials(() => controlDetailRun(p.id,run!.id,"resume",{},credentials));
      const done = await settled(p.id);
      assert.equal(done.status,"COMPLETED"); assert.equal(imageRequests-before,6); assert.equal(artDesignCalls,designs);
      assert.equal((done.checkpoint as any).images[0].assetId,savedAsset);
      assert.equal((done.checkpoint as any).creativeVersion,undefined);
    });
    await t.test("switching cover history rechecks that effective version without extra generation", async () => {
      const { NextRequest } = await import("next/server");
      const activate = await import("../app/api/projects/[id]/sections/[sectionId]/versions/[versionId]/activate/route");
      const p = await project(); rejectCoverOnly = true;
      const run = await inCredentials(() => createDetailRun(p.id,input,credentials));
      await settled(p.id); rejectCoverOnly = false;
      const cover = await prisma.pageSection.findFirstOrThrow({where:{projectId:p.id},orderBy:{order:"asc"},include:{versions:{orderBy:{versionNumber:"asc"}}}});
      const old = cover.versions[0]; const before=imageRequests;
      assert.equal((await activate.PATCH(new NextRequest("http://localhost/test",{method:"PATCH"}),{params:{id:p.id,sectionId:cover.id,versionId:old.id}})).status,200);
      await inCredentials(() => controlDetailRun(p.id,run!.id,"resume",{},credentials));
      const done = await settled(p.id);
      assert.equal(done.status,"COMPLETED"); assert.equal(imageRequests-before,0);
      assert.equal((done.checkpoint as any).firstHeroGate.assetId,old.imageAssetId);
      assert.equal((done.checkpoint as any).images[0].correctionCount,1);
      assert.equal(await prisma.sectionVersion.count({where:{sectionId:cover.id}}),2);
    });
    await t.test("correct facts alone cannot pass failed art direction; correction remains bounded", async () => {
      const p = await project(); const before = imageRequests; rejectComposition = true;
      try {
        await inCredentials(() => createDetailRun(p.id, input, credentials));
        const done = await settled(p.id);
        assert.equal(done.status, "PARTIAL");
        assert.equal(imageRequests - before, 14, "quality failure cannot stop subsequent images");
        assert.equal((done.checkpoint as any).images[0].check.visualQuality.composition, false);
        assert.ok((done.checkpoint as any).images.every((i: any) => i.assetId && i.correctionCount === 1));
      } finally { rejectComposition = false; }
    });
    await t.test("set-level review can reject individually passing images without extra paid retries", async () => {
      const p = await project(); const before = imageRequests; const reviewsBefore = pageReviews; rejectPage = true;
      try {
        const run = await inCredentials(() => createDetailRun(p.id, input, credentials));
        const done = await settled(p.id);
        assert.equal(done.status, "PARTIAL");
        assert.ok((done.checkpoint as any).images.every((i: any) => i.check.passed));
        assert.equal((done.checkpoint as any).setReview.passed, false);
        assert.equal(imageRequests - before, 7);
        await inCredentials(() => controlDetailRun(p.id, run!.id, "resume", {}, credentials));
        assert.equal((await settled(p.id)).status, "PARTIAL");
        assert.equal(pageReviews - reviewsBefore, 1, "saved set review is reused");
        assert.equal(imageRequests - before, 7, "set rejection never triggers image regeneration");
      } finally { rejectPage = false; }
    });
    await t.test("interrupted set review resumes without recreating images or versions", async () => {
      const p = await project(); const before = imageRequests; const designsBefore = artDesignCalls; failPageReview = true;
      const run = await inCredentials(() => createDetailRun(p.id, input, credentials));
      try {
        const paused = await settled(p.id);
        assert.equal(paused.status, "PARTIAL");
        assert.equal((paused.checkpoint as any).setReview, undefined);
        assert.equal(imageRequests - before, 7);
      } finally { failPageReview = false; }
      await inCredentials(() => controlDetailRun(p.id, run!.id, "resume", {}, credentials));
      assert.equal((await settled(p.id)).status, "COMPLETED");
      assert.equal(imageRequests - before, 7);
      assert.equal(await prisma.sectionVersion.count({ where: { section: { projectId: p.id } } }), 7);
      assert.equal(artDesignCalls - designsBefore, 1, "saved art direction is never re-run when resuming a page review");
    });
    await t.test("API create/upload/run, default ten images, edit, translate, versions, JSON and ZIP", async () => {
      const { NextRequest } = await import("next/server");
      const create = await import("../app/api/projects/route");
      const upload = await import("../app/api/projects/[id]/assets/upload/route");
      const runs = await import("../app/api/projects/[id]/detail-runs/route");
      const activate = await import("../app/api/projects/[id]/sections/[sectionId]/versions/[versionId]/activate/route");
      const { buildProjectJson, buildImageArchive } = await import("../lib/services/export-service");
      const request = (body: unknown) => new NextRequest("http://localhost/api", { method: "POST", headers: { "Content-Type": "application/json", "x-mxpage-api-key": credentials.apiKey, "x-mxpage-base-url": credentials.baseUrl }, body: JSON.stringify(body) });
      const created = await create.POST(request({ name: "API fixture", platform: "general_ecommerce", style: "generic_clean" }));
      assert.equal(created.status, 201); const p = (await created.json()).data;
      const ctx = { params: { id: p.id } };
      assert.equal((await upload.POST(request({ type: "MAIN", fileName: "fixture.png", mimeType: "image/png", base64Data: pixels.toString("base64") }), ctx)).status, 201);
      const start = await runs.POST(request({ idempotencyKey: "api-fixture-default", quality: "high" }), ctx);
      assert.equal(start.status, 202);
      const started = (await start.json()).data;
      const duplicate = await runs.POST(request({ idempotencyKey: "api-fixture-default" }), ctx);
      assert.equal((await duplicate.json()).data.id, started.id);
      assert.equal((await settled(p.id)).status, "COMPLETED");
      const result = await buildProjectJson(p.id);
      assert.equal((result.modelSnapshot as any).previewConfig.quality, "high");
      assert.equal(result.sections.length, 10);
      const section = result.sections.find(s => s.type !== "HERO")!;
      const oldVersion = section.versions[0];
      for (const mode of ["edit", "translate"] as const) {
        const count = imageRequests;
        const operation = await runs.POST(request({ idempotencyKey: `api-${mode}-fixture`, mode, sectionId: section.id, instruction: "Keep product unchanged", language: "en-US" }), ctx);
        assert.equal(operation.status, 202, JSON.stringify(await operation.json()));
        assert.equal((await settled(p.id)).status, "COMPLETED");
        assert.equal(((await getDetailRun(p.id))!.input as any).quality, "high");
        assert.equal(imageRequests - count, mode === "edit" ? 1 : 10);
      }
      assert.equal((await activate.PATCH(request({}), { params: { id: p.id, sectionId: section.id, versionId: oldVersion.id } })).status, 200);
      assert.equal((await prisma.pageSection.findUniqueOrThrow({ where: { id: section.id } })).currentImageAssetId, oldVersion.imageAssetId);
      const long = await exportLongImage(p.id);
      assert.equal((await sharp(long).metadata()).height, 8640);
      const zip = await buildImageArchive(p.id);
      const entries = new Map<string, Buffer>();
      const yauzl = require("yauzl");
      await new Promise<void>((resolve, reject) => yauzl.fromBuffer(zip, { lazyEntries: true }, (error: Error | null, archive: any) => {
        if (error) return reject(error);
        archive.on("error", reject); archive.on("end", resolve);
        archive.on("entry", (entry: any) => archive.openReadStream(entry, (error: Error | null, stream: any) => {
          if (error) return reject(error);
          const chunks: Buffer[] = []; stream.on("data", (chunk: Buffer) => chunks.push(chunk)); stream.on("error", reject);
          stream.on("end", () => { entries.set(entry.fileName, Buffer.concat(chunks)); archive.readEntry(); });
        })); archive.readEntry();
      }));
      const manifest = JSON.parse(entries.get("export-manifest.json")!.toString());
      assert.equal(manifest.heroImageCount, 4); assert.equal(manifest.detailImageCount, 6);
      assert.equal(entries.size, 11);
      assert.deepEqual(await stitchDetailImages(manifest.details.map((d: any) => entries.get(d.zipPath)!)), long);
      assert.ok(!JSON.stringify(await buildProjectJson(p.id)).includes(credentials.apiKey));
      const missingHero = result.sections.find(s => s.type === "HERO")!;
      await prisma.pageSection.update({ where: { id: missingHero.id }, data: { currentImageAssetId: null } });
      const partialZip = await buildImageArchive(p.id);
      const partialEntries: string[] = [];
      await new Promise<void>((resolve, reject) => yauzl.fromBuffer(partialZip, { lazyEntries: true }, (error: Error | null, archive: any) => {
        if (error) return reject(error);
        archive.on("error", reject); archive.on("end", resolve);
        archive.on("entry", (entry: any) => { partialEntries.push(entry.fileName); archive.readEntry(); }); archive.readEntry();
      }));
      assert.equal(partialEntries.filter(name => name.startsWith("00-")).length, 3, "partial ZIP must not replace a missing hero with the uploaded source");
    });
    await t.test("rediscovery retains target presets and recommends Luna and Sunburst regardless of catalogue order", async () => {
      const { discoverProviderModels, saveProviderConfig } = await import("../lib/services/provider-service");
      const { recommendDefaultModels } = await import("../lib/ai/model-matcher");
      const connection = { name: "Fixture", ...credentials };
      for (let round = 0; round < 2; round++) {
        const discovery = await discoverProviderModels(connection);
        assert.ok(discovery.models.some(m => m.modelId === "gpt-image-2.5-sunburst"));
        assert.ok(discovery.models.some(m => m.modelId === "gpt-image-2.5-flare"));
        assert.equal(discovery.recommendations.planningModelId, "gpt-6-luna");
        assert.equal(discovery.recommendations.analysisModelId, "gpt-6-luna");
        assert.equal(discovery.recommendations.detailImageModelId, "gpt-image-2.5-sunburst");
        assert.deepEqual(recommendDefaultModels([...discovery.models].reverse()), discovery.recommendations);
        await saveProviderConfig({ ...connection, id: provider.id, discoveredModels: discovery.models, defaultAssignments: discovery.recommendations });
        assert.equal((await prisma.modelProfile.findFirstOrThrow({ where: { providerConfigId: provider.id, isDefaultImageEdit: true } })).modelId, "gpt-image-2.5-sunburst");
      }
    });
    await t.test("batch produces sets progressively, cancellation preserves in-flight output, resume skips finished work", async () => {
      const { randomUUID } = await import("node:crypto");
      const { startBatch, getBatch, controlBatch } = await import("../lib/detail-runs/batch");
      const first = await project(); const second = await project("BATCH_HOLD");
      let release!: () => void;
      holdBatchImage = new Promise<void>(resolve => { release = resolve; });
      const before = imageRequests;
      const request = { id: randomUUID(), projectIds: [first.id, second.id], options: { heroCount: 3, detailCount: 4 } };
      await inCredentials(() => startBatch(request, credentials));
      await inCredentials(() => startBatch(request, credentials));
      try {
        for (let i = 0; i < 300 && !batchImageWaiting; i++) await new Promise(r => setTimeout(r, 20));
        assert.ok(batchImageWaiting);
        const midway = await getBatch(request.id);
        assert.equal(midway.items[0].status, "COMPLETED");
        assert.equal(midway.items[0].images.length, 7);
        assert.equal(midway.items[1].status, "RUNNING");
        await controlBatch(request.id, "cancel", credentials);
      } finally { release(); }
      await settled(second.id, "CANCELED");
      await new Promise(r => setTimeout(r, 700));
      await inCredentials(() => controlBatch(request.id, "resume", credentials));
      let done = await getBatch(request.id);
      for (let i = 0; i < 300 && done.status !== "SUCCESS"; i++) { await new Promise(r => setTimeout(r, 20)); done = await getBatch(request.id); }
      assert.equal(done.status, "SUCCESS", JSON.stringify(done));
      assert.equal(imageRequests - before, 14, "no duplicate generation after cancellation/resume");
      assert.equal(await prisma.detailRun.count({ where: { projectId: { in: request.projectIds } } }), 2);
      assert.ok(!JSON.stringify(await prisma.generationTask.findUnique({ where: { id: request.id } })).includes(credentials.apiKey));
    });
    await t.test("batch skips blocked products, persists their question, and continues subsequent products", async () => {
      const { randomUUID } = await import("node:crypto");
      const { startBatch, getBatch } = await import("../lib/detail-runs/batch");
      const first = await project("ASK"); const second = await project();
      const request = { id: randomUUID(), projectIds: [first.id, second.id], options: { heroCount: 3, detailCount: 4 } };
      await inCredentials(() => startBatch(request, credentials));
      let done = await getBatch(request.id);
      for (let i = 0; i < 300 && ["PENDING", "RUNNING"].includes(done.status); i++) { await new Promise(r => setTimeout(r, 20)); done = await getBatch(request.id); }
      assert.equal(done.status, "FAILED", "a blocked product must not be reported as complete");
      assert.equal(done.items[0].status, "WAITING_INPUT");
      assert.equal(done.items[1].status, "COMPLETED");
      const waiting = await getDetailRun(first.id);
      await inCredentials(() => controlDetailRun(first.id, waiting!.id, "answers", { skip: true }, credentials));
      await settled(first.id);
      assert.equal((await getBatch(request.id)).status, "SUCCESS", "batch reflects questions resolved in the project workspace");
    });
    await t.test("expired batch lease requires explicit resume and uncertain images do not block the next product", async () => {
      const { randomUUID } = await import("node:crypto");
      const { getBatch, controlBatch } = await import("../lib/detail-runs/batch");
      const first = await project(); const second = await project();
      const id = randomUUID();
      await prisma.generationTask.create({ data: { id, projectId: "mxpage-detail-batch-system", taskType: "BATCH_CREATE", status: "RUNNING", updatedAt: new Date(Date.now() - 120000), inputPayload: { id, workflow: "detail-batch-v1", projectIds: [first.id, second.id], options: { language: "zh-CN", quality: "auto", heroCount: 3, detailCount: 4 } }, outputPayload: { items: [{ projectId: first.id, status: "QUEUED", message: "queued" }, { projectId: second.id, status: "QUEUED", message: "queued" }] } } });
      assert.equal((await getBatch(id)).status, "FAILED");
      const before = imageRequests;
      failNextImage = true;
      await inCredentials(() => controlBatch(id, "resume", credentials));
      let done = await getBatch(id);
      for (let i = 0; i < 300 && ["PENDING", "RUNNING"].includes(done.status); i++) { await new Promise(r => setTimeout(r, 20)); done = await getBatch(id); }
      assert.equal(done.items[0].status, "PARTIAL");
      assert.equal(done.items[0].images.length, 6);
      assert.equal(done.items[1].status, "COMPLETED");
      assert.equal(imageRequests - before, 14, "both products attempt all seven frames; uncertain image is not retried");
      assert.equal(done.status, "FAILED");
    });
    await t.test("batch cover rejection retains a full flagged set and the next product completes", async () => {
      const { randomUUID } = await import("node:crypto");
      const { startBatch, getBatch } = await import("../lib/detail-runs/batch");
      const first = await project("REJECT_COVER"); const second = await project(); const before = imageRequests;
      const request = { id: randomUUID(), projectIds: [first.id, second.id], options: { heroCount: 3, detailCount: 4 } };
      await inCredentials(() => startBatch(request, credentials));
      let done = await getBatch(request.id);
      for (let i = 0; i < 400 && ["PENDING", "RUNNING"].includes(done.status); i++) { await new Promise(r => setTimeout(r, 20)); done = await getBatch(request.id); }
      assert.equal(done.items[0].status, "PARTIAL"); assert.equal(done.items[0].images.length, 7);
      assert.equal(done.items[1].status, "COMPLETED"); assert.equal(imageRequests - before, 15);
    });
    await t.test("V3 adapts only unrequested frames twice; copy/prompts/checkpoints commit together and resume is deduplicated", async () => {
      const p = await project(); const before = imageRequests, calls = adaptiveCalls; repeatRhythm = true;
      try {
        await inCredentials(() => createDetailRun(p.id, input, credentials));
        const done = await settled(p.id); const cp = done.checkpoint as any;
        assert.equal(imageRequests - before, 9, "7 slots plus two bounded corrections");
        assert.equal(adaptiveCalls - calls, 2);
        assert.equal(cp.adaptations.heroes.status, "applied"); assert.equal(cp.adaptations.details.status, "applied");
        assert.deepEqual(cp.artDirection.sections.slice(0, 2), cp.designDraft.sections.slice(0, 2), "completed head frames never redesigned");
        const sections = await prisma.pageSection.findMany({ where: { projectId: p.id }, orderBy: { order: "asc" }, include: { versions: true } });
        for (const [index, s] of sections.entries()) {
          assert.equal(s.copy, cp.plan.sections[index].copy); assert.equal(s.visualPrompt, cp.plan.sections[index].prompt);
          assert.ok(s.versions.every(v => v.copySnapshot === s.copy));
        }
        const counts = sections.map(s => s.versions.length); const paid = imageRequests;
        await inCredentials(() => controlDetailRun(p.id, done.id, "resume", {}, credentials));
        await settled(p.id);
        assert.equal(adaptiveCalls - calls, 2); assert.equal(imageRequests, paid);
        assert.deepEqual((await prisma.pageSection.findMany({where:{projectId:p.id},orderBy:{order:"asc"},include:{versions:true}})).map(s=>s.versions.length), counts);
      } finally { repeatRhythm = false; }
    });
    await t.test("adaptive outage keeps original valid storyboard and completes every slot", async () => {
      const p = await project(); repeatRhythm = true; adaptiveFailure = true; const before = imageRequests, calls = adaptiveCalls;
      try {
        await inCredentials(() => createDetailRun(p.id, input, credentials)); const done = await settled(p.id); const cp = done.checkpoint as any;
        assert.equal(imageRequests - before, 9); assert.equal(adaptiveCalls - calls, 2);
        assert.equal(cp.adaptations.heroes.status, "failed"); assert.equal(cp.adaptations.details.status, "failed");
        assert.deepEqual(cp.artDirection, cp.designDraft); assert.ok(cp.images.every((i:any)=>i.assetId));
      } finally { repeatRhythm = false; adaptiveFailure = false; }
    });
    await t.test("interrupted adaptive claim is not repeated after duplicate resume; versions and correction counts survive", async () => {
      const p = await project(); repeatRhythm = true; cancelAdaptive = true; const calls = adaptiveCalls;
      try {
        await inCredentials(() => createDetailRun(p.id, input, credentials)); const canceled = await settled(p.id, "CANCELED");
        assert.equal((canceled.checkpoint as any).adaptations.heroes.status, "claimed");
        const retained = (canceled.checkpoint as any).images.slice(0,2).map((i:any)=>({ assetId:i.assetId, correctionCount:i.correctionCount }));
        await inCredentials(() => controlDetailRun(p.id, canceled.id, "resume", {}, credentials));
        await inCredentials(() => controlDetailRun(p.id, canceled.id, "resume", {}, credentials));
        const done = await settled(p.id), cp = done.checkpoint as any;
        assert.equal(cp.adaptations.heroes.status, "failed"); assert.equal(adaptiveCalls - calls, 2, "only details gets a new adaptation call");
        assert.deepEqual(cp.images.slice(0,2).map((i:any)=>({assetId:i.assetId,correctionCount:i.correctionCount})), retained);
        assert.equal(cp.images.filter((i:any)=>i.assetId).length, 7);
      } finally { repeatRhythm = false; cancelAdaptive = false; }
    });
    await t.test("style upload limit is serialized; style assets stay outside facts and translation originals", async () => {
      const { NextRequest } = await import("next/server");
      const upload = await import("../app/api/projects/[id]/assets/upload/route");
      const { prepareTranslationProject } = await import("../lib/detail-runs/translation");
      const p = await project();
      const responses = await Promise.all([0,1,2].map(i => upload.POST(new NextRequest("http://localhost/test", {method:"POST",body:JSON.stringify({type:"REFERENCE",purpose:"style_reference",fileName:`style-${i}.png`,mimeType:"image/png",base64Data:pixels.toString("base64")})}), {params:{id:p.id}})));
      assert.equal(responses.filter(r => r.status === 201).length, 2);
      const sourceAssets = await prisma.productAsset.findMany({where:{projectId:p.id}});
      assert.equal(sourceAssets.filter(a => (a.metadata as any)?.purpose === "style_reference").length, 2);
      await prepareTranslationProject(`translation-style-${p.id}`, p.id, "en-US", "auto");
      assert.equal(await prisma.pageSection.count({where:{projectId:`translation-style-${p.id}`}}), 1);
      const before = imageRequests;
      await inCredentials(() => createDetailRun(p.id, input, credentials));
      const done = await settled(p.id);
      assert.equal(done.status, "COMPLETED"); assert.equal(imageRequests - before, 7);
      assert.ok((done.checkpoint as any).styleReferences.every((r:any) => r.source === "upload"));
      assert.equal((done.checkpoint as any).plan.evidence[0].sourceRef, sourceAssets.find(a=>a.type==="MAIN")!.id);
    });
    await t.test("multi-language translation makes independent outputs from immutable original images", async () => {
      const { randomUUID } = await import("node:crypto");
      const { startBatch, getBatch, batchInputSchema } = await import("../lib/detail-runs/batch");
      const { readStorageFile } = await import("../lib/storage/asset-manager");
      const p = await project();
      await saveUploadAsset({ projectId: p.id, type: "DETAIL", fileName: "second.png", fileBuffer: pixels, mimeType: "image/png", sortOrder: 1 });
      const originals = await prisma.productAsset.findMany({ where: { projectId: p.id }, orderBy: { sortOrder: "asc" } });
      const request = { id: randomUUID(), projectIds: [p.id], translations: ["en-US", "ja-JP"], options: { quality: "high" } };
      assert.equal(batchInputSchema.safeParse({ ...request, translations: [] }).success, false);
      assert.equal(batchInputSchema.safeParse({ ...request, translations: ["en-US", "en-US"] }).success, false);
      const before = imageRequests;
      const started = await inCredentials(() => startBatch(request, credentials));
      assert.equal(started.items.length, 2);
      // The worker can finish an image before startBatch returns. Check provenance, not timing.
      for (const item of started.items) for (const image of item.images) {
        assert.ok(image.url);
        assert.match(image.url, /\/generated\//, "original uploads must not appear as translated results");
      }
      await inCredentials(() => startBatch(request, credentials));
      let done = await getBatch(request.id);
      for (let i = 0; i < 300 && done.status !== "SUCCESS"; i++) { await new Promise(r => setTimeout(r, 20)); done = await getBatch(request.id); }
      assert.equal(done.status, "SUCCESS", JSON.stringify(done));
      assert.equal(imageRequests - before, 4, "2 originals x 2 languages, no duplicate calls");
      assert.notEqual(done.items[0].projectId, done.items[1].projectId);
      for (const item of done.items) {
        assert.equal(item.images.length, 2);
        const run = await getDetailRun(item.projectId);
        assert.equal((run!.input as any).language, item.language);
        const copy = await prisma.project.findUniqueOrThrow({ where: { id: item.projectId }, include: { assets: { where: { type: "DETAIL" }, orderBy: { sortOrder: "asc" } }, sections: { orderBy: { order: "asc" } } } });
        assert.equal(copy.assets.length, 2);
        assert.deepEqual(copy.sections.map(s => s.title), originals.map(a => a.fileName));
        assert.equal(await prisma.sectionVersion.count({ where: { section: { projectId: item.projectId } } }), 2);
        for (let i = 0; i < 2; i++) { assert.notEqual(copy.assets[i].filePath, originals[i].filePath); assert.deepEqual(await readStorageFile(copy.assets[i].filePath), await readStorageFile(originals[i].filePath)); }
        assert.equal((await sharp(await exportLongImage(item.projectId)).metadata()).width, 1080);
      }
      assert.equal(await prisma.pageSection.count({ where: { projectId: p.id } }), 0, "original source project is not overwritten");
      assert.deepEqual(await readStorageFile(originals[0].filePath), pixels);
    });
    await t.test("one-click Xiaohongshu text-only brief produces images, title, caption and tags without a manual plan", async () => {
      const p = await prisma.project.create({ data: { name: "XHS fixture", platform: "xiaohongshu", style: "generic_clean", description: "Make five illustrated small-space organization pages in English; no invented personal experience." } });
      const before = textOnlyImageRequests;
      const request = { idempotencyKey: `xhs:${p.id}`, mode: "xhs" };
      const first = await inCredentials(() => createDetailRun(p.id, request, credentials));
      const duplicate = await inCredentials(() => createDetailRun(p.id, request, credentials));
      assert.equal(first!.id, duplicate!.id);
      const done = await settled(p.id);
      assert.equal(done.status, "COMPLETED", JSON.stringify(done));
      assert.equal(textOnlyImageRequests - before, 5, "no-reference requests use the generations endpoint exactly once per page");
      const saved = await prisma.project.findUniqueOrThrow({ where: { id: p.id }, include: { sections: { orderBy: { order: "asc" } } } });
      const snapshot = saved.modelSnapshot as any;
      assert.equal(snapshot.socialPost.title, "Small space, more room");
      assert.ok(snapshot.socialPost.caption.length > 20);
      assert.equal(snapshot.socialPost.hashtags.length, 3);
      assert.equal(snapshot.previewConfig.contentLanguage, "en-US");
      assert.equal((done.input as any).language, "en-US");
      assert.equal(saved.sections.length, 5);
      assert.ok(saved.sections.every(s => s.currentImageAssetId && s.type !== "HERO"));
      assert.equal(await prisma.sectionVersion.count({ where: { section: { projectId: p.id } } }), 5);
      assert.equal((await sharp(await exportLongImage(p.id)).metadata()).width, 1080);
    });
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});
