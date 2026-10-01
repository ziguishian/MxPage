import test from "node:test";
import assert from "node:assert/strict";
import { handleRouteError } from "../lib/utils/route";
import { networkErrorCode } from "../lib/utils/network-error";

for (const [message, cause, status, code] of [
  ["fetch failed", "EACCES", 503, "PROVIDER_NETWORK_PERMISSION"],
  ["fetch failed", "EPERM", 503, "PROVIDER_NETWORK_PERMISSION"],
  ["fetch failed", "ENOTFOUND", 502, "PROVIDER_NETWORK_ERROR"],
  ["fetch failed", "ECONNREFUSED", 502, "PROVIDER_NETWORK_ERROR"],
  ["fetch failed", "UND_ERR_CONNECT_TIMEOUT", 504, "PROVIDER_TIMEOUT"],
  ["Provider request timed out after 15000ms", undefined, 504, "PROVIDER_TIMEOUT"],
  ["Provider HTTP 504 Gateway Timeout", undefined, 504, "PROVIDER_TIMEOUT"],
  ["Unauthorized 401", undefined, 401, "PROVIDER_AUTH_ERROR"],
] as const) {
  test(`${cause ?? message} maps to ${code}`, async () => {
    const response = handleRouteError(new Error(message, { cause: { code: cause } }));
    assert.equal(response.status, status);
    assert.equal((await response.json()).error.code, code);
  });
}

test("nested SDK and aggregate socket errors retain the network-permission cause", async () => {
  const sockets = new AggregateError([{ code: "EACCES" }, { code: "EACCES" }], "");
  const fetchError = new TypeError("fetch failed", { cause: sockets });
  const sdkError = new Error("Connection error.", { cause: fetchError });
  const compatibilityError = new Error("Model connection check failed", { cause: sdkError });
  const response = handleRouteError(compatibilityError);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "PROVIDER_NETWORK_PERMISSION");
});

test("nested network errors remain distinguishable and cyclic causes terminate", async () => {
  const timeout = new Error("Connection error.", { cause: new TypeError("fetch failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } }) });
  assert.equal(handleRouteError(timeout).status, 504);
  const dns = new Error("Connection error.", { cause: new AggregateError([{ code: "ENOTFOUND" }]) });
  assert.equal(handleRouteError(dns).status, 502);
  const cyclic: { cause?: unknown } = {};
  cyclic.cause = cyclic;
  assert.equal(networkErrorCode(cyclic), undefined);
});
