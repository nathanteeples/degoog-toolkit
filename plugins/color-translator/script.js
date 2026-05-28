(function () {
  const NAMED_COLORS = {
    aliceblue: "#f0f8ff",
    antiquewhite: "#faebd7",
    aqua: "#00ffff",
    aquamarine: "#7fffd4",
    azure: "#f0ffff",
    beige: "#f5f5dc",
    bisque: "#ffe4c4",
    black: "#000000",
    blanchedalmond: "#ffebcd",
    blue: "#0000ff",
    blueviolet: "#8a2be2",
    brown: "#a52a2a",
    burlywood: "#deb887",
    cadetblue: "#5f9ea0",
    chartreuse: "#7fff00",
    chocolate: "#d2691e",
    coral: "#ff7f50",
    cornflowerblue: "#6495ed",
    cornsilk: "#fff8dc",
    crimson: "#dc143c",
    cyan: "#00ffff",
    darkblue: "#00008b",
    darkcyan: "#008b8b",
    darkgoldenrod: "#b8860b",
    darkgray: "#a9a9a9",
    darkgreen: "#006400",
    darkgrey: "#a9a9a9",
    darkkhaki: "#bdb76b",
    darkmagenta: "#8b008b",
    darkolivegreen: "#556b2f",
    darkorange: "#ff8c00",
    darkorchid: "#9932cc",
    darkred: "#8b0000",
    darksalmon: "#e9967a",
    darkseagreen: "#8fbc8f",
    darkslate5a0: "#2f4f4f",
    darkslateblue: "#483d8b",
    darkslategrey: "#2f4f4f",
    darkturquoise: "#00ced1",
    darkviolet: "#9400d3",
    deeppink: "#ff1493",
    deepskyblue: "#00bfff",
    dimgray: "#696969",
    dimgrey: "#696969",
    dodgerblue: "#1e90ff",
    firebrick: "#b22222",
    floralwhite: "#fffaf0",
    forestgreen: "#228b22",
    fuchsia: "#ff00ff",
    gainsboro: "#dcdcdc",
    ghostwhite: "#f8f8ff",
    gold: "#ffd700",
    goldenrod: "#daa520",
    gray: "#808080",
    green: "#008000",
    greenyellow: "#adff2f",
    grey: "#808080",
    honeydew: "#f0fff0",
    hotpink: "#ff69b4",
    indianred: "#cd5c5c",
    indigo: "#4b0082",
    ivory: "#fffff0",
    khaki: "#f0e68c",
    lavender: "#e6e6fa",
    lavenderblush: "#fff0f5",
    lawngreen: "#7cfc00",
    lemonchiffon: "#fffacd",
    lightblue: "#add8e6",
    lightcoral: "#f08080",
    lightcyan: "#e0ffff",
    lightgoldenrodyellow: "#fafad2",
    lightgray: "#d3d3d3",
    lightgreen: "#90ee90",
    lightgrey: "#d3d3d3",
    lightpink: "#ffb6c1",
    lightsalmon: "#ffa07a",
    lightseagreen: "#20b2aa",
    lightskyblue: "#87cefa",
    lightslategrey: "#778899",
    lightyellow: "#ffffe0",
    lime: "#00ff00",
    limegreen: "#32cd32",
    linen: "#faf0e6",
    magenta: "#ff00ff",
    maroon: "#800000",
    mediumaquamarine: "#66cdaa",
    mediumblue: "#0000cd",
    mediumorchid: "#ba55d3",
    mediumpurple: "#9370db",
    mediumseagreen: "#3cb371",
    mediumslateblue: "#7b68ee",
    mediumspringgreen: "#00fa9a",
    mediumturquoise: "#48d1cc",
    mediumvioletred: "#c71585",
    midnightblue: "#191970",
    mintcream: "#f5fffa",
    mistyrose: "#ffe4e1",
    moccasin: "#ffe4b5",
    navajowhite: "#ffdead",
    navy: "#000080",
    oldlace: "#fdf5e6",
    olive: "#808000",
    olivedrab: "#6b8e23",
    orange: "#ffa500",
    orangered: "#ff4500",
    orchid: "#da70d6",
    palegoldenrod: "#eee8aa",
    palegreen: "#98fb98",
    paleturquoise: "#afeeee",
    palevioletred: "#db7093",
    papayawhip: "#ffefd5",
    peachpuff: "#ffdab9",
    peru: "#cd853f",
    pink: "#ffc0cb",
    plum: "#dda0dd",
    powderblue: "#b0e0e6",
    purple: "#800080",
    rebeccapurple: "#663399",
    red: "#ff0000",
    rosybrown: "#bc8f8f",
    royalblue: "#4169e1",
    saddlebrown: "#8b4513",
    salmon: "#fa8072",
    sandybrown: "#f4a460",
    seagreen: "#2e8b57",
    seashell: "#fff5ee",
    sienna: "#a0522d",
    silver: "#c0c0c0",
    skyblue: "#87ceeb",
    slateblue: "#6a5acd",
    slategrey: "#708090",
    snow: "#fffafa",
    springgreen: "#00ff7f",
    steelblue: "#4682b4",
    tan: "#d2b48c",
    teal: "#008080",
    thistle: "#d8bfd8",
    tomato: "#ff6347",
    turquoise: "#40e0d0",
    violet: "#ee82ee",
    wheat: "#f5deb3",
    white: "#ffffff",
    whitesmoke: "#f5f5f5",
    yellow: "#ffff00",
    yellowgreen: "#9acd32"
  };

  const HEX_TO_NAME = {};
  for (const [name, hex] of Object.entries(NAMED_COLORS)) {
    HEX_TO_NAME[hex.toLowerCase()] = name;
  }

  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  }

  function hslToRgb(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  function rgbToHsb(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h;
    const s = max === 0 ? 0 : d / max;
    const v = max;

    if (max === min) {
      h = 0;
    } else {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return [Math.round(h * 360), Math.round(s * 100), Math.round(v * 100)];
  }

  function hsbToRgb(h, s, b) {
    h /= 360;
    s /= 100;
    b /= 100;
    
    let r = 0, g = 0, bl = 0;
    
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = b * (1 - s);
    const q = b * (1 - f * s);
    const t = b * (1 - (1 - f) * s);
    
    switch (i % 6) {
      case 0: r = b; g = t; bl = p; break;
      case 1: r = q; g = b; bl = p; break;
      case 2: r = p; g = b; bl = t; break;
      case 3: r = p; g = q; bl = b; break;
      case 4: r = t; g = p; bl = b; break;
      case 5: r = b; g = p; bl = q; break;
    }
    
    return [Math.round(r * 255), Math.round(g * 255), Math.round(bl * 255)];
  }

  function rgbToCmyk(r, g, b) {
    let c = 1 - (r / 255);
    let m = 1 - (g / 255);
    let y = 1 - (b / 255);
    let k = Math.min(c, Math.min(m, y));
    if (k === 1) {
      c = 0;
      m = 0;
      y = 0;
    } else {
      c = (c - k) / (1 - k);
      m = (m - k) / (1 - k);
      y = (y - k) / (1 - k);
    }
    return [
      Math.round(c * 100),
      Math.round(m * 100),
      Math.round(y * 100),
      Math.round(k * 100)
    ];
  }

  function cmykToRgb(c, m, y, k) {
    c /= 100;
    m /= 100;
    y /= 100;
    k /= 100;
    const r = Math.round(255 * (1 - c) * (1 - k));
    const g = Math.round(255 * (1 - m) * (1 - k));
    const b = Math.round(255 * (1 - y) * (1 - k));
    return [r, g, b];
  }

  function parseHex(hex) {
    let r, g, b, a = 1;
    const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;
    if (cleanHex.length === 3) {
      r = parseInt(cleanHex[0] + cleanHex[0], 16);
      g = parseInt(cleanHex[1] + cleanHex[1], 16);
      b = parseInt(cleanHex[2] + cleanHex[2], 16);
    } else if (cleanHex.length === 4) {
      r = parseInt(cleanHex[0] + cleanHex[0], 16);
      g = parseInt(cleanHex[1] + cleanHex[1], 16);
      b = parseInt(cleanHex[2] + cleanHex[2], 16);
      a = parseInt(cleanHex[3] + cleanHex[3], 16) / 255;
    } else if (cleanHex.length === 6) {
      r = parseInt(cleanHex.slice(0, 2), 16);
      g = parseInt(cleanHex.slice(2, 4), 16);
      b = parseInt(cleanHex.slice(4, 6), 16);
    } else if (cleanHex.length === 8) {
      r = parseInt(cleanHex.slice(0, 2), 16);
      g = parseInt(cleanHex.slice(2, 4), 16);
      b = parseInt(cleanHex.slice(4, 6), 16);
      a = parseInt(cleanHex.slice(6, 8), 16) / 255;
    } else {
      return null;
    }
    return { r, g, b, a: Number(a.toFixed(3)) };
  }

  function parseComponent(val, max) {
    if (val.endsWith('%')) {
      return Math.round((parseFloat(val) / 100) * max);
    }
    return Math.round(parseFloat(val));
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function parseColor(query) {
    let q = query.trim().toLowerCase();
    
    q = q.replace(/^!(?:color-translator|color|translate-color)\s+/i, '');
    q = q.replace(/^color\s+/i, '');
    q = q.trim();

    if (!q) return null;

    if (NAMED_COLORS[q]) {
      return parseHex(NAMED_COLORS[q]);
    }

    const hexMatch = q.match(/^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (hexMatch) {
      const rawHex = hexMatch[1];
      if (rawHex.length === 3 || rawHex.length === 4 || rawHex.length === 6 || rawHex.length === 8) {
        return parseHex(rawHex);
      }
    }

    const rgbMatch = q.match(/rgba?\(\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)\s*,\s*([0-9.]+%?)\s*(?:,\s*([0-9.]+)\s*)?\)/i);
    if (rgbMatch) {
      const r = parseComponent(rgbMatch[1], 255);
      const g = parseComponent(rgbMatch[2], 255);
      const b = parseComponent(rgbMatch[3], 255);
      const a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;
      if (r !== null && g !== null && b !== null && !isNaN(a)) {
        return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), a: clamp(a, 0, 1) };
      }
    }

    const hslMatch = q.match(/hsla?\(\s*([0-9.]+)\s*,\s*([0-9.]+)%?\s*,\s*([0-9.]+)%?\s*(?:,\s*([0-9.]+)\s*)?\)/i);
    if (hslMatch) {
      const h = parseFloat(hslMatch[1]);
      const s = parseFloat(hslMatch[2]);
      const l = parseFloat(hslMatch[3]);
      const a = hslMatch[4] !== undefined ? parseFloat(hslMatch[4]) : 1;
      if (!isNaN(h) && !isNaN(s) && !isNaN(l) && !isNaN(a)) {
        const [r, g, b] = hslToRgb(h, s, l);
        return { r, g, b, a: clamp(a, 0, 1) };
      }
    }

    const hsbMatch = q.match(/hs[bv]a?\(\s*([0-9.]+)\s*,\s*([0-9.]+)%?\s*,\s*([0-9.]+)%?\s*(?:,\s*([0-9.]+)\s*)?\)/i);
    if (hsbMatch) {
      const h = parseFloat(hsbMatch[1]);
      const s = parseFloat(hsbMatch[2]);
      const b = parseFloat(hsbMatch[3]);
      const a = hsbMatch[4] !== undefined ? parseFloat(hsbMatch[4]) : 1;
      if (!isNaN(h) && !isNaN(s) && !isNaN(b) && !isNaN(a)) {
        const [r, g, bVal] = hsbToRgb(h, s, b);
        return { r, g, b: bVal, a: clamp(a, 0, 1) };
      }
    }

    const objcRgbMatch = q.match(/(?:ui|ns)color\s+colorwith(?:calibrated|device)?red\s*:\s*([0-9.]+)\s+green\s*:\s*([0-9.]+)\s+blue\s*:\s*([0-9.]+)(?:\s+alpha\s*:\s*([0-9.]+))?/i);
    if (objcRgbMatch) {
      const r = Math.round(parseFloat(objcRgbMatch[1]) * 255);
      const g = Math.round(parseFloat(objcRgbMatch[2]) * 255);
      const b = Math.round(parseFloat(objcRgbMatch[3]) * 255);
      const a = objcRgbMatch[4] !== undefined ? parseFloat(objcRgbMatch[4]) : 1;
      return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), a: clamp(a, 0, 1) };
    }

    const objcHsbMatch = q.match(/(?:ui|ns)color\s+colorwith(?:calibrated|device)?hue\s*:\s*([0-9.]+)\s+saturation\s*:\s*([0-9.]+)\s+brightness\s*:\s*([0-9.]+)(?:\s+alpha\s*:\s*([0-9.]+))?/i);
    if (objcHsbMatch) {
      const h = parseFloat(objcHsbMatch[1]) * 360;
      const s = parseFloat(objcHsbMatch[2]) * 100;
      const b = parseFloat(objcHsbMatch[3]) * 100;
      const a = objcHsbMatch[4] !== undefined ? parseFloat(objcHsbMatch[4]) : 1;
      const [r, g, bVal] = hsbToRgb(h, s, b);
      return { r, g, b: bVal, a: clamp(a, 0, 1) };
    }

    const looseRgbMatch = q.match(/red\s*[:\s]\s*([0-9.]+)(?:%|\b)\s*green\s*[:\s]\s*([0-9.]+)(?:%|\b)\s*blue\s*[:\s]\s*([0-9.]+)(?:%|\b)(?:\s*alpha\s*[:\s]\s*([0-9.]+))?/i);
    if (looseRgbMatch) {
      const isPct = looseRgbMatch[0].includes('%');
      const r = parseComponent(looseRgbMatch[1] + (isPct ? '%' : ''), 255);
      const g = parseComponent(looseRgbMatch[2] + (isPct ? '%' : ''), 255);
      const b = parseComponent(looseRgbMatch[3] + (isPct ? '%' : ''), 255);
      const a = looseRgbMatch[4] !== undefined ? parseFloat(looseRgbMatch[4]) : 1;
      if (r !== null && g !== null && b !== null && !isNaN(a)) {
        return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), a: clamp(a, 0, 1) };
      }
    }

    const looseHsbMatch = q.match(/hue\s*[:\s]\s*([0-9.]+)(?:%|\b)\s*saturation\s*[:\s]\s*([0-9.]+)(?:%|\b)\s*(?:brightness|value)\s*[:\s]\s*([0-9.]+)(?:%|\b)(?:\s*alpha\s*[:\s]\s*([0-9.]+))?/i);
    if (looseHsbMatch) {
      const h = parseFloat(looseHsbMatch[1]);
      const s = parseFloat(looseHsbMatch[2]);
      const b = parseFloat(looseHsbMatch[3]);
      const a = looseHsbMatch[4] !== undefined ? parseFloat(looseHsbMatch[4]) : 1;
      if (!isNaN(h) && !isNaN(s) && !isNaN(b) && !isNaN(a)) {
        const [r, g, bVal] = hsbToRgb(h, s, b);
        return { r, g, b: bVal, a: clamp(a, 0, 1) };
      }
    }

    const spaceRgbMatch = q.match(/^rgba?\s+([0-9.]+%?)\s+([0-9.]+%?)\s+([0-9.]+%?)(?:\s+([0-9.]+))?$/i);
    if (spaceRgbMatch) {
      const r = parseComponent(spaceRgbMatch[1], 255);
      const g = parseComponent(spaceRgbMatch[2], 255);
      const b = parseComponent(spaceRgbMatch[3], 255);
      const a = spaceRgbMatch[4] !== undefined ? parseFloat(spaceRgbMatch[4]) : 1;
      if (r !== null && g !== null && b !== null && !isNaN(a)) {
        return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), a: clamp(a, 0, 1) };
      }
    }

    const spaceHslMatch = q.match(/^hsla?\s+([0-9.]+)\s+([0-9.]+)%?\s+([0-9.]+)%?(?:\s+([0-9.]+))?$/i);
    if (spaceHslMatch) {
      const h = parseFloat(spaceHslMatch[1]);
      const s = parseFloat(spaceHslMatch[2]);
      const l = parseFloat(spaceHslMatch[3]);
      const a = spaceHslMatch[4] !== undefined ? parseFloat(spaceHslMatch[4]) : 1;
      if (!isNaN(h) && !isNaN(s) && !isNaN(l) && !isNaN(a)) {
        const [r, g, b] = hslToRgb(h, s, l);
        return { r, g, b, a: clamp(a, 0, 1) };
      }
    }

    const spaceHsbMatch = q.match(/^hs[bv]a?\s+([0-9.]+)\s+([0-9.]+)%?\s+([0-9.]+)%?(?:\s+([0-9.]+))?$/i);
    if (spaceHsbMatch) {
      const h = parseFloat(spaceHsbMatch[1]);
      const s = parseFloat(spaceHsbMatch[2]);
      const b = parseFloat(spaceHsbMatch[3]);
      const a = spaceHsbMatch[4] !== undefined ? parseFloat(spaceHsbMatch[4]) : 1;
      if (!isNaN(h) && !isNaN(s) && !isNaN(b) && !isNaN(a)) {
        const [r, g, bVal] = hsbToRgb(h, s, b);
        return { r, g, b: bVal, a: clamp(a, 0, 1) };
      }
    }

    const cmykMatch = q.match(/(?:device-)?cmyk\(\s*([0-9.]+)%?\s*,\s*([0-9.]+)%?\s*,\s*([0-9.]+)%?\s*,\s*([0-9.]+)%?\s*\)/i);
    if (cmykMatch) {
      const c = parseFloat(cmykMatch[1]);
      const m = parseFloat(cmykMatch[2]);
      const y = parseFloat(cmykMatch[3]);
      const k = parseFloat(cmykMatch[4]);
      if (!isNaN(c) && !isNaN(m) && !isNaN(y) && !isNaN(k)) {
        const [r, g, b] = cmykToRgb(c, m, y, k);
        return { r, g, b, a: 1 };
      }
    }

    const spaceCmykMatch = q.match(/^(?:device-)?cmyk\s+([0-9.]+)%?\s+([0-9.]+)%?\s+([0-9.]+)%?\s+([0-9.]+)%?$/i);
    if (spaceCmykMatch) {
      const c = parseFloat(spaceCmykMatch[1]);
      const m = parseFloat(spaceCmykMatch[2]);
      const y = parseFloat(spaceCmykMatch[3]);
      const k = parseFloat(spaceCmykMatch[4]);
      if (!isNaN(c) && !isNaN(m) && !isNaN(y) && !isNaN(k)) {
        const [r, g, b] = cmykToRgb(c, m, y, k);
        return { r, g, b, a: 1 };
      }
    }

    return null;
  }

  function formatCssHex(r, g, b, a) {
    const hexR = r.toString(16).padStart(2, '0').toUpperCase();
    const hexG = g.toString(16).padStart(2, '0').toUpperCase();
    const hexB = b.toString(16).padStart(2, '0').toUpperCase();
    if (a >= 1) {
      return `#${hexR}${hexG}${hexB}`;
    }
    const hexA = Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();
    return `#${hexR}${hexG}${hexB}${hexA}`;
  }

  function formatCssRgb(r, g, b, a) {
    if (a >= 1) {
      return `rgb(${r}, ${g}, ${b})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${parseFloat(a.toFixed(3))})`;
  }

  function formatCssRgbPercent(r, g, b, a) {
    const pctR = Math.round((r / 255) * 100);
    const pctG = Math.round((g / 255) * 100);
    const pctB = Math.round((b / 255) * 100);
    if (a >= 1) {
      return `rgb(${pctR}%, ${pctG}%, ${pctB}%)`;
    }
    return `rgba(${pctR}%, ${pctG}%, ${pctB}%, ${parseFloat(a.toFixed(3))})`;
  }

  function formatCssHsl(r, g, b, a) {
    const [h, s, l] = rgbToHsl(r, g, b);
    if (a >= 1) {
      return `hsl(${h}, ${s}%, ${l}%)`;
    }
    return `hsla(${h}, ${s}%, ${l}%, ${parseFloat(a.toFixed(3))})`;
  }

  function formatCssHsv(r, g, b, a) {
    const [h, s, v] = rgbToHsb(r, g, b);
    if (a >= 1) {
      return `hsv(${h}, ${s}%, ${v}%)`;
    }
    return `hsva(${h}, ${s}%, ${v}%, ${parseFloat(a.toFixed(3))})`;
  }

  function formatCmyk(r, g, b) {
    const [c, m, y, k] = rgbToCmyk(r, g, b);
    return `cmyk(${c}%, ${m}%, ${y}%, ${k}%)`;
  }

  function formatNamedColor(r, g, b, a) {
    if (a < 1) return "None";
    const hex = formatCssHex(r, g, b, 1).toLowerCase();
    return HEX_TO_NAME[hex] || "None";
  }

  function formatNsCalibratedRgb(r, g, b, a) {
    const red = (r / 255).toFixed(3);
    const green = (g / 255).toFixed(3);
    const blue = (b / 255).toFixed(3);
    return `[NSColor colorWithCalibratedRed:${parseFloat(red)} green:${parseFloat(green)} blue:${parseFloat(blue)} alpha:${parseFloat(a.toFixed(3))}]`;
  }

  function formatNsCalibratedHsb(r, g, b, a) {
    const [h, s, v] = rgbToHsb(r, g, b);
    const hue = (h / 360).toFixed(3);
    const sat = (s / 100).toFixed(3);
    const bri = (v / 100).toFixed(3);
    return `[NSColor colorWithCalibratedHue:${parseFloat(hue)} saturation:${parseFloat(sat)} brightness:${parseFloat(bri)} alpha:${parseFloat(a.toFixed(3))}]`;
  }

  function formatNsDeviceRgb(r, g, b, a) {
    const red = (r / 255).toFixed(3);
    const green = (g / 255).toFixed(3);
    const blue = (b / 255).toFixed(3);
    return `[NSColor colorWithDeviceRed:${parseFloat(red)} green:${parseFloat(green)} blue:${parseFloat(blue)} alpha:${parseFloat(a.toFixed(3))}]`;
  }

  function formatNsDeviceHsb(r, g, b, a) {
    const [h, s, v] = rgbToHsb(r, g, b);
    const hue = (h / 360).toFixed(3);
    const sat = (s / 100).toFixed(3);
    const bri = (v / 100).toFixed(3);
    return `[NSColor colorWithDeviceHue:${parseFloat(hue)} saturation:${parseFloat(sat)} brightness:${parseFloat(bri)} alpha:${parseFloat(a.toFixed(3))}]`;
  }

  function formatUiRgb(r, g, b, a) {
    const red = (r / 255).toFixed(3);
    const green = (g / 255).toFixed(3);
    const blue = (b / 255).toFixed(3);
    return `[UIColor colorWithRed:${parseFloat(red)} green:${parseFloat(green)} blue:${parseFloat(blue)} alpha:${parseFloat(a.toFixed(3))}]`;
  }

  function formatUiHsb(r, g, b, a) {
    const [h, s, v] = rgbToHsb(r, g, b);
    const hue = (h / 360).toFixed(3);
    const sat = (s / 100).toFixed(3);
    const bri = (v / 100).toFixed(3);
    return `[UIColor colorWithHue:${parseFloat(hue)} saturation:${parseFloat(sat)} brightness:${parseFloat(bri)} alpha:${parseFloat(a.toFixed(3))}]`;
  }

  function formatColor(color, type) {
    const { r, g, b, a } = color;
    switch (type) {
      case 'hex': return formatCssHex(r, g, b, a);
      case 'rgb': return formatCssRgb(r, g, b, a);
      case 'rgb_percent': return formatCssRgbPercent(r, g, b, a);
      case 'hsl': return formatCssHsl(r, g, b, a);
      case 'hsv': return formatCssHsv(r, g, b, a);
      case 'cmyk': return formatCmyk(r, g, b);
      case 'ns_calibrated_rgb': return formatNsCalibratedRgb(r, g, b, a);
      case 'ns_calibrated_hsb': return formatNsCalibratedHsb(r, g, b, a);
      case 'ns_device_rgb': return formatNsDeviceRgb(r, g, b, a);
      case 'ns_device_hsb': return formatNsDeviceHsb(r, g, b, a);
      case 'ui_rgb': return formatUiRgb(r, g, b, a);
      case 'ui_hsb': return formatUiHsb(r, g, b, a);
      default: return '';
    }
  }

  function initWheel(wheel, marker, onChange) {
    let isDragging = false;

    function updateFromEvent(e) {
      const rect = wheel.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      
      let clientX, clientY;
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const dx = clientX - cx;
      const dy = clientY - cy;
      
      const dist = Math.sqrt(dx * dx + dy * dy);
      const R = rect.width / 2;
      
      const saturation = Math.min(100, (dist / R) * 100);
      
      let angleDeg = Math.atan2(dx, -dy) * (180 / Math.PI);
      if (angleDeg < 0) {
        angleDeg += 360;
      }
      const hue = angleDeg;

      onChange(hue, saturation);
    }

    function onStart(e) {
      isDragging = true;
      updateFromEvent(e);
      
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
      
      e.preventDefault();
    }

    function onMove(e) {
      if (!isDragging) return;
      updateFromEvent(e);
      e.preventDefault();
    }

    function onEnd() {
      isDragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    }

    wheel.addEventListener('mousedown', onStart);
    wheel.addEventListener('touchstart', onStart, { passive: false });
  }

  function init() {
    document.querySelectorAll("[data-color-translator-card]").forEach(initCard);
  }

  function initCard(card) {
    if (card.__colorTranslatorInitialized) return;
    card.__colorTranslatorInitialized = true;

    const hexInput = card.querySelector('[data-clrtr-input="hex"]');
    const initialHex = hexInput ? hexInput.value : '#FF0000';
    let currentColor = parseColor(initialHex) || { r: 255, g: 0, b: 0, a: 1 };
    let [h, s, l] = rgbToHsl(currentColor.r, currentColor.g, currentColor.b);
    let a = currentColor.a;

    const previewBox = card.querySelector('.clrtr-preview-box');
    const previewBadge = card.querySelector('.clrtr-preview-badge');
    const colorNameSpan = card.querySelector('.clrtr-color-name span');
    const marker = card.querySelector('[data-clrtr-wheel-marker]');
    const wheel = card.querySelector('[data-clrtr-wheel]');
    
    const inputs = {};
    card.querySelectorAll('[data-clrtr-input]').forEach(input => {
      const type = input.getAttribute('data-clrtr-input');
      inputs[type] = input;
    });

    const hueSlider = card.querySelector('[data-clrtr-slider="hue"]');
    const lightnessSlider = card.querySelector('[data-clrtr-slider="lightness"]');
    const opacitySlider = card.querySelector('[data-clrtr-slider="opacity"]');

    function updateColorFromRgb(r, g, b, newAlpha) {
      currentColor.r = r;
      currentColor.g = g;
      currentColor.b = b;
      currentColor.a = newAlpha;
      
      const [newH, newS, newL] = rgbToHsl(r, g, b);
      h = newH;
      s = newS;
      l = newL;
      a = newAlpha;
    }

    function updateColorFromHsl(newH, newS, newL, newAlpha) {
      h = newH;
      s = newS;
      l = newL;
      a = newAlpha;
      
      const [r, g, b] = hslToRgb(h, s, l);
      currentColor.r = r;
      currentColor.g = g;
      currentColor.b = b;
      currentColor.a = a;
    }

    function updateUI(source) {
      const rgbCss = formatCssRgb(currentColor.r, currentColor.g, currentColor.b, currentColor.a);
      if (previewBox) {
        previewBox.style.backgroundColor = rgbCss;
      }
      
      const hexCss = formatCssHex(currentColor.r, currentColor.g, currentColor.b, currentColor.a);
      if (previewBadge) {
        previewBadge.textContent = hexCss;
      }

      const nameCss = formatNamedColor(currentColor.r, currentColor.g, currentColor.b, currentColor.a);
      if (colorNameSpan) {
        colorNameSpan.textContent = nameCss;
      }

      for (const [type, input] of Object.entries(inputs)) {
        const val = input === source ? input.value : formatColor(currentColor, type);
        if (input !== source) {
          input.value = val;
        }
        const btn = input.closest('.clrtr-row')?.querySelector('.clrtr-copy-btn');
        if (btn) {
          btn.setAttribute('data-copy', val);
        }
      }

      if (marker) {
        const rad = h * (Math.PI / 180);
        const left = 50 + (s * 0.5 * Math.sin(rad));
        const top = 50 - (s * 0.5 * Math.cos(rad));
        marker.style.left = `${left}%`;
        marker.style.top = `${top}%`;
      }

      if (hueSlider && source !== hueSlider) hueSlider.value = h;
      if (lightnessSlider && source !== lightnessSlider) lightnessSlider.value = l;
      if (opacitySlider && source !== opacitySlider) opacitySlider.value = a;

      if (lightnessSlider) {
        lightnessSlider.style.background = `linear-gradient(to right, #000 0%, hsl(${h}, ${s}%, 50%) 50%, #fff 100%)`;
      }
      if (opacitySlider) {
        opacitySlider.style.backgroundImage = `linear-gradient(to right, transparent, hsl(${h}, ${s}%, ${l}%)), repeating-conic-gradient(#ccc 0 25%, #fff 0 50%)`;
      }
    }

    if (wheel && marker) {
      initWheel(wheel, marker, (newH, newS) => {
        updateColorFromHsl(newH, newS, l, a);
        updateUI(wheel);
      });
    }

    [hueSlider, lightnessSlider, opacitySlider].forEach(slider => {
      if (!slider) return;
      slider.addEventListener('input', () => {
        const type = slider.getAttribute('data-clrtr-slider');
        const val = parseFloat(slider.value);
        if (type === 'hue') {
          h = val;
        } else if (type === 'lightness') {
          l = val;
        } else if (type === 'opacity') {
          a = val;
        }
        updateColorFromHsl(h, s, l, a);
        updateUI(slider);
      });
    });

    for (const [type, input] of Object.entries(inputs)) {
      input.addEventListener('input', () => {
        const parsed = parseColor(input.value);
        if (parsed) {
          updateColorFromRgb(parsed.r, parsed.g, parsed.b, parsed.a);
          updateUI(input);
        }
      });
      input.addEventListener('blur', () => {
        updateUI();
      });
    }

    const copyButtons = card.querySelectorAll(".clrtr-copy-btn");
    copyButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const textToCopy = btn.getAttribute("data-copy");
        if (!textToCopy) return;

        navigator.clipboard.writeText(textToCopy).then(() => {
          btn.classList.add("copied");
          setTimeout(() => {
            btn.classList.remove("copied");
          }, 1500);
        }).catch((err) => {
          console.error("Failed to copy text: ", err);
        });
      });
    });

    updateUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  const observer = new MutationObserver(init);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
