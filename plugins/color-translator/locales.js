// Automatically generated locales helper
export const translations = {
  "en": {
    "colorTranslator": "Color Translator",
    "copy": "Copy",
    "cssHex": "CSS HEX",
    "cssRgb": "CSS RGB",
    "cssRgbPercent": "CSS RGB%",
    "cssHsl": "CSS HSL",
    "cssHsv": "CSS HSV",
    "cmyk": "CMYK",
    "namedColor": "Named Color",
    "nsCalibratedRgb": "NSColor (Calibrated RGB)",
    "nsCalibratedHsb": "NSColor (Calibrated HSB)",
    "nsDeviceRgb": "NSColor (Device RGB)",
    "nsDeviceHsb": "NSColor (Device HSB)",
    "uiRgb": "UIColor (RGB)",
    "uiHsb": "UIColor (HSB)"
  },
  "es": {
    "colorTranslator": "Traductor de Color",
    "copy": "Copiar",
    "cssHex": "CSS HEX",
    "cssRgb": "CSS RGB",
    "cssRgbPercent": "CSS RGB%",
    "cssHsl": "CSS HSL",
    "cssHsv": "CSS HSV",
    "cmyk": "CMYK",
    "namedColor": "Color por Nombre",
    "nsCalibratedRgb": "NSColor (RGB Calibrado)",
    "nsCalibratedHsb": "NSColor (HSB Calibrado)",
    "nsDeviceRgb": "NSColor (RGB del Dispositivo)",
    "nsDeviceHsb": "NSColor (HSB del Dispositivo)",
    "uiRgb": "UIColor (RGB)",
    "uiHsb": "UIColor (HSB)"
  },
  "fr": {
    "colorTranslator": "Traducteur de Couleur",
    "copy": "Copier",
    "cssHex": "CSS HEX",
    "cssRgb": "CSS RGB",
    "cssRgbPercent": "CSS RGB%",
    "cssHsl": "CSS HSL",
    "cssHsv": "CSS HSV",
    "cmyk": "CMYK",
    "namedColor": "Nom de Couleur",
    "nsCalibratedRgb": "NSColor (RGB calibré)",
    "nsCalibratedHsb": "NSColor (HSB calibré)",
    "nsDeviceRgb": "NSColor (RGB de l'appareil)",
    "nsDeviceHsb": "NSColor (HSB de l'appareil)",
    "uiRgb": "UIColor (RGB)",
    "uiHsb": "UIColor (HSB)"
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
