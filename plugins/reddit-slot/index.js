let template = "";
let maxComments = 2;
let filterNsfw = true;
let minScore = 1;
let restrictSubreddit = "";
let showMode = "keyword";
let pluginFetch = (...args) => fetch(...args);
let redditCache = null;

/** Reddit requires a descriptive User-Agent; bare bot names often get 403. */
const REDDIT_USER_AGENT = "web:degoog-toolkit:v1.0.23 (by /u/SoPat712)";
const FETCH_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 2 * 60 * 1000;
const LOG_PREFIX = "[reddit-slot]";
const REDDIT_JSON_HOSTS = ["https://old.reddit.com", "https://www.reddit.com"];
const REDDIT_RSS_HOSTS = ["https://old.reddit.com", "https://www.reddit.com"];

const QUERY_STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "what", "how", "why", "when", "where", "who", "which", "that", "this",
  "i", "you", "he", "she", "we", "they", "it", "me", "him", "her", "us",
  "them", "my", "your", "his", "its", "our", "their", "and", "or", "but",
  "if", "in", "on", "at", "to", "for", "of", "with", "by", "from", "about",
  "per", "day", "daily", "each", "every", "normal", "much", "many", "some",
]);

function createExtensionCache(ctx, namespace, ttlMs) {
  if (typeof ctx?.useCache === "function") {
    return ctx.useCache(namespace, ttlMs);
  }
  return typeof ctx?.createCache === "function"
    ? ctx.createCache(ttlMs)
    : null;
}

async function cacheGet(cache, key) {
  return cache ? await cache.get(key) : null;
}

async function cacheSet(cache, key, value) {
  if (cache) await cache.set(key, value);
}

function isUtilityQuery(q) {
  return /\b(weather|forecast|погода|метео|temperature|humidity|wind|rain|snow|translate|translation|convert|currency|calculator|calculate|math|stopwatch|timer|countdown|coinflip|coin-flip|yesno|yes-no|tip|tips|gratuity|gratuities|stocks?)\b/i.test(q);
}

export const slot = {
  id: "reddit-slot",
  name: "Reddit",
  description: "Shows the top Reddit post and top comments above search results",
  position: "above-results",
  isClientExposed: false,
  waitForResults: true,

  settingsSchema: [
    {
      key: "showMode",
      label: "When to show",
      type: "select",
      options: ["always", "keyword", "top10"],
      default: "keyword",
      description:
        "Always: shows for every search. Keyword: only when query contains 'reddit'. Top10: only when a Reddit link is in the top 10 search results.",
    },
    {
      key: "maxComments",
      label: "Number of comments",
      type: "select",
      options: ["1", "2", "3", "4"],
      description: "How many top comments to show side by side.",
    },
    {
      key: "filterNsfw",
      label: "Hide 18+ posts",
      type: "toggle",
      description: "Skip posts marked as NSFW.",
    },
    {
      key: "minScore",
      label: "Minimum post score",
      type: "select",
      options: ["1", "10", "100", "500", "1000"],
      description: "Only show posts with at least this many upvotes.",
    },
    {
      key: "restrictSubreddit",
      label: "Search only in subreddit",
      type: "text",
      placeholder: "e.g. AskReddit  (leave empty for all of Reddit)",
      description: "If set, searches only within this subreddit.",
    },
  ],

  async init(ctx) {
    template = ctx?.template || "";
    if (!template && typeof ctx?.readFile === "function") {
      template = await ctx.readFile("template.html");
    }
    if (typeof ctx?.fetch === "function") {
      pluginFetch = (...args) => ctx.fetch(...args);
    }
    redditCache = createExtensionCache(
      ctx,
      "ext:reddit-slot:cards",
      CACHE_TTL_MS,
    );
  },

  configure(settings) {
    showMode = ["always", "keyword", "top10"].includes(settings?.showMode)
      ? settings.showMode
      : "keyword";

    const n = parseInt(settings?.maxComments ?? "2", 10);
    maxComments = Number.isFinite(n) ? Math.max(1, Math.min(4, n)) : 2;

    filterNsfw =
      settings?.filterNsfw !== false && settings?.filterNsfw !== "false";

    const ms = parseInt(settings?.minScore ?? "1", 10);
    minScore = Number.isFinite(ms) ? Math.max(0, ms) : 1;

    restrictSubreddit = (settings?.restrictSubreddit ?? "")
      .trim()
      .replace(/^\/?r\//i, "")
      .replace(/[^a-z0-9_]/gi, "")
      .slice(0, 50);
  },

  trigger(query) {
    const q = query.trim();
    if (q.length < 3 || isUtilityQuery(q)) return false;
    return showMode === "keyword" ? /\breddit\b/i.test(q) : true;
  },

  async execute(query, context) {
    try {
      const results = Array.isArray(context?.results) ? context.results : [];

      if (showMode === "top10") {
        const hasReddit = results.slice(0, 10).some((r) => isRedditUrl(r?.url));
        if (!hasReddit) return { html: "" };
      }

      const cleanQuery = query.replace(/\breddit\b/gi, "").trim();
      const searchQuery = cleanQuery.length > 1 ? cleanQuery : query.trim();
      if (!searchQuery) return { html: "" };

      const doFetch =
        typeof context?.fetch === "function" ? context.fetch : pluginFetch;

      const apiResult = await fetchCardFromRedditApi(
        {
          searchQuery,
          maxComments,
          minScore,
          filterNsfw,
          restrictSubreddit,
        },
        doFetch,
      );

      if (apiResult?.card) {
        return { html: renderCard(apiResult.card) };
      }
      if (apiResult?.error) {
        return { html: renderErrorCard(apiResult.error, searchQuery) };
      }

      return { html: "" };
    } catch (err) {
      logError("Slot execute failed", {
        query,
        error: formatError(err),
      });
      return { html: "" };
    }
  },
};

export default slot;

function isRedditUrl(url) {
  return typeof url === "string" && /reddit\.com/i.test(url);
}

function queryWords(searchQuery) {
  return String(searchQuery || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !QUERY_STOP_WORDS.has(w));
}

function scoreTextMatch(searchQuery, title, body = "") {
  const words = queryWords(searchQuery);
  const titleLower = String(title || "").toLowerCase();
  const combined = `${titleLower} ${String(body || "").toLowerCase()}`;
  let score = 0;
  for (const word of words) {
    if (combined.includes(word)) score += titleLower.includes(word) ? 2 : 1;
  }
  return score;
}

async function redditFetch(doFetch, url, context = {}, accept = "application/json") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await doFetch(url, {
      headers: {
        "User-Agent": REDDIT_USER_AGENT,
        Accept: accept,
      },
      signal: controller.signal,
    });
  } catch (err) {
    const isAbort = err?.name === "AbortError";
    logError(isAbort ? "Reddit request timed out" : "Reddit request failed", {
      ...context,
      url,
      userAgent: REDDIT_USER_AGENT,
      error: formatError(err),
    });
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponseBody(response) {
  if (typeof response?.text === "function") {
    return await response.text();
  }
  if (typeof response?.json === "function") {
    return JSON.stringify(await response.json());
  }
  return "";
}

function isHtmlResponse(body) {
  const trimmed = String(body || "").trimStart();
  const lower = trimmed.toLowerCase();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return false;
  if (
    trimmed.startsWith("<?xml") ||
    lower.startsWith("<feed") ||
    lower.startsWith("<rss")
  ) {
    return false;
  }
  return (
    lower.startsWith("<!doctype html") ||
    lower.startsWith("<html") ||
    lower.startsWith("<body")
  );
}

function decodeXmlEntities(str) {
  return String(str || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(str) {
  return decodeXmlEntities(str)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchXmlTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = block.match(re);
  return match ? decodeXmlEntities(match[1].trim()) : "";
}

function matchLinkHref(block) {
  const match = block.match(/<link[^>]+href="([^"]+)"/i);
  return match ? match[1] : "";
}

function matchAuthorName(block) {
  const authorBlock = block.match(/<author>([\s\S]*?)<\/author>/i)?.[1] || block;
  const name = matchXmlTag(authorBlock, "name");
  return name.replace(/^\/u\//i, "").trim();
}

function extractRssEntries(xml) {
  const entries = [];
  const re = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let match;
  while ((match = re.exec(xml)) !== null) {
    entries.push(match[1]);
  }
  return entries;
}

function parsePostLink(link) {
  try {
    const url = new URL(link);
    const parts = url.pathname.split("/").filter(Boolean);
    const commentsIndex = parts.indexOf("comments");
    if (commentsIndex === -1 || !parts[commentsIndex + 1]) return null;
    return {
      subreddit: parts[commentsIndex - 1] || "",
      postId: parts[commentsIndex + 1],
      permalink: `${url.pathname}${url.search}`,
      postUrl: link.split("?")[0],
    };
  } catch {
    return null;
  }
}

function buildJsonSearchPath(searchQuery, subreddit) {
  const encoded = encodeURIComponent(searchQuery);
  return subreddit
    ? `/r/${encodeURIComponent(subreddit)}/search.json?q=${encoded}&sort=relevance&limit=10&type=link&restrict_sr=1&raw_json=1`
    : `/search.json?q=${encoded}&sort=relevance&limit=10&type=link&raw_json=1`;
}

function buildRssSearchPath(searchQuery, subreddit) {
  const query = encodeURIComponent(searchQuery).replace(/%20/g, "+");
  return subreddit
    ? `/r/${encodeURIComponent(subreddit)}/search.rss?q=${query}&sort=relevance&restrict_sr=1`
    : `/search.rss?q=${query}&sort=relevance`;
}

async function fetchJsonSearch(doFetch, path, context) {
  let lastFailure = null;

  for (const host of REDDIT_JSON_HOSTS) {
    const url = `${host}${path}`;
    let response;
    let body = "";
    try {
      response = await redditFetch(doFetch, url, {
        ...context,
        host,
        transport: "json",
      });
      body = await readResponseBody(response);
    } catch (err) {
      lastFailure = {
        status: 0,
        statusText: formatError(err),
        url,
      };
      continue;
    }

    if (!response.ok || isHtmlResponse(body)) {
      lastFailure = {
        status: response.status || 0,
        statusText: response.statusText || "",
        url,
        bodyPreview: body.slice(0, 240),
      };
      logWarn("Reddit JSON search unavailable", {
        ...lastFailure,
        ...context,
      });
      continue;
    }

    try {
      const data = JSON.parse(body);
      const posts = data?.data?.children;
      if (!Array.isArray(posts)) {
        lastFailure = { status: 502, statusText: "Invalid JSON", url };
        continue;
      }
      return { posts, source: "json", url };
    } catch (err) {
      lastFailure = {
        status: 502,
        statusText: "Invalid JSON",
        url,
        error: formatError(err),
      };
      logWarn("Reddit JSON search returned unparsable body", lastFailure);
    }
  }

  return { error: lastFailure?.status || 0, lastFailure };
}

function parseSearchRss(xml) {
  return extractRssEntries(xml)
    .map((entry) => {
      const link = matchLinkHref(entry);
      const parsed = parsePostLink(link);
      if (!parsed?.postId || !parsed.subreddit) return null;

      const title = matchXmlTag(entry, "title");
      const selftext = stripHtml(
        matchXmlTag(entry, "content") || matchXmlTag(entry, "summary"),
      );
      const categoryLabel = entry.match(/label="r\/([^"]+)"/i)?.[1];

      return {
        data: {
          id: parsed.postId,
          subreddit: parsed.subreddit,
          subreddit_name_prefixed: `r/${categoryLabel || parsed.subreddit}`,
          title,
          permalink: parsed.permalink,
          score: null,
          num_comments: null,
          selftext,
          over_18: false,
          postUrl: parsed.postUrl,
        },
      };
    })
    .filter(Boolean);
}

async function fetchRssSearch(doFetch, searchQuery, subreddit, context) {
  const path = buildRssSearchPath(searchQuery, subreddit);

  for (const host of REDDIT_RSS_HOSTS) {
    const url = `${host}${path}`;
    let response;
    let body = "";
    try {
      response = await redditFetch(
        doFetch,
        url,
        { ...context, host, transport: "rss" },
        "application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      );
      body = await readResponseBody(response);
    } catch {
      continue;
    }

    if (!response.ok || !body.trim() || isHtmlResponse(body)) {
      logWarn("Reddit RSS search unavailable", {
        status: response.status,
        statusText: response.statusText || "",
        url,
        searchQuery,
        restrictSubreddit: subreddit || null,
        bodyPreview: body.slice(0, 240),
      });
      continue;
    }

    const posts = parseSearchRss(body);
    if (posts.length === 0) {
      logWarn("Reddit RSS search returned no entries", {
        url,
        searchQuery,
        restrictSubreddit: subreddit || null,
      });
      continue;
    }

    return { posts, source: "rss", url };
  }

  return null;
}

function mapJsonComments(rawComments, commentLimit) {
  return rawComments
    .filter(
      (c) =>
        c.kind === "t1" &&
        c.data.body &&
        c.data.body !== "[deleted]" &&
        c.data.body !== "[removed]" &&
        !c.data.stickied &&
        c.data.score > 0,
    )
    .sort((a, b) => b.data.score - a.data.score)
    .slice(0, commentLimit)
    .map((c) => ({
      author: c.data.author,
      body:
        c.data.body.length > 180
          ? `${c.data.body.slice(0, 177)}…`
          : c.data.body,
      score: c.data.score,
      url: `https://reddit.com${c.data.permalink}`,
    }));
}

function parseCommentsRss(xml, postUrl, commentLimit) {
  const entries = extractRssEntries(xml);
  const comments = [];

  for (const entry of entries) {
    const link = matchLinkHref(entry);
    if (!link || link.split("?")[0] === postUrl.split("?")[0]) continue;

    const body = stripHtml(
      matchXmlTag(entry, "content") || matchXmlTag(entry, "summary"),
    );
    const author = matchAuthorName(entry);
    if (!body || !author) continue;

    comments.push({
      author,
      body: body.length > 180 ? `${body.slice(0, 177)}…` : body,
      score: null,
      url: link,
    });
    if (comments.length >= commentLimit) break;
  }

  return comments;
}

function formatError(err) {
  if (err instanceof Error) return err.message || err.name;
  return String(err);
}

function logWarn(message, details) {
  if (details === undefined) {
    console.warn(LOG_PREFIX, message);
    return;
  }
  console.warn(LOG_PREFIX, message, details);
}

function logError(message, details) {
  if (details === undefined) {
    console.error(LOG_PREFIX, message);
    return;
  }
  console.error(LOG_PREFIX, message, details);
}

async function fetchCardFromRedditApi(config, doFetch = pluginFetch) {
  const {
    searchQuery,
    maxComments: commentLimit,
    minScore: scoreFloor,
    filterNsfw: hideNsfw,
    restrictSubreddit: subreddit,
  } = config;

  if (!searchQuery) return null;

  const cacheKey = [
    searchQuery.toLowerCase(),
    subreddit.toLowerCase(),
    hideNsfw ? "safe" : "all",
    scoreFloor,
    commentLimit,
  ].join("\u001f");
  const cached = await cacheGet(redditCache, cacheKey);
  if (cached) return cached;

  const searchContext = {
    phase: "search",
    searchQuery,
    restrictSubreddit: subreddit || null,
  };

  const jsonPath = buildJsonSearchPath(searchQuery, subreddit);
  const jsonResult = await fetchJsonSearch(doFetch, jsonPath, searchContext);
  let posts = jsonResult.posts;
  let searchSource = jsonResult.source || "json";

  if (!posts) {
    logWarn("Falling back to Reddit RSS search", searchContext);
    const rssResult = await fetchRssSearch(
      doFetch,
      searchQuery,
      subreddit,
      searchContext,
    );
    if (!rssResult?.posts) {
      if (jsonResult.error) {
        const result = { error: jsonResult.error };
        await cacheSet(redditCache, cacheKey, result);
        return result;
      }
      return null;
    }
    posts = rssResult.posts;
    searchSource = rssResult.source;
  }

  const filtered = posts.filter((p) => {
    if (hideNsfw && p.data.over_18) return false;
    if (
      searchSource !== "rss" &&
      Number.isFinite(p.data.score) &&
      p.data.score < scoreFloor
    ) {
      return false;
    }
    return true;
  });
  if (filtered.length === 0) {
    logWarn("Reddit search posts filtered out by plugin settings", {
      searchQuery,
      restrictSubreddit: subreddit || null,
      minScore: scoreFloor,
      filterNsfw: hideNsfw,
      candidateCount: posts.length,
      searchSource,
    });
    return null;
  }

  const scored = filtered.map((p) => ({
    data: p.data,
    score:
      scoreTextMatch(searchQuery, p.data.title, p.data.selftext) +
      (Number.isFinite(p.data.num_comments)
        ? Math.min(p.data.num_comments / 5000, 0.5)
        : 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  const post = scored[0].data;

  const comments = await fetchComments(
    doFetch,
    post.subreddit,
    post.id,
    commentLimit,
    post.postUrl || `https://reddit.com${post.permalink}`,
  );
  const result = {
    card: {
      subreddit: post.subreddit_name_prefixed,
      postTitle: post.title,
      postUrl: post.postUrl || `https://reddit.com${post.permalink}`,
      postScore: post.score,
      numComments: post.num_comments,
      comments,
    },
  };
  await cacheSet(redditCache, cacheKey, result);
  return result;
}

async function fetchComments(doFetch, subreddit, postId, commentLimit, postUrl) {
  const commentsPath =
    `/r/${encodeURIComponent(subreddit)}/comments/${encodeURIComponent(postId)}.json` +
    `?limit=15&depth=1&sort=top&raw_json=1`;

  for (const host of REDDIT_JSON_HOSTS) {
    const url = `${host}${commentsPath}`;
    let response;
    let body = "";
    try {
      response = await redditFetch(doFetch, url, {
        phase: "comments",
        subreddit,
        postId,
        host,
        transport: "json",
      });
      body = await readResponseBody(response);
    } catch {
      continue;
    }

    if (!response.ok || isHtmlResponse(body)) {
      logWarn("Reddit JSON comments unavailable", {
        status: response.status,
        statusText: response.statusText || "",
        url,
        subreddit,
        postId,
        bodyPreview: body.slice(0, 240),
      });
      continue;
    }

    try {
      const commentsData = JSON.parse(body);
      const rawComments = commentsData?.[1]?.data?.children || [];
      const mapped = mapJsonComments(rawComments, commentLimit);
      if (mapped.length > 0) return mapped;
    } catch (err) {
      logWarn("Reddit JSON comments returned unparsable body", {
        url,
        subreddit,
        postId,
        error: formatError(err),
      });
    }
  }

  const rssPath =
    `/r/${encodeURIComponent(subreddit)}/comments/${encodeURIComponent(postId)}/.rss` +
    `?limit=25&sort=top`;

  for (const host of REDDIT_RSS_HOSTS) {
    const rssUrl = `${host}${rssPath}`;
    let rssResponse;
    let rssBody = "";
    try {
      rssResponse = await redditFetch(
        doFetch,
        rssUrl,
        { phase: "comments", subreddit, postId, host, transport: "rss" },
        "application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      );
      rssBody = await readResponseBody(rssResponse);
    } catch {
      continue;
    }

    if (!rssResponse.ok || !rssBody.trim() || isHtmlResponse(rssBody)) {
      logWarn("Reddit RSS comments unavailable", {
        status: rssResponse.status,
        statusText: rssResponse.statusText || "",
        url: rssUrl,
        subreddit,
        postId,
        bodyPreview: rssBody.slice(0, 240),
      });
      continue;
    }

    const rssComments = parseCommentsRss(rssBody, postUrl, commentLimit);
    if (rssComments.length === 0) {
      logWarn("Reddit RSS comments feed had no comment entries", {
        url: rssUrl,
        subreddit,
        postId,
      });
      continue;
    }
    return rssComments;
  }

  return [];
}

function formatCount(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function renderErrorCard(status, searchQuery) {
  const statusCode =
    Number.isFinite(status) && status > 0 ? String(status) : "Error";
  const queryLabel = escapeHtml(searchQuery);
  const searchHref = `https://www.reddit.com/search/?q=${encodeURIComponent(searchQuery)}`;

  return `<div class="rslot-panel">
  <div class="rslot-header">
    <svg class="rslot-icon" width="28" height="28" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="rgba(255,255,255,0.12)"/>
      <path fill="rgba(255,255,255,0.85)" d="M16.67 10a1.46 1.46 0 0 0-2.47-1 7.12 7.12 0 0 0-3.85-1.23l.65-3.08 2.13.45a1 1 0 1 0 .14-.57l-2.38-.5a.26.26 0 0 0-.31.2l-.73 3.44a7.14 7.14 0 0 0-3.89 1.23 1.46 1.46 0 1 0-1.61 2.39 2.87 2.87 0 0 0 0 .44c0 2.24 2.61 4.06 5.83 4.06s5.83-1.82 5.83-4.06a2.87 2.87 0 0 0 0-.44 1.46 1.46 0 0 0 .57-1.33zM7.27 11a1 1 0 1 1 1 1 1 1 0 0 1-1-1zm5.58 2.65a3.56 3.56 0 0 1-2.85.77 3.56 3.56 0 0 1-2.85-.77.26.26 0 0 1 .37-.37 3.1 3.1 0 0 0 2.48.61 3.1 3.1 0 0 0 2.48-.61.26.26 0 0 1 .37.37zm-.17-1.65a1 1 0 1 1 1-1 1 1 0 0 1-1 1z"/>
    </svg>
    <span class="rslot-title">Reddit</span>
  </div>
  <div class="rslot-body">
    <div class="rslot-error">
      <span class="rslot-error-code">${escapeHtml(statusCode)}</span>
      <p class="rslot-error-title">Reddit blocked this request</p>
      <p class="rslot-error-body">Reddit blocked JSON and RSS requests from this server (HTTP ${escapeHtml(statusCode)}).</p>
      <a class="rslot-error-link" href="${searchHref}" target="_blank" rel="noopener noreferrer">Search “${queryLabel}” on reddit.com</a>
    </div>
  </div>
</div>`;
}

function renderCard(card) {
  if (!template) return "";

  const postTitle =
    card.postTitle.length > 100
      ? `${card.postTitle.slice(0, 97)}…`
      : card.postTitle;
  const comments = Array.isArray(card.comments) ? card.comments : [];

  const commentCards = comments
    .map((c) => {
      const scoreStr = `▲ ${formatCount(c.score)}`;
      return `
          <a class="rslot-comment" href="${escapeHtml(c.url)}" target="_blank" rel="noopener noreferrer">
            <div class="rslot-comment-header">
              <span class="rslot-comment-author">u/${escapeHtml(c.author)}</span>
              <span class="rslot-comment-score">${scoreStr}</span>
            </div>
            <p class="rslot-comment-body">${escapeHtml(c.body)}</p>
          </a>`;
    })
    .join("");

  const gridCols = comments.length <= 1 ? "1fr" : "1fr 1fr";

  return template
    .replace("{{subreddit}}", escapeHtml(card.subreddit))
    .replace("{{post_title}}", escapeHtml(postTitle))
    .replace("{{post_url}}", escapeHtml(card.postUrl))
    .replace("{{post_score}}", formatCount(card.postScore))
    .replace("{{post_comments}}", formatCount(card.numComments))
    .replace("{{post_subreddit}}", escapeHtml(card.subreddit))
    .replace("{{comment_cards}}", commentCards)
    .replace("{{grid_cols}}", gridCols);
}

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
