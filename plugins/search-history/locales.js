// Automatically generated locales helper
export const translations = {
  "en": {
    "history": "History",
    "clearHistory": "Clear history",
    "delete": "Delete",
    "noHistory": "No history yet",
    "page": "page",
    "confirmClear": "Are you sure you want to clear your search history?"
  },
  "es": {
    "history": "Historial",
    "clearHistory": "Borrar historial",
    "delete": "Eliminar",
    "noHistory": "Aún no hay historial",
    "page": "página",
    "confirmClear": "¿Está seguro de que desea borrar su historial de búsqueda?"
  },
  "fr": {
    "history": "Historique",
    "clearHistory": "Effacer l'historique",
    "delete": "Supprimer",
    "noHistory": "Pas encore d'historique",
    "page": "page",
    "confirmClear": "Êtes-vous sûr de vouloir effacer votre historique de recherche ?"
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
