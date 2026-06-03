// Automatically generated locales helper
export const translations = {
  "en": {
    "countdownBoard": "Countdown board",
    "until": "Until",
    "since": "Since",
    "approaching": "Approaching",
    "arrived": "Arrived",
    "fromNow": "from now",
    "ago": "ago",
    "rightNow": "right now",
    "year": "year",
    "years": "years",
    "month": "month",
    "months": "months",
    "week": "week",
    "weeks": "weeks",
    "day": "day",
    "days": "days",
    "hour": "hour",
    "hours": "hours",
    "minute": "minute",
    "minutes": "minutes",
    "second": "second",
    "seconds": "seconds"
  },
  "es": {
    "countdownBoard": "Tablero de cuenta regresiva",
    "until": "Hasta",
    "since": "Desde",
    "approaching": "Aproximándose",
    "arrived": "Llegado",
    "fromNow": "desde ahora",
    "ago": "hace",
    "rightNow": "ahora mismo",
    "year": "año",
    "years": "años",
    "month": "mes",
    "months": "meses",
    "week": "semana",
    "weeks": "semanas",
    "day": "día",
    "days": "días",
    "hour": "hora",
    "hours": "horas",
    "minute": "minuto",
    "minutes": "minutos",
    "second": "segundo",
    "seconds": "segundos"
  },
  "fr": {
    "countdownBoard": "Tableau de compte à rebours",
    "until": "Jusqu'à",
    "since": "Depuis",
    "approaching": "En approche",
    "arrived": "Arrivé",
    "fromNow": "à partir de maintenant",
    "ago": "il y a",
    "rightNow": "en ce moment",
    "year": "an",
    "years": "ans",
    "month": "mois",
    "months": "mois",
    "week": "semaine",
    "weeks": "semaines",
    "day": "jour",
    "days": "jours",
    "hour": "heure",
    "hours": "heures",
    "minute": "minute",
    "minutes": "minutes",
    "second": "seconde",
    "seconds": "secondes"
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
