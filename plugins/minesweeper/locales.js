// Automatically generated locales helper
export const translations = {
  "en": {
    "minesweeper": "Minesweeper",
    "newGame": "New Game",
    "mines": "Mines",
    "flags": "Flags",
    "time": "Time",
    "win": "You Win!",
    "gameOver": "Game Over!"
  },
  "es": {
    "minesweeper": "Buscaminas",
    "newGame": "Nuevo juego",
    "mines": "Minas",
    "flags": "Banderas",
    "time": "Tiempo",
    "win": "¡Ganaste!",
    "gameOver": "¡Fin de la partida!"
  },
  "fr": {
    "minesweeper": "Démineur",
    "newGame": "Nouvelle partie",
    "mines": "Mines",
    "flags": "Drapeaux",
    "time": "Temps",
    "win": "Vous avez gagné !",
    "gameOver": "Partie terminée !"
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
