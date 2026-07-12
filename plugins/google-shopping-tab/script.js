(() => {
  const TAB_TYPE = `tab:${__PLUGIN_ID__}`;
  const TOOLBAR_CLASS = "gshop-toolbar";
  let scheduled = false;
  let frameId = 0;

  const translated = (key, fallback, vars) => {
    try {
      const value = t(key, vars);
      if (value && value !== key) return String(value);
    } catch {}
    return fallback.replace("{count}", String(vars?.count ?? ""));
  };

  const isActive = () =>
    document.querySelector(".results-tab.active")?.dataset.type === TAB_TYPE;

  const parsePrice = (text) => {
    let value = String(text ?? "").replace(/[^\d.,-]/g, "");
    const commaCount = (value.match(/,/g) || []).length;
    const dotCount = (value.match(/\./g) || []).length;
    const lastComma = value.lastIndexOf(",");
    const lastDot = value.lastIndexOf(".");

    if (commaCount && dotCount) {
      if (lastComma > lastDot) {
        value = value.replace(/\./g, "").replace(",", ".");
      } else {
        value = value.replace(/,/g, "");
      }
    } else if (commaCount || dotCount) {
      const separator = commaCount ? "," : ".";
      const parts = value.split(separator);
      const westernGrouped =
        parts.length > 1 && parts.slice(1).every((part) => part.length === 3);
      const indianGrouped =
        parts.length > 2 &&
        parts.at(-1).length === 3 &&
        parts.slice(1, -1).every((part) => part.length === 2);
      const grouped = westernGrouped || indianGrouped;
      if (grouped) {
        value = parts.join("");
      } else if (separator === ",") {
        value = `${parts.slice(0, -1).join("")}.${parts.at(-1)}`;
      } else if (parts.length > 2) {
        value = `${parts.slice(0, -1).join("")}.${parts.at(-1)}`;
      }
    }
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
  };

  const createOption = (value, label) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  };

  const ensureToolbar = (list) => {
    let toolbar = document.querySelector(`.${TOOLBAR_CLASS}`);
    if (toolbar) return toolbar;

    toolbar = document.createElement("div");
    toolbar.className = TOOLBAR_CLASS;
    toolbar.setAttribute("role", "region");
    toolbar.setAttribute(
      "aria-label",
      translated(
        "google-shopping-tab.controls-label",
        "Shopping result controls",
      ),
    );

    const count = document.createElement("span");
    count.className = "gshop-count";
    count.setAttribute("aria-live", "polite");
    count.setAttribute("aria-atomic", "true");

    const controls = document.createElement("div");
    controls.className = "gshop-controls";

    const sortLabel = document.createElement("label");
    sortLabel.className = "gshop-control";
    const sortText = document.createElement("span");
    sortText.className = "gshop-control-label";
    sortText.textContent = translated(
      "google-shopping-tab.sort-label",
      "Sort",
    );
    const sort = document.createElement("select");
    sort.className = "gshop-sort";
    sort.setAttribute("aria-label", sortText.textContent);
    sort.append(
      createOption(
        "relevance",
        translated("google-shopping-tab.sort-relevance", "Relevance"),
      ),
      createOption(
        "price-low",
        translated("google-shopping-tab.sort-price-low", "Price: low to high"),
      ),
      createOption(
        "price-high",
        translated("google-shopping-tab.sort-price-high", "Price: high to low"),
      ),
    );
    sortLabel.append(sortText, sort);

    const merchantLabel = document.createElement("label");
    merchantLabel.className = "gshop-control";
    const merchantText = document.createElement("span");
    merchantText.className = "gshop-control-label";
    merchantText.textContent = translated(
      "google-shopping-tab.merchant-label",
      "Merchant",
    );
    const merchant = document.createElement("select");
    merchant.className = "gshop-merchant";
    merchant.setAttribute("aria-label", merchantText.textContent);
    merchant.append(
      createOption(
        "",
        translated("google-shopping-tab.all-merchants", "All merchants"),
      ),
    );
    merchantLabel.append(merchantText, merchant);

    controls.append(sortLabel, merchantLabel);
    toolbar.append(count, controls);
    list.before(toolbar);

    sort.addEventListener("change", scheduleScan);
    merchant.addEventListener("change", scheduleScan);
    return toolbar;
  };

  const enhanceCard = (card, index) => {
    if (!card.classList.contains("gshop-product-card")) {
      card.classList.add("gshop-product-card");
    }
    if (!card.dataset.gshopOriginalIndex) {
      card.dataset.gshopOriginalIndex = String(index);
    }

    const snippet = card.querySelector(".result-snippet");
    if (snippet && !snippet.dataset.gshopEnhanced) {
      const original = (snippet.textContent || "").trim();
      const parts = original
        .split(/\s+·\s+/)
        .map((part) => part.trim())
        .filter(Boolean);
      card.dataset.gshopPrice = String(parsePrice(parts[0] || ""));
      card.dataset.gshopMerchant = (parts[1] || "").toLowerCase();
      card.dataset.gshopMerchantLabel = parts[1] || "";
      snippet.textContent = "";
      parts.forEach((part, partIndex) => {
        const span = document.createElement("span");
        span.className =
          partIndex === 0
            ? "gshop-price"
            : partIndex === 1
              ? "gshop-merchant-name"
              : "gshop-detail";
        span.textContent = part;
        snippet.append(span);
      });
      snippet.dataset.gshopEnhanced = "true";
    }

  };

  const updateMerchantOptions = (select, cards) => {
    const merchants = [...new Set(
      cards
        .map((card) => ({
          value: card.dataset.gshopMerchant || "",
          label: card.dataset.gshopMerchantLabel || "",
        }))
        .filter((merchant) => merchant.value && merchant.label)
        .map((merchant) => JSON.stringify(merchant)),
    )]
      .map((entry) => JSON.parse(entry))
      .sort((a, b) => a.label.localeCompare(b.label));
    const signature = JSON.stringify(merchants);
    if (select.dataset.gshopOptions === signature) return;

    const current = select.value;
    select.textContent = "";
    select.append(
      createOption(
        "",
        translated("google-shopping-tab.all-merchants", "All merchants"),
      ),
    );
    for (const merchant of merchants) {
      select.append(createOption(merchant.value, merchant.label));
    }
    select.value = merchants.some((merchant) => merchant.value === current)
      ? current
      : "";
    select.dataset.gshopOptions = signature;
  };

  const applyControls = (list, toolbar, cards) => {
    const sort = toolbar.querySelector(".gshop-sort")?.value || "relevance";
    const merchant =
      toolbar.querySelector(".gshop-merchant")?.value || "";

    for (const card of cards) {
      card.hidden = Boolean(
        merchant && card.dataset.gshopMerchant !== merchant,
      );
    }

    const ordered = [...cards].sort((a, b) => {
      if (sort === "price-low") {
        return Number(a.dataset.gshopPrice) - Number(b.dataset.gshopPrice);
      }
      if (sort === "price-high") {
        return Number(b.dataset.gshopPrice) - Number(a.dataset.gshopPrice);
      }
      return (
        Number(a.dataset.gshopOriginalIndex) -
        Number(b.dataset.gshopOriginalIndex)
      );
    });
    const current = [...list.querySelectorAll(":scope > .result-item")];
    if (ordered.some((card, index) => current[index] !== card)) {
      list.append(...ordered);
    }

    const visibleCount = cards.filter((card) => !card.hidden).length;
    const key =
      visibleCount === 1
        ? "google-shopping-tab.product-count-one"
        : "google-shopping-tab.product-count-many";
    const fallback = visibleCount === 1 ? "1 product" : "{count} products";
    toolbar.querySelector(".gshop-count").textContent = translated(
      key,
      fallback,
      { count: visibleCount },
    );
  };

  const scan = () => {
    scheduled = false;
    frameId = 0;
    const page = document.getElementById("results-page");
    const list = document.getElementById("results-list");
    if (!page || !list) return;

    const active = isActive();
    if (page.classList.contains("gshop-active") !== active) {
      page.classList.toggle("gshop-active", active);
    }
    if (list.classList.contains("gshop-product-grid") !== active) {
      list.classList.toggle("gshop-product-grid", active);
    }

    const existingToolbar = document.querySelector(`.${TOOLBAR_CLASS}`);
    if (!active) {
      if (existingToolbar) existingToolbar.hidden = true;
      list
        .querySelectorAll(":scope > .result-item[hidden]")
        .forEach((card) => {
          card.hidden = false;
        });
      return;
    }

    const cards = [...list.querySelectorAll(":scope > .result-item")];
    cards.forEach(enhanceCard);
    const toolbar = ensureToolbar(list);
    toolbar.hidden = cards.length === 0;
    if (!cards.length) return;

    const merchantSelect = toolbar.querySelector(".gshop-merchant");
    updateMerchantOptions(merchantSelect, cards);
    applyControls(list, toolbar, cards);
  };

  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    frameId = requestAnimationFrame(scan);
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "data-type"],
  });
  const handlePageShow = () => scheduleScan();
  const handlePageHide = (event) => {
    if (event.persisted) return;
    observer.disconnect();
    if (frameId) cancelAnimationFrame(frameId);
    scheduled = false;
    frameId = 0;
    window.removeEventListener("popstate", scheduleScan);
    window.removeEventListener("extensions-saved", scheduleScan);
    window.removeEventListener("pageshow", handlePageShow);
    window.removeEventListener("pagehide", handlePageHide);
  };
  window.addEventListener("popstate", scheduleScan);
  window.addEventListener("extensions-saved", scheduleScan);
  window.addEventListener("pageshow", handlePageShow);
  window.addEventListener("pagehide", handlePageHide);
  scheduleScan();
})();
