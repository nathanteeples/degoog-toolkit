let template = "";
let enabled = true;

const settingsSchema = [
  {
    key: "enabled",
    label: "Enabled",
    type: "toggle",
    default: true,
    description: "Show the Minesweeper game card for matching queries.",
  },
];

export const slot = {
  id: "minesweeper",
  name: "Minesweeper",
  description: "A premium Minesweeper game card with classic board modes, emoji indicator, flag toggle, and interactive timer.",
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
    enabled = settings?.enabled !== false && settings?.enabled !== "false";
  },

  trigger(query) {
    if (!enabled) return false;
    return /^(?:!minesweeper|!ms|\b(?:play\s+)?minesweeper\b)/i.test(query);
  },

  async execute(query, context) {
    if (context?.tab && context.tab !== "all") return { title: "", html: "" };
    return {
      title: "",
      html: template || "",
    };
  },
};

export const slotPlugin = slot;
export default slot;
