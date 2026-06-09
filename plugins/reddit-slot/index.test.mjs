import assert from "node:assert/strict";
import test from "node:test";

import { slot } from "./index.js";

await slot.init({
  template:
    '<div class="rslot"><a href="{{post_url}}">{{post_title}}</a><span>{{post_subreddit}}</span>{{comment_cards}}</div>',
});

test("triggers on explicit reddit keyword queries", () => {
  slot.configure({ showMode: "keyword" });
  assert.equal(slot.trigger("reddit mark hamill"), true);
  assert.equal(slot.trigger("best laptops"), false);
});

test("falls back to reddit links in search results when API is blocked", async () => {
  slot.configure({ showMode: "keyword", maxComments: "2" });

  const output = await slot.execute("reddit mark hamill", {
    tab: "all",
    results: [
      {
        title: "Mark Hamill here. In an AMA far, far away... : r/IAmA - Reddit",
        url: "https://www.reddit.com/r/IAmA/comments/1vvul8/mark_hamill_here_in_an_ama_far_far_away/",
        snippet: "Jan 22, 2014 ... Mark Hamill here. I'm excited to talk to you reddit.",
      },
      {
        title: "Mark Hamill unearths Star Wars memories on Reddit - CNET",
        url: "https://www.cnet.com/culture/mark-hamill-unearths-star-wars-memories-on-reddit/",
        snippet: "Iconic Star Wars actor Mark Hamill fielded questions on Reddit.",
      },
    ],
    fetch: async () => new Response("", { status: 403 }),
  });

  assert.match(output.html, /Mark Hamill here/);
  assert.match(output.html, /r\/IAmA/);
  assert.match(output.html, /reddit\.com\/r\/IAmA\/comments\/1vvul8/);
  assert.match(output.html, /Search preview/);
});
