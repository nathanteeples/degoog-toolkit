import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import GoogleShoppingEngine, { type } from "./index.js";

const fixture = await readFile(
  new URL("./fixtures/shopping-results.html", import.meta.url),
  "utf8",
);

const responseWith = (body, status = 200) =>
  new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });

const makeContext = (body = fixture) => {
  const calls = [];
  let sentinelCalls = 0;
  return {
    calls,
    get sentinelCalls() {
      return sentinelCalls;
    },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return responseWith(body);
    },
    userAgent: () => "Shopping Engine Test UA",
    buildAcceptLanguage: () => "en-US,en;q=0.9",
    sentinel: () => {
      sentinelCalls += 1;
    },
    engineError: (status, message, options = {}) =>
      Object.assign(new Error(message), { status, ...options }),
  };
};

test("declares a transport-backed shopping engine", async () => {
  assert.equal(type, "shopping");
  const engine = new GoogleShoppingEngine();
  const transportField = engine.settingsSchema.find(
    (field) => field.key === "outgoingTransport",
  );
  assert.equal(transportField.default, "curl-impersonate");
  const context = makeContext();

  const results = await engine.executeSearch("wireless phone", 2, undefined, context);

  assert.equal(results.length, 3);
  assert.equal(results[0].source, "Google Shopping");
  assert.match(results[0].snippet, /^\$499\.99 · Example Store · 4\.7 stars/);
  assert.equal(context.sentinelCalls, 1);
  assert.equal(context.calls.length, 1);

  const request = context.calls[0];
  const url = new URL(request.url);
  assert.equal(url.hostname, "www.google.com");
  assert.equal(url.searchParams.get("q"), "wireless phone");
  assert.equal(url.searchParams.get("udm"), "28");
  assert.equal(url.searchParams.get("start"), "24");
  assert.equal(request.options.headers["User-Agent"], "Shopping Engine Test UA");
  assert.equal(request.options.headers["Accept-Language"], "en-US,en;q=0.9");
  assert.equal(request.options.redirect, "follow");
  assert.ok(request.options.signal instanceof AbortSignal);
});

test("honors configured locale and quality filters", async () => {
  const engine = new GoogleShoppingEngine();
  engine.configure({
    googleHost: "www.google.co.uk",
    region: "gb",
    language: "en",
    blockedMerchants: "shop.example",
    maxPerMerchant: "1",
    minimumRating: "4",
    timeoutMs: "30000",
  });
  const context = makeContext();

  const results = await engine.executeSearch("headphones", 1, undefined, context);
  const url = new URL(context.calls[0].url);
  assert.equal(url.hostname, "www.google.co.uk");
  assert.equal(url.searchParams.get("gl"), "gb");
  assert.equal(
    context.calls[0].options.headers["Accept-Language"],
    "en-GB,en;q=0.9",
  );
  assert.deepEqual(results.map((result) => result.title), ["Quiet Headphones"]);
});

test("requires degoog's injected transport", async () => {
  const engine = new GoogleShoppingEngine();
  await assert.rejects(
    engine.executeSearch("phone", 1, undefined, {}),
    (error) => error.status === "blocked",
  );
});

test("keeps the standard timeout default when its advanced field is blank", () => {
  const engine = new GoogleShoppingEngine();
  engine.configure({ timeoutMs: "" });
  assert.equal(engine.requestTimeoutMs, 30_000);
  engine.configure({ timeoutMs: "25000" });
  assert.equal(engine.requestTimeoutMs, 25_000);
});

test("accepts rendered Shopping results that retain Google's noscript fallback", async () => {
  const engine = new GoogleShoppingEngine();
  const renderedPage = fixture.replace(
    "<body>",
    '<body><noscript><a href="/httpservice/retry/enablejs">Enable JavaScript</a></noscript>',
  );

  const results = await engine.executeSearch(
    "phone",
    1,
    undefined,
    makeContext(renderedPage),
  );

  assert.equal(results.length, 3);
});

test("surfaces interstitial and parser failures", async () => {
  const engine = new GoogleShoppingEngine();

  await assert.rejects(
    engine.executeSearch(
      "phone",
      1,
      undefined,
      makeContext("<html>Before you continue to Google</html>"),
    ),
    (error) => error.status === "interstitial",
  );

  await assert.rejects(
    engine.executeSearch(
      "phone",
      1,
      undefined,
      makeContext("<html><main>ordinary web response</main></html>"),
    ),
    (error) => error.status === "parse_error",
  );
});
