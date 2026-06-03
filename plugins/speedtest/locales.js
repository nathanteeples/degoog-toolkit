// Automatically generated locales helper
export const translations = {
  "en": {
    "megabitsPerSec": "Megabits per second",
    "mbpsDownload": "Mbps download",
    "mbpsUpload": "Mbps upload",
    "latencyLabel": "Latency:",
    "serverLabel": "Server:",
    "autoServer": "Automatic (lowest latency)",
    "measuresLatency": "Measures latency first, then download, then upload using the selected server.",
    "readyToMeasure": "Ready to measure your connection.",
    "runAgain": "Run again",
    "cancel": "Cancel",
    "debugDetails": "Debug details",
    "runToCapture": "Run a speed test to capture debug details."
  },
  "es": {
    "megabitsPerSec": "Megabits por segundo",
    "mbpsDownload": "Mbps descarga",
    "mbpsUpload": "Mbps subida",
    "latencyLabel": "Latencia:",
    "serverLabel": "Servidor:",
    "autoServer": "Automático (menor latencia)",
    "measuresLatency": "Mide primero la latencia, luego la descarga y después la subida utilizando el servidor seleccionado.",
    "readyToMeasure": "Listo para medir tu conexión.",
    "runAgain": "Ejecutar de nuevo",
    "cancel": "Cancelar",
    "debugDetails": "Detalles de depuración",
    "runToCapture": "Ejecute una prueba de velocidad para capturar los detalles de depuración."
  },
  "fr": {
    "megabitsPerSec": "Mégabits par seconde",
    "mbpsDownload": "Mbps téléchargement",
    "mbpsUpload": "Mbps téléversement",
    "latencyLabel": "Latence :",
    "serverLabel": "Serveur :",
    "autoServer": "Automatique (latence la plus faible)",
    "measuresLatency": "Mesure d'abord la latence, puis le téléchargement, puis le téléversement à l'aide du serveur sélectionné.",
    "readyToMeasure": "Prêt à mesurer votre connexion.",
    "runAgain": "Recommencer",
    "cancel": "Annuler",
    "debugDetails": "Détails de débogage",
    "runToCapture": "Lancez un test de vitesse pour capturer les détails de débogage."
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
