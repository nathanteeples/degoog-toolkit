let template = "";
let maxComments = 2;
let filterNsfw = true;
let minScore = 1;
let restrictSubreddit = "";
let showMode = "keyword";
let pluginFetch = (...args) => fetch(...args);

/** Reddit requires a descriptive User-Agent; bare bot names often get 403. */
const REDDIT_USER_AGENT = "web:degoog-toolkit:v1.0.12 (by /u/SoPat712)";

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
      description: "Always: shows for every search. Keyword: only when query contains 'reddit'. Top10: only when a Reddit link is in the top 10 search results.",
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
  },

  configure(settings) {
    showMode = ["always", "keyword", "top10"].includes(settings?.showMode)
      ? settings.showMode
      : "keyword";

    const n = parseInt(settings?.maxComments ?? "2", 10);
    maxComments = Number.isFinite(n) ? Math.max(1, Math.min(4, n)) : 2;

    filterNsfw = settings?.filterNsfw !== false && settings?.filterNsfw !== "false";

    const ms = parseInt(settings?.minScore ?? "1", 10);
    minScore = Number.isFinite(ms) ? ms : 1;

    restrictSubreddit = (settings?.restrictSubreddit ?? "").trim().replace(/^r\//, "");
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

      const doFetch =
        typeof context?.fetch === "function"
          ? (...args) => context.fetch(...args)
          : pluginFetch;

      const apiCard = await _fetchCardFromRedditApi(searchQuery, doFetch);
      if (apiCard) {
        return { html: _renderCard(apiCard) };
      }

      const fallback = _pickCardFromSearchResults(results, searchQuery, restrictSubreddit);
      if (fallback) {
        return { html: _renderCard(fallback) };
      }

      return { html: "" };
    } catch {
      return { html: "" };
    }
  },
};

export default slot;

function isRedditUrl(url) {
  return typeof url === "string" && /reddit\.com/i.test(url);
}

function parseRedditPostUrl(url) {
  if (!isRedditUrl(url)) return null;
  const m = String(url).match(/reddit\.com\/r\/([^/]+)\/comments\/([^/?#]+)/i);
  if (!m) return null;
  return {
    subreddit: m[1],
    postId: m[2],
    subredditPrefixed: `r/${m[1]}`,
    postUrl: `https://www.reddit.com/r/${m[1]}/comments/${m[2]}/`,
  };
}

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

async function _redditFetch(doFetch, url) {
  return doFetch(url, {
    headers: { "User-Agent": REDDIT_USER_AGENT },
  });
}

async function _fetchCardFromRedditApi(searchQuery, doFetch) {
  const encoded = encodeURIComponent(searchQuery);
  const searchUrl = restrictSubreddit
    ? `https://www.reddit.com/r/${encodeURIComponent(restrictSubreddit)}/search.json?q=${encoded}&sort=relevance&limit=10&type=link&restrict_sr=1`
    : `https://www.reddit.com/search.json?q=${encoded}&sort=relevance&limit=10&type=link`;

  const searchRes = await _redditFetch(doFetch, searchUrl);
  if (!searchRes.ok) return null;

  const searchData = await searchRes.json();
  const posts = searchData?.data?.children;
  if (!Array.isArray(posts) || posts.length === 0) return null;

  const filtered = posts.filter((p) => {
    if (filterNsfw && p.data.over_18) return false;
    if (p.data.score < minScore) return false;
    return true;
  });
  if (filtered.length === 0) return null;

  const scored = filtered.map((p) => ({
    data: p.data,
    score:
      scoreTextMatch(searchQuery, p.data.title, p.data.selftext) +
      Math.min(p.data.num_comments / 5000, 0.5),
  }));
  scored.sort((a, b) => b.score - a.score);
  const post = scored[0].data;

  const comments = await _fetchComments(doFetch, post.subreddit, post.id);
  return {
    subreddit: post.subreddit_name_prefixed,
    postTitle: post.title,
    postUrl: `https://reddit.com${post.permalink}`,
    postScore: post.score,
    numComments: post.num_comments,
    comments,
  };
}

async function _fetchComments(doFetch, subreddit, postId) {
  const commentsUrl =
    `https://www.reddit.com/r/${subreddit}/comments/${postId}.json` +
    `?limit=15&depth=1&sort=top`;
  const commentsRes = await _redditFetch(doFetch, commentsUrl);
  if (!commentsRes.ok) return [];

  const commentsData = await commentsRes.json();
  const rawComments = commentsData?.[1]?.data?.children || [];
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
    .slice(0, maxComments)
    .map((c) => ({
      author: c.data.author,
      body: c.data.body.length > 180 ? `${c.data.body.slice(0, 177)}…` : c.data.body,
      score: c.data.score,
      url: `https://reddit.com${c.data.permalink}`,
    }));
}

function _pickCardFromSearchResults(results, searchQuery, subredditFilter) {
  const candidates = [];

  for (const result of results) {
    const url = typeof result?.url === "string" ? result.url : "";
    const parsed = parseRedditPostUrl(url);
    if (!parsed) continue;
    if (subredditFilter && parsed.subreddit.toLowerCase() !== subredditFilter.toLowerCase()) {
      continue;
    }

    const title = String(result.title || "").trim();
    const snippet = String(result.snippet || "").trim();
    const score = scoreTextMatch(searchQuery, title, snippet);
    candidates.push({ parsed, title, snippet, score, url: parsed.postUrl });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const postTitle = best.title.length > 100 ? `${best.title.slice(0, 97)}…` : best.title;

  const comments = [];
  if (best.snippet) {
    comments.push({
      author: "preview",
      body: best.snippet.length > 180 ? `${best.snippet.slice(0, 177)}…` : best.snippet,
      score: null,
      url: best.url,
      preview: true,
    });
  }

  return {
    subreddit: best.parsed.subredditPrefixed,
    postTitle,
    postUrl: best.url,
    postScore: null,
    numComments: null,
    comments,
  };
}

function _formatCount(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function _renderCard(card) {
  if (!template) return "";

  const postTitle =
    card.postTitle.length > 100 ? `${card.postTitle.slice(0, 97)}…` : card.postTitle;
  const comments = Array.isArray(card.comments) ? card.comments : [];

  const commentCards = comments
    .map((c) => {
      const scoreStr = c.score == null ? "" : `▲ ${_formatCount(c.score)}`;
      const authorLabel = c.preview ? "Search preview" : `u/${escapeHtml(c.author)}`;
      return `
          <a class="rslot-comment${c.preview ? " rslot-comment-preview" : ""}" href="${c.url}" target="_blank" rel="noopener noreferrer">
            <div class="rslot-comment-header">
              <span class="rslot-comment-author">${authorLabel}</span>
              ${scoreStr ? `<span class="rslot-comment-score">${scoreStr}</span>` : ""}
            </div>
            <p class="rslot-comment-body">${escapeHtml(c.body)}</p>
          </a>`;
    })
    .join("");

  const gridCols = comments.length <= 1 ? "1fr" : "1fr 1fr";

  return template
    .replace("{{subreddit}}", escapeHtml(card.subreddit))
    .replace("{{post_title}}", escapeHtml(postTitle))
    .replace("{{post_url}}", card.postUrl)
    .replace("{{post_score}}", _formatCount(card.postScore))
    .replace("{{post_comments}}", _formatCount(card.numComments))
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
