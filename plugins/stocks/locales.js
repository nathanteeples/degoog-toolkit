// Automatically generated locales helper
export const translations = {
  "en": {
    "open": "Open",
    "high": "High",
    "low": "Low",
    "mktCap": "Mkt Cap",
    "peRatio": "P/E Ratio",
    "divYield": "Div Yield",
    "high52w": "52W High",
    "low52w": "52W Low",
    "sourceLabel": "Yahoo Finance",
    "noChartData": "No chart data"
  },
  "es": {
    "open": "Apertura",
    "high": "Máximo",
    "low": "Mínimo",
    "mktCap": "Cap. de mercado",
    "peRatio": "Ratio P/E",
    "divYield": "Rend. de dividendo",
    "high52w": "Máx. 52 semanas",
    "low52w": "Mín. 52 semanas",
    "sourceLabel": "Yahoo Finanzas",
    "noChartData": "Sin datos de gráfico"
  },
  "fr": {
    "open": "Ouverture",
    "high": "Plus haut",
    "low": "Plus bas",
    "mktCap": "Cap. boursière",
    "peRatio": "Ratio P/E",
    "divYield": "Rend. dividende",
    "high52w": "Plus haut 52 sem.",
    "low52w": "Plus bas 52 sem.",
    "sourceLabel": "Yahoo Finance",
    "noChartData": "Pas de données"
  }
};

export function getLanguage(context) {
  // 1. Check degoog settings context.lang
  let lang = context?.lang;
  if (lang) {
    lang = lang.split('-')[0].toLowerCase();
    if (translations[lang]) return lang;
  }
  // 2. Fallback to browser UI language
  if (typeof document !== 'undefined') {
    let htmlLang = document.documentElement.lang;
    if (htmlLang) {
      htmlLang = htmlLang.split('-')[0].toLowerCase();
      if (translations[htmlLang]) return htmlLang;
    }
    let navLang = navigator.language;
    if (navLang) {
      navLang = navLang.split('-')[0].toLowerCase();
      if (translations[navLang]) return navLang;
    }
  }
  return 'en';
}

export function t(key, context) {
  const lang = getLanguage(context);
  return translations[lang]?.[key] || translations['en']?.[key] || key;
}
