/* ── 5d. Sticky panel scroll chaining (sidebar + image preview) ─────────── */
(() => {
    const SIDEBAR_ACTIVE_CLASS = "lg-sidebar-scroll-active";
    const SIDEBAR_STUCK_CLASS = "lg-sidebar-is-stuck";
    const PREVIEW_ACTIVE_CLASS = "lg-preview-scroll-active";
    const PREVIEW_STUCK_CLASS = "lg-preview-is-stuck";
    const SIDEBAR_TARGETS = "#sidebar-col.is-sticky";
    const wired = new WeakSet();
    let stuckFrame = 0;

    function stickyOffsetTop(el) {
        const parsed = Number.parseFloat(getComputedStyle(el).top);
        if (Number.isFinite(parsed)) return parsed;

        const root = getComputedStyle(document.documentElement);
        const fallback = Number.parseFloat(
            root.getPropertyValue("--literallygoogle-sticky-header-offset"),
        );
        return Number.isFinite(fallback) ? fallback : 0;
    }

    function isSidebarColStuck(sidebar) {
        if (!(sidebar instanceof HTMLElement) || !sidebar.classList.contains("is-sticky")) {
            return false;
        }
        if (
            window.matchMedia("(max-width: 767px)").matches ||
            getResultsPage()?.classList.contains("lg-results-layout-single")
        ) {
            return false;
        }
        if (getComputedStyle(sidebar).position !== "sticky") return false;
        return sidebar.getBoundingClientRect().top <= stickyOffsetTop(sidebar) + 1;
    }

    function isPreviewPanelStuck(panel) {
        if (!(panel instanceof HTMLElement) || !panel.classList.contains("open")) return false;
        if (panel.classList.contains("lg-preview-closing")) return false;
        if (window.matchMedia("(max-width: 767px)").matches) return false;
        if (getActiveSearchType() !== "images") return false;
        if (!getResultsLayout()?.classList.contains("media-mode")) return false;
        if (getComputedStyle(panel).position !== "sticky") return false;
        return panel.getBoundingClientRect().top <= stickyOffsetTop(panel) + 1;
    }

    function resetSidebarScroll(sidebar) {
        sidebar.classList.remove(SIDEBAR_ACTIVE_CLASS);
        sidebar.scrollTop = 0;
        const sticky = sidebar.querySelector(":scope > .sticky");
        if (sticky instanceof HTMLElement) sticky.scrollTop = 0;
    }

    function resetPreviewScroll(panel) {
        panel.classList.remove(PREVIEW_ACTIVE_CLASS);
        panel.scrollTop = 0;
    }

    function syncStuckStates() {
        stuckFrame = 0;

        const sidebar = document.getElementById("sidebar-col");
        if (sidebar instanceof HTMLElement) {
            const wasStuck = sidebar.classList.contains(SIDEBAR_STUCK_CLASS);
            const stuck = isSidebarColStuck(sidebar);
            sidebar.classList.toggle(SIDEBAR_STUCK_CLASS, stuck);

            if (stuck !== wasStuck) {
                resetSidebarScroll(sidebar);
                if (stuck) {
                    requestAnimationFrame(() => resetSidebarScroll(sidebar));
                }
            }
        }

        const preview = getMediaPreviewPanel();
        if (preview instanceof HTMLElement) {
            const wasStuck = preview.classList.contains(PREVIEW_STUCK_CLASS);
            const stuck = isPreviewPanelStuck(preview);
            preview.classList.toggle(PREVIEW_STUCK_CLASS, stuck);

            if (stuck !== wasStuck) {
                resetPreviewScroll(preview);
                if (stuck) {
                    requestAnimationFrame(() => resetPreviewScroll(preview));
                }
            }
        }
    }

    function scheduleStuckSync() {
        if (stuckFrame) return;
        stuckFrame = requestAnimationFrame(syncStuckStates);
    }

    function canScroll(el, stuckClass) {
        return el.classList.contains(stuckClass) && el.scrollHeight > el.clientHeight + 1;
    }

    function atScrollEdge(el, deltaY) {
        if (deltaY < 0) return el.scrollTop <= 0;
        if (deltaY > 0) {
            return el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
        }
        return true;
    }

    function bindScrollChaining(el, { stuckClass, activeClass }) {
        if (!el || wired.has(el)) return;
        wired.add(el);

        el.addEventListener("pointerleave", () => {
            el.classList.remove(activeClass);
        });

        el.addEventListener(
            "wheel",
            event => {
                if (!el.classList.contains(stuckClass) || !canScroll(el, stuckClass)) return;

                const { deltaY } = event;

                // At the top/bottom edge, allow normal page scroll chaining.
                if (atScrollEdge(el, deltaY)) {
                    el.classList.remove(activeClass);
                    return;
                }

                // Otherwise we take over so internal scroll doesn't cancel
                // page momentum and doesn't require moving the pointer.
                el.classList.add(activeClass);
                event.preventDefault();
                el.scrollTop += deltaY;
            },
            { passive: false },
        );
    }

    function scan() {
        document.querySelectorAll(SIDEBAR_TARGETS).forEach(el => {
            bindScrollChaining(el, {
                stuckClass: SIDEBAR_STUCK_CLASS,
                activeClass: SIDEBAR_ACTIVE_CLASS,
            });
        });

        const preview = getMediaPreviewPanel();
        if (preview) {
            bindScrollChaining(preview, {
                stuckClass: PREVIEW_STUCK_CLASS,
                activeClass: PREVIEW_ACTIVE_CLASS,
            });
        }

        scheduleStuckSync();
    }

    function init() {
        scan();
        const page = getResultsPage();
        if (!page) return;
        new MutationObserver(scan).observe(page, { childList: true, subtree: true });
        window.addEventListener("scroll", scheduleStuckSync, { passive: true });
        window.addEventListener("resize", scheduleStuckSync, { passive: true });

        const sidebar = document.getElementById("sidebar-col");
        if (sidebar) {
            new MutationObserver(scheduleStuckSync).observe(sidebar, {
                attributes: true,
                attributeFilter: ["class", "style"],
            });
        }

        const preview = getMediaPreviewPanel();
        if (preview) {
            new MutationObserver(scheduleStuckSync).observe(preview, {
                attributes: true,
                attributeFilter: ["class", "style"],
            });
        }
    }

    onReady(init);
})();