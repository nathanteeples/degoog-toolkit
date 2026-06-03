// Automatically generated locales helper
export const translations = {
  "en": {
    "synonyms": "Synonyms",
    "antonyms": "Antonyms",
    "origin": "Origin",
    "audio": "Audio",
    "definition": "Definition",
    "example": "Example",
    "noDefinition": "No definition found."
  },
  "es": {
    "synonyms": "Sinónimos",
    "antonyms": "Antónimos",
    "origin": "Origen",
    "audio": "Audio",
    "definition": "Definición",
    "example": "Ejemplo",
    "noDefinition": "No se encontró ninguna definición."
  },
  "fr": {
    "synonyms": "Synonymes",
    "antonyms": "Antonymes",
    "origin": "Origine",
    "audio": "Audio",
    "definition": "Définition",
    "example": "Exemple",
    "noDefinition": "Aucune définition trouvée."
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
