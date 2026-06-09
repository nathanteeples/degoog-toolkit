let template = "";
let enabled = true;
let defaultTipPercent = 15;

const settingsSchema = [
  {
    key: "enabled",
    label: "Enabled",
    type: "toggle",
    default: true,
    description: "Show the tip calculator card for matching queries.",
  },
  {
    key: "defaultTipPercent",
    label: "Default Tip Percentage",
    type: "select",
    options: ["10", "15", "18", "20", "25"],
    default: "15",
    description: "Default tip percentage to use if not specified in search query.",
  }
];

function isTipAdviceArticle(q) {
  return /\b(tips?\s+(?:to|on\s+how|on|for|about|with|and|from|in)|(?:gardening|coding|interview|study|writing|clean|life|health|safety|cooking|travel|career|business)\s+tips?)\b/i.test(q);
}

function parseTipQuery(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return null;

  const hasTipKeyword = /\b(tips?|gratuity|gratuities)\b/i.test(q);
  if (!hasTipKeyword) return null;

  if (isTipAdviceArticle(q)) return null;

  const explicitCalcKeywords = /\b(calculator|calculate|calc|compute)\b/i.test(q);
  const hasDigits = /\d/.test(q);
  
  if (!explicitCalcKeywords && !hasDigits) {
    const simpleTipCalculatorRx = /^(?:please\s+)?(?:(?:open|show|run|start)\s+)?(?:a\s+)?(?:tip|gratuity)\s*(?:calculator|calc)?(?:\s+please)?[.!?]*$/i;
    if (!simpleTipCalculatorRx.test(q)) return null;
  }

  let split = 1;
  const splitMatch = q.match(/\bsplit\s*(?:by|with|for|among)?\s*(\d+)/i) || q.match(/(\d+)\s*(?:ways?|people|persons|split)/i);
  if (splitMatch) split = parseInt(splitMatch[1], 10);

  let tipPercent = null;
  const percentMatch = q.match(/(\d+(?:\.\d+)?)\s*%/i) || q.match(/(\d+(?:\.\d+)?)\s*(?:percent|pct)\b/i);
  if (percentMatch) {
    tipPercent = parseFloat(percentMatch[1]);
  } else {
    const tipNearNumberMatch = q.match(/\b(?:tips?|gratuity|gratuities)\s+(\d+(?:\.\d+)?)\b/i) ||
                               q.match(/\b(\d+(?:\.\d+)?)\s+(?:tips?|gratuity|gratuities)\b/i);
    if (tipNearNumberMatch) tipPercent = parseFloat(tipNearNumberMatch[1]);
  }

  let bill = null;
  const dollarMatch = q.match(/\$\s*(\d+(?:\.\d+)?)/i);
  if (dollarMatch) {
    bill = parseFloat(dollarMatch[1]);
  } else {
    const numbers = [];
    const numRegex = /\d+(?:\.\d+)?/g;
    let m;
    while ((m = numRegex.exec(q)) !== null) {
      const val = parseFloat(m[0]);
      const index = m.index;
      const postStr = q.substring(index + m[0].length).trim();
      if (/^(%|percent|pct)\b/i.test(postStr)) continue;
      const preStr = q.substring(0, index).trim();
      if (/(split|split\s+by|split\s+with|split\s+for|split\s+among)$/i.test(preStr)) continue;
      numbers.push({ val, index });
    }

    let billCandidate = null;
    for (const item of numbers) {
      const preStr = q.substring(0, item.index).trim();
      if (/(?:on|for|of|at)$/i.test(preStr)) {
        billCandidate = item.val;
        break;
      }
    }

    if (billCandidate !== null) {
      bill = billCandidate;
    } else if (numbers.length > 0) {
      const remainingNumbers = numbers.filter(item => {
        if (splitMatch && item.val === split) return false;
        return true;
      });

      if (remainingNumbers.length === 1) {
        bill = remainingNumbers[0].val;
      } else if (remainingNumbers.length >= 2) {
        if (tipPercent !== null) {
          const notTip = remainingNumbers.find(item => item.val !== tipPercent);
          bill = notTip ? notTip.val : remainingNumbers[0].val;
        } else {
          const n1 = remainingNumbers[0].val;
          const n2 = remainingNumbers[1].val;
          if (n1 <= 100 && n2 > 100) {
            tipPercent = n1;
            bill = n2;
          } else if (n2 <= 100 && n1 > 100) {
            tipPercent = n2;
            bill = n1;
          } else {
            tipPercent = n1;
            bill = n2;
          }
        }
      }
    }
  }

  if (bill !== null && (isNaN(bill) || bill <= 0)) bill = null;
  if (tipPercent !== null && (isNaN(tipPercent) || tipPercent < 0)) tipPercent = null;
  if (split !== null && (isNaN(split) || split <= 0)) split = 1;

  return { bill, tipPercent, split };
}

export const slot = {
  id: "tip-calculator",
  name: "Tip Calculator",
  description: "Interactive tip calculator with real-time bill split, custom slider parameters, and animations.",
  isClientExposed: false,
  position: "above-results",
  slotPositions: ["above-results", "knowledge-panel"],
  settingsSchema,

  async init(ctx) {
    template = ctx?.template || "";
    if (!template && typeof ctx?.readFile === "function") {
      template = await ctx.readFile("template.html");
    }
  },

  configure(settings) {
    enabled = settings?.enabled !== false && settings?.enabled !== "false";
    defaultTipPercent = parseInt(settings?.defaultTipPercent || "15", 10);
    if (isNaN(defaultTipPercent) || defaultTipPercent < 0) defaultTipPercent = 15;
  },

  trigger(query) {
    return enabled && Boolean(parseTipQuery(query));
  },

  async execute(query, context) {
    if (context?.tab && context.tab !== "all") return { title: "", html: "" };
    const request = parseTipQuery(query);
    if (!request) return { title: "", html: "" };

    const billVal = request.bill !== null ? request.bill.toFixed(2) : "50.00";
    const tipVal = request.tipPercent !== null ? request.tipPercent : defaultTipPercent;
    const splitVal = request.split !== null ? request.split : 1;

    return {
      title: "",
      html: (template || "")
        .replaceAll("{{bill}}", String(billVal))
        .replaceAll("{{tip_percent}}", String(tipVal))
        .replaceAll("{{split}}", String(splitVal)),
    };
  },
};

export const slotPlugin = slot;
export default slot;
