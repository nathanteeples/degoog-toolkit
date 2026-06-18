import assert from "node:assert/strict";
import test from "node:test";

import { slot } from "./index.js";

await slot.init({
  template:
    '<div class="results-slot-panel rslot-panel"><a href="{{post_url}}">{{post_title}}</a><span>{{post_subreddit}}</span>{{comment_cards}}</div>',
});

test("triggers on explicit reddit keyword queries", () => {
  slot.configure({ showMode: "keyword" });
  assert.equal(slot.trigger("reddit mark hamill"), true);
  assert.equal(slot.trigger("best laptops"), false);
});

test("returns a client-loading shell for reddit queries", async () => {
  slot.configure({ showMode: "keyword", maxComments: "2" });

  const output = await slot.execute("reddit mark hamill", {
    tab: "all",
    results: [],
  });

  assert.match(output.html, /data-rslot-pending="1"/);
  assert.match(output.html, /data-rslot-query="mark hamill"/);
  assert.match(output.html, /rslot-card-template/);
  assert.match(output.html, /rslot-body--loading/);
  assert.doesNotMatch(output.html, /rslot-error/);
});

test("top10 mode skips shell when no reddit result is present", async () => {
  slot.configure({ showMode: "top10" });

  const output = await slot.execute("mark hamill", {
    results: [{ url: "https://example.com/thread" }],
  });

  assert.equal(output.html, "");
});
