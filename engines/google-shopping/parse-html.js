import * as cheerio from "cheerio";

const CARD_SELECTORS = [
  ".sh-dgr__grid-result",
  ".sh-dgr__content",
  ".sh-dlr__list-result",
  ".sh-pr__product-results-grid > div",
  ".sh-pr__product-results > div",
  "[data-product-id]",
  "[data-docid]",
];

const TITLE_SELECTORS = ["h3.tAxDx", "h3", "[role='heading']", "a[aria-label]"];
const PRICE_SELECTORS = [
  ".a8Pemb",
  "[data-sh-or='price']",
  ".T14wmb",
  ".HRLxBb",
  "[data-price]",
];
const MERCHANT_SELECTORS = [
  ".aULzUe",
  ".IuHnof",
  ".sh-dgr__seller",
  "[data-sh-or='merchant']",
  "[data-merchant]",
];
const RATING_SELECTORS = [
  ".Rsc7Yb",
  "[aria-label*='out of 5']",
  "[aria-label*='stars']",
  "[data-rating]",
];
const SHIPPING_SELECTORS = [
  ".vEjMR",
  ".vRrrC",
  ".sh-dgr__delivery",
  "[data-sh-or='delivery']",
  "[data-shipping]",
];
const IMAGE_SELECTORS = ["img.TL92Hc", "img[data-src]", "img[srcset]", "img[src]"];

const PRICE_RE =
  /(?:[$€£¥￥₹₩₽₺₫₴₦₱]\s*\d(?:[\d.,'’\s]*\d)?(?:\s?[A-Z]{3})?|(?:USD|EUR|GBP|CAD|AUD|JPY|INR|CHF|CNY|RMB|KRW|BRL|MXN|ZAR)\s*\d(?:[\d.,'’\s]*\d)?|\d(?:[\d.,'’\s]*\d)?\s*(?:[$€£¥￥₹₩₽₺₫₴₦₱]|USD|EUR|GBP|CAD|AUD|JPY|INR|CHF|CNY|RMB|KRW|BRL|MXN|ZAR))/i;
const RATING_RE =
  /([0-5](?:[.,]\d)?)\s*(?:(?:out of|von|sur|de|su|van)\s*5(?:\s*(?:stars?|sternen|étoiles?|estrellas?|stelle|sterren))?|(?:stars?|sternen|étoiles?|estrellas?|stelle|sterren))/iu;
const JAPANESE_RATING_RE = /5\s*つ星のうち\s*([0-5](?:[.,]\d)?)/u;
const REVIEW_RE =
  /(?:\(|\b)([\d,.]+(?:\s*[KMB]\b)?)(?:\s*(?:reviews?|ratings?|bewertungen|avis|reseñas|recensioni|beoordelingen))?\)?/iu;
const SPONSORED_RE =
  /^(?:sponsored|promoted|ads?|sponsored result|sponsorisé|annonce|gesponsert|anzeige|patrocinado|anuncio|sponsorizzato|annuncio|gesponsord|advertentie|スポンサー|広告)(?:\s*[·:|-].*)?$/iu;
const AD_URL_RE =
  /(?:\/aclk\?|\/pagead\/|[?&]adurl=|googleadservices\.|doubleclick\.net|googlesyndication\.com)/i;
const AD_CLASS_RE =
  /(?:sh-np__|(?:^|[-_\s])(?:pla|sponsored|promoted|ad-unit|ads?)(?:[-_\s]|$))/i;
const TRACKING_PARAMS = new Set([
  "gclid",
  "dclid",
  "gbraid",
  "wbraid",
  "gad_source",
  "srsltid",
  "ved",
  "ei",
]);

const cleanText = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const firstText = ($node, selectors) => {
  for (const selector of selectors) {
    const $candidate = $node.find(selector).first();
    const text = cleanText(
      $candidate.text() ||
        $candidate.attr("aria-label") ||
        $candidate.attr("data-price") ||
        $candidate.attr("data-merchant") ||
        $candidate.attr("data-rating") ||
        $candidate.attr("data-shipping"),
    );
    if (text) return text;
  }
  return "";
};

const isGoogleHost = (hostname) =>
  /(^|\.)google\.(?:com|co\.[a-z]{2}|[a-z]{2}|com\.[a-z]{2})$/i.test(hostname);

const normalizeHttpUrl = (raw, baseUrl) => {
  if (!raw) return "";
  try {
    let url = new URL(raw, baseUrl);
    if (!/^https?:$/.test(url.protocol)) return "";
    if (isGoogleHost(url.hostname) && url.pathname === "/url") {
      const destination = url.searchParams.get("q") || url.searchParams.get("url");
      if (!destination) return "";
      url = new URL(destination);
      if (!/^https?:$/.test(url.protocol)) return "";
    }
    if (AD_URL_RE.test(url.toString())) return "";
    for (const key of [...url.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (lower.startsWith("utm_") || TRACKING_PARAMS.has(lower)) {
        url.searchParams.delete(key);
      }
    }
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
};

const urlHost = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
};

const canonicalUrl = (raw) => {
  try {
    const url = new URL(raw);
    const params = [...url.searchParams.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    );
    url.search = "";
    for (const [key, value] of params) url.searchParams.append(key, value);
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return String(raw).toLowerCase();
  }
};

const nearbyNodes = ($, element, maxDepth = 3) => {
  const nodes = [];
  let current = $(element);
  for (let depth = 0; depth <= maxDepth && current.length; depth += 1) {
    nodes.push(current);
    current = current.parent();
  }
  return nodes;
};

const isSponsoredCard = ($, element) => {
  for (const $node of nearbyNodes($, element)) {
    const attrs = $node.get(0)?.attribs ?? {};
    for (const [key, value] of Object.entries(attrs)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.startsWith("data-ad") ||
        lowerKey.startsWith("data-pla") ||
        lowerKey === "data-dtld"
      ) {
        return true;
      }
      if (
        (lowerKey === "class" && AD_CLASS_RE.test(String(value))) ||
        ((lowerKey === "aria-label" || lowerKey === "title") &&
          SPONSORED_RE.test(cleanText(value)))
      ) {
        return true;
      }
    }
  }

  const $card = $(element);
  if (
    $card.is("[data-dtld], .sh-np__seller-container, .sh-np__click-target") ||
    $card.find("[data-dtld], .sh-np__seller-container, .sh-np__click-target, .sh-np__seller").length
  ) {
    return true;
  }
  if (
    $card
      .find("a[href]")
      .toArray()
      .some((link) => AD_URL_RE.test($(link).attr("href") || ""))
  ) {
    return true;
  }

  return $card
    .find("span, div, small, label, [aria-label]")
    .toArray()
    .some((node) => {
      const $node = $(node);
      const text = cleanText($node.attr("aria-label") || $node.text());
      return text.length <= 40 && SPONSORED_RE.test(text);
    });
};

const titleFrom = ($card) => {
  for (const selector of TITLE_SELECTORS) {
    const $candidate = $card.find(selector).first();
    const text = cleanText($candidate.attr("aria-label") || $candidate.text());
    if (text && !PRICE_RE.test(text) && !SPONSORED_RE.test(text)) return text;
  }
  return "";
};

const priceFrom = ($card) => {
  const selected = firstText($card, PRICE_SELECTORS);
  const cardText = cleanText($card.text());
  return cleanText(
    selected.match(PRICE_RE)?.[0] || cardText.match(PRICE_RE)?.[0] || "",
  );
};

const productUrlFrom = ($, $card, baseUrl) => {
  const choices = [];
  const links = $card.find("a[href], [data-lpage]").toArray();
  if ($card.attr("href") || $card.attr("data-lpage")) links.unshift($card.get(0));
  for (const link of links) {
    const $link = $(link);
    const url = normalizeHttpUrl(
      $link.attr("data-lpage") || $link.attr("href") || "",
      baseUrl,
    );
    if (!url) continue;
    let score = 0;
    const host = urlHost(url);
    if (!isGoogleHost(host)) score += 8;
    if ($link.find("h3, [role='heading']").length) score += 4;
    if ($link.attr("aria-label")) score += 1;
    if (/\/shopping\/product\//i.test(url)) score += 2;
    choices.push({ url, score });
  }
  choices.sort((a, b) => b.score - a.score);
  return choices[0]?.url || "";
};

const imageFrom = ($, $card, baseUrl) => {
  for (const selector of IMAGE_SELECTORS) {
    for (const img of $card.find(selector).toArray()) {
      const $img = $(img);
      const srcset =
        $img.attr("srcset")?.split(",")[0]?.trim().split(/\s+/)[0] || "";
      for (const raw of [$img.attr("data-src"), srcset, $img.attr("src")]) {
        const url = normalizeHttpUrl(raw, baseUrl);
        if (!url) continue;
        const width = Number($img.attr("width") || 0);
        const height = Number($img.attr("height") || 0);
        if ((width && width < 40) || (height && height < 40)) continue;
        if (/(?:favicon|logo|rating|stars?|1x1|pixel)/i.test(url)) continue;
        return url;
      }
    }
  }
  return "";
};

const ratingFrom = ($card) => {
  let selected = "";
  for (const selector of RATING_SELECTORS) {
    const $candidate = $card.find(selector).first();
    selected = cleanText(
      $candidate.attr("aria-label") ||
        $candidate.attr("data-rating") ||
        $candidate.text(),
    );
    if (selected) break;
  }
  const text = selected || cleanText($card.text());
  const match =
    text.match(RATING_RE) ||
    text.match(JAPANESE_RATING_RE) ||
    (selected ? selected.match(/^([0-5](?:[.,]\d)?)$/) : null);
  if (!match) return { rating: null, reviewCount: "" };
  const rating = Number(match[1].replace(",", "."));
  const offset = (match.index ?? 0) + match[0].length;
  const reviewCount = cleanText(
    text.slice(offset, offset + 50).match(REVIEW_RE)?.[1] || "",
  );
  return { rating: Number.isFinite(rating) ? rating : null, reviewCount };
};

const shippingFrom = ($card) => {
  const selected = firstText($card, SHIPPING_SELECTORS);
  if (selected) return selected;
  const text = cleanText($card.text());
  return cleanText(
    text.match(
      /(?:free (?:shipping|delivery)|delivery by [^·|]{3,40}|ships? (?:by|in) [^·|]{3,40}|pickup available)/i,
    )?.[0] || "",
  );
};

const normalizeBlocklist = (input) =>
  (Array.isArray(input) ? input : String(input ?? "").split(/[\n,]+/))
    .map((item) => cleanText(item).toLowerCase().replace(/^www\./, ""))
    .filter(Boolean);

const isBlocked = (result, blocklist) => {
  if (!blocklist.length) return false;
  const merchant = result.merchant.toLowerCase();
  const host = urlHost(result.url).toLowerCase();
  return blocklist.some(
    (entry) =>
      merchant.includes(entry) || host === entry || host.endsWith(`.${entry}`),
  );
};

const collectCandidates = ($) => {
  const candidates = [];
  const seen = new Set();
  const add = (element) => {
    if (!element || seen.has(element)) return;
    const text = cleanText($(element).text());
    if (!text || text.length > 6000) return;
    seen.add(element);
    candidates.push(element);
  };

  for (const selector of CARD_SELECTORS) {
    $(selector).each((_, element) => add(element));
  }

  $("a[href*='/shopping/product/'], a[href*='shopping/product']").each(
    (_, link) => {
      let current = $(link);
      for (let depth = 0; depth < 5 && current.length; depth += 1) {
        const text = cleanText(current.text());
        if (
          PRICE_RE.test(text) &&
          current.find("h3, [role='heading']").length
        ) {
          add(current.get(0));
          break;
        }
        current = current.parent();
      }
    },
  );

  $("[data-id='mosaic'] [data-lpage]").each((_, destination) => {
    let current = $(destination);
    for (let depth = 0; depth < 5 && current.length; depth += 1) {
      const text = cleanText(current.text());
      if (
        PRICE_RE.test(text) &&
        current.find("h3, [role='heading']").length
      ) {
        add(current.get(0));
        break;
      }
      current = current.parent();
    }
  });

  return candidates;
};

export const isGoogleShoppingInterstitial = (html, finalUrl = "") => {
  const sample = `${finalUrl}\n${String(html ?? "").slice(0, 12000)}`.toLowerCase();
  return [
    "/httpservice/retry/enablejs",
    "unusual traffic from your computer network",
    "/sorry/index",
    "g-recaptcha",
    "consent.google.com",
    "before you continue to google",
  ].some((signature) => sample.includes(signature));
};

export const parseGoogleShoppingHtml = (
  html,
  {
    baseUrl = "https://www.google.com",
    blockedMerchants = [],
    maxPerMerchant = 4,
    minimumRating = 0,
  } = {},
) => {
  const $ = cheerio.load(String(html ?? ""));
  const candidateElements = collectCandidates($);
  const blocklist = normalizeBlocklist(blockedMerchants);
  const seen = new Set();
  const merchantCounts = new Map();
  const results = [];
  let recognizedCount = 0;

  for (const element of candidateElements) {
    const $card = $(element);
    if (isSponsoredCard($, element)) continue;

    const title = titleFrom($card);
    const price = priceFrom($card);
    const url = productUrlFrom($, $card, baseUrl);
    let merchant = firstText($card, MERCHANT_SELECTORS);
    if (!merchant && url && !isGoogleHost(urlHost(url))) merchant = urlHost(url);

    if (!title || !price || !merchant || !url) continue;
    if (/^(?:view all|related searches|shop by|see more)$/i.test(title)) continue;

    recognizedCount += 1;
    const { rating, reviewCount } = ratingFrom($card);
    if (minimumRating > 0 && (rating === null || rating < minimumRating)) {
      continue;
    }

    const productId = cleanText(
      $card.attr("data-product-id") || $card.attr("data-docid") || "",
    );
    const identityKeys = [
      `url:${canonicalUrl(url)}`,
      `${canonicalUrl(url)}|${title.toLowerCase()}|${price.toLowerCase()}`,
      ...(productId ? [`id:${productId}`] : []),
    ];
    if (identityKeys.some((key) => seen.has(key))) continue;

    const result = {
      title,
      url,
      price,
      merchant,
      rating,
      reviewCount,
      shipping: shippingFrom($card),
      thumbnail: imageFrom($, $card, baseUrl),
      productId,
    };
    if (isBlocked(result, blocklist)) continue;

    const merchantKey = merchant.toLowerCase();
    const merchantCount = merchantCounts.get(merchantKey) || 0;
    if (merchantCount >= Math.max(1, maxPerMerchant)) continue;

    identityKeys.forEach((key) => seen.add(key));
    merchantCounts.set(merchantKey, merchantCount + 1);
    results.push(result);
  }

  const pageText = cleanText($("body").text());
  const explicitNoResults =
    /(?:no shopping results|did not match any products|no products found)/i.test(
      pageText,
    );

  return {
    results,
    candidateCount: candidateElements.length,
    recognizedCount,
    explicitNoResults,
  };
};
