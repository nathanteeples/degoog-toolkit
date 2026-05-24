let template = "";

const DEFAULT_TIMER_SECONDS = 5 * 60;
const DEFAULT_STOPWATCH_CYCLE_SECONDS = 60;
const MAX_DURATION_SECONDS = 24 * 60 * 60;
const STOPWATCH_CYCLE_OPTIONS = new Set(["60", "300", "3600"]);

let enabled = true;
let stopwatchCycleSeconds = DEFAULT_STOPWATCH_CYCLE_SECONDS;

const COMMAND_PREFIX_RX = /^!(?<command>timer|stopwatch|countdown)\b\s*/i;
const TIMER_KEYWORD_RX = /\b(?:timer|countdown|count\s+down)\b/i;
const SIMPLE_STOPWATCH_RX =
  /^(?:please\s+)?(?:(?:start|run|open|show)\s+)?(?:a\s+)?stop\s*watch(?:\s+please)?[.!?]*$/i;
const SIMPLE_TIMER_RX =
  /^(?:please\s+)?(?:(?:start|set|run|open|show)\s+)?(?:a\s+)?(?:timer|countdown|count\s+down)(?:\s+please)?[.!?]*$/i;

const UNIT_SECONDS = {
  h: 3600,
  hr: 3600,
  hrs: 3600,
  hour: 3600,
  hours: 3600,
  m: 60,
  min: 60,
  mins: 60,
  minute: 60,
  minutes: 60,
  s: 1,
  sec: 1,
  secs: 1,
  second: 1,
  seconds: 1,
};

const UNIT_TOKEN_RX =
  /(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)\b/gi;
const CLOCK_RX = /\b(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\b/;
const BARE_NUMBER_RX = /\b(\d{1,4})\b/;

const settingsSchema = [
  {
    key: "enabled",
    label: "Enabled",
    type: "toggle",
    default: true,
    description: "Show the timer and stopwatch card for matching queries.",
  },
  {
    key: "stopwatchCycle",
    label: "Stopwatch ring cycle",
    type: "select",
    options: ["60", "300", "3600"],
    default: String(DEFAULT_STOPWATCH_CYCLE_SECONDS),
    description: "Seconds represented by one full stopwatch progress ring.",
  },
];

function clampDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(Math.round(seconds), MAX_DURATION_SECONDS);
}

function normalizeQuery(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function stripCommandPrefix(value) {
  return normalizeQuery(value).replace(COMMAND_PREFIX_RX, "");
}

function parseDuration(value, options = {}) {
  const q = normalizeQuery(value).toLowerCase();
  if (!q) return null;

  const clock = CLOCK_RX.exec(q);
  if (clock) {
    const hours = clock[1] ? Number(clock[1]) : 0;
    const minutes = Number(clock[2]);
    const seconds = Number(clock[3]);
    return clampDuration(hours * 3600 + minutes * 60 + seconds);
  }

  let total = 0;
  let matched = false;
  for (const match of q.matchAll(UNIT_TOKEN_RX)) {
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (!Number.isFinite(amount) || !UNIT_SECONDS[unit]) continue;
    total += amount * UNIT_SECONDS[unit];
    matched = true;
  }
  if (matched) return clampDuration(total);

  if (options.allowBareNumber) {
    const bare = BARE_NUMBER_RX.exec(q);
    if (bare) return clampDuration(Number(bare[1]) * 60);
  }

  return null;
}

function parseRequest(input) {
  const original = normalizeQuery(input);
  if (!original || original.length > 160) return null;

  const commandMatch = COMMAND_PREFIX_RX.exec(original);
  const command = commandMatch?.groups?.command?.toLowerCase() || "";
  const q = stripCommandPrefix(original);
  const haystack = q || original.replace(COMMAND_PREFIX_RX, command);

  if (
    command === "stopwatch" ||
    (!command && SIMPLE_STOPWATCH_RX.test(original))
  ) {
    return {
      mode: "stopwatch",
      durationSeconds: DEFAULT_TIMER_SECONDS,
      autostart: /\b(?:start|run)\b/i.test(original),
    };
  }

  const isTimerCommand = command === "timer" || command === "countdown";
  const hasTimerKeyword = TIMER_KEYWORD_RX.test(original);
  const timerDuration = parseDuration(haystack, {
    allowBareNumber: isTimerCommand || hasTimerKeyword,
  });

  if (
    isTimerCommand ||
    SIMPLE_TIMER_RX.test(original) ||
    (hasTimerKeyword && timerDuration !== null)
  ) {
    return {
      mode: "timer",
      durationSeconds: timerDuration || DEFAULT_TIMER_SECONDS,
      autostart:
        timerDuration !== null || /\b(?:start|run|countdown|count\s+down)\b/i.test(original),
    };
  }

  return null;
}

function configureSettings(settings) {
  enabled = settings?.enabled !== false && settings?.enabled !== "false";
  const nextCycle = String(settings?.stopwatchCycle || DEFAULT_STOPWATCH_CYCLE_SECONDS);
  stopwatchCycleSeconds = STOPWATCH_CYCLE_OPTIONS.has(nextCycle)
    ? Number(nextCycle)
    : DEFAULT_STOPWATCH_CYCLE_SECONDS;
}

function renderTemplate(request) {
  return (template || "")
    .replaceAll("{{duration_seconds}}", String(request.durationSeconds))
    .replaceAll("{{mode}}", request.mode)
    .replaceAll("{{autostart}}", request.autostart ? "true" : "false")
    .replaceAll("{{stopwatch_cycle_seconds}}", String(stopwatchCycleSeconds));
}

export const slot = {
  id: "stopwatch",
  name: "Timer / Stopwatch",
  description:
    "Compact timer and stopwatch with smooth circular progress, editable timer duration, and optional sound.",
  isClientExposed: false,
  position: "at-a-glance",
  slotPositions: ["at-a-glance", "above-results", "knowledge-panel"],
  settingsSchema,

  async init(ctx) {
    template = ctx?.template || "";
    if (!template && typeof ctx?.readFile === "function") {
      template = await ctx.readFile("template.html");
    }
  },

  configure(settings) {
    configureSettings(settings);
  },

  trigger(query) {
    if (!enabled) return false;
    return Boolean(parseRequest(query));
  },

  async execute(query, context) {
    if (context?.tab && context.tab !== "all") return { title: "", html: "" };
    const request = parseRequest(query);
    if (!request) return { title: "", html: "" };

    return {
      title: "",
      html: renderTemplate(request),
    };
  },
};

export const slotPlugin = slot;
export default slot;
