import chronoEn from "./vendor/chrono-node/dist/cjs/locales/en/index.js";

let template = "";

const chrono = chronoEn?.casual ? chronoEn : chronoEn.default || chronoEn;
const untilChrono = chrono.casual?.clone ? chrono.casual.clone() : chrono.casual;
const DEFAULT_TOP_UNITS = 2;
const MAX_TOP_UNITS = 7;
const settings = {
  topUnits: DEFAULT_TOP_UNITS,
};

if (untilChrono?.parsers) {
  untilChrono.parsers.push(createFixedHolidayParser());
}

const FALLBACK_TEMPLATE = `
<div class="until-card {{state_class}}" data-until-card data-until-target="{{target_iso}}" data-until-unit="{{requested_unit}}" data-until-top-units="{{top_units}}">
  <div class="until-card__panel">
    <div class="until-card__main">
      <div class="until-card__eyebrow">{{eyebrow}}</div>
      <div class="until-card__answer" aria-live="polite">
        <span class="until-card__value" data-until-primary-value>{{primary_value}}</span>
        <span class="until-card__unit" data-until-primary-unit>{{primary_unit}}</span>
      </div>
      <div class="until-card__caption" data-until-caption>{{primary_caption}}</div>
    </div>
    <dl class="until-card__details">
      {{details_html}}
    </dl>
  </div>
</div>`;

const USAGE_HTML = `
<div class="until-card until-card--usage">
  <div class="until-card__panel">
    <div class="until-card__main">
      <div class="until-card__eyebrow">Until</div>
      <div class="until-card__answer until-card__answer--small">Try a countdown query</div>
      <div class="until-card__caption">Examples: years until 2040, weeks until July 6th, 2033, !until hours 5pm</div>
    </div>
  </div>
</div>`;

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

const UNIT_ALIASES = new Map(
  [
    ["year", "years"],
    ["years", "years"],
    ["yr", "years"],
    ["yrs", "years"],
    ["month", "months"],
    ["months", "months"],
    ["mo", "months"],
    ["mos", "months"],
    ["week", "weeks"],
    ["weeks", "weeks"],
    ["wk", "weeks"],
    ["wks", "weeks"],
    ["day", "days"],
    ["days", "days"],
    ["d", "days"],
    ["hour", "hours"],
    ["hours", "hours"],
    ["hr", "hours"],
    ["hrs", "hours"],
    ["minute", "minutes"],
    ["minutes", "minutes"],
    ["min", "minutes"],
    ["mins", "minutes"],
    ["second", "seconds"],
    ["seconds", "seconds"],
    ["sec", "seconds"],
    ["secs", "seconds"],
  ].map(([alias, unit]) => [alias, unit]),
);

const UNIT_PATTERN = [
  "years?",
  "yrs?",
  "months?",
  "mos?",
  "weeks?",
  "wks?",
  "days?",
  "hours?",
  "hrs?",
  "minutes?",
  "mins?",
  "seconds?",
  "secs?",
].join("|");

const MONTHS = new Map([
  ["jan", 0],
  ["january", 0],
  ["feb", 1],
  ["february", 1],
  ["mar", 2],
  ["march", 2],
  ["apr", 3],
  ["april", 3],
  ["may", 4],
  ["jun", 5],
  ["june", 5],
  ["jul", 6],
  ["july", 6],
  ["aug", 7],
  ["august", 7],
  ["sep", 8],
  ["sept", 8],
  ["september", 8],
  ["oct", 9],
  ["october", 9],
  ["nov", 10],
  ["november", 10],
  ["dec", 11],
  ["december", 11],
]);

const MONTH_PATTERN = Array.from(MONTHS.keys())
  .sort((a, b) => b.length - a.length)
  .join("|");

export const command = {
  name: "Until",
  description:
    "Shows countdown answers for queries like !until days 2040 or !until weeks July 6th, 2033.",
  trigger: "until",
  aliases: ["countdown", "timeuntil"],
  settingsSchema: [
    {
      key: "topUnits",
      label: "Top display units",
      type: "select",
      options: ["1", "2", "3", "4", "5", "6", "7"],
      description:
        "How many duration units to show in the main answer. Default: 2.",
    },
  ],

  init(ctx) {
    template = ctx.template || FALLBACK_TEMPLATE;
  },

  configure: configureSettings,

  async execute(args) {
    const parsed = parseUntilQuery(args, { allowTargetOnly: true });
    if (!parsed) return { html: USAGE_HTML };
    return renderUntil(parsed, new Date());
  },
};

export const slot = {
  id: "until",
  name: "Until",
  description:
    "Shows countdown answers for natural queries like years until 2040, days until 2040, or weeks until July 6th, 2033.",
  position: "at-a-glance",
  slotPositions: ["at-a-glance", "above-results", "knowledge-panel"],

  init(ctx) {
    template = ctx.template || FALLBACK_TEMPLATE;
  },

  configure: configureSettings,

  trigger(query) {
    return Boolean(parseUntilQuery(query, { allowTargetOnly: false }));
  },

  async execute(query, context) {
    if (context?.tab && context.tab !== "all") return { html: "" };
    const parsed = parseUntilQuery(query, { allowTargetOnly: false });
    if (!parsed) return { html: "" };
    return renderUntil(parsed, new Date());
  },
};

export const slotPlugin = slot;
export default command;

function parseUntilQuery(input, options = {}) {
  const original = String(input || "").trim();
  if (!original) return null;

  const q = normalizeQuery(stripCommandPrefix(original));
  if (!q) return null;

  const patterns = [
    new RegExp(
      `^(?:please\\s+)?(?:how\\s+many\\s+)?(?<unit>${UNIT_PATTERN})\\s+(?:are\\s+there\\s+)?(?:until|till|til|to)\\s+(?<target>.+)$`,
      "i",
    ),
    /^(?:please\s+)?(?:how\s+long|time|countdown)\s+(?:until|till|til|to)\s+(?<target>.+)$/i,
    /^(?:please\s+)?(?:until|till|til)\s+(?<target>.+)$/i,
    /^(?:please\s+)?(?<target>.+?)\s+countdown$/i,
  ];

  for (const pattern of patterns) {
    const match = q.match(pattern);
    if (!match?.groups?.target) continue;
    return parseMatch(match.groups.target, match.groups.unit || "auto");
  }

  const unitFirst = q.match(
    new RegExp(`^(?<unit>${UNIT_PATTERN})\\s+(?<target>.+)$`, "i"),
  );
  if (unitFirst?.groups?.target) {
    return parseMatch(unitFirst.groups.target, unitFirst.groups.unit);
  }

  if (options.allowTargetOnly) return parseMatch(q, "auto");
  return null;
}

function configureSettings(saved = {}) {
  if (!Object.prototype.hasOwnProperty.call(saved, "topUnits")) return;

  const topUnits = Number(saved.topUnits);
  if (
    Number.isInteger(topUnits) &&
    topUnits >= 1 &&
    topUnits <= MAX_TOP_UNITS
  ) {
    settings.topUnits = topUnits;
  }
}

function parseMatch(targetText, unitText) {
  const now = new Date();
  const target = parseTargetDate(targetText, now);
  if (!target) return null;

  return {
    requestedUnit: normalizeUnit(unitText),
    target,
  };
}

function stripCommandPrefix(query) {
  return query.replace(/^!(?:until|countdown|timeuntil)\b\s*/i, "");
}

function normalizeQuery(query) {
  return String(query || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[?!.]+$/g, "")
    .trim();
}

function normalizeUnit(unit) {
  if (!unit || unit === "auto" || unit === "time") return "auto";
  return UNIT_ALIASES.get(String(unit).toLowerCase()) || "auto";
}

function parseTargetDate(input, now) {
  const raw = cleanTarget(input);
  if (!raw) return null;

  return (
    parseChronoTarget(raw, now) ||
    parseYearTarget(raw) ||
    parseNamedTarget(raw, now) ||
    parsePeriodBoundaryTarget(raw, now) ||
    parseIsoTarget(raw) ||
    parseMonthNameTarget(raw, now) ||
    parseNumericTarget(raw, now) ||
    parseExplicitDate(raw)
  );
}

function cleanTarget(input) {
  return String(input || "")
    .trim()
    .replace(/[?!.]+$/g, "")
    .replace(/\bfrom\s+now$/i, "")
    .replace(/^(?:on|the|by)\s+/i, "")
    .replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, "$1")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePeriodBoundaryTarget(raw, now) {
  const lower = raw.toLowerCase();

  if (lower === "eod" || lower === "end of day" || lower === "end of today") {
    return {
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
      precision: "second",
    };
  }
  if (lower === "tonight") {
    return {
      date: nextClockTime(now, 20, 0),
      precision: "minute",
    };
  }

  const match = lower.match(
    /^(?:the\s+)?(?<boundary>start|beginning|end)\s+of\s+(?:(?<shift>this|next|last)\s+)?(?<period>week|month|year)$/i,
  );
  if (!match?.groups) return null;

  const shift = match.groups.shift || "this";
  const period = match.groups.period;
  const isEnd = match.groups.boundary === "end";

  if (period === "week") {
    const mondayOffset = (now.getDay() + 6) % 7;
    const weekShift = shift === "next" ? 7 : shift === "last" ? -7 : 0;
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - mondayOffset + weekShift,
    );
    if (!isEnd) return { date: start, precision: "day" };
    return {
      date: new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + 6,
        23,
        59,
        59,
      ),
      precision: "second",
    };
  }

  if (period === "month") {
    const monthShift = shift === "next" ? 1 : shift === "last" ? -1 : 0;
    const start = new Date(now.getFullYear(), now.getMonth() + monthShift, 1);
    if (!isEnd) return { date: start, precision: "day" };
    return {
      date: new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59),
      precision: "second",
    };
  }

  const yearShift = shift === "next" ? 1 : shift === "last" ? -1 : 0;
  const year = now.getFullYear() + yearShift;
  if (!isEnd) {
    return { date: new Date(year, 0, 1), precision: "day" };
  }
  return {
    date: new Date(year, 11, 31, 23, 59, 59),
    precision: "second",
  };
}

function parseNamedTarget(raw, now) {
  const lower = raw.toLowerCase();
  const namedDates = [
    [/^christmas(?:\s+(?<year>\d{4}))?$/, 11, 25],
    [/^christmas day(?:\s+(?<year>\d{4}))?$/, 11, 25],
    [/^halloween(?:\s+(?<year>\d{4}))?$/, 9, 31],
    [/^new year'?s?(?: day)?(?:\s+(?<year>\d{4}))?$/, 0, 1],
    [/^valentine'?s?(?: day)?(?:\s+(?<year>\d{4}))?$/, 1, 14],
    [/^independence day(?:\s+(?<year>\d{4}))?$/, 6, 4],
  ];

  for (const [pattern, month, day] of namedDates) {
    const match = lower.match(pattern);
    if (!match) continue;
    const year = match.groups?.year
      ? Number(match.groups.year)
      : nextOccurrenceYear(now, month, day);
    return makeDate(year, month, day, 0, 0, 0, "day");
  }

  return null;
}

function parseIsoTarget(raw) {
  const match = raw.match(
    /^(?<year>\d{4})-(?<month>\d{1,2})-(?<day>\d{1,2})(?:[ t](?<time>.+))?$/i,
  );
  if (!match?.groups) return null;

  const time = parseTime(match.groups.time || "") || {
    hour: 0,
    minute: 0,
    second: 0,
  };
  return makeDate(
    Number(match.groups.year),
    Number(match.groups.month) - 1,
    Number(match.groups.day),
    time.hour,
    time.minute,
    time.second || 0,
    match.groups.time ? "minute" : "day",
  );
}

function parseMonthNameTarget(raw, now) {
  const monthFirst = raw.match(
    new RegExp(
      `^(?<month>${MONTH_PATTERN})\\s+(?<day>\\d{1,2})(?:,?\\s+(?<year>\\d{4}))?(?:\\s+(?:at\\s+)?(?<time>.+))?$`,
      "i",
    ),
  );
  if (monthFirst?.groups) {
    return makeMonthNameDate(monthFirst.groups, now);
  }

  const dayFirst = raw.match(
    new RegExp(
      `^(?<day>\\d{1,2})\\s+(?<month>${MONTH_PATTERN})(?:,?\\s+(?<year>\\d{4}))?(?:\\s+(?:at\\s+)?(?<time>.+))?$`,
      "i",
    ),
  );
  if (dayFirst?.groups) {
    return makeMonthNameDate(dayFirst.groups, now);
  }

  const monthYear = raw.match(
    new RegExp(`^(?<month>${MONTH_PATTERN})\\s+(?<year>\\d{4})$`, "i"),
  );
  if (monthYear?.groups) {
    const month = MONTHS.get(monthYear.groups.month.toLowerCase());
    return makeDate(Number(monthYear.groups.year), month, 1, 0, 0, 0, "month");
  }

  return null;
}

function makeMonthNameDate(groups, now) {
  const month = MONTHS.get(groups.month.toLowerCase());
  const day = Number(groups.day);
  const time = parseTime(groups.time || "") || {
    hour: 0,
    minute: 0,
    second: 0,
  };
  const year = groups.year
    ? Number(groups.year)
    : nextOccurrenceYear(now, month, day, time.hour, time.minute);

  return makeDate(
    year,
    month,
    day,
    time.hour,
    time.minute,
    time.second || 0,
    groups.time ? "minute" : "day",
  );
}

function parseNumericTarget(raw, now) {
  const match = raw.match(
    /^(?<month>\d{1,2})\/(?<day>\d{1,2})(?:\/(?<year>\d{2,4}))?(?:\s+(?:at\s+)?(?<time>.+))?$/i,
  );
  if (!match?.groups) return null;

  const month = Number(match.groups.month) - 1;
  const day = Number(match.groups.day);
  const time = parseTime(match.groups.time || "") || {
    hour: 0,
    minute: 0,
    second: 0,
  };
  const year = match.groups.year
    ? normalizeYear(Number(match.groups.year))
    : nextOccurrenceYear(now, month, day, time.hour, time.minute);

  return makeDate(
    year,
    month,
    day,
    time.hour,
    time.minute,
    time.second || 0,
    match.groups.time ? "minute" : "day",
  );
}

function parseYearTarget(raw) {
  const match = raw.match(/^(?<year>[12]\d{3}|2[0-9]{3})$/);
  if (!match?.groups) return null;
  return makeDate(Number(match.groups.year), 0, 1, 0, 0, 0, "year");
}

function parseExplicitDate(raw) {
  if (!/\b(?:19|20|21|22|23|24|25|26|27|28|29)\d{2}\b/.test(raw)) {
    return null;
  }

  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) return null;

  return {
    date: new Date(timestamp),
    precision: /\d{1,2}:\d{2}|\b(?:am|pm)\b/i.test(raw)
      ? "minute"
      : "day",
  };
}

function parseChronoTarget(raw, now) {
  if (!untilChrono?.parse) return null;

  const results = untilChrono.parse(raw, now, { forwardDate: true });
  if (!Array.isArray(results) || !results.length) return null;

  const result =
    results.find((item) => isCompleteChronoMatch(item, raw)) || null;
  if (!result) return null;

  const date = result?.start?.date?.();
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return null;

  const hasTime =
    result.start.isCertain?.("hour") ||
    result.start.isCertain?.("minute") ||
    /\b(?:am|pm|noon|midnight|\d{1,2}:\d{2})\b/i.test(raw);

  if (!hasTime) date.setHours(0, 0, 0, 0);

  return {
    date,
    precision: hasTime ? "minute" : "day",
  };
}

function isCompleteChronoMatch(result, raw) {
  const text = String(result?.text || "").trim().toLowerCase();
  const target = String(raw || "").trim().toLowerCase();
  if (!text || !target) return false;
  return text === target || text.length / target.length >= 0.75;
}

function createFixedHolidayParser() {
  const holidays = {
    christmas: { month: 12, day: 25 },
    "christmas day": { month: 12, day: 25 },
    halloween: { month: 10, day: 31 },
    "new year": { month: 1, day: 1 },
    "new years": { month: 1, day: 1 },
    "new year's": { month: 1, day: 1 },
    "new years day": { month: 1, day: 1 },
    "new year's day": { month: 1, day: 1 },
    "valentine day": { month: 2, day: 14 },
    "valentines day": { month: 2, day: 14 },
    "valentine's day": { month: 2, day: 14 },
    "independence day": { month: 7, day: 4 },
  };

  return {
    pattern: () =>
      /^(christmas(?: day)?|halloween|new year'?s?(?: day)?|valentine'?s?(?: day)?|independence day)(?:\s+(\d{4}))?$/i,
    extract: (_context, match) => {
      const key = match[1].toLowerCase();
      const holiday = holidays[key];
      if (!holiday) return null;

      return {
        month: holiday.month,
        day: holiday.day,
        ...(match[2] ? { year: Number(match[2]) } : {}),
      };
    },
  };
}

function parseTime(raw) {
  const lower = String(raw || "").trim().toLowerCase();
  if (lower === "noon") return { hour: 12, minute: 0, second: 0 };
  if (lower === "midnight") return { hour: 0, minute: 0, second: 0 };

  const match = String(raw || "")
    .trim()
    .match(/^(?<hour>\d{1,2})(?::(?<minute>\d{2}))?\s*(?<period>am|pm)?$/i);
  if (!match?.groups) return null;

  let hour = Number(match.groups.hour);
  const minute = match.groups.minute ? Number(match.groups.minute) : 0;
  const period = match.groups.period?.toLowerCase();

  if (minute > 59) return null;
  if (period) {
    if (hour < 1 || hour > 12) return null;
    if (period === "pm" && hour !== 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }

  return { hour, minute, second: 0 };
}

function nextClockTime(now, hour, minute) {
  const date = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    minute,
  );
  if (date <= now) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

function nextOccurrenceYear(now, month, day, hour = 0, minute = 0) {
  const candidate = new Date(now.getFullYear(), month, day, hour, minute);
  return candidate > now ? now.getFullYear() : now.getFullYear() + 1;
}

function normalizeYear(year) {
  if (year >= 100) return year;
  return year >= 70 ? 1900 + year : 2000 + year;
}

function makeDate(year, month, day, hour, minute, second, precision) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 0 ||
    month > 11 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const date = new Date(year, month, day, hour, minute, second || 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }

  return { date, precision };
}

function renderUntil(parsed, now) {
  const targetDate = parsed.target.date;
  const diffMs = targetDate.getTime() - now.getTime();
  const absMs = Math.abs(diffMs);
  const primary = formatPrimary(absMs, parsed.requestedUnit);
  const targetLabel = formatTargetLabel(targetDate, parsed.target.precision);
  const future = diffMs >= 0;
  const html = (template || FALLBACK_TEMPLATE)
    .split("{{state_class}}")
    .join(future ? "until-card--future" : "until-card--past")
    .split("{{target_iso}}")
    .join(_esc(targetDate.toISOString()))
    .split("{{requested_unit}}")
    .join(_esc(parsed.requestedUnit))
    .split("{{top_units}}")
    .join(String(settings.topUnits))
    .split("{{eyebrow}}")
    .join(_esc(future ? `Until ${targetLabel}` : `Since ${targetLabel}`))
    .split("{{primary_value}}")
    .join(_esc(primary.value))
    .split("{{primary_unit}}")
    .join(_esc(primary.unit))
    .split("{{primary_caption}}")
    .join(_esc(future ? "from now" : "ago"))
    .split("{{details_html}}")
    .join(renderDetails(absMs));

  return { html };
}

function formatPrimary(absMs, requestedUnit) {
  const parts = decomposeDuration(absMs, requestedUnit, settings.topUnits);
  if (!parts.length) return { value: "right now", unit: "" };

  const [first, ...rest] = parts;
  const unitText = [
    plural(first.unit.slice(0, -1), first.value),
    ...rest.map((part) => formatDurationPart(part)),
  ].join(" ");

  return { value: formatWhole(first.value), unit: unitText };
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
    Math.min(
      Number(count) || DEFAULT_TOP_UNITS,
      DETAIL_UNITS.length - startIndex,
    ),
  );
  const units = DETAIL_UNITS.slice(startIndex, startIndex + unitCount);
  let remaining = absMs;
  const parts = [];

  for (const [index, unit] of units.entries()) {
    const isLast = index === units.length - 1;
    const value =
      isLast && units.length > 1
        ? Math.ceil(remaining / UNIT_MS[unit])
        : Math.floor(remaining / UNIT_MS[unit]);
    parts.push({ unit, value });
    remaining -=
      Math.min(value, Math.floor(remaining / UNIT_MS[unit])) * UNIT_MS[unit];
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

function formatDurationPart(part) {
  return `${formatWhole(part.value)} ${plural(part.unit.slice(0, -1), part.value)}`;
}

function renderDetails(absMs) {
  return DETAIL_UNITS.map((unit) => {
    const value = absMs / UNIT_MS[unit];
    return `
      <div class="until-card__detail">
        <dt>${_esc(capitalize(unit))}</dt>
        <dd data-until-value="${_esc(unit)}">${_esc(formatDetailNumber(value, unit))}</dd>
      </div>`;
  }).join("");
}

function formatTargetLabel(date, precision) {
  const options =
    precision === "minute" || precision === "second"
      ? {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }
      : {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        };

  return date.toLocaleString("en-US", options);
}

function formatDetailNumber(value, unit) {
  if (unit === "years" || unit === "months" || unit === "weeks") {
    return formatDecimal(value, value >= 10 ? 1 : 2);
  }
  return formatWhole(Math.round(value));
}

function formatWhole(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    value,
  );
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

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function _esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
