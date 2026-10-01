import test from "node:test";
import assert from "node:assert/strict";
import { ToolCallError } from "@openai/agents";
import { z } from "zod";
import { describeRunFailure, toolInputFeedback } from "../lib/detail-runs/run-errors";

test("SDK tool errors expose schema paths without persisting keys, values or agent state", () => {
  const invalid = z.object({ camera: z.string().min(10) }).safeParse({ camera: "sk-test" });
  assert.ok(!invalid.success);
  const inputError = Object.assign(new Error("bad input"), { name: "InvalidToolInputError", originalError: invalid.error });
  const error = new ToolCallError("request contains sk-private-secret", inputError);
  const failure = describeRunFailure(error, "视觉设计");
  assert.equal(failure.code, "INVALID_TOOL_INPUT");
  assert.deepEqual(failure.fields, ["camera: too_small; minimum=10"]);
  assert.ok(!JSON.stringify(failure).includes("sk-"));
  assert.equal(toolInputFeedback(new Error("database failed")), undefined, "operational failures are not model-format retries");
});

test("network, limits and missing tool output have different actionable messages", () => {
  assert.equal(describeRunFailure({name:"ToolCallError",error:{status:401,message:"Bearer secret"}}, "检查").code, "PROVIDER_AUTH_ERROR");
  assert.equal(describeRunFailure({status:429}, "检查").code, "PROVIDER_RATE_LIMIT");
  assert.equal(describeRunFailure({name:"MaxTurnsExceededError"}, "检查").code, "AGENT_TURN_LIMIT");
  assert.equal(describeRunFailure(new Error("ART_DIRECTION_MISSING"), "设计").code, "AGENT_RESULT_MISSING");
  assert.equal(describeRunFailure(new Error("DESIGN_REVIEW_MISSING"), "设计").code, "AGENT_RESULT_MISSING");
  const design = describeRunFailure(new ToolCallError("tool failed", new Error("DESIGN_REVIEW_FAILED")), "设计");
  assert.equal(design.code, "DESIGN_REVIEW_FAILED");
  assert.match(design.message, /文案或分镜.*设计检查说明.*复用草稿/);
  assert.doesNotMatch(design.message, /格式.*不完整|格式待补全/);
  const planning = describeRunFailure(new ToolCallError("tool failed", new Error("PLANNING_REVIEW_FAILED")), "商品卖点方案需调整");
  assert.equal(planning.code, "PLANNING_REVIEW_FAILED");
  assert.match(planning.message, /草稿与具体问题已保留/);
  assert.equal(describeRunFailure({cause:{code:"EACCES"}}, "设计").code, "PROVIDER_NETWORK_PERMISSION");
  assert.equal(describeRunFailure({name:"APIConnectionTimeoutError"}, "设计").code, "PROVIDER_TIMEOUT");
});

test("interrupted gateway sockets retain a safe reason instead of suggesting a wrong URL", () => {
  const failure = describeRunFailure({ name: "APIConnectionError", message: "Connection error sk-secret", cause: new TypeError("fetch failed", { cause: { code: "UND_ERR_SOCKET", headers: { authorization: "secret" } } }) }, "规划商品卖点与页面内容");
  assert.equal(failure.code, "PROVIDER_CONNECTION_INTERRUPTED");
  assert.equal(failure.networkCode, "UND_ERR_SOCKET");
  assert.match(failure.message, /连接中断.*检查点已保留/);
  assert.doesNotMatch(JSON.stringify(failure), /secret|headers|网关地址/);
});
