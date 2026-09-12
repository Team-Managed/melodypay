import assert from "node:assert/strict";
import test from "node:test";
import { isBackNavigation } from "./navigation.js";

test("treats prompt symbols as back navigation without side effects", () => {
  assert.equal(isBackNavigation(Symbol("escape")), true);
  assert.equal(isBackNavigation("dashboard"), false);
  assert.equal(isBackNavigation(null), false);
});
