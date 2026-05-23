(function () {
  const UNIT_MS = {
    years: 365.2425 * 24 * 60 * 60 * 1000,
    months: 30.436875 * 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    hours: 60 * 60 * 1000,
    minutes: 60 * 1000,
    seconds: 1000,
  };

  const DETAIL_UNITS = [
    "years",
    "months",
    "weeks",
    "days",
    "hours",
    "minutes",
    "seconds",
  ];

  function init() {
    document.querySelectorAll("[data-until-card]").forEach(startCard);
  }

  function startCard(card) {
    if (card.__untilTimer) return;

    const update = () => updateCard(card);
    update();
    card.__untilTimer = window.setInterval(update, 1000);
  }

  function updateCard(card) {
    const targetMs = Date.parse(card.dataset.untilTarget || "");
    if (!Number.isFinite(targetMs)) return;

    const diffMs = targetMs - Date.now();
    const absMs = Math.abs(diffMs);
    const future = diffMs >= 0;
    const unit = card.dataset.untilUnit || "auto";
    const primary = formatPrimary(absMs, unit);

    card.classList.toggle("until-card--future", future);
    card.classList.toggle("until-card--past", !future);

    const valueEl = card.querySelector("[data-until-primary-value]");
    const unitEl = card.querySelector("[data-until-primary-unit]");
    const captionEl = card.querySelector("[data-until-caption]");

    if (valueEl) valueEl.textContent = primary.value;
    if (unitEl) unitEl.textContent = primary.unit;
    if (captionEl) captionEl.textContent = future ? "from now" : "ago";

    for (const detailUnit of DETAIL_UNITS) {
      const detailEl = card.querySelector(`[data-until-value="${detailUnit}"]`);
      if (!detailEl) continue;
      detailEl.textContent = formatDetailNumber(
        absMs / UNIT_MS[detailUnit],
        detailUnit,
      );
    }
  }

  function formatPrimary(absMs, unit) {
    if (!unit || unit === "auto") {
      return { value: formatDuration(absMs), unit: "" };
    }

    const raw = absMs / UNIT_MS[unit];
    return {
      value: formatUnitNumber(raw, unit),
      unit: plural(unit.slice(0, -1), raw),
    };
  }

  function formatDuration(absMs) {
    if (absMs < 1000) return "right now";

    let remaining = Math.floor(absMs / 1000);
    const days = Math.floor(remaining / 86400);
    remaining -= days * 86400;
    const hours = Math.floor(remaining / 3600);
    remaining -= hours * 3600;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining - minutes * 60;

    const parts = [];
    if (days) parts.push([days, "day"]);
    if (hours) parts.push([hours, "hour"]);
    if (minutes && parts.length < 2) parts.push([minutes, "minute"]);
    if (!parts.length || parts.length < 2) parts.push([seconds, "second"]);

    return parts
      .slice(0, 2)
      .map(([value, label]) => `${formatWhole(value)} ${plural(label, value)}`)
      .join(", ");
  }

  function formatUnitNumber(value, unit) {
    if (unit === "seconds") return formatWhole(Math.round(value));
    if (value >= 1000) return formatWhole(Math.round(value));
    if (value >= 100) return formatWhole(value);
    if (value >= 10) return formatDecimal(value, 1);
    return formatDecimal(value, 2);
  }

  function formatDetailNumber(value, unit) {
    if (unit === "years" || unit === "months" || unit === "weeks") {
      return formatDecimal(value, value >= 10 ? 1 : 2);
    }
    return formatWhole(Math.round(value));
  }

  function formatWhole(value) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(value);
  }

  function formatDecimal(value, digits) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: digits,
      minimumFractionDigits: value < 10 ? Math.min(1, digits) : 0,
    }).format(value);
  }

  function plural(label, value) {
    return Math.abs(value) === 1 ? label : `${label}s`;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  const observer = new MutationObserver(init);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
