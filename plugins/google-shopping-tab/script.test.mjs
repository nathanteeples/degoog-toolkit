import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const script = await readFile(new URL("./script.js", import.meta.url), "utf8");

const card = (title, snippet, image) => `
  <article class="result-item">
    <div class="result-item-inner">
      <div class="result-thumbnail-wrap"><img class="result-thumbnail-img" src="${image}"></div>
      <div class="result-body">
        <a class="result-title" href="https://shop.example/${encodeURIComponent(title)}">${title}</a>
        <p class="result-snippet">${snippet}</p>
      </div>
    </div>
  </article>`;

const settle = () => new Promise((resolve) => setTimeout(resolve, 70));

test("enhances, sorts, filters, and cleanly deactivates Shopping results", async () => {
  const dom = new JSDOM(
    `<!doctype html><html><body>
      <div id="results-page">
        <div class="results-tab" data-type="web">Web</div>
        <div class="results-tab active" data-type="tab:google-shopping-tab">Shopping</div>
        <div id="results-main"><div id="results-list">
          ${card("Expensive Phone", "₹1,23,456 · Example Store · 4.8 stars", "phone.jpg")}
          ${card("Budget Phone", "€1.299 · Value Shop · 4.2 stars", "budget.jpg")}
          ${card("Japan Phone", "¥129,800 · Japan Shop · 4.5 stars", "japan.jpg")}
        </div></div>
      </div>
    </body></html>`,
    { pretendToBeVisual: true, runScripts: "outside-only", url: "https://degoog.test/search" },
  );

  dom.window.eval(`
    const __PLUGIN_ID__ = "google-shopping-tab";
    const t = (key, vars) => key.endsWith("product-count-many")
      ? String(vars.count) + " products"
      : key;
    ${script}
  `);
  await settle();

  const { document, Event } = dom.window;
  assert.equal(document.getElementById("results-page").classList.contains("gshop-active"), true);
  assert.equal(document.querySelectorAll(".gshop-product-card").length, 3);
  assert.equal(document.querySelectorAll(".gshop-image-link").length, 0);
  assert.equal(document.querySelector(".gshop-count").textContent, "3 products");
  assert.equal(document.querySelector(".gshop-count").getAttribute("aria-live"), "polite");
  assert.deepEqual(
    [...document.querySelectorAll(".gshop-product-card")].map((item) =>
      Number(item.dataset.gshopPrice),
    ),
    [123456, 1299, 129800],
  );

  const sort = document.querySelector(".gshop-sort");
  sort.value = "price-low";
  sort.dispatchEvent(new Event("change", { bubbles: true }));
  await settle();
  assert.equal(
    document.querySelector("#results-list > .result-item .result-title").textContent,
    "Budget Phone",
  );

  const merchant = document.querySelector(".gshop-merchant");
  merchant.value = "example store";
  merchant.dispatchEvent(new Event("change", { bubbles: true }));
  await settle();
  assert.equal(document.querySelectorAll("#results-list > .result-item[hidden]").length, 2);
  assert.equal(document.querySelector(".gshop-count").textContent, "1 product");

  document.querySelector("[data-type='web']").classList.add("active");
  document.querySelector("[data-type='tab:google-shopping-tab']").classList.remove("active");
  await settle();
  assert.equal(document.getElementById("results-page").classList.contains("gshop-active"), false);
  assert.equal(document.querySelector(".gshop-toolbar").hidden, true);
  assert.equal(document.querySelectorAll("#results-list > .result-item[hidden]").length, 0);

  const cachedHide = new Event("pagehide");
  Object.defineProperty(cachedHide, "persisted", { value: true });
  dom.window.dispatchEvent(cachedHide);
  document.querySelector("[data-type='web']").classList.remove("active");
  document.querySelector("[data-type='tab:google-shopping-tab']").classList.add("active");
  const cachedShow = new Event("pageshow");
  Object.defineProperty(cachedShow, "persisted", { value: true });
  dom.window.dispatchEvent(cachedShow);
  await settle();
  assert.equal(document.getElementById("results-page").classList.contains("gshop-active"), true);

  dom.window.dispatchEvent(new Event("pagehide"));
  dom.window.close();
});
