import assert from "node:assert/strict";
import test from "node:test";

import { slot, testNormalizeRange } from "./index.js";

slot.init({
  template:
    '<div data-mode="{{active_tab}}" data-die-type="{{die_type}}"></div>',
});

test("keeps dice trigger word boundaries", () => {
  assert.equal(slot.trigger("roll d20"), true);
  assert.equal(slot.trigger("roll d20foo"), false);
});

test("rejects unsupported and incidental dice text", () => {
  assert.equal(slot.trigger("120 sided dice"), false);
  assert.equal(slot.trigger("roll d8"), false);
  assert.equal(slot.trigger("price of d6 stock"), false);
  assert.equal(slot.trigger("roll a 6 sided die"), true);
  assert.equal(slot.trigger("roll a 20 sided die"), true);
});

test("normalizes, swaps, and bounds number ranges", () => {
  assert.deepEqual(testNormalizeRange(10, -5), { min: -5, max: 10 });
  assert.deepEqual(testNormalizeRange("-99999999999", "99999999999"), {
    min: -1_000_000_000,
    max: 1_000_000_000,
  });
  assert.deepEqual(testNormalizeRange("invalid", ""), { min: 1, max: 100 });
});
