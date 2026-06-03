// Automatically generated locales helper
export const translations = {
  "en": {
    "translate": "Translate",
    "from": "From",
    "to": "To",
    "autoDetect": "Auto Detect",
    "copy": "Copy",
    "copied": "Copied!",
    "provider": "Provider",
    "source": "Source",
    "translation": "Translation",
    "audioSource": "Listen to source",
    "audioTarget": "Listen to translation",
    "swapLanguages": "Swap languages"
  },
  "es": {
    "translate": "Traducir",
    "from": "De",
    "to": "A",
    "autoDetect": "Detectar idioma",
    "copy": "Copiar",
    "copied": "¡Copiado!",
    "provider": "Proveedor",
    "source": "Origen",
    "translation": "Traducción",
    "audioSource": "Escuchar origen",
    "audioTarget": "Escuchar traducción",
    "swapLanguages": "Intercambiar idiomas"
  },
  "fr": {
    "translate": "Traduire",
    "from": "De",
    "to": "À",
    "autoDetect": "Détecter la langue",
    "copy": "Copier",
    "copied": "Copié !",
    "provider": "Fournisseur",
    "source": "Source",
    "translation": "Traduction",
    "audioSource": "Écouter la source",
    "audioTarget": "Écouter la traduction",
    "swapLanguages": "Permuter les langues"
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
