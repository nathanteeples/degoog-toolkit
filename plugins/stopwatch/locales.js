// Automatically generated locales helper
export const translations = {
  "en": {
    "timer": "Timer",
    "stopwatch": "Stopwatch",
    "soundOff": "Sound off",
    "soundOn": "Sound on",
    "editTimerDuration": "Edit timer duration",
    "start": "Start",
    "pause": "Pause",
    "reset": "Reset",
    "timerDuration": "Timer duration"
  },
  "es": {
    "timer": "Temporizador",
    "stopwatch": "Cronómetro",
    "soundOff": "Sonido desactivado",
    "soundOn": "Sonido activado",
    "editTimerDuration": "Editar duración del temporizador",
    "start": "Iniciar",
    "pause": "Pausa",
    "reset": "Reiniciar",
    "timerDuration": "Duración del temporizador"
  },
  "fr": {
    "timer": "Minuteur",
    "stopwatch": "Chronomètre",
    "soundOff": "Sans son",
    "soundOn": "Son actif",
    "editTimerDuration": "Modifier la durée du minuteur",
    "start": "Démarrer",
    "pause": "Pause",
    "reset": "Réinitialiser",
    "timerDuration": "Durée du minuteur"
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
