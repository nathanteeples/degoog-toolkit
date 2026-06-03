// Automatically generated locales helper
export const translations = {
  "en": {
    "coinFlip": "Coin Flip",
    "rollDie": "Roll Die",
    "pickNumber": "Pick Number",
    "heads": "Heads",
    "tails": "Tails",
    "roll": "Roll",
    "generate": "Generate",
    "min": "Min",
    "max": "Max",
    "shouldI": "Should I...?",
    "absolutely": "Absolutely!",
    "yesDefinitely": "Yes, definitely!",
    "certain": "It is certain.",
    "noWay": "No way!",
    "maybeNextTime": "Maybe next time.",
    "doubtful": "Very doubtful."
  },
  "es": {
    "coinFlip": "Lanzar moneda",
    "rollDie": "Lanzar dado",
    "pickNumber": "Elegir número",
    "heads": "Cara",
    "tails": "Cruz",
    "roll": "Lanzar",
    "generate": "Generar",
    "min": "Mín",
    "max": "Máx",
    "shouldI": "¿Debería...?",
    "absolutely": "¡Absolutamente!",
    "yesDefinitely": "¡Sí, definitivamente!",
    "certain": "Es seguro.",
    "noWay": "¡De ninguna manera!",
    "maybeNextTime": "Quizás la próxima vez.",
    "doubtful": "Muy dudoso."
  },
  "fr": {
    "coinFlip": "Pile ou face",
    "rollDie": "Lancer le dé",
    "pickNumber": "Choisir un nombre",
    "heads": "Pile",
    "tails": "Face",
    "roll": "Lancer",
    "generate": "Générer",
    "min": "Min",
    "max": "Max",
    "shouldI": "Devrais-je...?",
    "absolutely": "Absolument !",
    "yesDefinitely": "Oui, tout à fait !",
    "certain": "C'est certain.",
    "noWay": "Pas question !",
    "maybeNextTime": "Peut-être la prochaine fois.",
    "doubtful": "Très douteux."
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
