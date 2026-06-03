// Automatically generated locales helper
export const translations = {
  "en": {
    "openInOsm": "Open in OpenStreetMap",
    "showFullscreen": "Show fullscreen",
    "open": "Open",
    "closed": "Closed",
    "open24h": "Open 24 hours",
    "closesTime": "Closes {time}",
    "opensTime": "Opens {time}",
    "closedToday": "Closed today",
    "call": "Call",
    "website": "Website",
    "directions": "Directions",
    "useMyLocation": "Use my location",
    "places": "Places",
    "nearPlace": "near {place}",
    "getDirections": "Get directions",
    "viewLargerMap": "View larger map",
    "seeHours": "Hours",
    "openInGoogle": "Open in Google Maps",
    "openInApple": "Open in Apple Maps"
  },
  "es": {
    "openInOsm": "Abrir en OpenStreetMap",
    "showFullscreen": "Mostrar en pantalla completa",
    "open": "Abierto",
    "closed": "Cerrado",
    "open24h": "Abierto las 24 horas",
    "closesTime": "Cierra a las {time}",
    "opensTime": "Abre a las {time}",
    "closedToday": "Cerrado hoy",
    "call": "Llamar",
    "website": "Sitio web",
    "directions": "Indicaciones",
    "useMyLocation": "Usar mi ubicación",
    "places": "Lugares",
    "nearPlace": "cerca de {place}",
    "getDirections": "Obtener indicaciones",
    "viewLargerMap": "Ver mapa más grande",
    "seeHours": "Horario",
    "openInGoogle": "Abrir en Google Maps",
    "openInApple": "Abrir en Apple Maps"
  },
  "fr": {
    "openInOsm": "Ouvrir dans OpenStreetMap",
    "showFullscreen": "Afficher en plein écran",
    "open": "Ouvert",
    "closed": "Fermé",
    "open24h": "Ouvert 24 heures sur 24",
    "closesTime": "Ferme à {time}",
    "opensTime": "Ouvre à {time}",
    "closedToday": "Fermé aujourd'hui",
    "call": "Appeler",
    "website": "Site web",
    "directions": "Itinéraire",
    "useMyLocation": "Utiliser ma position",
    "places": "Lieux",
    "nearPlace": "près de {place}",
    "getDirections": "Obtenir l'itinéraire",
    "viewLargerMap": "Afficher une carte plus grande",
    "seeHours": "Horaires",
    "openInGoogle": "Ouvrir dans Google Maps",
    "openInApple": "Ouvrir dans Plans"
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
