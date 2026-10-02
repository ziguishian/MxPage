import assert from "node:assert/strict";
import test from "node:test";

process.env.STORAGE_ROOT = `/tmp/mxpage-atlas-cloud-test-${process.pid}`;

test("discovers Atlas Cloud console models", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({
      data: [
        { model: "text/model", displayName: "Text Model", type: "Text", display_console: true },
        { model: "image/model", displayName: "Image Model", type: "Image", categories: ["image-generation"], display_console: true },
        { model: "hidden/model", type: "Image", display_console: false },
        { model: "video/model", type: "Video", display_console: true },
      ],
    }));
  };

  const { OpenAICompatibleAdapter } = await import("../lib/ai/adapters/openai-compatible");
  const adapter = new OpenAICompatibleAdapter("https://api.atlascloud.ai/v1", "test-key");
  const models = await adapter.listModels();

  assert.deepEqual(models.map((model) => model.id), ["text/model", "image/model"]);
  assert.equal(calls[0]?.url, "https://api.atlascloud.ai/api/v1/models");
});

test("submits an Atlas Cloud image exactly once and polls its result", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/model/generateImage")) {
      return new Response(JSON.stringify({ data: { id: "prediction-1" } }));
    }
    return new Response(JSON.stringify({ data: { status: "completed", outputs: ["https://cdn.example/image.png"] } }));
  };

  const { OpenAICompatibleAdapter } = await import("../lib/ai/adapters/openai-compatible");
  const adapter = new OpenAICompatibleAdapter("https://api.atlascloud.ai/v1", "test-key");
  const result = await adapter.generateImage({
    model: "bytedance/seedream-v5.0-lite",
    prompt: "A simple product photo",
    aspectRatio: "1:1",
  });

  const submissions = calls.filter((call) => call.init?.method === "POST");
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0]?.url, "https://api.atlascloud.ai/api/v1/model/generateImage");
  assert.deepEqual(JSON.parse(String(submissions[0]?.init?.body)), {
    model: "bytedance/seedream-v5.0-lite",
    prompt: "A simple product photo",
    size: "2048*2048",
    output_format: "png",
  });
  assert.equal(result.url, "https://cdn.example/image.png");
});
