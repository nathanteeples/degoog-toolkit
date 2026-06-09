import assert from "node:assert/strict";
import test from "node:test";

import { slot } from "./index.js";

function yahooFetch(url) {
  const parsed = new URL(url);

  if (parsed.pathname.endsWith("/v1/finance/search")) {
    const query = parsed.searchParams.get("q") || "";
    const symbol =
      query.toLowerCase() === "apple" ? "AAPL" : query.toUpperCase();
    const quotes =
      query.toLowerCase() === "aapl"
        ? [
            {
              symbol: "IEWQ.SW",
              quoteType: "ETF",
              shortname: "IVZ NASDAQ-100 EW Acc",
              longname: "AAPL Sep 2026 150.000 put",
              exchange: "EBS",
            },
          ]
        : [
            {
              symbol,
              quoteType: "EQUITY",
              shortname: symbol === "AAPL" ? "Apple Inc." : "Alphabet Inc.",
              exchange: "NMS",
            },
          ];
    return Promise.resolve(
      Response.json({
        quotes,
      }),
    );
  }

  if (parsed.pathname.endsWith("/v7/finance/quote")) {
    const symbol = parsed.searchParams.get("symbols") || "AAPL";
    return Promise.resolve(
      Response.json({
        quoteResponse: {
          result: [
            {
              symbol,
              quoteType: "EQUITY",
              shortName: symbol === "AAPL" ? "Apple Inc." : "Alphabet Inc.",
              regularMarketPrice: 200,
              regularMarketPreviousClose: 198,
            },
          ],
        },
      }),
    );
  }

  if (parsed.pathname.includes("/v8/finance/chart/")) {
    const symbol = decodeURIComponent(parsed.pathname.split("/").at(-1));
    return Promise.resolve(
      Response.json({
        chart: {
          result: [
            {
              meta: {
                symbol,
                instrumentType: "EQUITY",
                regularMarketPrice: 200,
                previousClose: 198,
                currency: "USD",
              },
              timestamp: [1, 2],
              indicators: {
                quote: [{ close: [198, 200] }],
              },
            },
          ],
        },
      }),
    );
  }

  throw new Error(`Unexpected URL: ${url}`);
}

test("renders quotes for explicit stock queries and Yahoo result hints", async () => {
  const cases = [
    ["stock aapl", []],
    ["aapl stock", []],
    ["apple stock", []],
    ["stock apple", []],
    ["goog", [{ url: "https://finance.yahoo.com/quote/GOOG/" }]],
  ];

  for (const [query, results] of cases) {
    assert.equal(slot.trigger(query), true);
    const output = await slot.execute(query, {
      tab: "all",
      results,
      fetch: yahooFetch,
    });
    assert.match(output.html, /stocks-card/);
    if (query.includes("aapl")) {
      assert.match(output.html, />AAPL</);
      assert.doesNotMatch(output.html, /IEWQ\.SW/);
    }
  }
});
