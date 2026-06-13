const TIME_RANGE_MAP = {
  hour: "day",
  day: "day",
  week: "week",
  month: "month",
  year: "year",
};

const DEFAULT_CATEGORIES = "files";
const REQUEST_TIMEOUT_MS = 10000;
const SAFE_SEARCH_VALUES = new Set(["0", "1", "2"]);

function normalizeBaseUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function mapResults(results) {
  const mapped = [];
  for (const result of results) {
    if (!result?.title || !result?.url) continue;
    const thumbnail = result.thumbnail || result.img_src;
    const imageUrl = result.img_src || result.thumbnail;
    const mappedResult = {
      title: result.title,
      url: result.url,
      snippet: result.content ?? "",
      source: `SearXNG:${result.engine ?? "unknown"}`,
    };
    if (thumbnail) mappedResult.thumbnail = thumbnail;
    if (imageUrl) mappedResult.imageUrl = imageUrl;
    if (result.duration) mappedResult.duration = result.duration;
    mapped.push(mappedResult);
  }
  return mapped;
}

export const type = "file";
export const outgoingHosts = ["*"];

class SearXNGFileEngine {
  name = "SearXNG File";
  bangShortcut = "sxf";
  baseUrl = "http://127.0.0.1:8888";

  settingsSchema = [
    {
      key: "baseUrl",
      label: "SearXNG URL",
      type: "text",
      default: "http://127.0.0.1:8888",
      description:
        "Base URL of your SearXNG instance (default: http://127.0.0.1:8888)",
    },
    {
      key: "categories",
      label: "Categories",
      type: "text",
      default: DEFAULT_CATEGORIES,
      description:
        'Comma-separated categories to search (defaults to "files" for this engine).',
    },
    {
      key: "engines",
      label: "Engines",
      type: "text",
      description:
        'Comma-separated engine names to use. Leave empty for all enabled.',
    },
    {
      key: "safesearch",
      label: "Safe Search",
      type: "select",
      options: ["0", "1", "2"],
      default: "0",
      description: "Safe search level: 0=off, 1=moderate, 2=strict",
    },
  ];

  #categories = DEFAULT_CATEGORIES;
  #engines = "";
  #safesearch = "0";

  configure(settings = {}) {
    const baseUrl = normalizeBaseUrl(settings.baseUrl);
    if (baseUrl) this.baseUrl = baseUrl;
    if (typeof settings.categories === "string") {
      this.#categories = settings.categories.trim() || DEFAULT_CATEGORIES;
    }
    if (typeof settings.engines === "string") {
      this.#engines = settings.engines.trim();
    }
    if (SAFE_SEARCH_VALUES.has(settings.safesearch)) {
      this.#safesearch = settings.safesearch;
    }
  }

  async executeSearch(query, page = 1, timeFilter, context) {
    const normalizedQuery = String(query ?? "").trim();
    if (!normalizedQuery) return [];
    const parsedPage = Number.parseInt(page, 10);
    const params = new URLSearchParams({
      q: normalizedQuery,
      format: "json",
      pageno: String(Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1),
      safesearch: this.#safesearch,
    });

    if (this.#categories) params.set("categories", this.#categories);
    if (this.#engines) params.set("engines", this.#engines);
    if (context?.lang) params.set("language", context.lang);

    const timeRange = TIME_RANGE_MAP[timeFilter];
    if (timeRange) params.set("time_range", timeRange);

    const url = `${this.baseUrl}/search?${params}`;
    const doFetch = context?.fetch ?? fetch;
    const controller =
      typeof AbortController === "function" ? new AbortController() : null;
    let timeoutId = null;

    try {
      if (controller) {
        timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      }
      const response = await doFetch(url, {
        headers: { Accept: "application/json" },
        ...(controller ? { signal: controller.signal } : {}),
      });

      if (!response.ok) return [];

      const data = await response.json();
      return Array.isArray(data?.results) ? mapResults(data.results) : [];
    } catch {
      return [];
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId);
    }
  }
}

export default SearXNGFileEngine;
