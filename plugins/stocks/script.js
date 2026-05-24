(function () {
  const PERIOD_LABELS = {
    "1d": "1D",
    "5d": "5D",
    "1mo": "1M",
    "6mo": "6M",
    ytd: "YTD",
    max: "Max",
  };
  const PLUGIN_API_BASE =
    typeof __PLUGIN_ID__ === "undefined"
      ? ""
      : `/api/plugin/${encodeURIComponent(__PLUGIN_ID__)}`;
  const chartCache = new Map();
  const chartInFlight = new Map();

  function chartKey(symbol, period) {
    return `${symbol}|${period}`;
  }

  function chartUrl(symbol, period) {
    const params = new URLSearchParams({ symbol, period });
    return `${PLUGIN_API_BASE}/chart?${params.toString()}`;
  }

  function formatPrice(value, priceHint) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    const hint = Number(priceHint);
    const decimals = Number.isFinite(hint)
      ? Math.max(0, Math.min(6, hint))
      : Math.abs(number) < 1
        ? 4
        : Math.abs(number) < 10
          ? 3
          : 2;
    return number.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function fetchChart(symbol, period) {
    const key = chartKey(symbol, period);
    if (chartCache.has(key)) return chartCache.get(key);
    if (chartInFlight.has(key)) return chartInFlight.get(key);

    const request = (async () => {
      const response = await fetch(chartUrl(symbol, period));
      if (!response.ok) return null;
      const payload = await response.json();
      if (!payload?.ok || !Array.isArray(payload.points)) return null;
      chartCache.set(key, payload);
      return payload;
    })();

    chartInFlight.set(key, request);
    try {
      return await request;
    } catch {
      return null;
    } finally {
      chartInFlight.delete(key);
    }
  }

  function setActivePeriod(chart, period) {
    chart.querySelectorAll(".stocks-period").forEach((button) => {
      const active = button.dataset.period === period;
      button.classList.toggle("stocks-period--active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function setLoading(body, stats, period) {
    if (body) {
      body.innerHTML = `<div class="stocks-chart-loading">Loading ${escapeHtml(
        PERIOD_LABELS[period] || period,
      )}</div>`;
    }
    if (stats) stats.textContent = "";
  }

  function setEmpty(body, stats) {
    if (body) {
      body.innerHTML = '<div class="stocks-sparkline-empty">No chart data</div>';
    }
    if (stats) stats.textContent = "";
  }

  function updateTrendClass(card, change) {
    card.classList.remove("stocks-card-up", "stocks-card-down", "stocks-card-flat");
    if (change > 0) card.classList.add("stocks-card-up");
    else if (change < 0) card.classList.add("stocks-card-down");
    else card.classList.add("stocks-card-flat");
  }

  function renderChart(card, body, stats, payload) {
    const points = payload.points
      .map((point) => ({
        price: Number(point.price),
        time: Number(point.time || 0),
      }))
      .filter((point) => Number.isFinite(point.price));

    if (!body || points.length < 2) {
      setEmpty(body, stats);
      return;
    }

    const prices = points.map((point) => point.price);
    const first = prices[0];
    const last = prices[prices.length - 1];
    const low = Math.min(...prices);
    const high = Math.max(...prices);
    const change = last - first;
    const changePercent = first ? (change / first) * 100 : 0;
    updateTrendClass(card, change);

    const width = 320;
    const height = 96;
    const padX = 8;
    const padY = 10;
    const span = high - low || Math.max(Math.abs(high), 1) * 0.01;
    const step = (width - padX * 2) / (points.length - 1);
    const coords = points.map((point, index) => {
      const x = padX + index * step;
      const y = height - padY - ((point.price - low) / span) * (height - padY * 2);
      return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
    });
    const path = coords
      .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
      .join(" ");
    const area = `${path} L ${coords[coords.length - 1][0]} ${height - padY} L ${coords[0][0]} ${height - padY} Z`;
    const lastPoint = coords[coords.length - 1];
    const label = escapeHtml(payload.label || PERIOD_LABELS[payload.period] || "");

    body.innerHTML = `
      <svg class="stocks-sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${label} price chart">
        <path class="stocks-sparkline-area" d="${area}"></path>
        <path class="stocks-sparkline-line" d="${path}"></path>
        <circle class="stocks-sparkline-dot" cx="${lastPoint[0]}" cy="${lastPoint[1]}" r="3"></circle>
        <text class="stocks-sparkline-label" x="${width - padX}" y="13" text-anchor="end">${label}</text>
      </svg>
    `;

    if (stats) {
      const priceHint = payload.priceHint;
      const sign = change >= 0 ? "+" : "";
      const trendClass =
        change >= 0 ? "stocks-chart-stat-value--up" : "stocks-chart-stat-value--down";
      stats.innerHTML = `
        <div class="stocks-chart-stat">
          <span class="stocks-chart-stat-label">Low</span>
          <span class="stocks-chart-stat-value">${escapeHtml(formatPrice(low, priceHint))}</span>
        </div>
        <div class="stocks-chart-stat">
          <span class="stocks-chart-stat-label">High</span>
          <span class="stocks-chart-stat-value">${escapeHtml(formatPrice(high, priceHint))}</span>
        </div>
        <div class="stocks-chart-stat">
          <span class="stocks-chart-stat-label">Last</span>
          <span class="stocks-chart-stat-value">${escapeHtml(formatPrice(last, priceHint))}</span>
        </div>
        <div class="stocks-chart-stat">
          <span class="stocks-chart-stat-label">Change</span>
          <span class="stocks-chart-stat-value ${trendClass}">${sign}${changePercent.toFixed(2)}%</span>
        </div>
      `;
    }
  }

  function initCard(card) {
    if (card.dataset.stocksChartInit) return;
    card.dataset.stocksChartInit = "1";

    const chart = card.querySelector(".stocks-chart");
    const body = card.querySelector(".stocks-chart-body");
    const stats = card.querySelector(".stocks-chart-stats");
    const symbol = chart?.dataset.symbol || card.dataset.symbol || "";
    if (!chart || !body || !symbol || !PLUGIN_API_BASE) return;

    chart.querySelectorAll(".stocks-period").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        button.classList.contains("stocks-period--active") ? "true" : "false",
      );
      button.addEventListener("click", async () => {
        const period = button.dataset.period || "1d";
        setActivePeriod(chart, period);
        setLoading(body, stats, period);
        const payload = await fetchChart(symbol, period);
        if (!payload) {
          setEmpty(body, stats);
          return;
        }
        renderChart(card, body, stats, payload);
      });
    });
  }

  function scan() {
    document
      .querySelectorAll(".stocks-card:not([data-stocks-chart-init])")
      .forEach(initCard);
  }

  function start() {
    scan();
    new MutationObserver(scan).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
