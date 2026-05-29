// Places slot plugin — local place recognition with Geoapify (primary) and Foursquare (booster).

const PLUGIN_NAME = "Places";
const PLUGIN_VERSION = "2.8.0";
const PLUGIN_DESCRIPTION =
  "Local place recognition — shows nearby businesses and POIs with address, hours, phone, directions, and interactive map.";

let _settings = {};
let _fetch = (...args) => fetch(...args);
let _cache = null;

const DEFAULT_PHOTON_URL = "https://photon.komoot.io";
const FOURSQUARE_BASE = "https://places-api.foursquare.com/places/search";
const GEOAPIFY_BASE = "https://api.geoapify.com/v2/places";

function _configure(s) {
  _settings = {
    geoapifyApiKey: s?.geoapifyApiKey || "0a2341f20dfa4b92952a726eb1e36554",
    locationiqApiKey: s?.locationiqApiKey || "pk.14ed93f5ee290008c448b4a0f07f73ad",
    foursquareApiKey: s?.foursquareApiKey || "",
    foursquareClientId: s?.foursquareClientId || "",
    foursquareClientSecret: s?.foursquareClientSecret || "",
    defaultLat: s?.defaultLat || "",
    defaultLon: s?.defaultLon || "",
    defaultLocationLabel: s?.defaultLocationLabel || "Home",
    useBrowserGeolocation: s?.useBrowserGeolocation === true || s?.useBrowserGeolocation === "true",
    defaultRadius: s?.defaultRadius || "25",
    resultsCount: s?.resultsCount || "5",
    distanceUnit: s?.distanceUnit || "miles",
    customTileUrl: s?.customTileUrl || "",
    photonBaseUrl: s?.photonBaseUrl || DEFAULT_PHOTON_URL,
  };
}

export const slot = {
  id: "osm-slot",
  name: PLUGIN_NAME,
  description: PLUGIN_DESCRIPTION,
  isClientExposed: true,
  position: "above-results",
  slotPositions: ["above-results", "knowledge-panel"],

  settingsSchema: [
    {
      key: "geoapifyApiKey",
      label: "Geoapify API key",
      type: "password",
      secret: true,
      required: true,
      default: "0a2341f20dfa4b92952a726eb1e36554",
      description: "Primary provider for nearby places and POIs. Required. Get a free key at geoapify.com.",
    },
    {
      key: "foursquareApiKey",
      label: "Foursquare API key",
      type: "password",
      secret: true,
      description:
        "Optional booster. Provides rich business data (ratings, hours, phone). Get one at foursquare.com/developers.",
    },
    {
      key: "locationiqApiKey",
      label: "LocationIQ API key",
      type: "password",
      secret: true,
      default: "pk.14ed93f5ee290008c448b4a0f07f73ad",
      description: "Optional fallback geocoder. Get a free key at locationiq.com.",
    },
    {
      key: "defaultLat",
      label: "Default latitude",
      type: "text",
      required: true,
      placeholder: "40.7128",
      description: "Latitude of your default search center.",
    },
    {
      key: "defaultLon",
      label: "Default longitude",
      type: "text",
      required: true,
      placeholder: "-74.0060",
      description: "Longitude of your default search center.",
    },
    {
      key: "defaultLocationLabel",
      label: "Default location label",
      type: "text",
      default: "Home",
      description: "Label shown in the card header, e.g. 'Home / Flemington NJ'.",
    },
    {
      key: "useBrowserGeolocation",
      label: "Ask browser for precise location",
      type: "toggle",
      default: false,
      description:
        "Show a button that lets the browser request your live location for more accurate nearby results.",
    },
    {
      key: "defaultRadius",
      label: "Search radius",
      type: "select",
      options: ["5", "10", "25", "50"],
      default: "25",
      description: "Search radius in miles.",
    },
    {
      key: "resultsCount",
      label: "Results count",
      type: "select",
      options: ["3", "5", "10", "15", "20", "25", "30"],
      default: "5",
      description: "How many place cards to show.",
    },
    {
      key: "distanceUnit",
      label: "Distance unit",
      type: "select",
      options: ["miles", "km"],
      default: "miles",
    },
    {
      key: "customTileUrl",
      label: "Custom map tile URL",
      type: "text",
      placeholder: "https://api.maptiler.com/maps/streets-v4/{z}/{x}/{y}.png?key=YOUR_KEY",
      description:
        "Optional raster tile template for the map. Supports {z}, {x}, and {y}. Leave blank to use the default OpenStreetMap embed.",
    },
  ],

  init(ctx) {
    if (typeof ctx?.fetch === "function") {
      _fetch = (...args) => ctx.fetch(...args);
    }
    if (typeof ctx?.createCache === "function") {
      _cache = ctx.createCache(5 * 60 * 1000); // 5 minutes
    }
  },

  configure: _configure,

  isConfigured() {
    const lat = parseFloat(_settings.defaultLat);
    const lon = parseFloat(_settings.defaultLon);
    return (
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lon) <= 180
    );
  },

  trigger(query) {
    return _looksProbablyPlaceQuery(query);
  },

  async execute(query, context) {
    const q = query.trim();
    const apiStatus = {
      geoapify: { configured: !!_settings.geoapifyApiKey, status: "unused", error: null, count: 0 },
      foursquareV3: { configured: !!_settings.foursquareApiKey, status: "unused", error: null, count: 0 },
      locationiq: { configured: !!_settings.locationiqApiKey, status: "unused", error: null, count: 0 }
    };

    if (!_looksProbablyPlaceQuery(q)) {
      console.log(`[Places Server v${PLUGIN_VERSION}] Query "${q}" did not pass trigger filter.`);
      return { html: "" };
    }

    try {
      const lat = parseFloat(_settings.defaultLat);
      const lon = parseFloat(_settings.defaultLon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        console.warn(`[Places Server v${PLUGIN_VERSION}] Invalid or missing default coordinates.`);
        return { html: "" };
      }

      const radiusMiles = parseInt(_settings.defaultRadius || "25", 10);
      const radiusMeters = radiusMiles * 1609.34;
      const limit = parseInt(_settings.resultsCount || "5", 10);
      const doFetch = typeof context?.fetch === "function" ? context.fetch : _fetch;

      const wrapFetch = (url, init = {}, timeoutMs = 15000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        const mergedInit = { ...init };
        if (!mergedInit.signal) mergedInit.signal = controller.signal;
        const startFetch = Date.now();
        return doFetch(url, mergedInit)
          .then((res) => {
            clearTimeout(id);
            console.log(`[Places Performance v${PLUGIN_VERSION}] Fetch completed: ${url.split("?")[0]} in ${Date.now() - startFetch}ms`);
            return res;
          })
          .catch((err) => {
            clearTimeout(id);
            console.warn(`[Places Performance v${PLUGIN_VERSION}] Fetch failed: ${url.split("?")[0]} - ${err.message}`);
            throw err;
          });
      };

      console.log(`[Places Server v${PLUGIN_VERSION}] Executing search for: "${q}" at lat=${lat}, lon=${lon}`);

      const places = await _searchAllProviders(q, lat, lon, radiusMeters, limit * 2, wrapFetch, apiStatus);

      const top = _processPlaces(q, places, limit, {
        enforceDistanceGate: true,
        enforceConfidenceGate: true,
      });

      if (top.length === 0) {
        console.log(`[Places Server v${PLUGIN_VERSION}] No high-confidence results found for query: "${q}"`);
        // Always return the wrapper with API status even if empty, so client can log it
        return { 
          html: `<div class="places-wrap" style="display:none" data-places-version="${PLUGIN_VERSION}" data-places-apis='${JSON.stringify(apiStatus)}'></div>` 
        };
      }

      // Final processing and details fetch (Foursquare/LocationIQ results already have these)
      // Overpass is removed from primary pipeline, but we might still use it for specific detail enrichment if needed.

      const html = _renderCard(
        top,
        q,
        _settings.defaultLocationLabel || "Home",
        _settings.useBrowserGeolocation,
        apiStatus
      );
      return { html };
    } catch (err) {
      console.error("[places] lookup failed:", err);
      return { html: "" };
    }
  },
};

export default slot;

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

export const routes = [
  {
    method: "post",
    path: "refresh",
    handler: async (request) => {
      try {
        let body = {};
        try { body = await request.json(); } catch (_) { if (request.body) body = request.body; }
        const { lat, lon, query } = body;
        const latNum = parseFloat(lat);
        const lonNum = parseFloat(lon);
        if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return _jsonResponse({ error: "Invalid coordinates" }, 400);

        const radiusMiles = parseInt(_settings.defaultRadius || "25", 10);
        const radiusMeters = radiusMiles * 1609.34;
        const limit = parseInt(_settings.resultsCount || "5", 10);

        const apiStatus = {
          geoapify: { configured: !!_settings.geoapifyApiKey, status: "unused", error: null, count: 0 },
          foursquareV3: { configured: !!_settings.foursquareApiKey, status: "unused", error: null, count: 0 },
          locationiq: { configured: !!_settings.locationiqApiKey, status: "unused", error: null, count: 0 }
        };

        const places = await _searchAllProviders(query || "", latNum, lonNum, radiusMeters, limit * 2, _fetch, apiStatus);

        const top = _processPlaces(query || "", places, limit, {
          enforceDistanceGate: false,
          enforceConfidenceGate: false,
        });

        if (top.length === 0) return _jsonResponse({ html: "" });

        const html = _renderCard(top, query || "", "your location", false, apiStatus);
        return _jsonResponse({ html });
      } catch (err) {
        return _jsonResponse({ html: "" });
      }
    },
  },
];

function _jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/* ------------------------------------------------------------------ */
/* Provider orchestration                                              */
/* ------------------------------------------------------------------ */

async function _searchAllProviders(query, lat, lon, radiusM, limit, doFetch, apiStatus) {
  const startAll = Date.now();
  let out = [];

  // 1. Geoapify as the primary live API
  if (_settings.geoapifyApiKey) {
    const geoStart = Date.now();
    try {
      out = await _searchGeoapify(query, lat, lon, radiusM, limit, (url, init) => doFetch(url, init, 5000), apiStatus);
      if (out.length > 0) {
        console.log(`[Places Performance v${PLUGIN_VERSION}] Geoapify returned ${out.length} results. Using as primary.`);
        return out;
      }
    } catch (err) {
      console.error(`[Places Performance v${PLUGIN_VERSION}] Geoapify search failed:`, err);
    }
  }

  // 2. Foursquare as optional quality booster/fallback
  if (out.length < limit && (_settings.foursquareApiKey || (_settings.foursquareClientId && _settings.foursquareClientSecret))) {
    const fqStart = Date.now();
    try {
      const fqResults = await _searchFoursquare(query, lat, lon, radiusM, limit, (url, init) => doFetch(url, init, 10000), apiStatus);
      out.push(...fqResults);
    } catch (err) {
      console.error(`[Places Performance v${PLUGIN_VERSION}] Foursquare search failed:`, err);
    }
  }

  // 3. LocationIQ as a sequential commercial fallback
  if (out.length === 0 && _settings.locationiqApiKey) {
    const liqStart = Date.now();
    try {
      const liqResults = await _searchLocationIQ(query, lat, lon, limit, (url, init) => doFetch(url, init, 5000), apiStatus);
      out.push(...liqResults);
    } catch (_) {}
  }

  console.log(`[Places Performance v${PLUGIN_VERSION}] Total _searchAllProviders execution time: ${Date.now() - startAll}ms`);
  return out;
}

/* ------------------------------------------------------------------ */
/* Individual providers                                                */
/* ------------------------------------------------------------------ */

async function _searchGeoapify(query, lat, lon, radiusM, limit, doFetch, apiStatus) {
  const cacheKey = `ga:${query}:${lat}:${lon}:${Math.round(radiusM)}:${limit}`;
  if (_cache?.has(cacheKey)) return _cache.get(cacheKey);

  const key = _settings.geoapifyApiKey || "0a2341f20dfa4b92952a726eb1e36554";
  const categories = _inferGeoapifyCategories(query);

  const buildUrl = (cats) => {
    let url = `${GEOAPIFY_BASE}?name=${encodeURIComponent(query)}` +
      `&filter=circle:${lon},${lat},${Math.round(radiusM)}` +
      `&bias=proximity:${lon},${lat}` +
      `&limit=${limit}` +
      `&apiKey=${key}`;
    if (cats) url += `&categories=${encodeURIComponent(cats)}`;
    return url;
  };

  let res = await doFetch(buildUrl(categories), {}, 5000);
  if (!res.ok) {
    const msg = `HTTP ${res.status}`;
    if (apiStatus?.geoapify) { apiStatus.geoapify.status = "error"; apiStatus.geoapify.error = msg; }
    return [];
  }

  let data = await res.json();
  
  // If zero results with category filter, retry once without it to be permissive
  if ((!data.features || data.features.length === 0) && categories) {
    console.log(`[Places Server v${PLUGIN_VERSION}] Geoapify returned 0 with category filter, retrying without filter...`);
    res = await doFetch(buildUrl(""), {}, 5000);
    if (res.ok) data = await res.json();
  }

  if (!data?.features || !Array.isArray(data.features)) return [];

  const out = data.features.map(f => {
    const p = f.properties;
    if (!p) return null;
    return {
      name: p.name || p.street || query,
      address: p.formatted || p.address_line2 || "",
      lat: p.lat,
      lon: p.lon,
      distanceMeters: p.distance || _haversine(lat, lon, p.lat, p.lon),
      phone: p.contact?.phone || null,
      website: p.contact?.website || null,
      hours: p.opening_hours ? { display: _formatOsmHours(p.opening_hours) } : null,
      categories: p.categories || [],
      source: "Geoapify",
      sourceUrl: p.datasource?.raw?.osm_id 
        ? `https://www.openstreetmap.org/${p.datasource.raw.osm_type || "node"}/${p.datasource.raw.osm_id}`
        : `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}`,
    };
  }).filter(Boolean);

  if (apiStatus?.geoapify) {
    apiStatus.geoapify.status = "success";
    apiStatus.geoapify.count = out.length;
  }

  _cache?.set(cacheKey, out);
  return out;
}

function _inferGeoapifyCategories(query) {
  const q = query.toLowerCase();
  const cats = [];
  if (/\b(coffee|cafe|starbucks|dunkin|espresso)\b/.test(q)) cats.push("catering.cafe");
  if (/\b(pizza|domino|hut|papa)\b/.test(q)) cats.push("catering.restaurant.pizza");
  if (/\b(taco|mexican|tacoria|chipotle|bell)\b/.test(q)) cats.push("catering.restaurant.mexican");
  if (/\b(burger|king|mcdonald|wendy|five guys|shake shack)\b/.test(q)) cats.push("catering.restaurant.burger");
  if (/\b(restaurant|food|eat|dinner|lunch|steak|grill|tavern|tap)\b/.test(q)) cats.push("catering.restaurant");
  if (/\b(ice cream|dessert|bear|yogurt|sweet)\b/.test(q)) cats.push("catering.cafe.dessert");
  if (/\b(bank|atm|chase|well|citibank|bofa)\b/.test(q)) cats.push("service.financial");
  if (/\b(gas|fuel|shell|exxon|mobil)\b/.test(q)) cats.push("service.fuel");
  if (/\b(pharmacy|cvs|walgreens|drugstore)\b/.test(q)) cats.push("healthcare.pharmacy");
  if (/\b(grocery|supermarket|market|whole foods|trader|depot)\b/.test(q)) cats.push("commercial.supermarket");
  if (/\b(home depot|lowes?|hardware|construction)\b/.test(q)) cats.push("commercial.construction", "commercial.houseware_and_furniture");
  if (/\b(hotel|motel|inn|stay|accommodation)\b/.test(q)) cats.push("accommodation");
  
  // If nothing specific, use a broad high-level set that covers most commercial POIs
  if (cats.length === 0) {
    return "commercial,catering,service,accommodation,leisure";
  }
  return cats.join(",");
}

async function _searchFoursquare(query, lat, lon, radiusM, limit, doFetch, apiStatus) {
  const cacheKey = `fq:${query}:${lat}:${lon}:${Math.round(radiusM)}:${limit}`;
  if (_cache?.has(cacheKey)) return _cache.get(cacheKey);

  let out = [];
  if (_settings.foursquareApiKey) {
    try {
      const authHeader = _settings.foursquareApiKey.startsWith("fsq3") ? _settings.foursquareApiKey : `Bearer ${_settings.foursquareApiKey}`;
      const fields = "name,location,geocodes,categories,tel,website,hours,rating,stats,fsq_id,distance";
      const url = `${FOURSQUARE_BASE}?query=${encodeURIComponent(query)}&ll=${lat},${lon}&radius=${Math.round(radiusM)}&limit=${limit}&fields=${encodeURIComponent(fields)}`;
      const res = await doFetch(url, { headers: { Authorization: authHeader, Accept: "application/json", "X-Places-Api-Version": "2025-06-17" } });

      if (res.ok) {
        const data = await res.json();
        out = (data.results || []).map((r) => ({
          name: r.name,
          address: _fmtFsqAddress(r.location),
          lat: r.geocodes?.main?.latitude,
          lon: r.geocodes?.main?.longitude,
          distanceMeters: r.distance || _haversine(lat, lon, r.geocodes?.main?.latitude, r.geocodes?.main?.longitude),
          phone: r.tel || null,
          website: r.website || null,
          categories: (r.categories || []).map((c) => c.name),
          hours: r.hours?.display ? { display: r.hours.display, openNow: r.hours.open_now } : null,
          rating: r.rating ? r.rating / 2 : null,
          reviewCount: r.stats?.total_ratings || null,
          source: "Foursquare",
          sourceUrl: `https://foursquare.com/v/${r.fsq_id}`,
        }));
        if (apiStatus?.foursquareV3) { apiStatus.foursquareV3.status = "success"; apiStatus.foursquareV3.count = out.length; }
      }
    } catch (_) {}
  }
  _cache?.set(cacheKey, out);
  return out;
}

async function _searchLocationIQ(query, lat, lon, limit, doFetch, apiStatus) {
  const cacheKey = `liq:${query}:${lat}:${lon}:${limit}`;
  if (_cache?.has(cacheKey)) return _cache.get(cacheKey);

  const key = _settings.locationiqApiKey || "pk.14ed93f5ee290008c448b4a0f07f73ad";
  const url = `https://us1.locationiq.com/v1/search?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&format=json&limit=${limit}&addressdetails=1&extratags=1&lat=${lat}&lon=${lon}`;

  try {
    const res = await doFetch(url, {}, 5000);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const out = data.map((r) => {
      const plat = parseFloat(r.lat);
      const plon = parseFloat(r.lon);
      if (!Number.isFinite(plat) || !Number.isFinite(plon)) return null;
      const xt = r.extratags || {};
      return {
        name: r.address?.[r.type || r.class] || r.name || r.display_name?.split(",")[0]?.trim() || query,
        address: _fmtNominatimAddress(r),
        lat: plat,
        lon: plon,
        distanceMeters: _haversine(lat, lon, plat, plon),
        phone: xt.phone || xt["contact:phone"] || null,
        website: xt.website || xt.url || null,
        hours: xt.opening_hours ? { display: _formatOsmHours(xt.opening_hours) } : null,
        categories: r.type ? [r.type.replace(/_/g, " ")] : [],
        source: "LocationIQ",
        sourceUrl: r.osm_type && r.osm_id ? `https://www.openstreetmap.org/${r.osm_type}/${r.osm_id}` : `https://www.openstreetmap.org/?mlat=${plat}&mlon=${plon}`,
      };
    }).filter(Boolean);

    if (apiStatus?.locationiq) { apiStatus.locationiq.status = "success"; apiStatus.locationiq.count = out.length; }
    _cache?.set(cacheKey, out);
    return out;
  } catch (_) { return []; }
}

/* ------------------------------------------------------------------ */
/* Logic & Utilities                                                   */
/* ------------------------------------------------------------------ */

function _processPlaces(query, places, limit, options = {}) {
  let out = _dedupeAndMergePlaces(places);
  const normQuery = _normalizeName(query);

  out.forEach(p => {
    const nameSim = _nameSimilarity(normQuery, p.name);
    const distanceScore = Math.max(0, 1 - (p.distanceMeters / 40233)); // 0 at 25 miles
    const hasCategoryMatch = p.categories.some(c => normQuery.includes(_normalizeName(c)));
    const categoryRelevance = hasCategoryMatch ? 1 : 0.5;
    const completeness = (p.phone ? 0.4 : 0) + (p.website ? 0.3 : 0) + (p.hours ? 0.3 : 0);

    p.score = (0.45 * nameSim) + (0.25 * distanceScore) + (0.20 * categoryRelevance) + (0.10 * completeness);
  });

  out.sort((a, b) => b.score - a.score);

  if (options.enforceConfidenceGate) {
    const topScore = out[0]?.score || 0;
    const secondScore = out[1]?.score || 0;
    if (!(topScore >= 0.72 || (topScore >= 0.65 && secondScore >= 0.65))) return [];
  }

  if (options.enforceDistanceGate) out = out.filter(p => p.distanceMeters < 80467); // 50 miles
  return out.slice(0, limit);
}

function _dedupeAndMergePlaces(places) {
  const out = [];
  for (const p of places) {
    const norm = _normalizeName(p.name);
    let existing = out.find(e => _haversine(p.lat, p.lon, e.lat, e.lon) < 150 && (_normalizeName(e.name).includes(norm) || norm.includes(_normalizeName(e.name))));
    if (existing) {
      existing.phone = existing.phone || p.phone;
      existing.website = existing.website || p.website;
      existing.hours = existing.hours || p.hours;
      if (p.source !== "LocationIQ") { existing.sourceUrl = p.sourceUrl; existing.source = p.source; }
    } else {
      out.push(p);
    }
  }
  return out;
}

function _nameSimilarity(q, n) {
  const n1 = _normalizeName(q);
  const n2 = _normalizeName(n);
  if (n2.includes(n1) || n1.includes(n2)) return 1.0;
  const sim = _levenshtein(n1, n2);
  return 1 - Math.min(sim / Math.max(n1.length, n2.length), 1);
}

function _normalizeName(s) {
  return String(s || "").toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

function _levenshtein(a, b) {
  if (!a.length) return b.length; if (!b.length) return a.length;
  const m = []; for (let i = 0; i <= b.length; i++) m[i] = [i]; for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] = b.charAt(i-1) === a.charAt(j-1) ? m[i-1][j-1] : Math.min(m[i-1][j-1]+1, m[i][j-1]+1, m[i-1][j]+1);
    }
  }
  return m[b.length][a.length];
}

function _haversine(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const R = 6371e3;
  const toRad = (n) => (n * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1); const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function _looksProbablyPlaceQuery(query) {
  const q = String(query || "").trim().toLowerCase();
  if (q.length < 2 || q.length > 100) return false;
  const TR = /\b(near me|nearby|nearest|closest|locations?|address|directions?|hours?|open now|phone|menu|reservations?|reviews?|coffee|pizza|tacos|pharmacy|gas|grocery|restaurant|bar|cafe|ice cream)\b/i;
  const NEG = /\b(qwen|python|npm|github|react|docker|linux|error|docs|tutorial|reddit|download|install|meaning|lyrics|wikipedia|cast|streaming|movie|trailer|episode|watch|meaning of|how to|what is)\b/i;
  if (NEG.test(q)) return false;
  if (TR.test(q)) return true;
  const words = q.split(/\s+/);
  return words.length <= 4 && words.every(w => /^[a-z0-9]/.test(w));
}

function _renderCard(places, query, locationLabel, showGeoBtn, apiStatus) {
  const listHtml = places.map((p, idx) => {
    const distStr = _settings.distanceUnit === "km" ? (p.distanceMeters/1000).toFixed(1)+" km" : (p.distanceMeters/1609.34).toFixed(1)+" mi";
    const hoursBadge = p.hours?.display ? `<span class="places-hours">${p.hours.display.split(",")[0]}</span>` : "";
    const stars = p.rating ? `<div class="places-rating"><span class="places-stars" style="--rating: ${p.rating}"></span><span class="places-count">(${p.reviewCount || 0})</span></div>` : "";
    return `
      <div class="places-card ${idx===0?"places-card-selected":""}" data-place-card data-lat="${p.lat}" data-lon="${p.lon}" data-place-name="${_esc(p.name)}">
        <div class="places-card-main">
          <div class="places-name-row"><span class="places-name">${_esc(p.name)}</span><span class="places-distance">${distStr}</span></div>
          <div class="places-meta">${hoursBadge}<span class="places-category">${_esc(p.categories[0] || "")}</span></div>
          ${stars}
          <div class="places-address" title="${_esc(p.address)}">${_esc(p.address)}</div>
        </div>
        <div class="places-actions">
          <a href="${_esc(p.website || "#")}" class="places-action-website ${!p.website ? "places-disabled" : ""}" target="_blank" rel="noopener">Website</a>
          <a href="tel:${_esc(p.phone || "")}" class="places-action-call ${!p.phone ? "places-disabled" : ""}">Call</a>
          <button type="button" class="places-action-directions" data-directions-btn data-place-name="${_esc(p.name)}" data-lat="${p.lat}" data-lon="${p.lon}" data-address="${_esc(p.address)}">Directions</button>
        </div>
      </div>`;
  }).join("");

  const first = places[0];
  const mapHtml = `<div class="places-map-panel" data-map-panel data-lat="${first.lat}" data-lon="${first.lon}" data-place-name="${_esc(first.name)}">
    <div class="places-tile-map" data-lat="${first.lat}" data-lon="${first.lon}" data-zoom="15" data-tile-template="${_esc(_settings.customTileUrl || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")}">
      <div class="places-tile-layer"></div>
      <div class="places-map-controls"><button type="button" class="places-map-btn" data-zoom-in>+</button><button type="button" class="places-map-btn" data-zoom-out>−</button></div>
    </div>
    <a href="https://www.openstreetmap.org/?mlat=${first.lat}&mlon=${first.lon}#map=15/${first.lat}/${first.lon}" class="places-map-link" target="_blank" rel="noopener" data-map-link>View on OpenStreetMap</a>
  </div>`;

  return `<div class="places-wrap" data-places-version="${PLUGIN_VERSION}" data-places-apis='${JSON.stringify(apiStatus || {})}'>
    <div class="places-header"><div class="places-title-row"><span class="places-title">Local Places</span>${showGeoBtn ? `<button type="button" class="places-geo-btn" data-query="${_esc(query)}">Use my location</button>` : ""}</div><span class="places-subhead">near ${_esc(locationLabel)}</span></div>
    <div class="places-content"><div class="places-list">${listHtml}</div>${mapHtml}</div>
    <div class="places-modal" data-places-modal hidden><div class="places-modal-content"><div class="places-modal-header"><span>Get Directions</span><button type="button" class="places-modal-close" data-modal-close>&times;</button></div><div class="places-modal-body"><a href="#" class="places-modal-option" data-modal-option="google" target="_blank" rel="noopener">Google Maps</a><a href="#" class="places-modal-option" data-modal-option="apple" target="_blank" rel="noopener">Apple Maps</a><a href="#" class="places-modal-option" data-modal-option="osm" target="_blank" rel="noopener">OpenStreetMap</a></div></div></div>
  </div>`;
}

function _fmtFsqAddress(loc) {
  if (!loc) return ""; if (loc.formatted_address) return loc.formatted_address;
  return [loc.address, loc.cross_street, loc.city, loc.state, loc.postcode].filter(Boolean).join(", ");
}

function _fmtNominatimAddress(r) {
  if (r.address) {
    const a = r.address;
    return [a.house_number, a.road || a.pedestrian || a.suburb, a.city || a.town || a.village || a.municipality, a.state, a.postcode, a.country].filter(Boolean).join(", ");
  }
  return r.display_name || "";
}

function _formatOsmHours(oh) {
  if (!oh) return null; if (oh.toLowerCase() === "24/7") return "Open 24/7";
  const daysMap = { "Mo": "Mon", "Tu": "Tue", "We": "Wed", "Th": "Thu", "Fr": "Fri", "Sa": "Sat", "Su": "Sun" };
  const to12Hr = (t) => {
    const p = t.split(":"); if (p.length !== 2) return t;
    let h = parseInt(p[0], 10); if (isNaN(h)) return t;
    const ampm = h >= 12 ? "PM" : "AM"; h = h % 12; if (h === 0) h = 12;
    return `${h}:${p[1]} ${ampm}`;
  };
  return oh.split(";").map(s => {
    const tm = s.match(/\d{2}:\d{2}/); if (!tm) return s;
    const days = s.substring(0, tm.index).trim(); const times = s.substring(tm.index).trim();
    let d = days; for (const [k, v] of Object.entries(daysMap)) d = d.replace(new RegExp(k, "g"), v);
    const tr = times.split("-").map(p => to12Hr(p.trim())).join("–");
    return d ? `${d}: ${tr}` : tr;
  }).join(", ");
}

function _esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
