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

    function isDockedPreviewOpen() {
        const preview = getMediaPreviewPanel();
        if (!(preview instanceof HTMLElement) || !preview.classList.contains("open")) {
            return false;
        }
        if (!window.matchMedia("(min-width: 768px)").matches) return false;
        if (!getResultsLayout()?.classList.contains("media-mode")) return false;
        return getComputedStyle(preview).position === "sticky";
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

    function syncBaseGrid(grid) {
        const desiredBaseCols = baseColumnsForWidth(window.innerWidth);
        const currentBaseCols =
            Number.parseInt(grid.dataset.lgGridBaseCols, 10) || desiredBaseCols;

        if (currentBaseCols === desiredBaseCols) return desiredBaseCols;

        const columns = ensureColumnCount(grid, desiredBaseCols);
        showAllColumns(columns);
        const items = collectGridItems(grid);
        items.forEach((item, index) => {
            columns[index % columns.length].appendChild(item);
        });
        grid.dataset.lgGridBaseCols = String(desiredBaseCols);
        grid.dataset.lgVisibleCols = String(desiredBaseCols);
        return desiredBaseCols;
    }

    function applyFold(grid) {
        if (!grid?.isConnected || !grid.classList.contains("lg-image-grid-fold")) return;

        const baseCols = syncBaseGrid(grid);
        const available = measureWidth(grid);
        const dockedPreviewOpen = isDockedPreviewOpen();

        if (!dockedPreviewOpen) {
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

        if (cols !== visibleCols) {
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

    function scrollSelectedImageIntoView() {
        const selected = document.querySelector("#results-list .image-card.selected");
        if (!(selected instanceof HTMLElement)) return;

        const rect = selected.getBoundingClientRect();
        const rootStyles = getComputedStyle(document.documentElement);
        const stickyOffset =
            Number.parseFloat(
                rootStyles.getPropertyValue("--literallygoogle-sticky-header-offset"),
            ) || 0;
        const topBoundary = Math.max(0, stickyOffset);
        const bottomBoundary = window.innerHeight;

        if (rect.top < topBoundary) {
            window.scrollBy(0, rect.top - topBoundary);
            return;
        }

        if (rect.bottom > bottomBoundary) {
            window.scrollBy(0, rect.bottom - bottomBoundary);
            return;
        }

        selected.scrollIntoView({ block: "nearest", inline: "nearest" });
    }

    let scrollSelectedFrame = 0;
    function scheduleScrollToSelected() {
        if (!isDockedPreviewOpen()) return;
        if (!document.querySelector("#results-list .image-card.selected")) return;
        if (scrollSelectedFrame) return;
        scrollSelectedFrame = requestAnimationFrame(() => {
            scrollSelectedFrame = 0;
            requestAnimationFrame(() => {
                scrollSelectedImageIntoView();
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
            window.dispatchEvent(new CustomEvent("lg-results-layout-changed"));
            if (preview.classList.contains("open")) {
                scheduleFold();
                requestAnimationFrame(scrollSelectedImageIntoView);
            } else {
                document
                    .querySelectorAll("#results-list .image-grid.lg-image-grid-fold")
                    .forEach(resetGrid);
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
            window.dispatchEvent(new CustomEvent("lg-results-layout-changed"));
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