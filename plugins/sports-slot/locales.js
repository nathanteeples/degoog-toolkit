// Automatically generated locales helper
export const translations = {
  "en": {
    "sportsResults": "Sports Results",
    "live": "Live",
    "upcoming": "Upcoming",
    "final": "Final",
    "nextMatch": "Next match",
    "latestResult": "Latest result",
    "standings": "Standings",
    "team": "Team",
    "league": "League",
    "venue": "Venue",
    "conference": "Conference",
    "division": "Division",
    "noStandings": "No standings were returned for that competition.",
    "noFixtures": "No recent or upcoming fixtures were found."
  },
  "es": {
    "sportsResults": "Resultados Deportivos",
    "live": "En vivo",
    "upcoming": "Próximos",
    "final": "Final",
    "nextMatch": "Siguiente partido",
    "latestResult": "Último resultado",
    "standings": "Clasificación",
    "team": "Equipo",
    "league": "Liga",
    "venue": "Sede",
    "conference": "Conferencia",
    "division": "División",
    "noStandings": "No se devolvió la clasificación para esa competición.",
    "noFixtures": "No se encontraron partidos recientes o próximos."
  },
  "fr": {
    "sportsResults": "Résultats sportifs",
    "live": "En direct",
    "upcoming": "À venir",
    "final": "Terminé",
    "nextMatch": "Prochain match",
    "latestResult": "Dernier résultat",
    "standings": "Classement",
    "team": "Équipe",
    "league": "Ligue",
    "venue": "Stade",
    "conference": "Conférence",
    "division": "Division",
    "noStandings": "Aucun classement retourné pour cette compétition.",
    "noFixtures": "Aucun match récent ou à venir trouvé."
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
