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

test("does not classify 120-sided dice as d20", async () => {
  const output = await slot.execute("120 sided dice", {
    tab: "all",
    results: [],
  });

  assert.match(output.html, /data-mode="dice"/);
  assert.match(output.html, /data-die-type="d6"/);
});
