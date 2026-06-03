// Automatically generated locales helper
export const translations = {
  "en": {
    "tipCalculator": "Tip Calculator",
    "bill": "Bill",
    "tip": "Tip",
    "tipAmount": "Tip Amount",
    "total": "Total",
    "split": "Split",
    "perPerson": "Per Person"
  },
  "es": {
    "tipCalculator": "Calculadora de Propinas",
    "bill": "Cuenta",
    "tip": "Propina",
    "tipAmount": "Monto de Propina",
    "total": "Total",
    "split": "Dividir",
    "perPerson": "Por Persona"
  },
  "fr": {
    "tipCalculator": "Calculateur de pourboire",
    "bill": "Facture",
    "tip": "Pourboire",
    "tipAmount": "Montant du pourboire",
    "total": "Total",
    "split": "Diviser",
    "perPerson": "Par personne"
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
