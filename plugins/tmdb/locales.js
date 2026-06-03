// Automatically generated locales helper
export const translations = {
  "en": {
    "overview": "Overview",
    "director": "Director",
    "cast": "Cast",
    "seasons": "Seasons",
    "season": "Season",
    "episodes": "episodes",
    "episode": "episode",
    "rating": "Rating",
    "runtime": "Runtime",
    "releaseDate": "Release Date",
    "genres": "Genres",
    "movies": "Movies",
    "tvShows": "TV Shows",
    "filmsTv": "Films & TV",
    "knownFor": "Known For",
    "birthday": "Birthday",
    "birthplace": "Birthplace",
    "directedBy": "Directed by",
    "createdBy": "Created by",
    "person": "person",
    "people": "people",
    "noEpisodes": "No episodes listed.",
    "tmdbVotes": "TMDB votes",
    "letterboxdTooltip": "Letterboxd (community scores are on the site; there is no public rating API)",
    "trailer": "Trailer",
    "watchTrailer": "Watch trailer"
  },
  "es": {
    "overview": "Sinopsis",
    "director": "Director",
    "cast": "Reparto",
    "seasons": "Temporadas",
    "season": "Temporada",
    "episodes": "episodios",
    "episode": "episodio",
    "rating": "Calificación",
    "runtime": "Duración",
    "releaseDate": "Fecha de lanzamiento",
    "genres": "Géneros",
    "movies": "Películas",
    "tvShows": "Programas de TV",
    "filmsTv": "Cine y TV",
    "knownFor": "Conocido por",
    "birthday": "Fecha de nacimiento",
    "birthplace": "Lugar de nacimiento",
    "directedBy": "Dirigida por",
    "createdBy": "Creada por",
    "person": "persona",
    "people": "personas",
    "noEpisodes": "No se enumeran episodios.",
    "tmdbVotes": "votos de TMDB",
    "letterboxdTooltip": "Letterboxd (las puntuaciones de la comunidad están en el sitio; no hay una API de calificación pública)",
    "trailer": "Tráiler",
    "watchTrailer": "Ver tráiler"
  },
  "fr": {
    "overview": "Synopsis",
    "director": "Réalisateur",
    "cast": "Acteurs",
    "seasons": "Saisons",
    "season": "Saison",
    "episodes": "épisodes",
    "episode": "épisode",
    "rating": "Note",
    "runtime": "Durée",
    "releaseDate": "Date de sortie",
    "genres": "Genres",
    "movies": "Films",
    "tvShows": "Émissions de TV",
    "filmsTv": "Films et TV",
    "knownFor": "Connu pour",
    "birthday": "Date de naissance",
    "birthplace": "Lieu de naissance",
    "directedBy": "Réalisé par",
    "createdBy": "Créé par",
    "person": "personne",
    "people": "personnes",
    "noEpisodes": "Aucun épisode répertorié.",
    "tmdbVotes": "votes TMDB",
    "letterboxdTooltip": "Letterboxd (les scores de la communauté sont sur le site ; il n'y a pas d'API de notation publique)",
    "trailer": "Bande-annonce",
    "watchTrailer": "Regarder la bande-annonce"
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
