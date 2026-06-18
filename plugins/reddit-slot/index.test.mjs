import assert from "node:assert/strict";
import test from "node:test";

import { slot } from "./index.js";

function mockRedditFetch() {
  return async (url) => {
    if (String(url).includes("/search.json")) {
      return {
        ok: true,
        async json() {
          return {
            data: {
              children: [
                {
                  data: {
                    id: "abc123",
                    subreddit: "test",
                    subreddit_name_prefixed: "r/test",
                    title: "Feather issues thread",
                    permalink: "/r/test/comments/abc123/feather_issues/",
                    score: 120,
                    num_comments: 42,
                    selftext: "feather issues discussion",
                    over_18: false,
                  },
                },
              ],
            },
          };
        },
      };
    }

    return {
      ok: true,
      async json() {
        return [
          {},
          {
            data: {
              children: [
                {
                  kind: "t1",
                  data: {
                    author: "tester",
                    body: "Try checking the quill alignment.",
                    score: 15,
                    permalink: "/r/test/comments/abc123/feather_issues/n123/",
                    stickied: false,
                  },
                },
              ],
            },
          },
        ];
      },
    };
  };
}

await slot.init({
  template:
    '<div class="rslot-panel"><a href="{{post_url}}">{{post_title}}</a><span>{{post_subreddit}}</span>{{comment_cards}}</div>',
  fetch: mockRedditFetch(),
  createCache: () => ({
    get: async () => null,
    set: async () => {},
  }),
});

test("triggers on explicit reddit keyword queries", () => {
  slot.configure({ showMode: "keyword" });
  assert.equal(slot.trigger("reddit mark hamill"), true);
  assert.equal(slot.trigger("best laptops"), false);
});

test("renders a reddit card server-side for reddit queries", async () => {
  slot.configure({ showMode: "keyword", maxComments: "1" });

  const output = await slot.execute("reddit feather issues", {
    tab: "all",
    results: [],
    fetch: mockRedditFetch(),
  });

  assert.match(output.html, /Feather issues thread/);
  assert.match(output.html, /r\/test/);
  assert.match(output.html, /Try checking the quill alignment/);
  assert.doesNotMatch(output.html, /data-rslot-pending/);
  assert.doesNotMatch(output.html, /results-slot-panel rslot-panel/);
});

test("top10 mode returns empty html when no reddit result is present", async () => {
  slot.configure({ showMode: "top10" });

  const output = await slot.execute("mark hamill", {
    results: [{ url: "https://example.com/thread" }],
  });

  assert.equal(output.html, "");
});

test("renders an error card when reddit blocks the server", async () => {
  slot.configure({ showMode: "keyword" });

  const output = await slot.execute("reddit feather issues", {
    results: [],
    fetch: async () => ({ ok: false, status: 403 }),
  });

  assert.match(output.html, /rslot-error/);
  assert.match(output.html, /403/);
});
