let template = "";
let enabled = true;
let initialSpeed = "Normal";

const settingsSchema = [
  {
    key: "enabled",
    label: "Enabled",
    type: "toggle",
    default: true,
    description: "Show the Snake game card for matching queries.",
  },
  {
    key: "initialSpeed",
    label: "Initial Speed",
    type: "select",
    options: ["Easy", "Normal", "Hard"],
    default: "Normal",
    description: "The starting speed of the snake.",
  }
];

function configureSettings(settings) {
  enabled = settings?.enabled !== false && settings?.enabled !== "true" && settings?.enabled !== "false";
  // Handled appropriately since it can be boolean or string
  if (settings?.enabled === false || settings?.enabled === "false") {
    enabled = false;
  } else {
    enabled = true;
  }
  initialSpeed = settings?.initialSpeed || "Normal";
}

function parseSnakeQuery(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return false;
  if (q.startsWith("!snake")) return true;
  const playSnakeRx = /^(?:play\s+)?snake(?:\s+game)?$/i;
  return playSnakeRx.test(q);
}

export const slot = {
  id: "snake",
  name: "Snake Game",
  description: "A premium classic arcade Snake game with custom speeds, D-pad controls, particle effects, and score tracking.",
  isClientExposed: false,
  position: "above-results",
  slotPositions: ["above-results", "at-a-glance", "knowledge-panel"],
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
    return parseSnakeQuery(query);
  },

  async execute(query, context) {
    if (context?.tab && context.tab !== "all") return { title: "", html: "" };
    if (!parseSnakeQuery(query)) return { title: "", html: "" };

    const speedMsMap = { "Easy": 150, "Normal": 100, "Hard": 70 };
    const initialSpeedMs = speedMsMap[initialSpeed] || 100;

    const html = (template || "")
      .replaceAll("{{initial_speed_ms}}", String(initialSpeedMs));

    return {
      title: "",
      html: html,
    };
  },
};

export const slotPlugin = slot;
export default slot;
