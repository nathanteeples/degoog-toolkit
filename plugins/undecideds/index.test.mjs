import assert from "node:assert/strict";
import test from "node:test";

import { slot } from "./index.js";

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
