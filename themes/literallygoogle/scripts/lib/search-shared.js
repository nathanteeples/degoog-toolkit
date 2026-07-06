const LG_LANG_DICT = {
    en: {
        settings: "Settings",
        filters: "Filter",
        tools: "Tools",
        prev: "Previous",
        prev10: "Back 10 pages",
        prevImage: "Previous image",
        next: "Next",
        next10: "Forward 10 pages",
        nextImage: "Next image",
        moreOptions: "More options",
        download: "Download",
        copyLink: "Copy link",
        close: "Close",
        imageCopied: "Image link copied!",
        linkCopied: "Link copied!"
    }
};
const LG_FILTERS_ICON = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 5H3"/>
        <path d="M12 19H3"/>
        <path d="M14 3v4"/>
        <path d="M16 17v4"/>
        <path d="M21 12h-9"/>
        <path d="M21 19h-5"/>
        <path d="M21 5h-7"/>
        <path d="M8 10v4"/>
        <path d="M8 12H3"/>
    </svg>`;
const SEARCH_ACTIVITY_TEXT = Object.freeze({
    runningCommand: "Running command...",
    aboutResultsPattern: /^About \d+ results/i,
    streamingPattern: /streaming/i,
    searchingPattern: /^searching/i,
    completePattern: /results/i,
    completeTimePattern: /seconds?\)/i,
});
const SEARCH_START_SELECTOR =
    ".skeleton-results, .skeleton-card, .skeleton-sidebar, .streaming-engine-panel";
const SEARCH_START_SELECTOR_WITH_IMAGE_GRID = `${SEARCH_START_SELECTOR}, .skeleton-image-grid`;

function onReady(callback) {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
        callback();
    }
}

function getResultsPage() {
    return document.getElementById("results-page");
}

function getResultsList() {
    return document.getElementById("results-list");
}

function getResultsMeta() {
    return document.getElementById("results-meta");
}

function getResultsTabs() {
    return document.getElementById("results-tabs");
}

function getImageFiltersBar() {
    return document.getElementById("image-filters-bar");
}

function getResultsLayout() {
    return document.getElementById("results-layout");
}

function getMediaPreviewPanel() {
    return document.getElementById("media-preview-panel");
}

function getResultsSearchInput() {
    return document.getElementById("results-search-input");
}

function getResultsSearchButton() {
    return document.getElementById("results-search-btn");
}

function getActiveResultsTab() {
    return document.querySelector(
        '.results-tab.active[data-type], .results-tab[aria-selected="true"][data-type]',
    );
}

function getActiveSearchType(defaultType = "web") {
    return getResultsPage()?.getAttribute("data-lg-search-type") || getActiveResultsTab()?.dataset.type || defaultType;
}

function markWired(node, key) {
    if (!node || node.dataset[key] === "1") return false;
    node.dataset[key] = "1";
    return true;
}

function nodeStartsSearch(node, { includeImageGrid = false } = {}) {
    if (!node || node.nodeType !== 1) return false;
    const selector = includeImageGrid
        ? SEARCH_START_SELECTOR_WITH_IMAGE_GRID
        : SEARCH_START_SELECTOR;
    return node.matches?.(selector) || Boolean(node.querySelector?.(selector));
}

function mutationsStartSearch(mutations, options) {
    return mutations.some(mutation => [...mutation.addedNodes].some(node => nodeStartsSearch(node, options)));
}

function getLgTranslation(key) {
    const attrName = `data-t-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
    const el = getResultsPage();
    return el?.getAttribute(attrName) || LG_LANG_DICT.en[key] || key;
}