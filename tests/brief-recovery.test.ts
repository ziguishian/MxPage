import test from "node:test";
import assert from "node:assert/strict";
import { BriefPreparationError, runBriefStep } from "../lib/detail-runs/brief-recovery";

test("local model configuration errors keep their actionable explanation", async () => {
  const error = new Error("请在 AI 配置中明确选择图像识别模型。");
  let calls = 0;
  await assert.rejects(() => runBriefStep("识别", async () => { calls++; throw error; }), e => e === error);
  assert.equal(calls, 1);
});

for (const code of ["ECONNRESET", "UND_ERR_SOCKET"]) {
  test(`brief retries one transient ${code} then succeeds`, async () => {
    let calls = 0;
    const value = await runBriefStep("识别", async () => {
      if (++calls === 1) throw new Error("Connection error", { cause: new TypeError("fetch failed", { cause: { code } }) });
      return "recognized";
    });
    assert.equal(value, "recognized");
    assert.equal(calls, 2);
  });
}

test("persistent gateway failure stops after two attempts with safe resumable phase error", async () => {
  let calls = 0;
  await assert.rejects(() => runBriefStep("复核", async () => {
    calls++;
    throw Object.assign(new Error("sensitive-provider-response"), { status: 502 });
  }), (e: unknown) => {
    assert.ok(e instanceof BriefPreparationError);
    assert.equal(e.status, 502);
    assert.match(e.message, /结果已保存.*继续复核/);
    assert.ok(!e.message.includes("sensitive-provider-response"));
    return true;
  });
  assert.equal(calls, 2);
});

for (const [error, status] of [
  [Object.assign(new Error("fixture"), { status: 401 }), 401],
  [Object.assign(new Error("fixture"), { status: 403 }), 401],
  [Object.assign(new Error("fixture"), { status: 429 }), 429],
  [Object.assign(new Error("fixture"), { status: 400 }), 502],
  [new Error("fetch failed", { cause: { code: "EACCES" } }), 503],
  [Object.assign(new Error("timed out"), { name: "APIConnectionTimeoutError" }), 504],
] as const) {
  test(`brief does not retry ${JSON.stringify({ status: (error as any).status, name: error.name, cause: error.cause })}`, async () => {
    let calls = 0;
    await assert.rejects(() => runBriefStep("识别", async () => { calls++; throw error; }), (e: unknown) => e instanceof BriefPreparationError && e.status === status);
    assert.equal(calls, 1);
  });
}
