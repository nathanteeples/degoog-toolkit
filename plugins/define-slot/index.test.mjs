import assert from "node:assert/strict";
import test from "node:test";

import { finalizeSlotHtml, shouldRenderSlotForContext } from "./slot-position.js";
import { slot } from "./index.js";

await slot.init({
  template: '<div class="dslot-card" data-dslot-word="{{word}}">{{word}}</div>',
});

test("wraps glance output in glance-box shell", () => {
  const html = finalizeSlotHtml(
    '<div class="dslot-card">test</div>',
    { results: [] },
    "at-a-glance",
  );
  assert.match(html, /^<div class="glance-box">/);
  assert.match(html, /dslot-card/);
});

test("does not wrap above-results output", () => {
  const html = finalizeSlotHtml(
    '<div class="dslot-card">test</div>',
    {},
    "above-results",
  );
  assert.doesNotMatch(html, /glance-box/);
});

test("at-a-glance position gates main vs glance slot paths", () => {
  assert.equal(shouldRenderSlotForContext({}, "at-a-glance"), false);
  assert.equal(shouldRenderSlotForContext({ results: [] }, "at-a-glance"), true);
  assert.equal(shouldRenderSlotForContext({}, "above-results"), true);
  assert.equal(
    shouldRenderSlotForContext({ results: [] }, "above-results"),
    false,
  );
});
