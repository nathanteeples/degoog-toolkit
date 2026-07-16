import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isGoogleShoppingInterstitial,
  parseGoogleShoppingHtml,
} from "./parse-html.js";

const fixture = await readFile(
  new URL("./fixtures/shopping-results.html", import.meta.url),
  "utf8",
);

test("parses organic products and rejects ads, duplicates, and malformed cards", () => {
  const parsed = parseGoogleShoppingHtml(fixture);

  assert.equal(parsed.results.length, 3);
  assert.deepEqual(
    parsed.results.map((result) => result.title),
    ["Pocket Phone 128GB", "Quiet Headphones", "Protective Phone Case"],
  );
  assert.equal(parsed.results[0].url, "https://shop.example/phone");
  assert.equal(parsed.results[0].price, "$499.99");
  assert.equal(parsed.results[0].merchant, "Example Store");
  assert.equal(parsed.results[0].rating, 4.7);
  assert.equal(parsed.results[0].reviewCount, "321");
  assert.equal(parsed.results[0].shipping, "Free shipping");
  assert.equal(parsed.results[0].thumbnail, "https://images.example/phone.webp");
  assert.ok(!parsed.results.some((result) => /Sponsored|Click Ad/.test(result.title)));
});

test("applies local merchant, diversity, and rating filters", () => {
  const blocked = parseGoogleShoppingHtml(fixture, {
    blockedMerchants: ["shop.example"],
  });
  assert.deepEqual(blocked.results.map((result) => result.title), ["Quiet Headphones"]);

  const diverse = parseGoogleShoppingHtml(fixture, { maxPerMerchant: 1 });
  assert.deepEqual(
    diverse.results.map((result) => result.title),
    ["Pocket Phone 128GB", "Quiet Headphones"],
  );

  const highlyRated = parseGoogleShoppingHtml(fixture, { minimumRating: 4 });
  assert.deepEqual(
    highlyRated.results.map((result) => result.title),
    ["Pocket Phone 128GB", "Quiet Headphones"],
  );
});

test("falls back from a product link to a bounded semantic card", () => {
  const html = `
    <div data-docid="unrelated-navigation">Shopping filters</div>
    <section>
      <div class="unknown-card">
        <a href="/shopping/product/123"><h3>Semantic Lamp</h3></a>
        <span class="a8Pemb">$42.00</span>
        <span class="aULzUe">Lamp Store</span>
        <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" srcset="https://images.example/lamp.jpg 1x" width="100" height="100">
      </div>
    </section>`;
  const parsed = parseGoogleShoppingHtml(html);
  assert.equal(parsed.results.length, 1);
  assert.equal(parsed.results[0].title, "Semantic Lamp");
  assert.match(parsed.results[0].url, /google\.com\/shopping\/product\/123/);
  assert.equal(parsed.results[0].thumbnail, "https://images.example/lamp.jpg");
});

test("handles localized prices, sponsored labels, and accessible ratings", () => {
  const html = `
    <article data-docid="localized-organic">
      <a href="https://shop.example/de-lamp"><h3>Leselampe</h3></a>
      <span class="a8Pemb">79,99 €</span>
      <span class="aULzUe">Lampenladen</span>
      <span class="Rsc7Yb" aria-label="4,8 von 5 Sternen (45 Bewertungen)">4,8</span>
    </article>
    <article data-docid="localized-ad">
      <span>Gesponsert</span>
      <a href="https://ads.example/lamp"><h3>Werbelampe</h3></a>
      <span class="a8Pemb">1,00 €</span>
      <span class="aULzUe">Ads Shop</span>
    </article>`;
  const parsed = parseGoogleShoppingHtml(html, { minimumRating: 4.5 });
  assert.equal(parsed.results.length, 1);
  assert.equal(parsed.results[0].price, "79,99 €");
  assert.equal(parsed.results[0].rating, 4.8);
  assert.equal(parsed.results[0].reviewCount, "45");
});

test("keeps grouped localized amounts and accepts bare rating text", () => {
  const html = `
    <article data-docid="space-price">
      <a href="https://shop.example/space-price"><h3>European Sofa</h3></a>
      <span class="a8Pemb">1 299,00 €</span>
      <span class="aULzUe">Sofa Shop</span>
      <span class="Rsc7Yb">4,8</span>
    </article>
    <article data-docid="apostrophe-price">
      <a href="https://shop.example/apostrophe-price"><h3>Swiss Watch</h3></a>
      <span class="a8Pemb">CHF 1’299.00</span>
      <span class="aULzUe">Watch Shop</span>
    </article>`;
  const parsed = parseGoogleShoppingHtml(html);
  assert.deepEqual(
    parsed.results.map((result) => result.price),
    ["1 299,00 €", "CHF 1’299.00"],
  );
  assert.equal(parsed.results[0].rating, 4.8);
  assert.equal(
    parseGoogleShoppingHtml(html, { minimumRating: 4.5 }).results[0].title,
    "European Sofa",
  );
});

test("supports current mosaic destinations and machine-readable ad markers", () => {
  const html = `
    <div data-id="mosaic">
      <article>
        <div data-lpage="https://merchant.example/mosaic-product">
          <h3>Mosaic Product</h3>
          <span class="a8Pemb">$55.00</span>
          <span class="aULzUe">Mosaic Merchant</span>
        </div>
      </article>
      <article class="sh-np__seller-container" data-docid="paid-one">
        <a href="https://ads.example/paid"><h3>Paid Product</h3></a>
        <span class="a8Pemb">$1.00</span><span class="aULzUe">Ads</span>
      </article>
      <article data-docid="paid-two" data-dtld="ads.example">
        <a href="https://ads.example/paid-two"><h3>Another Paid Product</h3></a>
        <span class="a8Pemb">$2.00</span><span class="aULzUe">Ads</span>
      </article>
    </div>`;
  const parsed = parseGoogleShoppingHtml(html);
  assert.deepEqual(parsed.results.map((result) => result.title), ["Mosaic Product"]);
  assert.equal(parsed.results[0].url, "https://merchant.example/mosaic-product");
});

test("deduplicates a canonical destination despite changing offer text", () => {
  const html = `
    <article data-docid="offer-a">
      <a href="https://shop.example/item"><h3>Product Name</h3></a>
      <span class="a8Pemb">$10.00</span><span class="aULzUe">Shop</span>
    </article>
    <article data-docid="offer-b">
      <a href="https://shop.example/item"><h3>Product Name - Sale</h3></a>
      <span class="a8Pemb">$9.99</span><span class="aULzUe">Shop</span>
    </article>`;
  assert.equal(parseGoogleShoppingHtml(html).results.length, 1);
});

test("detects explicit empty pages and Google interstitials", () => {
  const empty = parseGoogleShoppingHtml("<main>No products found</main>");
  assert.equal(empty.explicitNoResults, true);
  assert.deepEqual(empty.results, []);

  assert.equal(
    isGoogleShoppingInterstitial("unusual traffic from your computer network"),
    true,
  );
  assert.equal(
    isGoogleShoppingInterstitial(
      fixture.replace(
        "<body>",
        '<body><noscript><a href="/httpservice/retry/enablejs">Enable JavaScript</a></noscript>',
      ),
    ),
    false,
  );
  assert.equal(
    isGoogleShoppingInterstitial(
      '<html><noscript><a href="/httpservice/retry/enablejs">Enable JavaScript</a></noscript></html>',
    ),
    true,
  );
  assert.equal(isGoogleShoppingInterstitial(fixture), false);
});
