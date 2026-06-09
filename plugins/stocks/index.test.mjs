import assert from "node:assert/strict";
import test from "node:test";

import { slot } from "./index.js";

function yahooFetch(url) {
  const parsed = new URL(url);

  if (parsed.pathname.endsWith("/v1/finance/search")) {
    const query = parsed.searchParams.get("q") || "";
    const normalized = query.toLowerCase();
    const quotes = normalized === "alphabet"
      ? [{
          symbol: "GOOGL",
          quoteType: "EQUITY",
          shortname: "Alphabet Inc.",
          exchange: "NMS",
        }]
      : normalized === "acme robotics"
        ? [{
            symbol: "ACMEX.SW",
            quoteType: "ETF",
            shortname: "Unrelated Robotics Fund",
            exchange: "EBS",
          }]
        : [{
            symbol: query.toUpperCase(),
            quoteType: "EQUITY",
            shortname: `${query.toUpperCase()} Holdings`,
            exchange: "NMS",
          }];
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

test("uses matching Yahoo quote results as general instrument evidence", async () => {
  const cases = [
    [
      "aapl stock",
      "AAPL",
      [{
        url: "https://finance.yahoo.com/quote/AAPL/",
        title: "Apple Inc. (AAPL) Stock Price, News, Quote & History",
        snippet: "Find the latest Apple Inc. stock quote and company information.",
      }],
    ],
    [
      "alphabet stock",
      "GOOG",
      [{
        url: "https://finance.yahoo.com/quote/GOOG/",
        title: "Alphabet Inc. (GOOG) Stock Price, News, Quote & History",
        snippet: "Find the latest Alphabet Inc. stock quote and company information.",
      }],
    ],
    [
      "acme robotics stock",
      "ACME",
      [
        {
          url: "https://finance.yahoo.com/quote/ACME/",
          title: "Acme Robotics Inc. (ACME) Stock Price, News, Quote & History",
          snippet: "Find the latest Acme Robotics stock quote and company information.",
        },
        {
          url: "https://finance.yahoo.com/quote/ACMEX.SW/",
          title: "Acme Robotics Fund (ACMEX.SW)",
        },
      ],
    ],
    [
      "goog",
      "GOOG",
      [{
        url: "https://finance.yahoo.com/quote/GOOG/",
        title: "Alphabet Inc. (GOOG) Stock Price, News, Quote & History",
      }],
    ],
  ];

  for (const [query, expectedSymbol, results] of cases) {
    assert.equal(slot.trigger(query), true);
    const output = await slot.execute(query, {
      tab: "all",
      results,
      fetch: yahooFetch,
    });
    assert.match(output.html, /stocks-card/);
    assert.match(output.html, new RegExp(`>${expectedSymbol}<`));
  }
});

test("does not let an unrelated Yahoo result override an explicit ticker", async () => {
  const output = await slot.execute("MSFT stock", {
    tab: "all",
    results: [{
      url: "https://finance.yahoo.com/quote/AAPL/",
      title: "Apple Inc. (AAPL) Stock Price, News, Quote & History",
    }],
    fetch: yahooFetch,
  });

  assert.match(output.html, />MSFT</);
  assert.doesNotMatch(output.html, />AAPL</);
});

test("does not treat a partial company-name match as stock evidence", async () => {
  const output = await slot.execute("app", {
    tab: "all",
    results: [{
      url: "https://finance.yahoo.com/quote/AAPL/",
      title: "Apple Inc. (AAPL) Stock Price, News, Quote & History",
    }],
    fetch: yahooFetch,
  });

  assert.deepEqual(output, { html: "" });
});
