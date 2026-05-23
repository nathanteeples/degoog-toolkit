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
  const DEFAULT_TOP_UNITS = 2;

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
    const topUnits = normalizeTopUnits(card.dataset.untilTopUnits);
    const primary = formatPrimary(absMs, unit, topUnits);

    card.classList.toggle("until-card--future", future);
    card.classList.toggle("until-card--past", !future);

    const answerEl = card.querySelector("[data-until-answer]");
    const captionEl = card.querySelector("[data-until-caption]");

    if (answerEl) answerEl.innerHTML = primary.html;
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

  function formatPrimary(absMs, unit, topUnits) {
    const parts = decomposeDuration(absMs, unit, topUnits);
    return { html: renderPrimaryHtml(parts) };
  }

  function renderPrimaryHtml(parts) {
    if (!parts.length) {
      return '<span class="until-card__now">right now</span>';
    }

    return parts
      .map((part, index) => {
        const level = Math.min(index, DETAIL_UNITS.length - 1);
        return `<span class="until-card__part until-card__part--${level}">
          <span class="until-card__part-value">${escapeHtml(formatWhole(part.value))}</span>
          <span class="until-card__part-unit">${escapeHtml(plural(part.unit.slice(0, -1), part.value))}</span>
        </span>`;
      })
      .join("");
  }

  function decomposeDuration(absMs, requestedUnit, count) {
    if (absMs < 1000) return [];

    const startIndex =
      requestedUnit && requestedUnit !== "auto"
        ? DETAIL_UNITS.indexOf(requestedUnit)
        : findAutoStartIndex(absMs);
    if (startIndex < 0) return [];

    const unitCount = Math.max(
      1,
      Math.min(count || DEFAULT_TOP_UNITS, DETAIL_UNITS.length - startIndex),
    );
    const units = DETAIL_UNITS.slice(startIndex, startIndex + unitCount);
    let remaining = absMs;
    const parts = [];

    for (const [index, durationUnit] of units.entries()) {
      const isLast = index === units.length - 1;
      const value =
        isLast && units.length > 1
          ? Math.ceil(remaining / UNIT_MS[durationUnit])
          : Math.floor(remaining / UNIT_MS[durationUnit]);
      parts.push({ unit: durationUnit, value });
      remaining -=
        Math.min(value, Math.floor(remaining / UNIT_MS[durationUnit])) *
        UNIT_MS[durationUnit];
    }

    normalizeDurationCarry(parts);

    const visible = parts.filter((part) => part.value > 0);
    return visible.length ? visible : parts.slice(0, 1);
  }

  function findAutoStartIndex(absMs) {
    const index = DETAIL_UNITS.findIndex((unit) => absMs >= UNIT_MS[unit]);
    return index === -1 ? DETAIL_UNITS.length - 1 : index;
  }

  function normalizeDurationCarry(parts) {
    for (let index = parts.length - 1; index > 0; index -= 1) {
      const current = parts[index];
      const previous = parts[index - 1];
      const ratio = Math.round(UNIT_MS[previous.unit] / UNIT_MS[current.unit]);
      if (!Number.isFinite(ratio) || ratio <= 1 || current.value < ratio) {
        continue;
      }

      previous.value += Math.floor(current.value / ratio);
      current.value %= ratio;
    }
  }

  function normalizeTopUnits(value) {
    const parsed = Number(value);
    if (
      Number.isInteger(parsed) &&
      parsed >= 1 &&
      parsed <= DETAIL_UNITS.length
    ) {
      return parsed;
    }
    return DEFAULT_TOP_UNITS;
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

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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
