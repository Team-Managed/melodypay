import assert from "node:assert/strict";
import test from "node:test";
import { parseApiResponse } from "./serial.js";

test("parses a successful device response", () => {
  assert.deepEqual(parseApiResponse('{"id":4,"ok":true,"result":{"audio":true}}'), {
    id: 4,
    ok: true,
    result: { audio: true },
  });
});

test("parses a device error response", () => {
  assert.deepEqual(parseApiResponse('{"id":9,"ok":false,"error":"unsupported"}'), {
    id: 9,
    ok: false,
    error: "unsupported",
  });
});

test("ignores console lines and malformed JSON", () => {
  assert.equal(parseApiResponse("melodypay>"), null);
  assert.equal(parseApiResponse("not json"), null);
  assert.equal(parseApiResponse('{"id":"bad","ok":true}'), null);
});
