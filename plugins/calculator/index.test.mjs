import assert from "node:assert/strict";
import test from "node:test";

import { slot } from "./index.js";

slot.init({
  template:
    '<div data-result="{{display_result}}" data-graph="{{graph_mode}}"></div>',
});

test("loads the parser and executes calculator queries", async () => {
  assert.equal(slot.trigger("2+2"), true);
  const output = await slot.execute("2+2", { lang: "en-US" });
  assert.match(output.html, /data-result="4"/);
  assert.match(output.html, /data-graph="false"/);
});

test("supports additional scientific functions", async () => {
  assert.equal(slot.trigger("sinh(0)+abs(-4)"), true);
  const output = await slot.execute("sinh(0)+abs(-4)", { lang: "en-US" });
  assert.match(output.html, /data-result="4"/);
});

test("supports explicit constants and multiple graph series", async () => {
  assert.equal(slot.trigger("graph 5"), true);
  assert.equal(slot.trigger("graph sin(x); cos(x); x/2"), true);

  const constant = await slot.execute("graph 5", { lang: "en-US" });
  const multiple = await slot.execute("graph sin(x); cos(x); x/2", {
    lang: "en-US",
  });

  assert.match(constant.html, /data-result=""/);
  assert.match(constant.html, /data-graph="true"/);
  assert.match(multiple.html, /data-graph="true"/);
});
