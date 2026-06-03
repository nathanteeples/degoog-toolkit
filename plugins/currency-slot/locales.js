// Automatically generated locales helper
export const translations = {
  "en": {
    "currencyConverter": "Currency Converter",
    "exchangeRate": "Exchange rate",
    "asOf": "As of",
    "cryptoChartError": "Chart history is not available for crypto pairs",
    "fetchError": "Exchange rate provider returned an error",
    "days1": "1D",
    "days5": "5D",
    "days30": "30D",
    "days365": "1Y",
    "days1825": "5Y",
    "daysMax": "Max",
    "amount": "Amount",
    "result": "Result",
    "copyResult": "Copy result",
    "liveRate": "Live rate",
    "loadingChart": "Loading chart...",
    "popularPairs": "Popular pairs",
    "searchCurrency": "Search currency..."
  },
  "es": {
    "currencyConverter": "Convertidor de Divisas",
    "exchangeRate": "Tipo de cambio",
    "asOf": "A partir de",
    "cryptoChartError": "El historial de gráficos no está disponible para pares de criptomonedas",
    "fetchError": "El proveedor del tipo de cambio devolvió un error",
    "days1": "1D",
    "days5": "5D",
    "days30": "30D",
    "days365": "1A",
    "days1825": "5A",
    "daysMax": "Máx",
    "amount": "Monto",
    "result": "Resultado",
    "copyResult": "Copiar resultado",
    "liveRate": "Tipo de cambio en vivo",
    "loadingChart": "Cargando gráfico...",
    "popularPairs": "Pares populares",
    "searchCurrency": "Buscar divisa..."
  },
  "fr": {
    "currencyConverter": "Convertisseur de devises",
    "exchangeRate": "Taux de change",
    "asOf": "À partir de",
    "cryptoChartError": "L'historique des graphiques n'est pas disponible pour les paires de crypto",
    "fetchError": "Le fournisseur de taux de change a retourné une erreur",
    "days1": "1D",
    "days5": "5D",
    "days30": "30D",
    "days365": "1A",
    "days1825": "5A",
    "daysMax": "Max",
    "amount": "Montant",
    "result": "Résultat",
    "copyResult": "Copier le résultat",
    "liveRate": "Taux en direct",
    "loadingChart": "Chargement du graphique...",
    "popularPairs": "Paires populaires",
    "searchCurrency": "Rechercher une devise..."
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
