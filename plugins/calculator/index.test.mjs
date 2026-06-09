import assert from "node:assert/strict";
import test from "node:test";

import { slot } from "./index.js";

slot.init({
  template: '<div data-result="{{display_result}}"></div>',
});

test("loads the parser and executes calculator queries", async () => {
  assert.equal(slot.trigger("2+2"), true);
  const output = await slot.execute("2+2", { lang: "en-US" });
  assert.match(output.html, /data-result="4"/);
});

test("at-a-glance position only renders on glance API path", async () => {
  slot.configure({ slotPosition: "at-a-glance" });
  const main = await slot.execute("2+2", {});
  assert.equal(main.html, "");
  const glance = await slot.execute("2+2", { results: [] });
  assert.match(glance.html, /data-result="4"/);
});
