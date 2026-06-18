import assert from "node:assert/strict";
import test from "node:test";

import { slot } from "./index.js";

const SAMPLE_SEARCH_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>White collar thread</title>
    <link href="https://www.reddit.com/r/test/comments/abc123/white_collar/" />
    <content type="html">discussion about white collar</content>
    <author><name>/u/poster</name></author>
  </entry>
</feed>`;

const SAMPLE_COMMENTS_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>White collar thread</title>
    <link href="https://www.reddit.com/r/test/comments/abc123/white_collar/" />
  </entry>
  <entry>
    <title>comment</title>
    <link href="https://www.reddit.com/r/test/comments/abc123/white_collar/n1/" />
    <content type="html">RSS comment body</content>
    <author><name>/u/tester</name></author>
  </entry>
</feed>`;

function mockRedditFetch() {
  return async (url) => {
    const target = String(url);

    if (target.includes("/search.json")) {
      const body = JSON.stringify({
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
      });
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => body,
      };
    }

    if (target.includes("/comments/") && target.includes(".json")) {
      const body = JSON.stringify([
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
      ]);
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => body,
      };
    }

    return {
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "",
    };
  };
}

function mockBlockedJsonRssFallbackFetch() {
  return async (url) => {
    const target = String(url);

    if (target.includes("/search.json")) {
      return {
        ok: false,
        status: 403,
        statusText: "Blocked",
        text: async () => "<html>blocked</html>",
      };
    }

    if (target.startsWith("https://www.reddit.com") && target.includes("/search.rss")) {
      return {
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => "",
      };
    }

    if (target.startsWith("https://old.reddit.com") && target.includes("/search.rss")) {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => SAMPLE_SEARCH_RSS,
      };
    }

    if (target.includes("/comments/") && target.includes(".json")) {
      return {
        ok: false,
        status: 403,
        statusText: "Blocked",
        text: async () => "<html>blocked</html>",
      };
    }

    if (
      target.startsWith("https://www.reddit.com") &&
      target.includes("/comments/") &&
      target.includes(".rss")
    ) {
      return {
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => "",
      };
    }

    if (
      target.startsWith("https://old.reddit.com") &&
      target.includes("/comments/") &&
      target.includes(".rss")
    ) {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => SAMPLE_COMMENTS_RSS,
      };
    }

    return {
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "",
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

test("falls back to RSS when reddit JSON search is blocked", async () => {
  slot.configure({ showMode: "keyword", maxComments: "1" });

  const output = await slot.execute("reddit white collar", {
    results: [],
    fetch: mockBlockedJsonRssFallbackFetch(),
  });

  assert.match(output.html, /White collar thread/);
  assert.match(output.html, /RSS comment body/);
  assert.doesNotMatch(output.html, /rslot-error/);
});

test("uses existing reddit search results before direct reddit requests", async () => {
  slot.configure({ showMode: "keyword", maxComments: "1" });

  const output = await slot.execute("best lsat prep site reddit", {
    results: [
      {
        title: "Best LSAT prep site? : r/LSAT - Reddit",
        url: "https://www.reddit.com/r/LSAT/comments/abc123/best_lsat_prep_site/",
        snippet: "People compare LawHub, 7Sage, and other LSAT prep options.",
      },
    ],
    fetch: async () => {
      throw new Error("direct reddit fetch should not run");
    },
  });

  assert.match(output.html, /Best LSAT prep site\?/);
  assert.match(output.html, /r\/LSAT/);
  assert.match(output.html, /People compare LawHub/);
  assert.doesNotMatch(output.html, /rslot-error/);
});

test("top10 mode returns empty html when no reddit result is present", async () => {
  slot.configure({ showMode: "top10" });

  const output = await slot.execute("mark hamill", {
    results: [{ url: "https://example.com/thread" }],
  });

  assert.equal(output.html, "");
});

test("renders an error card when reddit JSON and RSS are blocked", async () => {
  slot.configure({ showMode: "keyword" });

  const output = await slot.execute("reddit feather issues", {
    results: [],
    fetch: async () => ({
      ok: false,
      status: 403,
      statusText: "Blocked",
      text: async () => "<html>blocked</html>",
    }),
  });

  assert.match(output.html, /rslot-error/);
  assert.match(output.html, /403/);
});
