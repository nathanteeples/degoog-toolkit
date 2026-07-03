const LG_LANG_DICT = {
    en: {
        settings: "Settings",
        filters: "Tools",
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

/* ── 1. Sticky header scroll shadow ─────────────────────────────────────── */
(() => {
    const header = document.getElementById("results-header");
    if (!header) return;
    window.addEventListener(
        "scroll",
        () => {
            header.classList.toggle("scrolled", window.scrollY > 50);
        },
        { passive: true },
    );
})();

/* ── 2. Result pagination enhancements ─────────────────────────────────── */
(() => {
    const ENHANCED_ATTR = "data-lg-pager-enhanced";
    let paginationClickBound = false;
    let pageClickDriver = null;
    const clientPager = {
        enabled: false,
        currentPage: 1,
        queryKey: "",
    };
    const RESULTS_PER_PAGE_HINT = 10;
    const MIN_DEGOOG_PAGES = 2;
    const MAX_DEGOOG_PAGES = 10;
    const PAGE_JUMP = MAX_DEGOOG_PAGES;

    function getSearchQueryKey() {
        return (getResultsSearchInput()?.value || "").trim();
    }

    function getUrlPage() {
        const raw = new URLSearchParams(window.location.search).get("page");
        const page = parseInt(raw || "1", 10);
        return Number.isFinite(page) && page > 0 ? page : 1;
    }

    function isWebTab() {
        return getActiveSearchType() === "web";
    }

    function getResultItems() {
        const list = getResultsList();
        if (!list) return [];
        return [...list.querySelectorAll(".result-item, .degoog-result")].filter(
            el => !el.classList.contains("lg-engine-filtered-out"),
        );
    }

    function shouldEnableClientPagination(resultCount) {
        if (!isWebTab()) return false;
        if (getUrlPage() > 1) return false;
        return resultCount > RESULTS_PER_PAGE_HINT;
    }

    function resetClientPagination() {
        clientPager.enabled = false;
        clientPager.currentPage = 1;
        clientPager.queryKey = "";
        document.querySelectorAll(".lg-client-page-hidden").forEach(el => {
            el.classList.remove("lg-client-page-hidden");
        });
        getResultsList()?.removeAttribute("data-lg-client-page");
    }

    function applyClientPage(page, options = {}) {
        const items = getResultItems();
        const totalPages = Math.max(1, Math.ceil(items.length / RESULTS_PER_PAGE_HINT));
        const target = wrapPage(page, totalPages);
        const start = (target - 1) * RESULTS_PER_PAGE_HINT;
        const end = start + RESULTS_PER_PAGE_HINT;

        clientPager.enabled = true;
        clientPager.currentPage = target;
        clientPager.queryKey = getSearchQueryKey();

        items.forEach((el, index) => {
            el.classList.toggle("lg-client-page-hidden", index < start || index >= end);
        });

        getResultsList()?.setAttribute("data-lg-client-page", String(target));

        if (!options.preserveScroll) {
            window.scrollTo(0, 0);
        }

        if (!options.skipPagerSync) {
            window.requestAnimationFrame(syncPagination);
        }

        window.dispatchEvent(
            new CustomEvent("lg-client-page-change", {
                detail: { page: target, totalPages },
            }),
        );
    }

    function syncClientResultsPage() {
        const list = getResultsList();
        if (!list) return;

        if (list.querySelector(".skeleton-card, .skeleton, .no-results")) {
            resetClientPagination();
            return;
        }

        const queryKey = getSearchQueryKey();
        if (clientPager.queryKey && queryKey !== clientPager.queryKey) {
            resetClientPagination();
        }

        const resultCount = getResultCount();
        if (resultCount < 0) return;

        if (!shouldEnableClientPagination(resultCount)) {
            if (clientPager.enabled) resetClientPagination();
            return;
        }

        if (!clientPager.enabled) {
            applyClientPage(1, { skipPagerSync: true, preserveScroll: true });
            return;
        }

        applyClientPage(clientPager.currentPage, {
            skipPagerSync: true,
            preserveScroll: true,
        });
    }

    function buildClientControls(totalPages, activePage) {
        const pages = [];
        for (let page = 1; page <= totalPages; page += 1) {
            pages.push({ page, node: null });
        }
        return {
            pages,
            activePage,
            prev: activePage > 1 ? { page: activePage - 1, node: null } : null,
            next: activePage < totalPages ? { page: activePage + 1, node: null } : null,
        };
    }

    function usesClientPagination(resultCount) {
        return clientPager.enabled || shouldEnableClientPagination(resultCount);
    }

    function getPageNumber(node) {
        const raw = node.getAttribute("data-page") || node.textContent || "";
        const page = parseInt(raw.trim(), 10);
        return Number.isFinite(page) && page > 0 ? page : null;
    }

    function getPageNodes(pagination) {
        return [
            ...pagination.querySelectorAll("[data-page]"),
            ...pagination.querySelectorAll(".pagination-current")
        ].filter(node => getPageNumber(node) !== null);
    }

    function isActivePage(node) {
        return (
            node.classList.contains("pagination-current") ||
            node.classList.contains("active") ||
            node.classList.contains("current") ||
            node.classList.contains("selected") ||
            node.getAttribute("aria-current") === "page" ||
            node.disabled
        );
    }

    function classifyControls(nodes) {
        const pages = nodes
            .map(node => ({ node, page: getPageNumber(node) }))
            .filter(item => item.page !== null)
            .sort((a, b) => a.page - b.page);
        const active = pages.find(item => isActivePage(item.node));
        const activePage = active ? active.page : (pages[0]?.page || 1);
        let prev = null;
        let next = null;

        pages.forEach(item => {
            if (item.page < activePage && (!prev || item.page > prev.page)) {
                prev = item;
            }
            if (item.page > activePage && (!next || item.page < next.page)) {
                next = item;
            }
        });

        return { pages, activePage, prev, next };
    }

    function getResultCount() {
        const list = getResultsList();
        if (!list) return -1;
        if (list.querySelector(".no-results")) return 0;
        return list.querySelectorAll(
            ".result-item:not(.lg-engine-filtered-out), .degoog-result:not(.lg-engine-filtered-out)",
        ).length;
    }

    function isOptimisticMaxPageStrip(pageNodes) {
        if (pageNodes.length !== MAX_DEGOOG_PAGES) return false;
        const pages = pageNodes
            .map(getPageNumber)
            .filter(page => page !== null)
            .sort((a, b) => a - b);
        if (pages.length !== MAX_DEGOOG_PAGES) return false;
        return pages.every((page, i) => page === i + 1);
    }

    function wrapPage(page, totalPages) {
        if (totalPages < 1) return Math.max(1, page);
        return ((page - 1) % totalPages + totalPages) % totalPages + 1;
    }

    function resolveTotalPages(pageNodes, resultCount, activePage, hasNext, storedTotal) {
        let total = storedTotal || 0;

        if (pageNodes.length < MIN_DEGOOG_PAGES && total < MIN_DEGOOG_PAGES) {
            if (resultCount === 0 && activePage === 1) return 0;
            if (pageNodes.length === 0) return 0;
        }

        if (isOptimisticMaxPageStrip(pageNodes)) {
            if (activePage === 1 && resultCount < RESULTS_PER_PAGE_HINT) return 0;
            if (activePage === 1) {
                total = Math.max(total, Math.ceil(resultCount / RESULTS_PER_PAGE_HINT));
            }
            if (hasNext) total = Math.max(total, activePage + 1);
            total = Math.max(total, activePage);
        } else if (pageNodes.length > 0) {
            const listedMax = Math.max(
                ...pageNodes.map(getPageNumber).filter(page => page !== null),
            );
            total = Math.max(total, listedMax, pageNodes.length);
        }

        total = Math.max(total, activePage);
        return total < MIN_DEGOOG_PAGES ? 0 : total;
    }

    function resolveVisibleOCount(totalPages) {
        return Math.max(MIN_DEGOOG_PAGES, Math.min(MAX_DEGOOG_PAGES, totalPages));
    }

    function buildDisplayPages(controls, totalPages) {
        const visibleCount = resolveVisibleOCount(totalPages);
        const activePage = controls.activePage;
        const activeOIndex = (activePage - 1) % visibleCount;
        const windowStart = Math.floor((activePage - 1) / visibleCount) * visibleCount + 1;
        const loops = totalPages > MAX_DEGOOG_PAGES;
        const displayPages = [];

        for (let i = 0; i < visibleCount; i++) {
            const page = loops
                ? wrapPage(windowStart + i, totalPages)
                : windowStart + i;
            const existing = controls.pages.find(item => item.page === page);
            displayPages.push({
                page,
                node: existing?.node || null,
                oActive: i === activeOIndex,
            });
        }

        return { displayPages, visibleCount };
    }

    function rememberPageClickDriver(pageNodes) {
        for (const node of pageNodes) {
            if (!isActivePage(node)) {
                pageClickDriver = node;
                return;
            }
        }
        if (pageNodes[0]) pageClickDriver = pageNodes[0];
    }

    function navigateToPage(targetPage) {
        const resultCount = getResultCount();
        if (usesClientPagination(resultCount)) {
            applyClientPage(targetPage);
            return;
        }

        const pagination = document.getElementById("pagination");
        if (!pagination) return;

        const existing = pagination.querySelector(
            `[data-page="${targetPage}"]:not(.lg-pager-control)`,
        );
        if (existing) {
            existing.click();
            return;
        }

        if (pageClickDriver) {
            const probe = pageClickDriver.cloneNode(false);
            probe.setAttribute("data-page", String(targetPage));
            if (pageClickDriver.className) probe.className = pageClickDriver.className;
            probe.textContent = String(targetPage);
            pagination.appendChild(probe);
            probe.click();
            probe.remove();
            return;
        }

        const input = document.getElementById("results-search-input");
        const query = input?.value?.trim();
        if (!query) return;

        const url = new URL(window.location.href);
        url.searchParams.set("q", query);
        if (targetPage > 1) url.searchParams.set("page", String(targetPage));
        else url.searchParams.delete("page");

        const activeTab = document.querySelector(
            ".results-tab.active[data-type], .results-tab[aria-selected='true'][data-type]",
        );
        const type = activeTab?.getAttribute("data-type");
        if (type && type !== "web") url.searchParams.set("type", type);
        else url.searchParams.delete("type");

        window.location.assign(url.toString());
    }

    function clearPagination(pagination) {
        pagination.removeAttribute(ENHANCED_ATTR);
        pagination.innerHTML = "";
    }

    function makeLetter(char, className) {
        const span = document.createElement("span");
        span.className = `lg-pager-letter ${className}`;
        span.textContent = char;
        return span;
    }

    const CONTROL_ARROWS = {
        prev: "‹",
        next: "›",
        prev10: "‹‹",
        next10: "››",
    };

    function makeControlElement(kind, label) {
        const span = document.createElement("span");
        span.className = `lg-pager-control lg-pager-control--${kind}`;
        span.innerHTML =
            `<span class="lg-pager-arrow" aria-hidden="true">${CONTROL_ARROWS[kind] || ""}</span>` +
            `<span class="lg-pager-control-label"></span>`;
        span.querySelector(".lg-pager-control-label").textContent = label;
        return span;
    }

    function makeDisabledControl(kind, label) {
        const control = makeControlElement(kind, label);
        control.classList.add("lg-pager-control--disabled");
        control.setAttribute("aria-disabled", "true");
        return control;
    }

    function decorateControl(item, kind, label) {
        if (!item) return makeDisabledControl(kind, label);
        const node = document.createElement("button");
        node.type = "button";
        node.className = `lg-pager-control lg-pager-control--${kind}`;
        node.setAttribute("data-page", String(item.page));
        node.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            navigateToPage(item.page);
        });
        node.innerHTML = makeControlElement(kind, label).innerHTML;
        return node;
    }

    function decorateJumpControl(kind, delta, activePage, totalPages, label) {
        const targetPage = wrapPage(activePage + delta, totalPages);
        const node = document.createElement("button");
        node.type = "button";
        node.className = `lg-pager-control lg-pager-control--${kind}`;
        node.setAttribute("data-lg-jump-to", String(targetPage));
        node.setAttribute("aria-label", label);
        node.innerHTML = makeControlElement(kind, "").innerHTML;
        node.addEventListener("click", event => {
            event.preventDefault();
            navigateToPage(targetPage);
        });
        return node;
    }

    function renderOPages(oTrack, displayPages) {
        oTrack.replaceChildren();
        for (const item of displayPages) {
            const oClass = item.oActive
                ? "lg-pager-o lg-pager-o--active"
                : "lg-pager-o";
            oTrack.appendChild(makeLetter("o", oClass));
        }
    }

    function renderNumberRow(numberRow, displayPages, activePage) {
        numberRow.replaceChildren();
        for (const item of displayPages) {
            let node = item.node;
            if (!node) {
                node = document.createElement("button");
                node.type = "button";
                node.className = "lg-pager-page";
                node.setAttribute("data-page", String(item.page));
                node.addEventListener("click", event => {
                    event.preventDefault();
                    navigateToPage(item.page);
                });
            } else {
                node.classList.add("lg-pager-page");
            }
            node.classList.toggle("lg-pager-page--active", item.page === activePage);
            node.textContent = String(item.page);
            numberRow.appendChild(node);
        }
    }

    function syncJumpControls(lettersLine, controls, totalPages) {
        const showJump = totalPages > MAX_DEGOOG_PAGES;
        for (const [kind, delta, key] of [
            ["prev10", -PAGE_JUMP, "prev10"],
            ["next10", PAGE_JUMP, "next10"],
        ]) {
            const selector = `.lg-pager-control--${kind}`;
            const existing = lettersLine.querySelector(selector);
            if (!showJump) {
                existing?.remove();
                continue;
            }
            const control = decorateJumpControl(
                kind,
                delta,
                controls.activePage,
                totalPages,
                getLgTranslation(key),
            );
            if (existing) existing.replaceWith(control);
            else if (kind === "prev10") lettersLine.insertBefore(control, lettersLine.firstChild);
            else lettersLine.appendChild(control);
        }
    }

    function updatePager(pager, displayPages, controls, visibleCount, totalPages) {
        pager.dataset.lgPageCount = String(visibleCount);
        pager.dataset.lgTotalPages = String(totalPages);
        pager.dataset.lgActivePage = String(controls.activePage);

        const wordmark = pager.querySelector(".lg-pager-wordmark");
        wordmark?.style.setProperty("--lg-pager-page-count", String(visibleCount));

        renderOPages(pager.querySelector(".lg-pager-o-track"), displayPages);
        renderNumberRow(pager.querySelector(".lg-pager-pages"), displayPages, controls.activePage);

        const lettersLine = pager.querySelector(".lg-pager-letters-line");
        if (!lettersLine) return;
        lettersLine.querySelector(".lg-pager-control--prev")?.replaceWith(
            decorateControl(controls.prev, "prev", getLgTranslation("prev")),
        );
        lettersLine.querySelector(".lg-pager-control--next")?.replaceWith(
            decorateControl(controls.next, "next", getLgTranslation("next")),
        );
        syncJumpControls(lettersLine, controls, totalPages);
    }

    function enhancePagination(pagination, pageNodes, displayPages, controls, visibleCount, totalPages) {
        if (!pagination) return;
        if (pagination.querySelector(":scope > .lg-pager")) return;

        pagination.setAttribute(ENHANCED_ATTR, "1");

        const root = document.createElement("nav");
        root.className = "lg-pager";
        root.dataset.lgPageCount = String(visibleCount);
        root.dataset.lgTotalPages = String(totalPages);
        root.dataset.lgActivePage = String(controls.activePage);
        root.setAttribute("aria-label", "Search result pages");

        const wordmark = document.createElement("div");
        const lettersLine = document.createElement("div");
        const lettersCore = document.createElement("div");
        const oTrack = document.createElement("div");
        const prefix = document.createElement("div");
        const suffix = document.createElement("div");

        wordmark.className = "lg-pager-wordmark";
        wordmark.style.setProperty("--lg-pager-page-count", String(visibleCount));
        lettersLine.className = "lg-pager-letters-line";
        lettersCore.className = "lg-pager-letters-core";
        prefix.className = "lg-pager-prefix";
        oTrack.className = "lg-pager-o-track";
        suffix.className = "lg-pager-suffix";

        [
            ["d", "lg-pager-blue"],
            ["e", "lg-pager-red"],
            ["g", "lg-pager-yellow"],
        ].forEach(part => {
            prefix.appendChild(makeLetter(part[0], part[1]));
        });
        renderOPages(oTrack, displayPages);
        suffix.appendChild(makeLetter("g", "lg-pager-blue"));

        const numberRow = document.createElement("div");
        numberRow.className = "lg-pager-pages";
        renderNumberRow(numberRow, displayPages, controls.activePage);

        lettersCore.appendChild(prefix);
        lettersCore.appendChild(oTrack);
        lettersCore.appendChild(suffix);
        if (totalPages > MAX_DEGOOG_PAGES) {
            lettersLine.appendChild(
                decorateJumpControl(
                    "prev10",
                    -PAGE_JUMP,
                    controls.activePage,
                    totalPages,
                    getLgTranslation("prev10"),
                ),
            );
        }
        lettersLine.appendChild(decorateControl(controls.prev, "prev", getLgTranslation("prev")));
        lettersLine.appendChild(lettersCore);
        lettersLine.appendChild(decorateControl(controls.next, "next", getLgTranslation("next")));
        if (totalPages > MAX_DEGOOG_PAGES) {
            lettersLine.appendChild(
                decorateJumpControl(
                    "next10",
                    PAGE_JUMP,
                    controls.activePage,
                    totalPages,
                    getLgTranslation("next10"),
                ),
            );
        }
        wordmark.appendChild(lettersLine);
        wordmark.appendChild(numberRow);
        root.appendChild(wordmark);
        pagination.replaceChildren(root);
    }

    function syncPagination() {
        const pagination = document.getElementById("pagination");
        if (!pagination) return;

        syncClientResultsPage();

        const resultCount = getResultCount();
        const clientMode = usesClientPagination(resultCount);
        const coreWrapper = pagination.querySelector(":scope > .pagination");
        const pageNodes = coreWrapper ? getPageNodes(coreWrapper) : getPageNodes(pagination);
        if (pageNodes.length > 0) rememberPageClickDriver(pageNodes);

        let controls;
        let totalPages;
        const existing = pagination.querySelector(":scope > .lg-pager");
        const storedTotal = existing
            ? parseInt(existing.dataset.lgTotalPages || existing.dataset.lgPageCount || "0", 10)
            : 0;

        if (clientMode) {
            totalPages = Math.max(MIN_DEGOOG_PAGES, Math.ceil(resultCount / RESULTS_PER_PAGE_HINT));
            controls = buildClientControls(totalPages, clientPager.currentPage);
        } else {
            controls = classifyControls(pageNodes);
            totalPages = resolveTotalPages(
                pageNodes,
                resultCount,
                controls.activePage,
                Boolean(controls.next),
                storedTotal,
            );
        }

        if (totalPages < MIN_DEGOOG_PAGES) {
            if (pagination.childElementCount > 0) clearPagination(pagination);
            return;
        }

        const { displayPages, visibleCount } = buildDisplayPages(controls, totalPages);

        if (existing) {
            const prevCount = parseInt(existing.dataset.lgPageCount || "0", 10);
            const prevTotal = parseInt(existing.dataset.lgTotalPages || "0", 10);
            const prevActive = parseInt(existing.dataset.lgActivePage || "0", 10);
            if (
                prevCount === visibleCount &&
                prevTotal === totalPages &&
                prevActive === controls.activePage
            ) {
                return;
            }
            updatePager(existing, displayPages, controls, visibleCount, totalPages);
            return;
        }

        if (!clientMode && !coreWrapper && pageNodes.length < MIN_DEGOOG_PAGES) return;

        enhancePagination(
            pagination,
            pageNodes,
            displayPages,
            controls,
            visibleCount,
            totalPages,
        );
    }

    function interceptPaginationClicks(event) {
        const target = event.target;
        if (!target || typeof target.closest !== "function") return;
        const link = target.closest("#pagination [data-page]");
        if (!link || link.classList.contains("lg-pager-control")) return;

        const page = getPageNumber(link);
        if (!page) return;

        const resultCount = getResultCount();
        if (!usesClientPagination(resultCount)) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        applyClientPage(page);
    }

    function observePagination() {
        const pagination = document.getElementById("pagination");
        if (!pagination) return;

        if (!paginationClickBound) {
            paginationClickBound = true;
            document.addEventListener("click", interceptPaginationClicks, true);
        }

        new MutationObserver(() => {
            window.requestAnimationFrame(syncPagination);
        }).observe(pagination, { childList: true, subtree: false });

        const resultsList = getResultsList();
        if (resultsList) {
            new MutationObserver(() => {
                window.requestAnimationFrame(syncPagination);
            }).observe(resultsList, { childList: true, subtree: false });
        }

        window.addEventListener("degoog-results-ready", () => {
            window.requestAnimationFrame(syncPagination);
        });
        window.addEventListener("lg-results-layout-changed", () => {
            window.requestAnimationFrame(syncPagination);
        });

        syncPagination();
    }

    onReady(observePagination);
})();

/* ── 3. Result-slot hygiene during pagination ──────────────────────────── */
(() => {
    const SLOT_CONTAINER_IDS = [
        "slot-above-results",
        "slot-below-results",
        "slot-above-sidebar",
        "slot-below-sidebar",
    ];
    const observedSlots = new WeakSet();
    const observedContainers = new WeakSet();
    let sidebarRowResizeBound = false;

    function slotContainers() {
        return SLOT_CONTAINER_IDS.map(id => document.getElementById(id)).filter(Boolean);
    }

    function clearResultSlots() {
        slotContainers().forEach(container => {
            container.innerHTML = "";
        });
    }

    function fullWidthKey(panel) {
        const root = panel.querySelector(
            ":scope > .results-slot-panel-body > .slot-full-width",
        );
        if (!root) return "";
        for (let i = 0; i < root.classList.length; i += 1) {
            const className = root.classList[i];
            if (className !== "slot-full-width") return className;
        }
        return root.tagName.toLowerCase();
    }

    function dedupeFullWidthPanels(container) {
        const seen = new Map();
        const panels = [...container.querySelectorAll(":scope > .results-slot-panel")];
        panels.forEach(panel => {
            const key = fullWidthKey(panel);
            if (!key) return;
            const previous = seen.get(key);
            if (previous?.isConnected) {
                previous.remove();
            }
            seen.set(key, panel);
        });
    }

    document.addEventListener(
        "click",
        event => {
            const target = event.target;
            if (
                target &&
                typeof target.closest === "function" &&
                target.closest("#pagination [data-page]")
            ) {
                clearResultSlots();
            }
        },
        true,
    );

    function leadingFullWidthSlotRows() {
        const slot = document.getElementById("slot-above-results");
        if (!slot) return 1;

        let row = 1;
        for (const panel of slot.querySelectorAll(":scope > .results-slot-panel")) {
            if (
                panel.querySelector(
                    ":scope > .results-slot-panel-body > .slot-full-width",
                )
            ) {
                row += 1;
            } else {
                break;
            }
        }
        return row;
    }

    function syncSidebarGridRow() {
        const sidebar = document.getElementById("sidebar-col");
        if (!sidebar) return;

        if (window.matchMedia("(max-width: 767px)").matches) {
            sidebar.style.removeProperty("grid-row");
            return;
        }

        sidebar.style.gridRow = `${leadingFullWidthSlotRows()} / span 30`;
    }

    function observeSlots() {
        syncSidebarGridRow();

        const slot = document.getElementById("slot-above-results");
        if (slot && !observedSlots.has(slot)) {
            observedSlots.add(slot);
            new MutationObserver(() => {
                window.requestAnimationFrame(syncSidebarGridRow);
            }).observe(slot, { childList: true });
        }

        if (!sidebarRowResizeBound) {
            sidebarRowResizeBound = true;
            window.addEventListener("resize", syncSidebarGridRow, { passive: true });
            window.addEventListener("degoog-results-ready", syncSidebarGridRow);
        }

        slotContainers().forEach(container => {
            dedupeFullWidthPanels(container);
            if (observedContainers.has(container)) return;
            observedContainers.add(container);
            new MutationObserver(mutations => {
                const shouldDedupe = mutations.some(mutation => mutation.addedNodes.length > 0);
                if (shouldDedupe) dedupeFullWidthPanels(container);
            }).observe(container, { childList: true });
        });
    }

    onReady(observeSlots);
})();

/* ── 4. Move spell-check notices into #results-meta ─────────────────────── */
(() => {
    let spellCheckFrame = 0;

    function wrapResultsStats(meta) {
        if (!meta || meta.querySelector(".results-meta-stats")) return;
        for (let i = 0; i < meta.childNodes.length; i++) {
            const node = meta.childNodes[i];
            if (node.nodeType !== Node.TEXT_NODE) continue;
            const text = node.textContent.trim();
            if (!text) continue;
            const stats = document.createElement("span");
            stats.className = "results-meta-stats";
            stats.textContent = text;
            meta.replaceChild(stats, node);
            return;
        }
    }

    function moveSpellCheck() {
        const notices = document.querySelectorAll(".spell-check-notice");
        const meta = getResultsMeta();
        wrapResultsStats(meta);
        for (let i = 0; i < notices.length; i++) {
            const notice = notices[i];
            const panel = notice.closest(".results-slot-panel");
            if (meta && notice.parentNode !== meta) {
                meta.appendChild(notice);
                panel?.remove();
            }
        }
    }

    function scheduleSpellCheck() {
        if (spellCheckFrame) return;
        spellCheckFrame = requestAnimationFrame(() => {
            spellCheckFrame = 0;
            moveSpellCheck();
        });
    }

    const target = getResultsPage() || document.documentElement;
    new MutationObserver(mutations => {
        const shouldCheck = mutations.some(mutation => mutation.addedNodes.length > 0);
        if (shouldCheck) scheduleSpellCheck();
    }).observe(target, {
        childList: true,
        subtree: true,
    });

    moveSpellCheck();
})();

/* ── 4a. Filters dropdown ──────────────────────────────────────────────── */
(() => {
    let filtersFrame = 0;

    function unwrapMetaRow() {
        const row = document.getElementById("lg-meta-row");
        const meta = getResultsMeta();
        const page = getResultsPage();
        const tabs = getResultsTabs();
        if (!page) return;
        if (!row) return;
        if (meta?.parentNode === row) {
            page.insertBefore(meta, row);
        }
        page.classList.remove("lg-image-meta-filters", "lg-image-fab-filters", "lg-image-fab-open");
        const panel = document.getElementById("tools-panel");
        if (panel?.parentNode === row) {
            tabs?.after(panel);
        }
        row.remove();
    }

    function relabelFiltersToggle(toggle) {
        if (toggle.dataset.lgFiltersLabel === "1") return;
        const filterLabel = getLgTranslation("tools");
        let icon = toggle.querySelector(".lg-filters-icon");
        if (!icon) {
            toggle.querySelector("i")?.remove();
            icon = document.createElement("span");
            icon.className = "lg-filters-icon";
            icon.innerHTML = LG_FILTERS_ICON;
            toggle.prepend(icon);
        }
        for (const node of [...toggle.childNodes]) {
            if (node.nodeType === Node.TEXT_NODE) {
                node.remove();
            }
        }
        let label = toggle.querySelector(".lg-filters-label");
        if (!label) {
            label = document.createElement("span");
            label.className = "lg-filters-label";
            toggle.appendChild(label);
        }
        label.textContent = filterLabel;
        toggle.setAttribute("aria-label", filterLabel);
        toggle.dataset.lgFiltersLabel = "1";
    }

    function renderFiltersButton(button, { iconOnly = false } = {}) {
        const filterLabel = getLgTranslation("tools");
        let icon = button.querySelector(".lg-filters-icon");
        if (!icon) {
            icon = document.createElement("span");
            icon.className = "lg-filters-icon";
            button.prepend(icon);
        }
        icon.innerHTML = LG_FILTERS_ICON;

        const existingLabel = button.querySelector(".lg-filters-label");
        if (iconOnly) {
            existingLabel?.remove();
            button.classList.add("lg-tools-toggle-icon-only");
        } else {
            let label = existingLabel;
            if (!label) {
                label = document.createElement("span");
                label.className = "lg-filters-label";
                button.appendChild(label);
            }
            label.textContent = filterLabel;
            button.classList.remove("lg-tools-toggle-icon-only");
        }
        button.setAttribute("aria-label", filterLabel);
    }

    const DRAWER_ANIMATING = "lg-image-drawer-animating";
    const DRAWER_READY = "lg-image-drawer-open-ready";
    const DRAWER_ANIM_MS = 400;
    const FAB_READY = "lg-image-tools-fab-ready";
    const FAB_ENTERING = "lg-image-tools-fab-entering";
    const FAB_ENTER_MS = 20;
    const IMAGE_MODE_DESKTOP_LAYOUT = "data-image-mode-desktop-layout";
    const IMAGE_FAB_SIDE_MOBILE = "data-image-fab-side-mobile";
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktopQuery = window.matchMedia("(min-width: 768px)");
    let drawerAnimTimeout = 0;

    function getImageModeDesktopLayout() {
        return (document.documentElement.getAttribute(IMAGE_MODE_DESKTOP_LAYOUT) || "organizers-left")
            .trim()
            .toLowerCase();
    }

    function isDesktopFabLayout() {
        const layout = getImageModeDesktopLayout();
        return (
            layout === "organizers-left" ||
            layout === "preview-left" ||
            layout === "fab-left" ||
            layout === "fab-right"
        );
    }

    function isDesktopFabEndAnchor(layout = getImageModeDesktopLayout()) {
        return layout === "preview-left" || layout === "fab-right";
    }

    function isDesktopImageDrawerMode(page) {
        return (
            page?.getAttribute("data-lg-search-type") === "images" &&
            desktopQuery.matches &&
            isDesktopFabLayout()
        );
    }

    function isImageDrawerMode(page) {
        return (
            page?.getAttribute("data-lg-search-type") === "images" &&
            (!desktopQuery.matches || isDesktopFabLayout())
        );
    }

    function getImageDrawerOverlay() {
        return document.querySelector(".degoog-img-sidebar-overlay");
    }

    function setImageFiltersSidebarOpen(open) {
        const sidebar = getImageFiltersBar();
        const overlay = getImageDrawerOverlay();
        if (!sidebar) return;
        sidebar.classList.toggle("open", open);
        overlay?.classList.toggle("open", open);
    }

    function clearImageDrawerInlineAnchor(page) {
        page?.classList.remove("lg-image-drawer-anchor-start", "lg-image-drawer-anchor-end");
        getImageFiltersBar()?.classList.remove("lg-image-drawer-anchor-start", "lg-image-drawer-anchor-end");
        document.getElementById("lg-image-tools-fab")?.classList.remove(
            "lg-image-drawer-anchor-start",
            "lg-image-drawer-anchor-end",
        );
    }

    function syncImageDrawerInlineAnchor(page) {
        const sidebar = getImageFiltersBar();
        if (!sidebar || !page?.classList.contains("lg-image-fab-filters") || !isImageDrawerMode(page)) {
            clearImageDrawerInlineAnchor(page);
            return;
        }

        const launcher = document.getElementById("lg-image-tools-fab");
        const desktopLayout = getImageModeDesktopLayout();
        if (desktopQuery.matches && isDesktopFabLayout()) {
            const useEndAnchor = isDesktopFabEndAnchor(desktopLayout);
            const anchorStart = !useEndAnchor;
            page.classList.toggle("lg-image-drawer-anchor-start", anchorStart);
            page.classList.toggle("lg-image-drawer-anchor-end", useEndAnchor);
            sidebar.classList.toggle("lg-image-drawer-anchor-start", anchorStart);
            sidebar.classList.toggle("lg-image-drawer-anchor-end", useEndAnchor);
            launcher?.classList.toggle("lg-image-drawer-anchor-start", anchorStart);
            launcher?.classList.toggle("lg-image-drawer-anchor-end", useEndAnchor);
            return;
        }

        const sideSetting = (document.documentElement.getAttribute(IMAGE_FAB_SIDE_MOBILE) || "auto")
            .trim()
            .toLowerCase();
        const locale = (
            document.documentElement.lang ||
            navigator.language ||
            navigator.languages?.[0] ||
            ""
        )
            .trim()
            .toLowerCase();
        const lang = locale.split(/[-_]/)[0];
        const autoUsesLeft =
            document.documentElement.dir === "rtl" || lang === "he" || lang === "iw" || lang === "ja";
        const useEndAnchor =
            sideSetting === "right"
                ? true
                : sideSetting === "left"
                  ? false
                  : !autoUsesLeft;
        const anchorStart = !useEndAnchor;

        page.classList.toggle("lg-image-drawer-anchor-start", anchorStart);
        page.classList.toggle("lg-image-drawer-anchor-end", useEndAnchor);
        sidebar.classList.toggle("lg-image-drawer-anchor-start", anchorStart);
        sidebar.classList.toggle("lg-image-drawer-anchor-end", useEndAnchor);
        launcher?.classList.toggle("lg-image-drawer-anchor-start", anchorStart);
        launcher?.classList.toggle("lg-image-drawer-anchor-end", useEndAnchor);
    }

    function openImageFiltersDrawer(page, toggle, panel) {
        const sidebar = getImageFiltersBar();
        if (!sidebar || sidebar.classList.contains("open")) return;

        if (panel && toggle) {
            ensureFiltersClosed(panel, toggle);
        }

        syncImageDrawerInlineAnchor(page);
        syncImageDrawerViewport(page);
        prepareImageDrawerAnimation(page);
        setImageFiltersSidebarOpen(true);
        setImageDrawerReady(page, true);
        sidebar.classList.add("lg-drawer-dragging");
        applyImageDrawerMotionProgress(sidebar, getImageDrawerMotionMetrics(page, sidebar), 1);
        sidebar.getBoundingClientRect();

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                sidebar.classList.remove("lg-drawer-dragging");
                clearImageDrawerMotionProgress(sidebar);
            });
        });
    }

    function setImageDrawerAnimating(page, on) {
        const sidebar = getImageFiltersBar();
        const overlay = getImageDrawerOverlay();
        page?.classList.toggle(DRAWER_ANIMATING, on);
        sidebar?.classList.toggle(DRAWER_ANIMATING, on);
        overlay?.classList.toggle(DRAWER_ANIMATING, on);
    }

    function setImageDrawerReady(page, on) {
        const sidebar = getImageFiltersBar();
        const overlay = getImageDrawerOverlay();
        page?.classList.toggle(DRAWER_READY, on);
        sidebar?.classList.toggle(DRAWER_READY, on);
        overlay?.classList.toggle(DRAWER_READY, on);
    }

    function prepareImageDrawerAnimation(page) {
        setImageDrawerReady(page, false);
        setImageDrawerAnimating(page, true);
        window.clearTimeout(drawerAnimTimeout);
        if (!reducedMotionQuery.matches) {
            drawerAnimTimeout = window.setTimeout(
                () => finishImageDrawerAnimation(page),
                DRAWER_ANIM_MS + 80,
            );
        }
    }

    function finishImageDrawerAnimation(page) {
        window.clearTimeout(drawerAnimTimeout);
        drawerAnimTimeout = 0;
        const sidebar = getImageFiltersBar();
        const open = sidebar?.classList.contains("open") ?? false;
        setImageDrawerAnimating(page, false);
        setImageDrawerReady(page, open);
    }

    function clearImageDrawerPerformance(page) {
        window.clearTimeout(drawerAnimTimeout);
        drawerAnimTimeout = 0;
        setImageDrawerAnimating(page, false);
        setImageDrawerReady(page, false);
    }

    function clearImageFabInsetBottom(page) {
        page?.style.removeProperty("--lg-fab-inset-bottom");
        getImageFiltersBar()?.style.removeProperty("--lg-fab-inset-bottom");
    }

    function ensureImageDrawerHost(page) {
        const sidebar = getImageFiltersBar();
        if (!page || !sidebar || !isDesktopImageDrawerMode(page)) {
            restoreImageDrawerHost();
            return;
        }
        sidebar.classList.add("lg-image-fab-drawer");
        if (sidebar.parentNode === document.body) return;
        document.body.appendChild(sidebar);
    }

    function restoreImageDrawerHost() {
        const sidebar = getImageFiltersBar();
        const layout = getResultsLayout();
        const preview = getMediaPreviewPanel();
        if (!sidebar || !layout || sidebar.parentNode === layout) return;
        sidebar.classList.remove("lg-image-fab-drawer");
        layout.insertBefore(sidebar, preview || null);
    }

    function syncImageDrawerViewport(page) {
        const sidebar = getImageFiltersBar();
        const vv = window.visualViewport;
        if (!sidebar || !page?.classList.contains("lg-image-fab-filters")) return;

        const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const bottomPx = 0.75 * remPx;
        const topPx = 0.5 * remPx;
        const viewportHeight = vv?.height ?? window.innerHeight;
        const maxH = Math.max(14 * remPx, viewportHeight - topPx - bottomPx);
        sidebar.style.setProperty("--lg-drawer-max-height", `${maxH}px`);
        syncImageDrawerInlineAnchor(page);
        clearImageFabInsetBottom(page);
    }

    function wireImageDrawerViewport(page) {
        if (page.dataset.lgDrawerViewportWired === "1") return;
        page.dataset.lgDrawerViewportWired = "1";

        const sync = () => syncImageDrawerViewport(page);
        window.visualViewport?.addEventListener("resize", sync);
        window.visualViewport?.addEventListener("scroll", sync);
        window.addEventListener("resize", sync);
        window.addEventListener("orientationchange", sync);
        sync();
    }

    function getPx(value, fallback = 0) {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function lerp(start, end, progress) {
        return start + (end - start) * progress;
    }

    function getImageDrawerMotionMetrics(page, sidebar) {
        const rect = sidebar.getBoundingClientRect();
        const styles = getComputedStyle(sidebar);
        const anchorEnd =
            page.classList.contains("lg-image-drawer-anchor-end") ||
            sidebar.classList.contains("lg-image-drawer-anchor-end");
        const fabSize = getPx(styles.getPropertyValue("--lg-fab-size"), 56);
        const fabInset = getPx(styles.getPropertyValue("--lg-fab-inset-inline"), 16);
        const fabBottom = getPx(styles.getPropertyValue("--lg-fab-inset-bottom"), 16);
        const openInset = anchorEnd ? window.innerWidth - rect.right : rect.left;
        const openBottom = window.innerHeight - rect.bottom;
        const openRadius =
            getPx(styles.borderTopLeftRadius, 0) || getPx(styles.borderRadius, fabSize / 2);

        return {
            anchorEnd,
            dragDistance: Math.max(1, rect.height - fabSize),
            fabBottom,
            fabInset,
            fabSize,
            openBottom,
            openHeight: rect.height,
            openInset,
            openRadius,
            openWidth: rect.width,
        };
    }

    function applyImageDrawerMotionProgress(sidebar, metrics, progress) {
        if (!sidebar || !metrics) return;
        const clamped = Math.max(0, Math.min(progress, 1));
        const width = lerp(metrics.openWidth, metrics.fabSize, clamped);
        const height = lerp(metrics.openHeight, metrics.fabSize, clamped);
        const radius = lerp(metrics.openRadius, metrics.fabSize / 2, clamped);
        const inset = lerp(metrics.openInset, metrics.fabInset, clamped);
        const bottom = lerp(metrics.openBottom, metrics.fabBottom, clamped);
        const contentOpacity = Math.max(0, 1 - clamped * 1.8);

        sidebar.style.setProperty("width", `${width}px`, "important");
        sidebar.style.setProperty("max-width", `${width}px`, "important");
        sidebar.style.setProperty("height", `${height}px`, "important");
        sidebar.style.setProperty("min-height", `${height}px`, "important");
        sidebar.style.setProperty("max-height", `${height}px`, "important");
        sidebar.style.setProperty("border-radius", `${radius}px`, "important");
        sidebar.style.setProperty("bottom", `${bottom}px`, "important");

        if (metrics.anchorEnd) {
            sidebar.style.removeProperty("inset-inline-start");
            sidebar.style.setProperty("inset-inline-end", `${inset}px`, "important");
        } else {
            sidebar.style.removeProperty("inset-inline-end");
            sidebar.style.setProperty("inset-inline-start", `${inset}px`, "important");
        }

        sidebar.style.setProperty("--lg-drawer-content-opacity", String(contentOpacity));
    }

    function clearImageDrawerMotionProgress(sidebar) {
        sidebar?.style.removeProperty("width");
        sidebar?.style.removeProperty("max-width");
        sidebar?.style.removeProperty("height");
        sidebar?.style.removeProperty("min-height");
        sidebar?.style.removeProperty("max-height");
        sidebar?.style.removeProperty("border-radius");
        sidebar?.style.removeProperty("bottom");
        sidebar?.style.removeProperty("inset-inline-start");
        sidebar?.style.removeProperty("inset-inline-end");
        sidebar?.style.removeProperty("--lg-drawer-content-opacity");
    }

    function wireImageDrawerPullDismiss(page) {
        const sidebar = getImageFiltersBar();
        if (!markWired(sidebar, "lgDrawerPullWired")) return;

        const DISMISS_DISTANCE = 120;
        const DISMISS_VELOCITY = 0.45;
        const DRAG_START_THRESHOLD = 6;

        let startY = 0;
        let lastY = 0;
        let lastT = 0;
        let velocity = 0;
        let dragging = false;
        let dragArmed = false;
        let dragProgress = 0;
        let dragMetrics = null;

        function getHandle() {
            return sidebar.querySelector(".degoog-img-sidebar-close");
        }

        function applyDragProgress(progress) {
            if (!dragMetrics) return;
            const clamped = Math.max(0, Math.min(progress, 1));
            applyImageDrawerMotionProgress(sidebar, dragMetrics, clamped);
            dragProgress = clamped;
        }

        function clearDragGeometry() {
            clearImageDrawerMotionProgress(sidebar);
            dragMetrics = null;
            dragProgress = 0;
        }

        function clearDragVars() {
            sidebar.classList.remove("lg-drawer-dragging", "lg-drawer-drag-snap");
            clearDragGeometry();
        }

        function closeDrawer() {
            if (!sidebar.classList.contains("open")) return;
            sidebar.classList.remove("lg-drawer-dragging", "lg-drawer-drag-snap");
            clearDragGeometry();
            prepareImageDrawerAnimation(page);
            setImageFiltersSidebarOpen(false);
        }

        function snapBack() {
            sidebar.classList.remove("lg-drawer-dragging");
            sidebar.classList.add("lg-drawer-drag-snap");
            clearDragGeometry();
            const onEnd = event => {
                if (event.target !== sidebar || event.propertyName !== "height") return;
                sidebar.removeEventListener("transitionend", onEnd);
                clearDragVars();
            };
            sidebar.addEventListener("transitionend", onEnd);
        }

        sidebar.addEventListener(
            "touchstart",
            event => {
                if (!isImageDrawerMode(page) || !sidebar.classList.contains("open")) return;
                if (sidebar.classList.contains(DRAWER_ANIMATING)) return;
                const handle = getHandle();
                if (!handle || !(event.target instanceof Node) || !handle.contains(event.target)) {
                    return;
                }

                const touch = event.touches[0];
                startY = touch.clientY;
                lastY = startY;
                lastT = performance.now();
                velocity = 0;
                dragging = false;
                dragArmed = true;
                dragProgress = 0;
                dragMetrics = getImageDrawerMotionMetrics(page, sidebar);
            },
            { passive: true },
        );

        sidebar.addEventListener(
            "touchmove",
            event => {
                if (!dragArmed) return;
                const touch = event.touches[0];
                const dy = touch.clientY - startY;
                if (!dragging && dy < DRAG_START_THRESHOLD) return;

                if (!dragging) {
                    dragging = true;
                    sidebar.classList.add("lg-drawer-dragging");
                }

                const clampedDy = Math.max(0, dy);
                const now = performance.now();
                const dt = now - lastT;
                if (dt > 0) {
                    velocity = (touch.clientY - lastY) / dt;
                }
                lastY = touch.clientY;
                lastT = now;

                event.preventDefault();
                applyDragProgress(clampedDy / dragMetrics.dragDistance);
            },
            { passive: false },
        );

        function finishDrag() {
            if (!dragArmed) return;
            dragArmed = false;
            if (!dragging) return;

            const dy = Math.max(0, lastY - startY);
            dragging = false;

            if (dy > DISMISS_DISTANCE || dragProgress > 0.28 || velocity > DISMISS_VELOCITY) {
                closeDrawer();
                return;
            }

            if (dragProgress > 0) {
                snapBack();
                return;
            }

            clearDragVars();
        }

        sidebar.addEventListener("touchend", finishDrag, { passive: true });
        sidebar.addEventListener("touchcancel", finishDrag, { passive: true });
    }

    function wireImageDrawerPerformance(page) {
        const sidebar = getImageFiltersBar();
        if (!markWired(sidebar, "lgDrawerPerfWired")) return;

        let wasOpen = sidebar.classList.contains("open");

        new MutationObserver(() => {
            if (!isImageDrawerMode(page)) {
                wasOpen = sidebar.classList.contains("open");
                return;
            }

            const open = sidebar.classList.contains("open");
            if (open === wasOpen) return;

            if (!sidebar.classList.contains(DRAWER_ANIMATING)) {
                prepareImageDrawerAnimation(page);
            }
            if (reducedMotionQuery.matches) {
                requestAnimationFrame(() => finishImageDrawerAnimation(page));
            }
            syncImageDrawerViewport(page);
            wasOpen = open;
        }).observe(sidebar, { attributes: true, attributeFilter: ["class"] });
    }

    function removeFloatingFiltersLauncher(page) {
        page?.classList.remove("lg-image-fab-filters", "lg-image-fab-open");
        clearImageDrawerPerformance(page);
        clearImageFabInsetBottom(page);
        clearImageDrawerInlineAnchor(page);
        document.getElementById("lg-image-tools-fab")?.remove();
        restoreImageDrawerHost();
    }

    function playFloatingFiltersLauncherIntro(launcher) {
        launcher.classList.remove(FAB_READY);
        launcher.classList.add(FAB_ENTERING);
        launcher.getBoundingClientRect();
        if (reducedMotionQuery.matches) {
            launcher.classList.add(FAB_READY);
            launcher.classList.remove(FAB_ENTERING);
            return;
        }
        window.setTimeout(() => {
            launcher.classList.add(FAB_READY);
            launcher.classList.remove(FAB_ENTERING);
        }, FAB_ENTER_MS);
    }

    function armFloatingFiltersLauncher(launcher) {
        if (!launcher || launcher.dataset.lgFabMounted === "1") return;
        launcher.dataset.lgFabMounted = "1";

        const startIntro = () => {
            if (!launcher.isConnected) return;
            playFloatingFiltersLauncherIntro(launcher);
        };

        requestAnimationFrame(startIntro);
    }

    function applyFloatingFiltersLauncherState(launcher, toggle, page) {
        if (!launcher || !page) return;
        const sidebar = getImageFiltersBar();
        const drawerMode = isImageDrawerMode(page);
        const isOpen = drawerMode
            ? Boolean(sidebar?.classList.contains("open"))
            : Boolean(
                  sidebar?.classList.contains("open") ||
                      toggle.classList.contains("is-open") ||
                      toggle.classList.contains("active") ||
                      toggle.getAttribute("aria-expanded") === "true",
              );

        page.classList.add("lg-image-fab-filters");
        page.classList.toggle("lg-image-fab-open", Boolean(isOpen));
        syncImageDrawerInlineAnchor(page);
        launcher.classList.toggle("is-open", Boolean(isOpen));
        launcher.classList.toggle("active", Boolean(isOpen));
        launcher.setAttribute("aria-expanded", String(Boolean(isOpen)));
    }

    let syncFabFrame = 0;
    function syncFloatingFiltersLauncher(toggle, page) {
        if (syncFabFrame) return;
        syncFabFrame = requestAnimationFrame(() => {
            syncFabFrame = 0;

            const launcher = document.getElementById("lg-image-tools-fab");
            applyFloatingFiltersLauncherState(launcher, toggle, page);
        });
    }

    function ensureFloatingFiltersLauncher(page, toggle) {
        let launcher = document.getElementById("lg-image-tools-fab");
        if (!launcher) {
            launcher = document.createElement("button");
            launcher.id = "lg-image-tools-fab";
            launcher.className = "lg-image-tools-fab";
            launcher.type = "button";
            page.appendChild(launcher);
        }

        renderFiltersButton(launcher, { iconOnly: true });
        launcher.setAttribute("aria-label", getLgTranslation("tools"));
        launcher.setAttribute("aria-haspopup", "dialog");
        applyFloatingFiltersLauncherState(launcher, toggle, page);
        armFloatingFiltersLauncher(launcher);

        if (markWired(launcher, "lgFabWired")) {
            launcher.addEventListener("click", event => {
                const currentPage = getResultsPage();
                const sidebar = getImageFiltersBar();
                const panel = document.getElementById("tools-panel");
                const currentToggle = document.getElementById("tools-toggle");
                if (!isImageDrawerMode(currentPage)) return;
                if (sidebar?.classList.contains("open")) {
                    event.preventDefault();
                    return;
                }
                openImageFiltersDrawer(currentPage, currentToggle, panel);
            });
        }

        syncFloatingFiltersLauncher(toggle, page);
    }

    function syncCustomDateMenuState(panel) {
        panel.querySelectorAll(".tools-field-menu").forEach(menu => {
            const customDate = menu.querySelector(".tools-custom-date");
            if (!customDate) return;
            const visible =
                customDate.style.display !== "none" && !customDate.hidden;
            menu.classList.toggle("lg-custom-date-open", visible);
        });
    }

    function wireCustomDateMenuState(panel) {
        if (!markWired(panel, "lgCustomDateWired")) return;
        panel.querySelectorAll(".tools-custom-date").forEach(customDate => {
            new MutationObserver(() => syncCustomDateMenuState(panel)).observe(
                customDate,
                { attributes: true, attributeFilter: ["style", "hidden", "class"] },
            );
        });
        syncCustomDateMenuState(panel);
    }

    function positionFiltersPanel(panel, toggle, page) {
        if (isImageDrawerMode(page)) return;
        if (panel.style.display === "none") return;
        const toggleRect = toggle.getBoundingClientRect();
        const pageRect = page.getBoundingClientRect();
        panel.style.setProperty("--lg-filters-top", `${toggleRect.bottom - pageRect.top + 4}px`);
        panel.style.setProperty("--lg-filters-left", `${toggleRect.left - pageRect.left}px`);
    }

    function ensureFiltersClosed(panel, toggle) {
        if (!panel || !toggle) return;
        panel.style.display = "none";
        toggle.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        panel.querySelectorAll(".tools-field-menu").forEach(menu => {
            menu.style.display = "none";
        });
        panel.querySelectorAll('.tools-field-toggle[aria-expanded="true"]').forEach(btn => {
            btn.setAttribute("aria-expanded", "false");
        });
        try {
            localStorage.setItem("degoog-tools-open", "false");
        } catch {
            /* Persisting the transient tools-panel state is optional. */
        }
    }

    function ensureFiltersClosedAfterCore(panel, toggle) {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => ensureFiltersClosed(panel, toggle));
        });
    }

    function closeFiltersDropdown(panel, toggle) {
        if (!panel || !toggle || panel.style.display === "none") return;
        window.dispatchEvent(new Event("degoog-tools-close"));
        ensureFiltersClosed(panel, toggle);
    }

    function wireFiltersDismiss(panel, toggle) {
        if (!markWired(panel, "lgFiltersDismissWired")) return;

        document.addEventListener("click", event => {
            if (panel.style.display === "none") return;
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (panel.contains(target) || toggle.contains(target)) return;
            closeFiltersDropdown(panel, toggle);
        });
    }

    function wireFiltersHover(panel) {
        if (!markWired(panel, "lgFiltersHoverWired")) return;

        panel.addEventListener("mouseover", e => {
            if (panel.style.display === "none") return;
            const field = e.target.closest(".tools-field");
            if (!field || !panel.contains(field)) return;
            const toggle = field.querySelector(".tools-field-toggle");
            const menuId = toggle?.getAttribute("aria-controls");
            const menu = menuId ? document.getElementById(menuId) : null;
            if (!toggle || !menu || menu.style.display === "block") return;
            toggle.click();
        });
    }

    function wireDrawerToggleGuard(toggle) {
        if (!markWired(toggle, "lgDrawerGuardWired")) return;

        toggle.addEventListener(
            "click",
            event => {
                const page = getResultsPage();
                const sidebar = getImageFiltersBar();
                if (!isImageDrawerMode(page)) return;
                if (!sidebar?.classList.contains("open")) return;
                event.preventDefault();
                event.stopImmediatePropagation();
            },
            true,
        );
    }

    function isBangCommandQuery(query) {
        const trimmed = query.trim();
        if (!trimmed) return false;
        return trimmed.startsWith("!") || /\s!\S+$/.test(trimmed);
    }

    function isCommandMode() {
        const query = getResultsSearchInput()?.value ?? "";
        if (!isBangCommandQuery(query)) return false;

        const metaText = getResultsMeta()?.textContent?.trim() ?? "";
        if (metaText === SEARCH_ACTIVITY_TEXT.runningCommand) return true;
        if (SEARCH_ACTIVITY_TEXT.aboutResultsPattern.test(metaText)) return false;

        const list = getResultsList();
        if (!list) return false;

        if (list.querySelector(".loading-dots")) {
            return metaText === SEARCH_ACTIVITY_TEXT.runningCommand;
        }

        if (list.querySelector(".command-result, .command-help-table")) return true;

        if (list.querySelector(".result-item")) return false;

        if (list.querySelector(".no-results")) return true;

        return false;
    }

    function syncFiltersVisibility(toolsBar, panel, toggle, page) {
        if (!toolsBar || !page) return;
        const commandMode = isCommandMode();
        page.classList.toggle("lg-command-mode", commandMode);
        if (commandMode) {
            closeFiltersDropdown(panel, toggle);
            return;
        }
        if (toolsBar.hidden) {
            toolsBar.hidden = false;
        }
    }

    function getFiltersElements() {
        return {
            page: getResultsPage(),
            panel: document.getElementById("tools-panel"),
            toggle: document.getElementById("tools-toggle"),
            toolsBar: document.getElementById("tools-bar"),
        };
    }

    function activateImageDrawerMode(page, toggle) {
        if (isDesktopImageDrawerMode(page)) {
            ensureImageDrawerHost(page);
        } else {
            restoreImageDrawerHost();
        }
        ensureFloatingFiltersLauncher(page, toggle);
        wireImageDrawerPerformance(page);
        wireImageDrawerViewport(page);
        wireImageDrawerPullDismiss(page);
        syncImageDrawerViewport(page);
        clearImageFabInsetBottom(page);
    }

    function deactivateImageDrawerMode(page) {
        removeFloatingFiltersLauncher(page);
        clearImageFabInsetBottom(page);
    }

    function wireFiltersUiObservers(panel, toggle, page) {
        toggle.addEventListener("click", () => {
            requestAnimationFrame(() => {
                positionFiltersPanel(panel, toggle, page);
                syncCustomDateMenuState(panel);
                syncFloatingFiltersLauncher(toggle, page);
            });
        });
        window.addEventListener("resize", () => {
            scheduleFiltersDropdown();
            positionFiltersPanel(panel, toggle, page);
        });
        window.addEventListener(
            "scroll",
            () => positionFiltersPanel(panel, toggle, page),
            true,
        );
        new MutationObserver(() => positionFiltersPanel(panel, toggle, page)).observe(panel, {
            attributes: true,
            attributeFilter: ["style", "class"],
        });
        new MutationObserver(() => syncFloatingFiltersLauncher(toggle, page)).observe(toggle, {
            attributes: true,
            attributeFilter: ["class", "aria-expanded"],
        });

        const sidebar = getImageFiltersBar();
        if (!sidebar) return;

        new MutationObserver(() => syncFloatingFiltersLauncher(toggle, page)).observe(sidebar, {
            attributes: true,
            attributeFilter: ["class", "style"],
        });
    }

    function syncFiltersVisibilityFromDom(page = getResultsPage()) {
        const { toolsBar, panel, toggle } = getFiltersElements();
        if (!panel || !toggle) return;
        syncFiltersVisibility(toolsBar, panel, toggle, page);
    }

    function setupFiltersDropdown() {
        unwrapMetaRow();

        const { page, panel, toggle, toolsBar } = getFiltersElements();
        if (!page || !panel || !toggle) return;
        const drawerMode = isImageDrawerMode(page);

        relabelFiltersToggle(toggle);
        wireDrawerToggleGuard(toggle);
        panel.classList.remove("lg-tools-inline");
        panel.classList.add("lg-filters-dropdown");
        toolsBar?.classList.add("lg-filters-wrap");

        if (drawerMode) {
            activateImageDrawerMode(page, toggle);
        } else {
            deactivateImageDrawerMode(page);
        }

        positionFiltersPanel(panel, toggle, page);
        wireCustomDateMenuState(panel);
        if (!drawerMode) {
            ensureFiltersClosedAfterCore(panel, toggle);
            wireFiltersDismiss(panel, toggle);
            wireFiltersHover(panel);
        }
        syncFiltersVisibility(toolsBar, panel, toggle, page);

        if (toggle.dataset.lgFiltersWired !== "1") {
            toggle.dataset.lgFiltersWired = "1";
            wireFiltersUiObservers(panel, toggle, page);
        }

        syncFloatingFiltersLauncher(toggle, page);
        window.dispatchEvent(new Event("lg-sync-sidebar-chrome"));
    }

    function scheduleFiltersDropdown() {
        if (filtersFrame) return;
        filtersFrame = requestAnimationFrame(() => {
            filtersFrame = 0;
            setupFiltersDropdown();
        });
    }

    function scheduleFiltersSync() {
        scheduleFiltersDropdown();
    }

    scheduleFiltersSync();
    window.addEventListener("degoog-results-ready", scheduleFiltersSync);
    window.addEventListener("lg-sync-search-type", scheduleFiltersSync);
    desktopQuery.addEventListener?.("change", scheduleFiltersSync);

    const page = getResultsPage();
    if (page) {
        new MutationObserver(mutations => {
            let needsSetup = false;
            let needsVisibilitySync = false;

            for (const mutation of mutations) {
                if (
                    mutation.type === "attributes" &&
                    mutation.target === page &&
                    mutation.attributeName === "data-lg-search-type"
                ) {
                    needsSetup = true;
                    continue;
                }

                if (
                    mutation.type === "attributes" &&
                    mutation.target instanceof Element &&
                    mutation.target.matches?.("#results-tabs .results-tab")
                ) {
                    needsVisibilitySync = true;
                    continue;
                }

                if (mutation.type !== "childList") continue;

                const target = mutation.target;
                if (
                    target instanceof Element &&
                    (target.id === "results-list" ||
                        target.id === "results-meta" ||
                        target.closest?.("#results-list, #results-meta"))
                ) {
                    needsVisibilitySync = true;
                }

                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    if (
                        node.id === "tools-panel" ||
                        node.id === "tools-toggle" ||
                        node.id === "lg-meta-row" ||
                        node.querySelector?.("#tools-panel, #tools-toggle, #lg-meta-row")
                    ) {
                        needsSetup = true;
                        break;
                    }
                }
            }

            if (needsSetup) {
                scheduleFiltersDropdown();
            } else if (needsVisibilitySync) {
                requestAnimationFrame(() => syncFiltersVisibilityFromDom(page));
            }
        }).observe(page, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class", "aria-selected", "data-lg-search-type"],
        });
    }
})();

/* ── 5. Media-preview (mp2) bar enhancements ────────────────────────────── */
(() => {
    let toastTimer = null;

    function showToast(msg) {
        const el = document.getElementById("mp2-toast");
        if (!el) return;
        el.textContent = msg;
        el.classList.add("mp2-toast--visible");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            el.classList.remove("mp2-toast--visible");
        }, 2500);
    }

    function fallbackCopy(text) {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try {
            document.execCommand("copy");
        } catch (e) {}
        document.body.removeChild(ta);
    }

    function faviconUrlForOrigin(origin) {
        const page = encodeURIComponent(`${origin}/`);
        return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${page}&size=64`;
    }

    function tuneFavicon(favicon) {
        if (!favicon) return;
        favicon.classList.remove("mp2-favicon--fill");
        const nw = favicon.naturalWidth;
        const nh = favicon.naturalHeight;
        if (!nw || !nh) return;
        const minSide = Math.min(nw, nh);
        const maxSide = Math.max(nw, nh);
        if (minSide <= 20 && maxSide / minSide < 1.35) {
            favicon.classList.add("mp2-favicon--fill");
        }
    }

    function fitPreviewImage(panel) {
        const img = panel.querySelector("#media-preview-img");
        const wrap = panel.querySelector(".media-preview-img-wrap");
        if (!img || !wrap || img.style.display === "none") return;

        const apply = () => {
            wrap.style.removeProperty("width");
            wrap.style.removeProperty("aspect-ratio");
            img.style.removeProperty("width");
            img.style.removeProperty("height");
            const nw = img.naturalWidth;
            const nh = img.naturalHeight;
            if (!nw || !nh) return;

            const body = wrap.closest(".mp2-body");
            const maxW = Math.max(120, (body?.clientWidth || wrap.clientWidth || 360) - 28);
            const maxH = Math.min(window.innerHeight * 0.56, 448);
            let w = nw;
            let h = nh;
            if (h > maxH) {
                w = (nw / nh) * maxH;
                h = maxH;
            }
            if (w > maxW) {
                h = (h / w) * maxW;
                w = maxW;
            }
            img.style.width = `${Math.max(1, Math.round(w))}px`;
            img.style.height = `${Math.max(1, Math.round(h))}px`;
        };

        if (img.complete) {
            apply();
        } else {
            img.addEventListener("load", apply, { once: true });
        }
    }

    function syncMeta(panel) {
        const info = panel.querySelector("#media-preview-info");
        if (!info) return;
        const link = info.querySelector(".media-preview-link");
        if (!link?.href) return;
        const favicon = panel.querySelector("#mp2-favicon");
        const host = panel.querySelector("#mp2-host");
        try {
            const parsed = new URL(link.href);
            const hostname = parsed.hostname;
            if (host) {
                host.textContent = hostname;
                host.href = link.href;
                host.title = hostname;
            }
            if (favicon) {
                favicon.classList.remove("mp2-favicon--fill");
                favicon.src = faviconUrlForOrigin(parsed.origin);
                favicon.style.display = "block";
                favicon.onload = () => tuneFavicon(favicon);
                favicon.onerror = () => {
                    favicon.src = `${parsed.origin}/favicon.ico`;
                    favicon.onload = () => tuneFavicon(favicon);
                    favicon.onerror = () => {
                        favicon.style.display = "none";
                    };
                };
            }
        } catch (e) {}
    }

    function isVideosTabActive() {
        return !!document.querySelector(
            '#results-tabs .results-tab[data-type="videos"].active, #results-tabs .results-tab[data-type="videos"][aria-selected="true"]',
        );
    }

    function getVisualImageCards() {
        const cards = [...document.querySelectorAll("#results-list .image-card")].filter(
            card => card.offsetParent !== null,
        );
        const rowTolerance = 14;
        cards.sort((a, b) => {
            const ar = a.getBoundingClientRect();
            const br = b.getBoundingClientRect();
            if (Math.abs(ar.top - br.top) > rowTolerance) {
                return ar.top - br.top;
            }
            return ar.left - br.left;
        });
        return cards;
    }

    function navigatePreviewByVisualOrder(direction) {
        const cards = getVisualImageCards();
        if (cards.length < 2) return;
        const current = document.querySelector("#results-list .image-card.selected");
        const currentIndex = Math.max(0, cards.indexOf(current));
        const nextIndex = (currentIndex + direction + cards.length) % cards.length;
        const target = cards[nextIndex];
        if (!target) return;
        target.scrollIntoView({ block: "nearest", inline: "nearest" });
        target.dispatchEvent(
            new MouseEvent("click", { bubbles: true, cancelable: true, view: window }),
        );
    }

    function syncMp2DownloadVisibility(panel) {
        const dl = panel.querySelector("#mp2-download");
        if (!dl) return;
        if (isVideosTabActive()) {
            dl.setAttribute("hidden", "");
            dl.setAttribute("aria-hidden", "true");
        } else {
            dl.removeAttribute("hidden");
            dl.removeAttribute("aria-hidden");
        }
    }

    function bindPanel(panel) {
        if (panel.dataset.mp2 === "1") return;
        panel.dataset.mp2 = "1";

        const info = panel.querySelector("#media-preview-info");
        const dropdown = panel.querySelector("#mp2-dropdown");
        const menuBtn = panel.querySelector("#mp2-menu");
        const dlBtn = panel.querySelector("#mp2-download");
        const shareBtn = panel.querySelector("#mp2-share");

        const prevBtn = panel.querySelector("#media-preview-prev");
        if (prevBtn) {
            prevBtn.setAttribute("aria-label", getLgTranslation("prevImage"));
            prevBtn.setAttribute("title", getLgTranslation("prev"));
            prevBtn.addEventListener(
                "click",
                e => {
                    if (isVideosTabActive()) return;
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    navigatePreviewByVisualOrder(-1);
                },
                true,
            );
        }
        const nextBtn = panel.querySelector("#media-preview-next");
        if (nextBtn) {
            nextBtn.setAttribute("aria-label", getLgTranslation("nextImage"));
            nextBtn.setAttribute("title", getLgTranslation("next"));
            nextBtn.addEventListener(
                "click",
                e => {
                    if (isVideosTabActive()) return;
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    navigatePreviewByVisualOrder(1);
                },
                true,
            );
        }
        if (menuBtn) {
            menuBtn.setAttribute("aria-label", getLgTranslation("moreOptions"));
            menuBtn.setAttribute("title", getLgTranslation("moreOptions"));
        }
        const closeBtn = panel.querySelector("#media-preview-close");
        if (closeBtn) {
            closeBtn.setAttribute("aria-label", getLgTranslation("close"));
            closeBtn.setAttribute("title", getLgTranslation("close"));
        }
        if (dlBtn) {
            const dlSvg = dlBtn.querySelector("svg");
            dlBtn.innerHTML = "";
            if (dlSvg) dlBtn.appendChild(dlSvg);
            dlBtn.appendChild(document.createTextNode(` ${getLgTranslation("download")}`));
        }
        if (shareBtn) {
            const shareSvg = shareBtn.querySelector("svg");
            shareBtn.innerHTML = "";
            if (shareSvg) shareBtn.appendChild(shareSvg);
            shareBtn.appendChild(document.createTextNode(` ${getLgTranslation("copyLink")}`));
        }

        syncMp2DownloadVisibility(panel);
        new MutationObserver(() => {
            syncMp2DownloadVisibility(panel);
        }).observe(panel, { childList: true, subtree: true });

        const tabs = document.getElementById("results-tabs");
        if (tabs) {
            new MutationObserver(() => {
                syncMp2DownloadVisibility(panel);
            }).observe(tabs, {
                attributes: true,
                subtree: true,
                attributeFilter: ["class", "aria-selected"],
            });
        }

        if (info) {
            syncMeta(panel);
            fitPreviewImage(panel);
            new MutationObserver(() => {
                syncMeta(panel);
            }).observe(info, { childList: true, subtree: true });
        }

        const previewImg = panel.querySelector("#media-preview-img");
        if (previewImg) {
            fitPreviewImage(panel);
            new MutationObserver(() => fitPreviewImage(panel)).observe(previewImg, {
                attributes: true,
                attributeFilter: ["src"],
            });
        }

        window.addEventListener("resize", () => fitPreviewImage(panel), { passive: true });

        if (menuBtn && dropdown) {
            menuBtn.addEventListener("click", e => {
                e.stopPropagation();
                const open = !dropdown.hasAttribute("hidden");
                dropdown.toggleAttribute("hidden", open);
                menuBtn.setAttribute("aria-expanded", String(!open));
            });
        }

        document.addEventListener("click", () => {
            if (dropdown) {
                dropdown.setAttribute("hidden", "");
                if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
            }
        });

        document.addEventListener(
            "keydown",
            e => {
                if (isVideosTabActive()) return;
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                if (!panel.classList.contains("open")) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                navigatePreviewByVisualOrder(e.key === "ArrowLeft" ? -1 : 1);
            },
            true,
        );

        if (dlBtn) {
            dlBtn.addEventListener("click", () => {
                if (dropdown) dropdown.setAttribute("hidden", "");
                const dl = info?.querySelector(".media-preview-download");
                dl?.click();
            });
        }

        if (shareBtn) {
            shareBtn.addEventListener("click", () => {
                if (dropdown) dropdown.setAttribute("hidden", "");
                const imgEl = panel.querySelector("#media-preview-img");
                const visit = info?.querySelector(".media-preview-visit");
                let href = "";
                let toastMsg = getLgTranslation("linkCopied");
                if (isVideosTabActive()) {
                    href = visit?.href || "";
                    if (!href) {
                        const ifr = panel.querySelector("iframe");
                        const isrc = String(
                                  ifr?.getAttribute("src") || ifr?.src || "",
                              ).trim();
                        if (isrc && !/^about:blank$/i.test(isrc)) href = isrc;
                    }
                    if (!href) href = location.href;
                } else if (imgEl) {
                    const src = imgEl.currentSrc || imgEl.src || "";
                    if (src && !/^about:blank$/i.test(src)) {
                        href = src;
                        toastMsg = getLgTranslation("imageCopied");
                    }
                }
                if (!href && visit?.href) href = visit.href;
                if (!href) href = location.href;
                if (navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(href).then(
                        () => showToast(toastMsg),
                        () => {
                            fallbackCopy(href);
                            showToast(toastMsg);
                        },
                    );
                } else {
                    fallbackCopy(href);
                    showToast(toastMsg);
                }
            });
        }
    }

    function tryBind() {
        const panel = document.getElementById("media-preview-panel");
        if (panel?.querySelector(".mp2-bar")) bindPanel(panel);
    }

    const panel = document.getElementById("media-preview-panel");
    new MutationObserver(mutations => {
        const hasAdded = mutations.some(mutation => mutation.addedNodes.length > 0);
        if (hasAdded) tryBind();
    }).observe(panel || document.documentElement, {
        childList: true,
        subtree: true,
    });

    tryBind();
})();

(() => {
    function usesImageFabDrawerChrome() {
        return getResultsPage()?.classList.contains("lg-image-fab-filters");
    }

    function syncImageSidebarChrome() {
        const close = document.querySelector("#image-filters-bar .degoog-img-sidebar-close");
        if (!close) return;
        if (!("lgDefaultInnerHtml" in close.dataset)) {
            close.dataset.lgDefaultInnerHtml = close.innerHTML;
        }
        if (!("lgDefaultAriaLabel" in close.dataset)) {
            close.dataset.lgDefaultAriaLabel = close.getAttribute("aria-label") || "";
        }

        if (usesImageFabDrawerChrome()) {
            if (close.dataset.lgFabPullTab === "1") return;
            close.classList.add("lg-drawer-pull-tab");
            close.innerHTML = "";
            close.setAttribute("aria-label", getLgTranslation("close"));
            close.dataset.lgFabPullTab = "1";
            return;
        }

        if (close.dataset.lgFabPullTab !== "1") return;
        close.classList.remove("lg-drawer-pull-tab");
        delete close.dataset.lgFabPullTab;
        close.innerHTML = close.dataset.lgDefaultInnerHtml || "";
        if (close.dataset.lgDefaultAriaLabel) {
            close.setAttribute("aria-label", close.dataset.lgDefaultAriaLabel);
        } else {
            close.removeAttribute("aria-label");
        }
    }

    function init() {
        syncImageSidebarChrome();
        const page = getResultsPage();
        if (!page) return;
        new MutationObserver(syncImageSidebarChrome).observe(page, {
            childList: true,
            subtree: true,
        });
    }

    onReady(init);
    window.addEventListener("lg-sync-sidebar-chrome", syncImageSidebarChrome);
})();

/* ── 5b. Image grid fold-in when preview pane opens ───────────────────── */
(() => {
    const COL_BREAKPOINTS = [
        [800, 3],
        [1100, 4],
        [1400, 5],
        [Infinity, 6],
    ];
    const MIN_COL_PX = 72;
    const COL_GAP_PX = 4;
    const MIN_COL_COUNT = 2;

    function baseColumnsForWidth(width) {
        const w = Math.max(0, width);
        for (const [max, cols] of COL_BREAKPOINTS) {
            if (w <= max) return cols;
        }
        return 3;
    }

    function isPreviewOpen() {
        return document.getElementById("media-preview-panel")?.classList.contains("open") ?? false;
    }

    function measureWidth(grid) {
        const main = grid.closest("#results-main");
        if (main?.clientWidth) return main.clientWidth;
        return grid.clientWidth || window.innerWidth;
    }

    let fallbackSeq = 0;
    function itemSortKey(item) {
        const rawIdx = item.getAttribute("data-idx") || item.dataset.idx || "";
        const parsed = Number.parseInt(rawIdx, 10);
        if (Number.isFinite(parsed)) {
            return { primary: parsed, secondary: 0 };
        }
        if (!item.dataset.lgImageSeq) {
            fallbackSeq += 1;
            item.dataset.lgImageSeq = String(fallbackSeq);
        }
        return {
            primary: 1_000_000,
            secondary: Number.parseInt(item.dataset.lgImageSeq, 10) || 0,
        };
    }

    function collectGridItems(grid) {
        const items = [];
        for (const col of grid.querySelectorAll(":scope > .image-column")) {
            items.push(...col.children);
        }
        for (const child of grid.querySelectorAll(
            ":scope > .image-card, :scope > .skeleton-media-card",
        )) {
            items.push(child);
        }
        items.sort((a, b) => {
            const ka = itemSortKey(a);
            const kb = itemSortKey(b);
            if (ka.primary !== kb.primary) return ka.primary - kb.primary;
            return ka.secondary - kb.secondary;
        });
        return items;
    }

    function pickShortestColumn(columns) {
        const visible = columns.filter(col => !col.classList.contains("lg-image-col-hidden"));
        const pool = visible.length ? visible : columns;
        return pool.reduce((best, col) => {
            if (col.offsetHeight < best.offsetHeight) return col;
            if (col.offsetHeight > best.offsetHeight) return best;
            return col.children.length <= best.children.length ? col : best;
        });
    }

    function ensureColumnCount(grid, count) {
        const target = Math.max(MIN_COL_COUNT, count);
        let columns = [...grid.querySelectorAll(":scope > .image-column")];
        while (columns.length < target) {
            const col = document.createElement("div");
            col.className = "image-column";
            grid.appendChild(col);
            columns.push(col);
        }
        while (columns.length > target) {
            const col = columns.pop();
            const dest = pickShortestColumn(columns);
            if (col && dest) {
                while (col.firstChild) dest.appendChild(col.firstChild);
            }
            col?.remove();
        }
        return [...grid.querySelectorAll(":scope > .image-column")];
    }

    function stabilizeGrid(grid) {
        const items = collectGridItems(grid);
        if (!items.length) return;

        const baseCols = baseColumnsForWidth(window.innerWidth);
        const columns = ensureColumnCount(grid, baseCols);
        items.forEach((item, index) => {
            columns[index % columns.length].appendChild(item);
        });

        grid.dataset.lgGridBaseCols = String(baseCols);
        grid.dataset.lgVisibleCols = String(baseCols);
        grid.classList.add("lg-image-grid-fold");
        for (const col of columns) {
            col.classList.remove("lg-image-col-hidden");
        }
    }

    function absorbNewItems(grid) {
        const columns = [...grid.querySelectorAll(":scope > .image-column")].filter(
            col => !col.classList.contains("lg-image-col-hidden"),
        );
        if (!columns.length) return;

        const loose = [...grid.querySelectorAll(
            ":scope > .image-card, :scope > .skeleton-media-card",
        )];
        if (!loose.length) return;

        loose.sort((a, b) => {
            const ka = itemSortKey(a);
            const kb = itemSortKey(b);
            if (ka.primary !== kb.primary) return ka.primary - kb.primary;
            return ka.secondary - kb.secondary;
        });

        for (const item of loose) {
            pickShortestColumn(columns).appendChild(item);
        }
    }

    function mergeColumnAt(columns, index) {
        const column = columns[index];
        if (!column || column.classList.contains("lg-image-col-hidden")) return;
        const targets = columns.slice(0, index).filter(
            col => !col.classList.contains("lg-image-col-hidden"),
        );
        if (!targets.length) return;
        const dest = pickShortestColumn(targets);
        while (column.firstChild) dest.appendChild(column.firstChild);
        column.classList.add("lg-image-col-hidden");
    }

    function showAllColumns(columns) {
        for (const col of columns) {
            col.classList.remove("lg-image-col-hidden");
        }
    }

    function targetColumnsForWidth(available, baseCols) {
        let cols = baseCols;
        while (cols > MIN_COL_COUNT) {
            const widthPerCol = (available - COL_GAP_PX * (cols - 1)) / cols;
            if (widthPerCol >= MIN_COL_PX) return { cols, widthPerCol };
            cols -= 1;
        }
        const widthPerCol =
            (available - COL_GAP_PX * (MIN_COL_COUNT - 1)) / MIN_COL_COUNT;
        return { cols: MIN_COL_COUNT, widthPerCol };
    }

    function resetGrid(grid) {
        const baseCols =
            Number.parseInt(grid.dataset.lgGridBaseCols, 10) ||
            baseColumnsForWidth(window.innerWidth);
        const columns = ensureColumnCount(grid, baseCols);
        showAllColumns(columns);
        const items = collectGridItems(grid);
        items.forEach((item, index) => {
            columns[index % columns.length].appendChild(item);
        });
        grid.dataset.lgVisibleCols = String(baseCols);
    }

    function applyFold(grid) {
        if (!grid?.isConnected || !grid.classList.contains("lg-image-grid-fold")) return;

        const baseCols =
            Number.parseInt(grid.dataset.lgGridBaseCols, 10) ||
            baseColumnsForWidth(window.innerWidth);
        const available = measureWidth(grid);

        if (!isPreviewOpen()) {
            const visibleCols =
                Number.parseInt(grid.dataset.lgVisibleCols, 10) || baseCols;
            if (visibleCols !== baseCols) resetGrid(grid);
            const { widthPerCol } = targetColumnsForWidth(available, baseCols);
            grid.style.setProperty(
                "--lg-col-min",
                `${Math.min(160, Math.max(MIN_COL_PX, widthPerCol))}px`,
            );
            return;
        }

        const { cols, widthPerCol } = targetColumnsForWidth(available, baseCols);
        let columns = [...grid.querySelectorAll(":scope > .image-column")];
        const visibleCols =
            Number.parseInt(grid.dataset.lgVisibleCols, 10) || columns.length;

        if (cols < visibleCols) {
            columns = ensureColumnCount(grid, baseCols);
            showAllColumns(columns);
            for (let i = columns.length - 1; i >= cols; i--) {
                mergeColumnAt(columns, i);
            }
            grid.dataset.lgVisibleCols = String(cols);
        }

        grid.style.setProperty(
            "--lg-col-min",
            `${Math.max(MIN_COL_PX, Math.min(160, widthPerCol))}px`,
        );
    }

    function scrollSelectedImageIntoView({ block = "nearest" } = {}) {
        document
            .querySelector("#results-list .image-card.selected")
            ?.scrollIntoView({ block, inline: "nearest", behavior: "smooth" });
    }

    let scrollSelectedFrame = 0;
    function scheduleScrollToSelected() {
        if (!isPreviewOpen()) return;
        if (!document.querySelector("#results-list .image-card.selected")) return;
        if (scrollSelectedFrame) return;
        scrollSelectedFrame = requestAnimationFrame(() => {
            scrollSelectedFrame = 0;
            requestAnimationFrame(() => {
                scrollSelectedImageIntoView({ block: "center" });
            });
        });
    }

    function bindGrid(grid) {
        if (!grid) return;
        if (markWired(grid, "lgFoldBound")) {
            stabilizeGrid(grid);
        } else {
            absorbNewItems(grid);
        }
        applyFold(grid);

        grid.querySelectorAll(".image-thumb-wrap:not(.loaded)").forEach(wrap => {
            const img = wrap.querySelector("img.image-thumb");
            if (img && img.complete) {
                wrap.classList.add("loaded");
            }
        });

        scheduleScrollToSelected();
    }

    function scanGrids() {
        document
            .querySelectorAll("#results-list .image-grid")
            .forEach(bindGrid);
    }

    let foldFrame = 0;
    function scheduleFold() {
        if (foldFrame) return;
        foldFrame = requestAnimationFrame(() => {
            foldFrame = 0;
            document
                .querySelectorAll("#results-list .image-grid.lg-image-grid-fold")
                .forEach(applyFold);
            scheduleScrollToSelected();
        });
    }

    const main = document.getElementById("results-main");
    if (main && typeof ResizeObserver !== "undefined") {
        new ResizeObserver(scheduleFold).observe(main);
    }

    const preview = document.getElementById("media-preview-panel");
    if (preview) {
        new MutationObserver(() => {
            scanGrids();
            scheduleFold();
            if (preview.classList.contains("open")) {
                requestAnimationFrame(scrollSelectedImageIntoView);
            }
        }).observe(preview, { attributes: true, attributeFilter: ["class"] });

        preview.addEventListener("transitionend", event => {
            if (!preview.classList.contains("open")) return;
            if (
                event.target !== preview ||
                !["flex-basis", "width", "transform", "max-width"].includes(
                    event.propertyName,
                )
            ) {
                return;
            }
            scheduleFold();
            scrollSelectedImageIntoView();
        });
    }

    window.addEventListener("resize", scheduleFold);
    window.addEventListener("degoog-results-ready", () => {
        scanGrids();
        scheduleFold();
    });

    const resultsList = getResultsList();
    if (resultsList) {
        new MutationObserver(mutations => {
            let needsBind = false;
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    if (
                        node.matches?.(".image-grid") ||
                        node.querySelector?.(".image-grid, .image-card")
                    ) {
                        needsBind = true;
                        break;
                    }
                }
                if (needsBind) break;
            }
            if (needsBind) scanGrids();
            else scheduleFold();
            scheduleScrollToSelected();
        }).observe(resultsList, { childList: true, subtree: true });
    }

    document.addEventListener("load", (event) => {
        const target = event.target;
        if (target instanceof HTMLImageElement && target.classList.contains("image-thumb")) {
            const wrap = target.closest(".image-thumb-wrap");
            if (wrap) {
                wrap.classList.add("loaded");
            }
        }
    }, true);

    scanGrids();
})();

/* ── 5c. Engine performance row → filter results by engine ─────────────── */
(() => {
    const FILTER_ATTR = "data-lg-engine-filter";
    const ACTIVE_CLASS = "lg-engine-stat-row--active";
    const HIDDEN_CLASS = "lg-engine-filtered-out";
    const RESULT_SELECTORS = ".result-item, .image-card, .video-card";

    function installEngineResultLearnerEarly() {
        if (EventSource.prototype.__lgEngineLearner) return;
        const nativeAdd = EventSource.prototype.addEventListener;
        EventSource.prototype.addEventListener = function (type, listener, options) {
            if (type === "engine-result" && typeof listener === "function") {
                const stream = this;
                const wrapped = event => {
                    try {
                        if (!stream.__lgEngineStreamSeen) {
                            stream.__lgEngineStreamSeen = true;
                            resetSourceEngineLearner();
                        }
                        const data = JSON.parse(event.data);
                        ingestEngineResultBatch(data.engine, data.results);
                    } catch {
                        /* Some stream events do not carry JSON result payloads. */
                    }
                    return listener.call(this, event);
                };
                return nativeAdd.call(this, type, wrapped, options);
            }
            return nativeAdd.call(this, type, listener, options);
        };
        EventSource.prototype.__lgEngineLearner = true;
    }

    installEngineResultLearnerEarly();

    function getPage() {
        return getResultsPage();
    }

    function normalizeEngine(name) {
        return (name || "").trim().toLowerCase();
    }

    function compactEngineToken(name) {
        return normalizeEngine(name).replace(/[^a-z0-9]+/g, "");
    }

    /** Sources learned from SSE engine-result batches (source tag → engine display names). */
    const sourceEngineAliases = new Map();
    let streamUrlSources = new Map();

    function resetSourceEngineLearner() {
        sourceEngineAliases.clear();
        streamUrlSources = new Map();
    }

    function rememberSourceEngine(source, engineName) {
        const srcKey = normalizeEngine(source);
        const engKey = normalizeEngine(engineName);
        if (!srcKey || !engKey) return;
        let aliases = sourceEngineAliases.get(srcKey);
        if (!aliases) {
            aliases = new Set();
            sourceEngineAliases.set(srcKey, aliases);
        }
        aliases.add(engKey);
    }

    function ingestEngineResultBatch(engineName, results) {
        if (!engineName || !Array.isArray(results)) return;
        for (const result of results) {
            const sources = Array.isArray(result.sources)
                ? result.sources.map(part => String(part).trim()).filter(Boolean)
                : result.source
                  ? [String(result.source).trim()]
                  : [];
            if (!result.url || !sources.length) continue;

            const prev = streamUrlSources.get(result.url) || new Set();
            const next = new Set(sources);
            for (const source of next) {
                if (!prev.has(source)) {
                    rememberSourceEngine(source, engineName);
                }
            }
            streamUrlSources.set(result.url, next);
        }
        if (getSelectedEngines().length) {
            requestAnimationFrame(() => applyFilter(getSelectedEngines()));
        }
    }

    function sourceKnownForEngine(source, engineName) {
        const aliases = sourceEngineAliases.get(normalizeEngine(source));
        return aliases?.has(normalizeEngine(engineName)) ?? false;
    }

    function sourceMatchesEngineStrict(source, engineName) {
        const normalized = normalizeEngine(source);
        const needle = normalizeEngine(engineName);
        if (!needle) return true;
        if (normalized === needle) return true;
        if (normalized.startsWith(`${needle}:`)) return true;

        const sourceBase = normalized.split(":")[0]?.trim();
        if (!sourceBase) return false;
        if (sourceBase === needle) return true;
        if (needle.startsWith(`${sourceBase} `)) return true;
        if (sourceBase.startsWith(`${needle} `)) return true;

        const compactSource = compactEngineToken(source);
        const compactNeedle = compactEngineToken(engineName);
        const compactBase = compactEngineToken(sourceBase);
        if (!compactNeedle) return true;
        if (compactSource === compactNeedle) return true;
        if (compactBase && compactNeedle.startsWith(compactBase)) return true;
        if (compactBase && compactBase.startsWith(compactNeedle)) return true;
        return false;
    }

    function sourceMatchesEngine(source, engineName) {
        if (sourceMatchesEngineStrict(source, engineName)) return true;
        return sourceKnownForEngine(source, engineName);
    }

    function enginePanelRoots() {
        return [
            document.getElementById("results-sidebar"),
            document.getElementById("image-engine-panel"),
        ].filter(Boolean);
    }

    function getSelectedEngines() {
        const raw = getPage()?.getAttribute(FILTER_ATTR);
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed)
                ? parsed.map(name => String(name).trim()).filter(Boolean)
                : [];
        } catch {
            return raw.trim() ? [raw.trim()] : [];
        }
    }

    function getResultSources(el) {
        if (el.classList.contains("result-item")) {
            return [...el.querySelectorAll(".result-engine-tag")].map(tag =>
                tag.textContent.trim(),
            );
        }
        const meta = el.querySelector(".lg-result-sources");
        if (!meta) return [];
        return meta.textContent
            .split("|")
            .map(part => part.trim())
            .filter(Boolean);
    }

    function resultMatches(selectedEngines, el) {
        if (!selectedEngines.length) return true;
        return getResultSources(el).some(source =>
            selectedEngines.some(engine => sourceMatchesEngine(source, engine)),
        );
    }

    function syncRowHighlights(selectedEngines) {
        const active = new Set(selectedEngines.map(normalizeEngine));
        document.querySelectorAll(".engine-stat-row").forEach(row => {
            const rowEngine = normalizeEngine(row.querySelector(".engine-stat-label")?.textContent);
            const isActive = active.has(rowEngine);
            row.classList.toggle(ACTIVE_CLASS, isActive);
            row.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
    }

    function applyFilter(selectedEngines) {
        const list = getResultsList();
        if (!list) return;
        list.querySelectorAll(RESULT_SELECTORS).forEach(el => {
            const show = resultMatches(selectedEngines, el);
            el.classList.toggle(HIDDEN_CLASS, !show);
        });
    }

    function setSelectedEngines(engines) {
        const page = getPage();
        if (!page) return;
        const unique = [];
        const seen = new Set();
        for (const engine of engines) {
            const name = String(engine || "").trim();
            if (!name) continue;
            const key = normalizeEngine(name);
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(name);
        }
        if (unique.length === 0) {
            page.removeAttribute(FILTER_ATTR);
        } else {
            page.setAttribute(FILTER_ATTR, JSON.stringify(unique));
        }
        syncRowHighlights(unique);
        applyFilter(unique);
        window.dispatchEvent(new CustomEvent("lg-results-layout-changed"));
    }

    function engineNameFromRow(row) {
        return row.querySelector(".engine-stat-label")?.textContent?.trim() || "";
    }

    function onRowActivate(row) {
        const name = engineNameFromRow(row);
        if (!name) return;
        const selected = getSelectedEngines();
        const key = normalizeEngine(name);
        const index = selected.findIndex(engine => normalizeEngine(engine) === key);
        if (index >= 0) {
            selected.splice(index, 1);
        } else {
            selected.push(name);
        }
        setSelectedEngines(selected);
    }

    function decorateRows() {
        for (const root of enginePanelRoots()) {
            root.querySelectorAll(".engine-stat-row").forEach(row => {
                row.classList.add("lg-engine-stat-row--filterable");
                if (!row.hasAttribute("role")) row.setAttribute("role", "button");
                if (!row.hasAttribute("tabindex")) row.setAttribute("tabindex", "0");
                if (!row.hasAttribute("aria-pressed")) row.setAttribute("aria-pressed", "false");
            });
        }
    }

    function rowInEnginePanel(row) {
        return enginePanelRoots().some(root => root.contains(row));
    }

    const observedEngineRoots = new WeakSet();

    function ensureRootObserved(root) {
        if (!root || observedEngineRoots.has(root)) return;
        observedEngineRoots.add(root);
        new MutationObserver(() => {
            decorateRows();
            syncRowHighlights(getSelectedEngines());
        }).observe(root, { childList: true, subtree: true });
    }

    function refreshEnginePanels() {
        for (const root of enginePanelRoots()) {
            ensureRootObserved(root);
        }
        decorateRows();
        syncRowHighlights(getSelectedEngines());
    }

    function nodeAddsEnginePanel(node) {
        if (!node || node.nodeType !== 1) return false;
        return (
            node.id === "image-engine-panel" ||
            node.id === "image-filters-bar" ||
            !!node.querySelector?.("#image-engine-panel, .engine-stat-row")
        );
    }

    function observeEnginePanelMount() {
        const layout = document.getElementById("results-layout");
        const target = layout || document.documentElement;
        new MutationObserver(mutations => {
            const added = mutations.some(mutation =>
                [...mutation.addedNodes].some(nodeAddsEnginePanel),
            );
            if (added) refreshEnginePanels();
        }).observe(target, { childList: true, subtree: true });
    }

    function bindEnginePanelDelegation() {
        const page = getPage();
        if (!page || page.dataset.lgEngineFilterClick === "1") return;
        page.dataset.lgEngineFilterClick = "1";
        page.addEventListener("click", onClick);
        page.addEventListener("keydown", onKeydown);
    }

    function clearFilter() {
        resetSourceEngineLearner();
        setSelectedEngines([]);
    }

    function scheduleApply() {
        const engines = getSelectedEngines();
        if (!engines.length) return;
        requestAnimationFrame(() => applyFilter(engines));
    }

    function onClick(event) {
        const target = event.target;
        if (!target?.closest) return;
        if (target.closest(".engine-retry-link")) return;
        const row = target.closest(".engine-stat-row");
        if (!row || !rowInEnginePanel(row)) return;
        event.preventDefault();
        event.stopPropagation();
        onRowActivate(row);
    }

    function onKeydown(event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        const row = event.target.closest?.(".engine-stat-row");
        if (!row || !rowInEnginePanel(row)) return;
        event.preventDefault();
        onRowActivate(row);
    }

    function init() {
        if (!getPage()) return;

        bindEnginePanelDelegation();

        const resultsList = getResultsList();
        if (resultsList) {
            new MutationObserver(mutations => {
                const started = mutationsStartSearch(mutations, { includeImageGrid: true });
                if (started) clearFilter();
                decorateRows();
                scheduleApply();
            }).observe(resultsList, { childList: true, subtree: true });
        }

        refreshEnginePanels();
        observeEnginePanelMount();

        getResultsSearchButton()?.addEventListener("click", clearFilter);
        getResultsSearchInput()?.addEventListener("keydown", event => {
            if (event.key === "Enter") clearFilter();
        });

        window.addEventListener("degoog-results-ready", () => {
            decorateRows();
            scheduleApply();
        });

        decorateRows();
    }

    onReady(init);
})();

/* ── 5d. Results sidebar scroll — don't cancel document momentum on hover ─ */
(() => {
    const ACTIVE_CLASS = "lg-sidebar-scroll-active";
    const SCROLL_TARGETS = "#sidebar-col > .sticky";
    const wired = new WeakSet();

    function canScroll(el) {
        return el.scrollHeight > el.clientHeight + 1;
    }

    function atScrollEdge(el, deltaY) {
        if (deltaY < 0) return el.scrollTop <= 0;
        if (deltaY > 0) {
            return el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
        }
        return true;
    }

    function bindScrollTarget(el) {
        if (!el || wired.has(el)) return;
        wired.add(el);

        el.addEventListener("pointerleave", () => {
            el.classList.remove(ACTIVE_CLASS);
        });

        el.addEventListener(
            "wheel",
            event => {
                if (!canScroll(el)) return;

                const { deltaY } = event;
                const active = el.classList.contains(ACTIVE_CLASS);

                if (!active) {
                    if (atScrollEdge(el, deltaY)) return;
                    el.classList.add(ACTIVE_CLASS);
                    event.preventDefault();
                    el.scrollTop += deltaY;
                    return;
                }

                if (atScrollEdge(el, deltaY)) {
                    el.classList.remove(ACTIVE_CLASS);
                    return;
                }
            },
            { passive: false },
        );
    }

    function scan() {
        document.querySelectorAll(SCROLL_TARGETS).forEach(bindScrollTarget);
    }

    function init() {
        scan();
        const page = getResultsPage();
        if (!page) return;
        new MutationObserver(scan).observe(page, { childList: true, subtree: true });
    }

    onReady(init);
})();

/* ── 6. Immediate search-type state for theme layout ───────────────────── */
(() => {
    const TYPE_ATTR = "data-lg-search-type";
    let observedTabs = null;

    function getRoot() {
        return getResultsPage();
    }

    function normalizeType(type) {
        if (!type) return "web";
        if (type.startsWith("tab:engine:")) return type.slice(11);
        if (type.startsWith("engine:")) return type.slice(7);
        if (type.startsWith("tab:")) return type.slice(4);
        return type;
    }

    function getTypeFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get("type") || "web";
    }

    function setSearchType(type) {
        const root = getRoot();
        if (!root) return;
        root.setAttribute(TYPE_ATTR, normalizeType(type));
    }

    function syncSearchType() {
        const root = getRoot();
        const prev = root?.getAttribute(TYPE_ATTR) || "";
        setSearchType(getActiveResultsTab()?.dataset.type || getTypeFromUrl());
        const next = root?.getAttribute(TYPE_ATTR) || "";
        if (prev !== next) {
            window.dispatchEvent(new Event("lg-sync-search-type"));
        }
    }

    function bindTabsClick() {
        const tabs = getResultsTabs();
        if (!tabs || tabs === observedTabs) return;
        observedTabs = tabs;

        tabs.addEventListener(
            "click",
            event => {
                const target = event.target;
                if (!target || typeof target.closest !== "function") return;
                const tab = target.closest(".results-tab[data-type]");
                if (!tab || !tabs.contains(tab)) return;
                setSearchType(tab.dataset.type || "web");
            },
            true,
        );

        new MutationObserver(syncSearchType).observe(tabs, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class", "aria-selected"],
        });
    }

    function init() {
        bindTabsClick();
        new MutationObserver(() => {
            bindTabsClick();
            syncSearchType();
        }).observe(document.documentElement, {
            childList: true,
            subtree: true,
        });
        window.addEventListener("popstate", () => {
            window.requestAnimationFrame(syncSearchType);
        });
        syncSearchType();
    }

    onReady(init);
})();

/* ── 7. Sidebar accordion panels (theme settings) ──────────────────────── */
(() => {
    const ENGINE_MODE_MOBILE = "data-sidebar-panels-mobile";
    const ENGINE_MODE_DESKTOP = "data-sidebar-panels-desktop";
    const ENGINE_MODE_IMAGES_MOBILE = "data-sidebar-panels-images-mobile";
    const ENGINE_MODE_IMAGES_DESKTOP = "data-sidebar-panels-images-desktop";
    const RELATED_MODE_MOBILE = "data-related-searches-mobile";
    const RELATED_MODE_DESKTOP = "data-related-searches-desktop";
    const KNOWLEDGE_MODE_MOBILE = "data-knowledge-panel-mobile";
    const KNOWLEDGE_MODE_DESKTOP = "data-knowledge-panel-desktop";
    const DESKTOP_MIN = 768;
    const SEARCHING_ATTR = "data-lg-sidebar-searching";
    const USER_ATTR_ENGINE = "data-lg-sidebar-user-engine";
    const USER_ATTR_RELATED = "data-lg-sidebar-user-related";
    const USER_ATTR_KNOWLEDGE = "data-lg-sidebar-user-knowledge";
    let lastIsDesktop = null;

    function isDesktop() {
        return window.innerWidth >= DESKTOP_MIN;
    }

    function sidebarRoots() {
        return [
            document.getElementById("results-sidebar"),
            document.getElementById("image-engine-panel"),
        ].filter(Boolean);
    }

    function isThemeEnabled() {
        const root = document.documentElement;
        return (
            root.hasAttribute(ENGINE_MODE_MOBILE) ||
            root.hasAttribute(ENGINE_MODE_DESKTOP) ||
            root.hasAttribute(ENGINE_MODE_IMAGES_MOBILE) ||
            root.hasAttribute(ENGINE_MODE_IMAGES_DESKTOP) ||
            root.hasAttribute(RELATED_MODE_MOBILE) ||
            root.hasAttribute(RELATED_MODE_DESKTOP) ||
            root.hasAttribute(KNOWLEDGE_MODE_MOBILE) ||
            root.hasAttribute(KNOWLEDGE_MODE_DESKTOP)
        );
    }

    function isEnginePerformancePanel(accordion) {
        if (!accordion?.classList) return false;
        return (
            accordion.classList.contains("streaming-engine-panel") ||
            !!accordion.querySelector(".engine-stat-row")
        );
    }

    function isRelatedSearchesPanel(accordion) {
        if (!accordion || isEnginePerformancePanel(accordion)) return false;
        return !!accordion.querySelector(".related-search-link");
    }

    function getEnginePerformancePanels(root) {
        return [...root.querySelectorAll(".sidebar-accordion")].filter(isEnginePerformancePanel);
    }

    function getRelatedSearchesPanels(root) {
        return [...root.querySelectorAll(".sidebar-accordion")].filter(isRelatedSearchesPanel);
    }

    function isKnowledgePanel(accordion) {
        if (
            !accordion ||
            isEnginePerformancePanel(accordion) ||
            isRelatedSearchesPanel(accordion)
        ) {
            return false;
        }
        return !!accordion.querySelector(
            ".kp-title, .kp-description, .kp-image, .wiki-card",
        );
    }

    function getKnowledgePanels(root) {
        return [...root.querySelectorAll(".sidebar-accordion")].filter(isKnowledgePanel);
    }

    function syncKnowledgeAccordion(accordion) {
        if (!accordion.classList.contains("lg-sidebar-knowledge")) {
            accordion.classList.add("lg-sidebar-knowledge");
        }
        if (accordion.hasAttribute(USER_ATTR_KNOWLEDGE)) return;
        const shouldBeOpen = getKnowledgeMode() === "open";
        if (accordion.classList.contains("open") !== shouldBeOpen) {
            accordion.classList.toggle("open", shouldBeOpen);
        }
    }

    function normalizeEngineMode(raw) {
        if (raw === "open" || raw === "collapsed" || raw === "collapse-on-complete") {
            return raw;
        }
        return "collapsed";
    }

    function isImageEngineRoot(root) {
        return root?.id === "image-engine-panel";
    }

    function getEngineMode(root) {
        if (isImageEngineRoot(root)) {
            const attr = isDesktop() ? ENGINE_MODE_IMAGES_DESKTOP : ENGINE_MODE_IMAGES_MOBILE;
            return normalizeEngineMode(document.documentElement.getAttribute(attr) || "open");
        }
        const attr = isDesktop() ? ENGINE_MODE_DESKTOP : ENGINE_MODE_MOBILE;
        return normalizeEngineMode(
            document.documentElement.getAttribute(attr) || "collapse-on-complete",
        );
    }

    function getRelatedMode() {
        const attr = isDesktop() ? RELATED_MODE_DESKTOP : RELATED_MODE_MOBILE;
        const fallback = isDesktop() ? "open" : "collapsed";
        const raw = document.documentElement.getAttribute(attr) || fallback;
        return raw === "open" ? "open" : "collapsed";
    }

    function getKnowledgeMode() {
        const attr = isDesktop() ? KNOWLEDGE_MODE_DESKTOP : KNOWLEDGE_MODE_MOBILE;
        const fallback = isDesktop() ? "open" : "collapsed";
        const raw = document.documentElement.getAttribute(attr) || fallback;
        return raw === "open" ? "open" : "collapsed";
    }

    function getMetaText() {
        const meta = getResultsMeta();
        return meta ? meta.textContent || "" : "";
    }

    function isMetaStreaming(text) {
        return SEARCH_ACTIVITY_TEXT.streamingPattern.test(text);
    }

    function isMetaSearching(text) {
        return SEARCH_ACTIVITY_TEXT.searchingPattern.test(text.trim());
    }

    function isMetaComplete(text) {
        if (!text.trim() || isMetaStreaming(text) || isMetaSearching(text)) {
            return false;
        }
        return (
            SEARCH_ACTIVITY_TEXT.completePattern.test(text) &&
            SEARCH_ACTIVITY_TEXT.completeTimePattern.test(text)
        );
    }

    function isSearching() {
        if (document.documentElement.hasAttribute(SEARCHING_ATTR)) return true;
        return isMetaStreaming(getMetaText());
    }

    function sidebarMutationHasRelated(nodes) {
        return nodes.some(
            node =>
                node.nodeType === 1 &&
                (node.classList?.contains("related-search-link") ||
                    !!node.querySelector?.(".related-search-link")),
        );
    }

    function shouldEngineBeOpen(mode, searching) {
        if (mode === "open") return true;
        if (mode === "collapsed") return false;
        if (mode === "collapse-on-complete") return searching;
        return false;
    }

    function syncEngineAccordion(accordion, root) {
        if (accordion.hasAttribute(USER_ATTR_ENGINE)) return;
        const shouldBeOpen = shouldEngineBeOpen(getEngineMode(root), isSearching());
        if (accordion.classList.contains("open") !== shouldBeOpen) {
            accordion.classList.toggle("open", shouldBeOpen);
        }
    }

    function syncRelatedAccordion(accordion) {
        if (accordion.hasAttribute(USER_ATTR_RELATED)) return;
        const shouldBeOpen = getRelatedMode() === "open";
        if (accordion.classList.contains("open") !== shouldBeOpen) {
            accordion.classList.toggle("open", shouldBeOpen);
        }
    }

    function syncAll() {
        if (!isThemeEnabled()) return;
        const roots = sidebarRoots();
        if (roots.length === 0) return;
        roots.forEach(root => {
            getEnginePerformancePanels(root).forEach(accordion =>
                syncEngineAccordion(accordion, root),
            );
            getRelatedSearchesPanels(root).forEach(syncRelatedAccordion);
            getKnowledgePanels(root).forEach(syncKnowledgeAccordion);
        });
    }

    function bindRoots() {
        sidebarRoots().forEach(bindSidebar);
    }

    function scheduleSync() {
        window.requestAnimationFrame(() => {
            bindRoots();
            window.requestAnimationFrame(syncAll);
        });
        window.setTimeout(() => {
            bindRoots();
            syncAll();
        }, 0);
    }

    function markSearching() {
        document.documentElement.setAttribute(SEARCHING_ATTR, "1");
        scheduleSync();
    }

    function markComplete() {
        document.documentElement.removeAttribute(SEARCHING_ATTR);
        scheduleSync();
    }

    function clearUserOverrides() {
        sidebarRoots().forEach(root => {
            getEnginePerformancePanels(root).forEach(accordion => {
                accordion.removeAttribute(USER_ATTR_ENGINE);
            });
            getRelatedSearchesPanels(root).forEach(accordion => {
                accordion.removeAttribute(USER_ATTR_RELATED);
            });
            getKnowledgePanels(root).forEach(accordion => {
                accordion.removeAttribute(USER_ATTR_KNOWLEDGE);
            });
        });
    }

    function onSearchStart() {
        clearUserOverrides();
        markSearching();
    }

    function bindSidebar(root) {
        if (!root || root.hasAttribute("data-lg-sidebar-bound")) return;
        root.setAttribute("data-lg-sidebar-bound", "1");

        root.addEventListener(
            "click",
            event => {
                const target = event.target;
                if (!target || typeof target.closest !== "function") return;
                const toggle = target.closest(".sidebar-accordion-toggle");
                if (!toggle || !root.contains(toggle)) return;
                const accordion = toggle.closest(".sidebar-accordion");
                if (!accordion) return;
                if (isEnginePerformancePanel(accordion)) {
                    accordion.setAttribute(USER_ATTR_ENGINE, "1");
                } else if (isRelatedSearchesPanel(accordion)) {
                    accordion.setAttribute(USER_ATTR_RELATED, "1");
                } else if (isKnowledgePanel(accordion)) {
                    accordion.setAttribute(USER_ATTR_KNOWLEDGE, "1");
                }
            },
            true,
        );

        new MutationObserver(mutations => {
            const relatedAdded = mutations.some(mutation =>
                sidebarMutationHasRelated([...mutation.addedNodes]),
            );
            scheduleSync();
            if (relatedAdded && getRelatedMode() === "open") {
                window.setTimeout(syncAll, 0);
                window.setTimeout(syncAll, 50);
            }
        }).observe(root, {
            childList: true,
            subtree: true,
        });
    }

    function observeSearchLifecycle() {
        const resultsList = getResultsList();
        if (resultsList) {
            new MutationObserver(mutations => {
                const started = mutationsStartSearch(mutations);
                if (started) onSearchStart();
            }).observe(resultsList, { childList: true, subtree: true });
        }

        const meta = getResultsMeta();
        if (meta) {
            new MutationObserver(() => {
                const text = getMetaText();
                if (isMetaStreaming(text) || isMetaSearching(text)) {
                    markSearching();
                } else if (isMetaComplete(text)) {
                    markComplete();
                }
            }).observe(meta, { childList: true, characterData: true, subtree: true });
        }

        window.addEventListener("degoog-results-ready", markComplete);

        getResultsSearchButton()?.addEventListener("click", onSearchStart);
        getResultsSearchInput()?.addEventListener("keydown", event => {
            if (event.key === "Enter") onSearchStart();
        });
    }

    function init() {
        if (!isThemeEnabled()) return;
        lastIsDesktop = isDesktop();
        bindRoots();
        new MutationObserver(mutations => {
            const shouldRebind = mutations.some(mutation =>
                [...mutation.addedNodes].some(
                    node =>
                        node.nodeType === 1 &&
                        (node.id === "results-sidebar" ||
                            node.id === "image-engine-panel" ||
                            !!node.querySelector?.(
                                "#results-sidebar, #image-engine-panel",
                            )),
                ),
            );
            if (shouldRebind) scheduleSync();
        }).observe(document.documentElement, {
            childList: true,
            subtree: true,
        });
        observeSearchLifecycle();
        window.addEventListener("resize", () => {
            const nowDesktop = isDesktop();
            if (nowDesktop === lastIsDesktop) return;
            lastIsDesktop = nowDesktop;
            clearUserOverrides();
            scheduleSync();
        });
        scheduleSync();
    }

    onReady(init);
})();

/* ── 8. Translate settings gear title ───────────────────────────────────── */
(() => {
    function translateSettingsGear() {
        const settingsEl = document.getElementById("nav-settings-results");
        if (settingsEl) {
            settingsEl.setAttribute("title", getLgTranslation("settings"));
        }
    }
    onReady(translateSettingsGear);
})();
