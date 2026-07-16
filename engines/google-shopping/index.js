import {
  isGoogleShoppingInterstitial,
  parseGoogleShoppingHtml,
} from "./parse-html.js";

const FALLBACK_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";
const GOOGLE_HOSTS = new Set([
  "www.google.com",
  "www.google.ca",
  "www.google.co.uk",
  "www.google.com.au",
  "www.google.de",
  "www.google.fr",
  "www.google.it",
  "www.google.es",
  "www.google.nl",
  "www.google.co.jp",
]);
const GOOGLE_HOST_OPTIONS = [...GOOGLE_HOSTS];
const GOOGLE_HOST_LABELS = GOOGLE_HOST_OPTIONS.map((host) =>
  host.replace(/^www\./, ""),
);

export const type = "shopping";
export const outgoingHosts = GOOGLE_HOST_OPTIONS;
export const description =
  "Organic Google Shopping product results with sponsored, malformed, and duplicate cards removed.";

const clampNumber = (value, fallback, min, max) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(max, Math.max(min, parsed))
    : fallback;
};

const normalizeCode = (value, fallback) => {
  const candidate = String(value ?? "").trim().toLowerCase();
  return /^[a-z]{2}$/.test(candidate) ? candidate : fallback;
};

const splitBlocklist = (value) =>
  String(value ?? "")
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const engineError = (context, status, message, opts = {}) => {
  if (typeof context?.engineError === "function") {
    return context.engineError(status, message, {
      engine: "Google Shopping",
      ...opts,
    });
  }
  return Object.assign(new Error(message), { status, ...opts });
};

const buildSnippet = (product) => {
  const rating =
    product.rating === null
      ? ""
      : `${product.rating.toFixed(1)} stars${
          product.reviewCount ? ` (${product.reviewCount})` : ""
        }`;
  return [
    product.price,
    product.merchant,
    rating,
    product.shipping,
  ]
    .filter(Boolean)
    .join(" · ");
};

export default class GoogleShoppingEngine {
  isClientExposed = false;
  name = "Google Shopping";
  bangShortcut = "gshop";

  googleHost = "www.google.com";
  region = "us";
  language = "en";
  blockedMerchants = [];
  maxPerMerchant = 4;
  minimumRating = 0;
  requestTimeoutMs = 30_000;

  settingsSchema = [
    {
      key: "outgoingTransport",
      label: "Outgoing HTTP client transport",
      type: "select",
      options: ["curl-impersonate", "fetch", "curl", "curl-fallback"],
      default: "curl-impersonate",
      description:
        "Curl Impersonate is the safest built-in default for Google's TLS and JavaScript challenges. Browser-backed transports can be selected when installed.",
      advanced: true,
    },
    {
      key: "googleHost",
      label: "Google Shopping region site",
      type: "select",
      options: GOOGLE_HOST_OPTIONS,
      optionLabels: GOOGLE_HOST_LABELS,
      default: "www.google.com",
      description: "Choose the Google domain used for Shopping results.",
    },
    {
      key: "region",
      label: "Result region",
      type: "text",
      default: "us",
      placeholder: "us",
      description: "Two-letter country code sent to Google (for example `us`, `ca`, or `gb`).",
    },
    {
      key: "language",
      label: "Result language",
      type: "text",
      default: "en",
      placeholder: "en",
      description: "Two-letter language code sent to Google (for example `en`, `fr`, or `de`).",
    },
    {
      key: "blockedMerchants",
      label: "Blocked merchants or domains",
      type: "textarea",
      default: "",
      placeholder: "example.com\nMarketplace name",
      description: "One merchant name or domain per line. Matching products are removed.",
    },
    {
      key: "maxPerMerchant",
      label: "Maximum results per merchant",
      type: "number",
      default: "4",
      description: "Limits repeated listings from one seller. Choose a value from 1 to 20.",
    },
    {
      key: "minimumRating",
      label: "Minimum product rating",
      type: "select",
      options: ["0", "3", "4", "4.5"],
      optionLabels: ["Any rating", "3.0+", "4.0+", "4.5+"],
      default: "0",
      description: "Products without a rating are hidden when a minimum is selected.",
    },
  ];

  configure(settings = {}) {
    if (GOOGLE_HOSTS.has(settings.googleHost)) this.googleHost = settings.googleHost;
    this.region = normalizeCode(settings.region, "us");
    this.language = normalizeCode(settings.language, "en");
    this.blockedMerchants = splitBlocklist(settings.blockedMerchants);
    this.maxPerMerchant = Math.round(
      clampNumber(settings.maxPerMerchant, 4, 1, 20),
    );
    this.minimumRating = clampNumber(settings.minimumRating, 0, 0, 5);
    this.requestTimeoutMs = Math.round(
      clampNumber(settings.timeoutMs, 30_000, 1_000, 120_000),
    );
  }

  buildSearchUrl(query, page = 1) {
    const params = new URLSearchParams({
      q: query,
      udm: "28",
      hl: this.language,
      gl: this.region,
      start: String((Math.max(1, page) - 1) * 24),
      num: "24",
      filter: "0",
    });
    return `https://${this.googleHost}/search?${params.toString()}`;
  }

  async executeSearch(query, page = 1, _timeFilter, context) {
    const normalizedQuery = String(query ?? "").trim();
    if (!normalizedQuery) return [];
    if (typeof context?.fetch !== "function") {
      throw engineError(
        context,
        "blocked",
        "Google Shopping requires degoog's configured engine transport.",
      );
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.requestTimeoutMs);
    timer.unref?.();

    try {
      const url = this.buildSearchUrl(normalizedQuery, page);
      const response = await context.fetch(url, {
        headers: {
          "User-Agent": context.userAgent?.() || FALLBACK_UA,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language":
            `${this.language}-${this.region.toUpperCase()},${this.language};q=0.9`,
          Cookie: "CONSENT=YES+",
        },
        redirect: "follow",
        signal: controller.signal,
      });

      context.sentinel?.(response, this.name);
      if (!response.ok) {
        throw engineError(
          context,
          "network",
          `Google Shopping returned HTTP ${response.status}.`,
          { httpStatus: response.status },
        );
      }

      const html = await response.text();
      if (isGoogleShoppingInterstitial(html, response.url || "")) {
        throw engineError(
          context,
          "interstitial",
          "Google returned a consent, JavaScript, or anti-bot page. Select a browser-backed transport in this engine's Advanced settings.",
          { httpStatus: response.status },
        );
      }

      const parsed = parseGoogleShoppingHtml(html, {
        baseUrl: `https://${this.googleHost}`,
        blockedMerchants: this.blockedMerchants,
        maxPerMerchant: this.maxPerMerchant,
        minimumRating: this.minimumRating,
      });

      if (
        parsed.results.length === 0 &&
        parsed.recognizedCount === 0 &&
        !parsed.explicitNoResults
      ) {
        throw engineError(
          context,
          "parse_error",
          "Google Shopping returned a page without recognizable product cards. Try a browser-backed transport or update the extension.",
        );
      }

      return parsed.results.map((product) => ({
        title: product.title,
        url: product.url,
        snippet: buildSnippet(product),
        source: this.name,
        ...(product.thumbnail ? { thumbnail: product.thumbnail } : {}),
      }));
    } catch (error) {
      if (timedOut || error?.name === "AbortError") {
        throw engineError(
          context,
          "timeout",
          `Google Shopping did not respond within ${this.requestTimeoutMs}ms.`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
