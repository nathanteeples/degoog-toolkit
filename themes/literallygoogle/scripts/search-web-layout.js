/* ── 5e. Web results layout: fluid sidebar, then fluid main ─────────────── */
(() => {
    const MAIN_MIN_PX = 450;
    const STACK_ENTER_PX = 480;
    const STACK_EXIT_PX = 520;
    const SINGLE_CLASS = "lg-results-layout-single";
    const DESKTOP_MIN = 768;
    const SIDEBAR_MAX_REM = 20;
    const SIDEBAR_MIN_REM = 16;
    const MAIN_MAX_REM = 48;
    const COLUMN_GAP_REM = 2;
    const SCROLLBAR_REM = 0.75;
    let frame = 0;
    let wasSingleColumn = false;

    function isWebResultsPage(page) {
        if (!page || window.innerWidth < DESKTOP_MIN) return false;
        const type = (page.getAttribute("data-lg-search-type") || "web").toLowerCase();
        if (type === "images" || type === "videos") return false;
        if (page.classList.contains("lg-command-mode")) return false;
        if (page.querySelector("#results-list .command-result, #results-list .command-help-table")) {
            return false;
        }
        return true;
    }

    function remPx() {
        return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    }

    function clearFluidLayoutVars(page) {
        page.style.removeProperty("--literallygoogle-results-sidebar-max");
        page.style.removeProperty("--literallygoogle-results-main-col-max");
        page.style.removeProperty("--literallygoogle-results-sidebar-col");
        page.style.removeProperty("--lg-results-grid-columns");
    }

    function resetSingleColumnGridState(page, layout, { entering }) {
        const sidebar = document.getElementById("sidebar-col");
        const main = document.getElementById("results-main");
        if (layout) {
            layout.style.removeProperty("grid-template-columns");
        }
        if (main) {
            main.style.removeProperty("grid-column");
        }
        if (sidebar) {
            sidebar.style.removeProperty("grid-column");
            sidebar.style.removeProperty("grid-row");
            if (entering) {
                sidebar.classList.remove("lg-sidebar-is-stuck", "lg-sidebar-scroll-active");
            }
        }
        if (entering) {
            page?.classList.remove("lg-results-sidebar-compact");
        }
    }

    function targetGridInnerWidth(layout) {
        const px = remPx();
        const style = getComputedStyle(layout);
        const padStart = parseFloat(style.paddingInlineStart) || parseFloat(style.paddingLeft) || 0;
        const padEnd = parseFloat(style.paddingInlineEnd) || parseFloat(style.paddingRight) || 0;
        const rect = layout.getBoundingClientRect();
        const outerMax = Math.min(
            76 * px + padStart + padEnd,
            Math.max(0, window.innerWidth - rect.left - padEnd),
        );
        return Math.max(0, outerMax - padStart - padEnd);
    }

    function computeFluidColumns(innerWidth) {
        const px = remPx();
        const sidebarMax = SIDEBAR_MAX_REM * px;
        const sidebarMin = SIDEBAR_MIN_REM * px;
        const mainMax = MAIN_MAX_REM * px;
        const gap = COLUMN_GAP_REM * px;
        const scrollbar = SCROLLBAR_REM * px;

        const fullNeeded = mainMax + gap + sidebarMax + scrollbar;
        let sidebarPanel = sidebarMax;
        let mainCol = mainMax;

        if (innerWidth < fullNeeded) {
            const sidebarPanelIfMainFull = innerWidth - mainMax - gap - scrollbar;
            if (sidebarPanelIfMainFull >= sidebarMin) {
                sidebarPanel = Math.min(sidebarMax, sidebarPanelIfMainFull);
                mainCol = mainMax;
            } else {
                sidebarPanel = sidebarMin;
                mainCol = Math.max(0, innerWidth - gap - sidebarMin - scrollbar);
            }
        }

        return { sidebarPanel, mainCol };
    }

    function applyFluidLayout(page, { sidebarPanel, mainCol }) {
        const px = remPx();
        const sidebarRem = sidebarPanel / px;
        const mainRem = mainCol / px;
        const sidebarColRem = sidebarRem + SCROLLBAR_REM;
        page.style.setProperty("--literallygoogle-results-sidebar-max", `${sidebarRem}rem`);
        page.style.setProperty("--literallygoogle-results-main-col-max", `${mainRem}rem`);
        page.style.setProperty(
            "--literallygoogle-results-sidebar-col",
            `calc(${sidebarRem}rem + var(--lg-sidebar-scrollbar-size))`,
        );
        page.style.setProperty("--lg-results-grid-columns", `${mainRem}rem ${sidebarColRem}rem`);
    }

    function sync() {
        frame = 0;
        const page = getResultsPage();
        const layout = getResultsLayout();
        if (!page || !layout) return;

        if (!isWebResultsPage(page)) {
            page.classList.remove(SINGLE_CLASS);
            clearFluidLayoutVars(page);
            if (wasSingleColumn) {
                wasSingleColumn = false;
                window.dispatchEvent(new Event("lg-results-layout-changed"));
            }
            window.dispatchEvent(new Event("lg-sync-sidebar-row"));
            return;
        }

        const innerWidth = targetGridInnerWidth(layout);
        const { sidebarPanel, mainCol } = computeFluidColumns(innerWidth);
        const isSingle = page.classList.contains(SINGLE_CLASS);
        const stackThreshold = isSingle ? STACK_EXIT_PX : STACK_ENTER_PX;

        if (mainCol > 0 && mainCol < stackThreshold) {
            page.classList.add(SINGLE_CLASS);
            clearFluidLayoutVars(page);
            resetSingleColumnGridState(page, layout, { entering: true });
        } else {
            const exiting = page.classList.contains(SINGLE_CLASS);
            page.classList.remove(SINGLE_CLASS);
            applyFluidLayout(page, { sidebarPanel, mainCol });
            if (exiting) {
                resetSingleColumnGridState(page, layout, { entering: false });
            }
        }

        const isSingleColumn = page.classList.contains(SINGLE_CLASS);
        if (isSingleColumn !== wasSingleColumn) {
            wasSingleColumn = isSingleColumn;
            window.dispatchEvent(new Event("lg-results-layout-changed"));
        }

        window.dispatchEvent(new Event("lg-sync-sidebar-row"));
    }

    function schedule() {
        if (frame) return;
        frame = requestAnimationFrame(sync);
    }

    function init() {
        // Two RAFs so we don't smush on first paint.
        requestAnimationFrame(() => requestAnimationFrame(schedule));
        window.addEventListener("resize", schedule, { passive: true });
        window.addEventListener("scroll", schedule, { passive: true });
        const page = getResultsPage();
        if (!page) return;
        new MutationObserver(schedule).observe(page, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class", "data-lg-search-type", "hidden"],
        });
        const tabs = getResultsTabs();
        if (tabs) {
            new MutationObserver(schedule).observe(tabs, {
                childList: true,
                subtree: true,
                attributes: true,
            });
        }
    }

    onReady(init);
})();