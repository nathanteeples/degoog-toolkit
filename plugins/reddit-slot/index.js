let template = "";
let maxComments = 2;
let filterNsfw = true;
let minScore = 1;
let restrictSubreddit = "";
let showMode = "keyword";

function isUtilityQuery(q) {
  return /\b(weather|forecast|погода|метео|temperature|humidity|wind|rain|snow|translate|translation|convert|currency|calculator|calculate|math|stopwatch|timer|countdown|coinflip|coin-flip|yesno|yes-no|tip|tips|gratuity|gratuities|stocks?)\b/i.test(q);
}

export const slot = {
  id: "reddit-slot",
  name: "Reddit",
  description: "Shows the top Reddit post and top comments above search results",
  position: "above-results",
  isClientExposed: true,
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

      return {
        html: renderLoadingShell(searchQuery, {
          maxComments,
          minScore,
          filterNsfw,
          restrictSubreddit,
        }),
      };
    } catch {
      return { html: "" };
    }
  },
};

export default slot;

function isRedditUrl(url) {
  return typeof url === "string" && /reddit\.com/i.test(url);
}

function renderLoadingShell(searchQuery, settings) {
  return `<div class="results-slot-panel rslot-panel rslot-panel--loading" data-rslot-pending="1" data-rslot-query="${escapeAttr(searchQuery)}" data-rslot-max-comments="${settings.maxComments}" data-rslot-min-score="${settings.minScore}" data-rslot-filter-nsfw="${settings.filterNsfw ? "1" : "0"}" data-rslot-restrict="${escapeAttr(settings.restrictSubreddit)}">
  <template class="rslot-card-template">${template}</template>
  <div class="rslot-header">
    <svg class="rslot-icon" width="28" height="28" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="rgba(255,255,255,0.12)"/>
      <path fill="rgba(255,255,255,0.85)" d="M16.67 10a1.46 1.46 0 0 0-2.47-1 7.12 7.12 0 0 0-3.85-1.23l.65-3.08 2.13.45a1 1 0 1 0 .14-.57l-2.38-.5a.26.26 0 0 0-.31.2l-.73 3.44a7.14 7.14 0 0 0-3.89 1.23 1.46 1.46 0 1 0-1.61 2.39 2.87 2.87 0 0 0 0 .44c0 2.24 2.61 4.06 5.83 4.06s5.83-1.82 5.83-4.06a2.87 2.87 0 0 0 0-.44 1.46 1.46 0 0 0 .57-1.33zM7.27 11a1 1 0 1 1 1 1 1 1 0 0 1-1-1zm5.58 2.65a3.56 3.56 0 0 1-2.85.77 3.56 3.56 0 0 1-2.85-.77.26.26 0 0 1 .37-.37 3.1 3.1 0 0 0 2.48.61 3.1 3.1 0 0 0 2.48-.61.26.26 0 0 1 .37.37zm-.17-1.65a1 1 0 1 1 1-1 1 1 0 0 1-1 1z"/>
    </svg>
    <span class="rslot-title">{{ t:plugin-reddit-slot.reddit }}</span>
  </div>
  <div class="rslot-body rslot-body--loading">
    <p class="rslot-loading-text">{{ t:plugin-reddit-slot.loading }}</p>
  </div>
</div>`;
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

function escapeAttr(str) {
  return escapeHtml(str);
}
