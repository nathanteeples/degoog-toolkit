let templateHtml = "";
let pluginFetch = null;
let quoteCache = null;

const PLUGIN_NAME = "Stocks";
const CACHE_TTL_MS = 60 * 1000;
const YAHOO_SEARCH_URL = "https://query1.finance.yahoo.com/v1/finance/search";
const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const STOOQ_QUOTE_URL = "https://stooq.com/q/l/";

const REQUEST_HEADERS = {
  Accept: "application/json,text/csv,text/plain;q=0.9,*/*;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (compatible; degoog-stocks/1.0; +https://github.com/SoPat712)",
};

const BANG_PREFIX_RX = /^!(stock|stocks|quote|ticker)\b\s*/i;
const CASH_TAG_RX = /(?:^|\s)\$([A-Za-z][A-Za-z0-9.-]{0,11})(?=$|\s|[?!.,;:])/;
const STOCK_WORD_RX = /\b(stock|stocks|share|shares|equity|equities|quote|ticker)\b/i;
const PRICE_WORD_RX = /\b(price|prices)\b/i;
const MARKET_SHARE_RX = /\bmarket\s+shares?\b/i;

const ACCEPTED_QUOTE_TYPES = new Set([
  "EQUITY",
  "ETF",
  "MUTUALFUND",
  "ECNQUOTE",
]);
const REJECTED_QUOTE_TYPES = new Set([
  "CRYPTOCURRENCY",
  "CURRENCY",
  "FUTURE",
  "INDEX",
  "OPTION",
]);

const NON_STOCK_TARGETS = new Set([
  "bitcoin",
  "btc",
  "ethereum",
  "eth",
  "crypto",
  "cryptocurrency",
  "dogecoin",
  "litecoin",
  "solana",
  "cardano",
  "xrp",
  "forex",
]);

const BAD_COMPANY_TARGETS = new Set([
  "market",
  "market today",
  "news",
  "today",
  "forecast",
  "photo",
  "photos",
  "image",
  "images",
  "video",
  "videos",
  "footage",
  "recipe",
  "recipes",
  "soup",
  "broth",
  "chicken",
  "vegetable",
]);

const NON_FINANCE_CONTEXT_WORDS = new Set([
  "photo",
  "photos",
  "image",
  "images",
  "video",
  "videos",
  "footage",
  "recipe",
  "recipes",
  "soup",
  "broth",
  "chicken",
  "vegetable",
]);

const AMBIGUOUS_SYMBOLS = new Set([
  "A",
  "I",
  "AI",
  "ALL",
  "ARE",
  "AS",
  "AT",
  "BE",
  "BY",
  "CAN",
  "FOR",
  "HAS",
  "IN",
  "IT",
  "LOW",
  "NOW",
  "ON",
  "OPEN",
  "OR",
  "SAVE",
  "SO",
  "TO",
  "TRY",
  "USA",
  "USD",
]);

const COMPANY_ALIASES = new Map([
  ["adobe", "ADBE"],
  ["alphabet", "GOOGL"],
  ["amazon", "AMZN"],
  ["amd", "AMD"],
  ["apple", "AAPL"],
  ["berkshire", "BRK-B"],
  ["berkshire hathaway", "BRK-B"],
  ["boeing", "BA"],
  ["costco", "COST"],
  ["disney", "DIS"],
  ["facebook", "META"],
  ["ford", "F"],
  ["google", "GOOGL"],
  ["home depot", "HD"],
  ["intel", "INTC"],
  ["johnson and johnson", "JNJ"],
  ["jpmorgan", "JPM"],
  ["mastercard", "MA"],
  ["meta", "META"],
  ["microsoft", "MSFT"],
  ["netflix", "NFLX"],
  ["nvidia", "NVDA"],
  ["oracle", "ORCL"],
  ["paypal", "PYPL"],
  ["pepsi", "PEP"],
  ["salesforce", "CRM"],
  ["tesla", "TSLA"],
  ["visa", "V"],
  ["walmart", "WMT"],
]);

const STOOQ_SUFFIX_META = {
  US: { currency: "USD", exchange: "US" },
  UK: { currency: "GBP", exchange: "LSE" },
  JP: { currency: "JPY", exchange: "TSE" },
  HK: { currency: "HKD", exchange: "HKEX" },
  PL: { currency: "PLN", exchange: "WSE" },
  DE: { currency: "EUR", exchange: "Germany" },
  FR: { currency: "EUR", exchange: "France" },
  CA: { currency: "CAD", exchange: "Canada" },
  AU: { currency: "AUD", exchange: "Australia" },
};

const EXCHANGE_LABELS = {
  NMS: "NasdaqGS",
  NGM: "NasdaqGM",
  NCM: "NasdaqCM",
  NAS: "Nasdaq",
  NYQ: "NYSE",
  ASE: "NYSE American",
  PCX: "NYSE Arca",
  PNK: "OTC",
};

export const slot = {
  id: "stocks",
  name: PLUGIN_NAME,
  description:
    "Shows no-key stock quotes for explicit ticker and company-share queries using server-side Yahoo Finance data with Stooq fallback.",
  isClientExposed: false,
  position: "at-a-glance",
  slotPositions: ["at-a-glance", "above-results", "knowledge-panel"],

  async init(ctx) {
    templateHtml = ctx?.template || "";
    if (!templateHtml && typeof ctx?.readFile === "function") {
      templateHtml = await ctx.readFile("template.html");
    }
    if (typeof ctx?.fetch === "function") {
      pluginFetch = (...args) => ctx.fetch(...args);
    }
    if (typeof ctx?.createCache === "function") {
      quoteCache = ctx.createCache(CACHE_TTL_MS);
    }
  },

  trigger(query) {
    return parseStockQuery(query) !== null;
  },

  async execute(query, context) {
    if (context?.tab && context.tab !== "all") return { html: "" };

    const request = parseStockQuery(query);
    if (!request) return { html: "" };

    const doFetch =
      typeof context?.fetch === "function"
        ? (...args) => context.fetch(...args)
        : pluginFetch;
    if (!doFetch) return { html: "" };

    try {
      const quote = await getCachedQuote(request, doFetch);
      if (!quote) return { html: "" };

      return {
        title: "",
        html: renderQuote(quote),
      };
    } catch {
      return { html: "" };
    }
  },
};

export default slot;

async function getCachedQuote(request, doFetch) {
  const key = `stocks:${request.kind}:${request.symbol || request.target}`;
  const cached = quoteCache?.get?.(key);
  if (cached) return cached;

  const quote = await resolveQuote(request, doFetch);
  if (quote) quoteCache?.set?.(key, quote, CACHE_TTL_MS);
  return quote;
}

async function resolveQuote(request, doFetch) {
  let symbol = request.symbol || "";
  let searchQuote = null;
  let resolvedByAlias = false;

  if (request.kind === "company") {
    searchQuote = await findYahooQuote(request.target, doFetch);
    if (searchQuote?.symbol) {
      symbol = searchQuote.symbol;
    } else {
      symbol = COMPANY_ALIASES.get(normalizeWords(request.target)) || "";
      resolvedByAlias = Boolean(symbol);
    }
  } else {
    searchQuote = await findExactYahooQuote(symbol, doFetch);
  }

  if (!symbol) return null;

  const yahooQuote = await fetchYahooChart(symbol, searchQuote, doFetch);
  if (yahooQuote) return yahooQuote;

  if (request.kind === "symbol" || resolvedByAlias || searchQuote?.symbol) {
    return fetchStooqQuote(symbol, searchQuote, doFetch);
  }

  return null;
}

function parseStockQuery(value) {
  const raw = String(value || "").trim();
  if (raw.length < 2 || raw.length > 160) return null;
  if (/^https?:\/\//i.test(raw) || MARKET_SHARE_RX.test(raw)) return null;

  const cashtag = raw.match(CASH_TAG_RX);
  if (cashtag) {
    const symbol = normalizeSymbol(cashtag[1], { allowAmbiguous: true });
    return symbol ? { kind: "symbol", symbol, explicit: true } : null;
  }

  const bangMatch = raw.match(BANG_PREFIX_RX);
  if (bangMatch) {
    const target = cleanupTarget(raw.replace(BANG_PREFIX_RX, ""));
    if (!target) return null;
    const symbol = symbolFromSingleToken(target, { allowLowercase: true });
    if (symbol) return { kind: "symbol", symbol, explicit: true };
    if (isRejectedCompanyTarget(target)) return null;
    return { kind: "company", target, explicit: false };
  }

  const hasStockWord = STOCK_WORD_RX.test(raw);
  const hasPriceWord = PRICE_WORD_RX.test(raw);
  if (!hasStockWord && !hasPriceWord) return null;

  const explicitSymbol = extractExplicitSymbol(raw, hasPriceWord);
  if (explicitSymbol) {
    return { kind: "symbol", symbol: explicitSymbol, explicit: true };
  }

  if (!hasStockWord) return null;

  const target = cleanupTarget(raw);
  if (!target || isRejectedCompanyTarget(target)) return null;

  const upperTarget = symbolFromSingleToken(target, { allowLowercase: false });
  if (upperTarget) {
    return { kind: "symbol", symbol: upperTarget, explicit: true };
  }

  return { kind: "company", target, explicit: false };
}

function extractExplicitSymbol(raw, allowPriceOnly) {
  const prefixPattern = allowPriceOnly
    ? /\b(?:stock|stocks|quote|ticker|share|shares|price|prices)\b\s+(?:for\s+)?([A-Z][A-Z0-9.-]{0,11})\b/
    : /\b(?:stock|stocks|quote|ticker|share|shares)\b\s+(?:for\s+)?([A-Z][A-Z0-9.-]{0,11})\b/;
  const suffixPattern = allowPriceOnly
    ? /\b([A-Z][A-Z0-9.-]{0,11})\b\s+(?:stock|stocks|quote|ticker|share|shares|price|prices)\b/
    : /\b([A-Z][A-Z0-9.-]{0,11})\b\s+(?:stock|stocks|quote|ticker|share|shares)\b/;

  const prefix = raw.match(prefixPattern);
  if (prefix) {
    const symbol = normalizeSymbol(prefix[1], { allowAmbiguous: false });
    if (symbol) return symbol;
  }

  const suffix = raw.match(suffixPattern);
  if (suffix) {
    const symbol = normalizeSymbol(suffix[1], { allowAmbiguous: false });
    if (symbol) return symbol;
  }

  return "";
}

function symbolFromSingleToken(value, options = {}) {
  const cleaned = String(value || "")
    .trim()
    .replace(/^\$/, "")
    .replace(/[?!.,;:]+$/g, "");
  if (!/^[A-Za-z][A-Za-z0-9.-]{0,11}$/.test(cleaned)) return "";
  if (!options.allowLowercase && cleaned !== cleaned.toUpperCase()) return "";
  return normalizeSymbol(cleaned, options);
}

function normalizeSymbol(value, options = {}) {
  const symbol = String(value || "")
    .trim()
    .replace(/^\$/, "")
    .replace(/\s+/g, "")
    .toUpperCase();

  if (!/^[A-Z][A-Z0-9.-]{0,11}$/.test(symbol)) return "";
  if (!options.allowAmbiguous && AMBIGUOUS_SYMBOLS.has(symbol)) return "";
  return symbol;
}

function cleanupTarget(raw) {
  return String(raw || "")
    .replace(BANG_PREFIX_RX, "")
    .replace(CASH_TAG_RX, " ")
    .replace(
      /\b(what(?:'s|s| is)?|show|show me|get|latest|current|today|now|the|a|an|of|for|on|about|please)\b/gi,
      " ",
    )
    .replace(
      /\b(stock|stocks|share|shares|equity|equities|quote|ticker|price|prices|company)\b/gi,
      " ",
    )
    .replace(/[?!,;:(){}\[\]"“”]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRejectedCompanyTarget(target) {
  const normalized = normalizeWords(target);
  if (!normalized || normalized.length < 2) return true;
  if (NON_STOCK_TARGETS.has(normalized) || BAD_COMPANY_TARGETS.has(normalized)) {
    return true;
  }
  const words = normalized.split(" ");
  if (words.some((word) => NON_FINANCE_CONTEXT_WORDS.has(word))) return true;
  if (words.every((word) => BAD_COMPANY_TARGETS.has(word))) return true;
  if (words.some((word) => NON_STOCK_TARGETS.has(word))) return true;
  return false;
}

async function findExactYahooQuote(symbol, doFetch) {
  const quotes = await fetchYahooSearch(symbol, doFetch);
  if (!quotes?.length) return null;

  const normalized = symbol.toUpperCase();
  return (
    quotes.find(
      (quote) =>
        String(quote.symbol || "").toUpperCase() === normalized &&
        isAcceptedYahooQuote(quote),
    ) || null
  );
}

async function findYahooQuote(target, doFetch) {
  const quotes = await fetchYahooSearch(target, doFetch);
  if (!quotes?.length) return null;

  const normalizedTarget = normalizeWords(target);
  const candidates = quotes
    .filter(isAcceptedYahooQuote)
    .map((quote) => ({ quote, score: scoreYahooQuote(quote, normalizedTarget) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.quote || null;
}

async function fetchYahooSearch(query, doFetch) {
  try {
    const params = new URLSearchParams({
      q: query,
      quotes_count: "8",
      news_count: "0",
      lists_count: "0",
      enableFuzzyQuery: "false",
    });
    const response = await doFetch(`${YAHOO_SEARCH_URL}?${params}`, {
      headers: REQUEST_HEADERS,
    });
    if (!response?.ok) return null;
    const data = await response.json();
    return Array.isArray(data?.quotes) ? data.quotes : null;
  } catch {
    return null;
  }
}

function isAcceptedYahooQuote(quote) {
  const type = String(quote?.quoteType || quote?.typeDisp || "").toUpperCase();
  const symbol = String(quote?.symbol || "");
  if (!symbol || symbol.includes("=") || symbol.startsWith("^")) return false;
  if (/-(USD|USDT|EUR|GBP|JPY|BTC|ETH)$/i.test(symbol)) return false;
  if (REJECTED_QUOTE_TYPES.has(type)) return false;
  if (type && !ACCEPTED_QUOTE_TYPES.has(type)) return false;
  return true;
}

function scoreYahooQuote(quote, normalizedTarget) {
  const symbol = normalizeWords(quote.symbol || "");
  const shortName = normalizeCompanyName(quote.shortname || "");
  const longName = normalizeCompanyName(quote.longname || "");
  const exchange = String(quote.exchange || "").toUpperCase();
  let score = 0;

  if (symbol === normalizedTarget) score += 100;
  if (shortName === normalizedTarget || longName === normalizedTarget) score += 90;
  if (shortName.startsWith(normalizedTarget + " ")) score += 70;
  if (longName.startsWith(normalizedTarget + " ")) score += 70;
  if (containsAllWords(shortName, normalizedTarget)) score += 45;
  if (containsAllWords(longName, normalizedTarget)) score += 45;
  if (["NMS", "NGM", "NCM", "NYQ", "ASE", "PCX"].includes(exchange)) {
    score += 10;
  }

  return score;
}

async function fetchYahooChart(symbol, searchQuote, doFetch) {
  try {
    const params = new URLSearchParams({
      interval: "5m",
      range: "1d",
      includePrePost: "false",
    });
    const response = await doFetch(
      `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?${params}`,
      { headers: REQUEST_HEADERS },
    );
    if (!response?.ok) return null;
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta || {};
    if (!result || !isAcceptedYahooInstrument(meta, searchQuote)) return null;

    const price = firstFinite(
      meta.regularMarketPrice,
      meta.previousClose,
      lastFinite(result.indicators?.quote?.[0]?.close),
    );
    if (!Number.isFinite(price)) return null;

    const previousClose = firstFinite(
      meta.chartPreviousClose,
      meta.previousClose,
      searchQuote?.regularMarketPreviousClose,
    );
    const change = Number.isFinite(previousClose) ? price - previousClose : null;
    const changePercent =
      Number.isFinite(change) && previousClose
        ? (change / previousClose) * 100
        : null;
    const chartPoints = extractYahooChartPoints(result);
    const exchange =
      meta.fullExchangeName ||
      searchQuote?.exchDisp ||
      EXCHANGE_LABELS[meta.exchangeName] ||
      meta.exchangeName ||
      searchQuote?.exchange ||
      "";

    return {
      symbol: String(meta.symbol || searchQuote?.symbol || symbol).toUpperCase(),
      name:
        searchQuote?.longname ||
        searchQuote?.shortname ||
        meta.longName ||
        meta.shortName ||
        symbol,
      price,
      priceHint: Number.isFinite(meta.priceHint) ? meta.priceHint : null,
      currency: meta.currency || searchQuote?.currency || "",
      change,
      changePercent,
      previousClose,
      open: firstFinite(meta.regularMarketOpen),
      high: firstFinite(meta.regularMarketDayHigh),
      low: firstFinite(meta.regularMarketDayLow),
      volume: firstFinite(meta.regularMarketVolume),
      exchange,
      marketState: formatMarketState(searchQuote?.marketState),
      asOf: formatYahooTime(meta.regularMarketTime),
      sourceLabel: "Yahoo Finance",
      sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
      chartPoints,
      chartLabel: chartPoints.length > 2 ? "1D" : "",
    };
  } catch {
    return null;
  }
}

function isAcceptedYahooInstrument(meta, searchQuote) {
  const metaType = String(meta?.instrumentType || "").toUpperCase();
  const quoteType = String(searchQuote?.quoteType || "").toUpperCase();
  if (REJECTED_QUOTE_TYPES.has(metaType) || REJECTED_QUOTE_TYPES.has(quoteType)) {
    return false;
  }
  if (quoteType && !ACCEPTED_QUOTE_TYPES.has(quoteType)) return false;
  return true;
}

function extractYahooChartPoints(result) {
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const close = result?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(close)) return [];

  return close
    .map((price, index) => ({
      price: Number(price),
      time: Number(timestamps[index] || 0),
    }))
    .filter((point) => Number.isFinite(point.price));
}

async function fetchStooqQuote(symbol, searchQuote, doFetch) {
  const candidates = stooqSymbolCandidates(symbol);
  for (const candidate of candidates) {
    const quote = await fetchStooqCandidate(candidate, symbol, searchQuote, doFetch);
    if (quote) return quote;
  }
  return null;
}

async function fetchStooqCandidate(stooqSymbol, displaySymbol, searchQuote, doFetch) {
  try {
    const params = new URLSearchParams({
      s: stooqSymbol.toLowerCase(),
      f: "sd2t2ohlcvnp",
      h: "",
      e: "csv",
    });
    const response = await doFetch(`${STOOQ_QUOTE_URL}?${params}`, {
      headers: REQUEST_HEADERS,
    });
    if (!response?.ok) return null;
    const text = await response.text();
    const rows = parseCsv(text);
    const row = rows[0];
    if (!row || !row.Symbol || row.Close === "N/D") return null;

    const price = toNumber(row.Close);
    const previousClose = toNumber(row.Prev);
    if (!Number.isFinite(price)) return null;

    const change = Number.isFinite(previousClose) ? price - previousClose : null;
    const changePercent =
      Number.isFinite(change) && previousClose
        ? (change / previousClose) * 100
        : null;
    const suffix = String(row.Symbol || "").split(".").pop().toUpperCase();
    const suffixMeta = STOOQ_SUFFIX_META[suffix] || {};
    const chartPoints = [
      toNumber(row.Open),
      toNumber(row.Low),
      toNumber(row.High),
      price,
    ].filter(Number.isFinite);

    return {
      symbol: displaySymbolForStooq(row.Symbol, displaySymbol),
      name:
        searchQuote?.longname ||
        searchQuote?.shortname ||
        formatCompanyDisplayName(row.Name) ||
        displaySymbol,
      price,
      priceHint: null,
      currency: suffixMeta.currency || "",
      change,
      changePercent,
      previousClose,
      open: toNumber(row.Open),
      high: toNumber(row.High),
      low: toNumber(row.Low),
      volume: toNumber(row.Volume),
      exchange: suffixMeta.exchange || suffix || "",
      marketState: "Delayed quote",
      asOf: formatStooqTime(row.Date, row.Time),
      sourceLabel: "Stooq",
      sourceUrl: `https://stooq.com/q/?s=${encodeURIComponent(row.Symbol)}`,
      chartPoints: chartPoints.map((point) => ({ price: point })),
      chartLabel: chartPoints.length > 2 ? "Range" : "",
    };
  } catch {
    return null;
  }
}

function stooqSymbolCandidates(symbol) {
  const base = String(symbol || "").trim().toUpperCase();
  if (!base) return [];

  const normalizedClass = base.replace("-", ".");
  const candidates = new Set();
  candidates.add(normalizedClass);

  if (!base.includes(".") && !base.includes("-")) {
    candidates.add(`${base}.US`);
  } else if (/^[A-Z]+-[A-Z]$/.test(base)) {
    candidates.add(`${normalizedClass}.US`);
  }

  return [...candidates];
}

function parseCsv(text) {
  const rows = String(text || "")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map(parseCsvLine);
  if (rows.length < 2) return [];

  const headers = rows[0];
  return rows.slice(1).map((values) => {
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    return row;
  });
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function renderQuote(quote) {
  const trend = quote.change > 0 ? "up" : quote.change < 0 ? "down" : "flat";
  const replacements = {
    trend,
    symbol: escapeHtml(quote.symbol),
    company: escapeHtml(quote.name),
    price: escapeHtml(formatPrice(quote.price, quote.priceHint)),
    currency: escapeHtml(quote.currency || "Quote"),
    change: escapeHtml(formatChange(quote.change, quote.changePercent)),
    exchange: escapeHtml(quote.exchange || "Exchange unavailable"),
    market_state: escapeHtml(quote.marketState || "Market state unavailable"),
    as_of: escapeHtml(quote.asOf || "Time unavailable"),
    previous_close: escapeHtml(formatMaybePrice(quote.previousClose, quote.priceHint)),
    day_range: escapeHtml(formatDayRange(quote.low, quote.high, quote.priceHint)),
    volume: escapeHtml(formatVolume(quote.volume)),
    source_label: escapeHtml(quote.sourceLabel),
    source_url: escapeHtml(quote.sourceUrl),
    sparkline: renderSparkline(quote.chartPoints, trend, quote.chartLabel),
  };

  if (!templateHtml) {
    return `<div class="stocks-card"><strong>${replacements.symbol}</strong> ${replacements.price}</div>`;
  }

  let html = templateHtml;
  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }
  return html;
}

function renderSparkline(points, trend, label) {
  const prices = (Array.isArray(points) ? points : [])
    .map((point) => Number(point.price))
    .filter(Number.isFinite);
  if (prices.length < 2) {
    return '<div class="stocks-sparkline-empty">No chart data</div>';
  }

  const width = 260;
  const height = 74;
  const padX = 8;
  const padY = 10;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || Math.max(Math.abs(max), 1) * 0.01;
  const step = prices.length > 1 ? (width - padX * 2) / (prices.length - 1) : 0;
  const coords = prices.map((price, index) => {
    const x = padX + index * step;
    const y = height - padY - ((price - min) / span) * (height - padY * 2);
    return [round(x), round(y)];
  });
  const path = coords
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");
  const area = `${path} L ${coords[coords.length - 1][0]} ${height - padY} L ${coords[0][0]} ${height - padY} Z`;
  const last = coords[coords.length - 1];
  const labelHtml = label
    ? `<text class="stocks-sparkline-label" x="${width - padX}" y="13" text-anchor="end">${escapeHtml(label)}</text>`
    : "";

  return `
    <svg class="stocks-sparkline stocks-sparkline-${trend}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Price sparkline">
      <path class="stocks-sparkline-area" d="${area}"></path>
      <path class="stocks-sparkline-line" d="${path}"></path>
      <circle class="stocks-sparkline-dot" cx="${last[0]}" cy="${last[1]}" r="3"></circle>
      ${labelHtml}
    </svg>
  `;
}

function formatPrice(value, priceHint) {
  if (!Number.isFinite(value)) return "N/A";
  const decimals = Number.isFinite(priceHint)
    ? Math.max(0, Math.min(6, priceHint))
    : value < 1
      ? 4
      : value < 10
        ? 3
        : 2;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatMaybePrice(value, priceHint) {
  return Number.isFinite(value) ? formatPrice(value, priceHint) : "N/A";
}

function formatChange(change, percent) {
  if (!Number.isFinite(change)) return "N/A";
  const sign = change > 0 ? "+" : "";
  const percentPart = Number.isFinite(percent)
    ? ` (${sign}${percent.toFixed(2)}%)`
    : "";
  return `${sign}${formatPrice(change, Math.abs(change) < 1 ? 4 : 2)}${percentPart}`;
}

function formatDayRange(low, high, priceHint) {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return "N/A";
  return `${formatPrice(low, priceHint)} - ${formatPrice(high, priceHint)}`;
}

function formatVolume(value) {
  if (!Number.isFinite(value)) return "N/A";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    value,
  );
}

function formatMarketState(value) {
  const state = String(value || "").toUpperCase();
  if (state === "REGULAR") return "Market open";
  if (state === "PRE") return "Pre-market";
  if (state === "POST") return "After hours";
  if (state === "CLOSED") return "Market closed";
  if (!state) return "";
  return state
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatYahooTime(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value * 1000));
}

function formatStooqTime(date, time) {
  const parts = [date, time].filter(Boolean);
  return parts.length ? parts.join(" ") : "";
}

function displaySymbolForStooq(stooqSymbol, fallback) {
  const symbol = String(stooqSymbol || fallback || "").toUpperCase();
  return symbol.endsWith(".US") ? symbol.slice(0, -3) : symbol;
}

function formatCompanyDisplayName(value) {
  const name = String(value || "").trim();
  if (!name) return "";
  if (name !== name.toUpperCase()) return name;
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      if (word === "inc") return "Inc.";
      if (word === "corp") return "Corp.";
      if (word === "co") return "Co.";
      if (word === "ltd") return "Ltd.";
      if (word === "plc") return "PLC";
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function normalizeCompanyName(value) {
  return normalizeWords(value).replace(
    /\b(incorporated|inc|corporation|corp|company|co|class|ordinary|shares|common|stock|plc|ltd|limited|sa|nv|adr|ads)\b/g,
    "",
  ).replace(/\s+/g, " ").trim();
}

function normalizeWords(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAllWords(haystack, needle) {
  if (!haystack || !needle) return false;
  const haystackWords = new Set(haystack.split(" "));
  return needle.split(" ").every((word) => haystackWords.has(word));
}

function toNumber(value) {
  if (value === null || value === undefined || value === "" || value === "N/D") {
    return null;
  }
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function firstFinite(...values) {
  for (const value of values) {
    const number = toNumber(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function lastFinite(values) {
  if (!Array.isArray(values)) return null;
  for (let i = values.length - 1; i >= 0; i--) {
    const number = toNumber(values[i]);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
