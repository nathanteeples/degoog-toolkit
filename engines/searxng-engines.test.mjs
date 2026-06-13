import assert from "node:assert/strict";
import test from "node:test";

const ENGINE_CASES = [
  {
    path: "./searxng-search/index.js",
    type: "web",
    category: "general",
  },
  {
    path: "./searxng-images/index.js",
    type: "images",
    category: "images",
  },
  {
    path: "./searxng-videos/index.js",
    type: "videos",
    category: "videos",
  },
  {
    path: "./searxng-news/index.js",
    type: "news",
    category: "news",
  },
  {
    path: "./searxng-file/index.js",
    type: "file",
    category: "files",
  },
];

for (const engineCase of ENGINE_CASES) {
  test(`${engineCase.type} engine builds requests and maps results`, async () => {
    const module = await import(engineCase.path);
    const engine = new module.default();
    let requestUrl;
    let requestInit;

    engine.configure({
      baseUrl: "https://search.example.test/",
      engines: "example",
      safesearch: "2",
    });

    const results = await engine.executeSearch("test query", 2, "week", {
      lang: "en-US",
      fetch: async (url, init) => {
        requestUrl = new URL(url);
        requestInit = init;
        return {
          ok: true,
          async json() {
            return {
              results: [
                {
                  title: "Example",
                  url: "https://example.test/result",
                  content: "Result summary",
                  engine: "example",
                  thumbnail: "https://example.test/thumb.jpg",
                  img_src: "https://example.test/image.jpg",
                  duration: "3:14",
                },
                { title: "", url: "https://example.test/invalid" },
              ],
            };
          },
        };
      },
    });

    assert.equal(module.type, engineCase.type);
    assert.equal(requestUrl.origin, "https://search.example.test");
    assert.equal(requestUrl.pathname, "/search");
    assert.equal(requestUrl.searchParams.get("q"), "test query");
    assert.equal(requestUrl.searchParams.get("pageno"), "2");
    assert.equal(requestUrl.searchParams.get("categories"), engineCase.category);
    assert.equal(requestUrl.searchParams.get("engines"), "example");
    assert.equal(requestUrl.searchParams.get("safesearch"), "2");
    assert.equal(requestUrl.searchParams.get("language"), "en-US");
    assert.equal(requestUrl.searchParams.get("time_range"), "week");
    assert.equal(requestInit.headers.Accept, "application/json");
    assert.deepEqual(results, [
      {
        title: "Example",
        url: "https://example.test/result",
        snippet: "Result summary",
        source: "SearXNG:example",
        thumbnail: "https://example.test/thumb.jpg",
        imageUrl: "https://example.test/image.jpg",
        duration: "3:14",
      },
    ]);
  });

  test(`${engineCase.type} engine skips blank searches`, async () => {
    const module = await import(engineCase.path);
    const engine = new module.default();
    let fetchCalls = 0;

    const results = await engine.executeSearch("   ", 1, "any", {
      fetch: async () => {
        fetchCalls += 1;
        throw new Error("blank queries must not reach SearXNG");
      },
    });

    assert.deepEqual(results, []);
    assert.equal(fetchCalls, 0);
  });
}
