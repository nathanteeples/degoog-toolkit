// Places slot plugin — local place recognition with Geoapify (primary), Foursquare, Yelp, Overpass, Photon, and Nominatim.

const PLUGIN_NAME = "Places";
const PLUGIN_VERSION = "2.7.0";
const PLUGIN_DESCRIPTION =
  "Local place recognition — shows nearby businesses and POIs with address, hours, phone, directions, and interactive map.";

let _settings = {};
let _fetch = (...args) => fetch(...args);
let _cache = null;

const DEFAULT_PHOTON_URL = "https://photon.komoot.io";
const FOURSQUARE_BASE = "https://places-api.foursquare.com/places/search";
const YELP_BASE = "https://api.yelp.com/v3/businesses/search";
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
const GEOAPIFY_BASE = "https://api.geoapify.com/v2/places";

function _configure(s) {
  _settings = {
    geoapifyApiKey: s?.geoapifyApiKey || "0a2341f20dfa4b92952a726eb1e36554",
    locationiqApiKey: s?.locationiqApiKey || "pk.14ed93f5ee290008c448b4a0f07f73ad",
    foursquareApiKey: s?.foursquareApiKey || "",
    foursquareClientId: s?.foursquareClientId || "",
    foursquareClientSecret: s?.foursquareClientSecret || "",
    yelpApiKey: s?.yelpApiKey || "",
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
      description: "Primary provider for nearby places and POIs. Get a free key at geoapify.com.",
    },
    {
      key: "locationiqApiKey",
      label: "LocationIQ API key",
      type: "password",
      secret: true,
      required: true,
      default: "pk.14ed93f5ee290008c448b4a0f07f73ad",
      description: "Fallback provider for geocoding and search. Get a free key at locationiq.com.",
    },
    {
      key: "foursquareApiKey",
      label: "Foursquare API key",
      type: "password",
      secret: true,
      description:
        "Optional. Provides rich business data (ratings, hours, phone) for Foursquare v3. Get one at foursquare.com/developers.",
    },
    {
      key: "foursquareClientId",
      label: "Foursquare v2 Client ID",
      type: "password",
      secret: true,
      description:
        "Optional (Legacy v2 fallback). Use with Foursquare v2 Client Secret if you do not have a v3 API key.",
    },
    {
      key: "foursquareClientSecret",
      label: "Foursquare v2 Client Secret",
      type: "password",
      secret: true,
      description:
        "Optional (Legacy v2 fallback). Use with Foursquare v2 Client ID.",
    },
    {
      key: "yelpApiKey",
      label: "Yelp API key",
      type: "password",
      secret: true,
      description:
        "Optional. Great for restaurants and bars. Get one at yelp.com/developers.",
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
    {
      key: "photonBaseUrl",
      label: "Photon base URL",
      type: "url",
      placeholder: DEFAULT_PHOTON_URL,
      default: DEFAULT_PHOTON_URL,
      description:
        "Open-data fallback geocoder. Default is Komoot's public instance.",
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
    // Defense-in-depth. Never trust trigger alone.
    if (!_looksProbablyPlaceQuery(query)) {
      return { html: "" };
    }

    try {
      const q = query.trim();

      const lat = parseFloat(_settings.defaultLat);
      const lon = parseFloat(_settings.defaultLon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
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
        if (!mergedInit.signal) {
          mergedInit.signal = controller.signal;
        }
        const startFetch = Date.now();
        console.log(`[Places Performance v${PLUGIN_VERSION}] Fetch starting: ${url} (Timeout: ${timeoutMs}ms)`);
        return doFetch(url, mergedInit)
          .then((res) => {
            clearTimeout(id);
            console.log(`[Places Performance v${PLUGIN_VERSION}] Fetch completed: ${url} in ${Date.now() - startFetch}ms (Status: ${res.status})`);
            return res;
          })
          .catch((err) => {
            clearTimeout(id);
            if (err.name === "AbortError") {
              console.warn(`[Places Performance v${PLUGIN_VERSION}] Fetch timed out: ${url} (gave up after ${timeoutMs / 1000} seconds)`);
            } else {
              console.warn(`[Places Performance v${PLUGIN_VERSION}] Fetch failed: ${url} in ${Date.now() - startFetch}ms:`, err);
            }
            throw err;
          });
      };

      const apiStatus = {
        geoapify: { configured: !!_settings.geoapifyApiKey, status: "unused", error: null, count: 0 },
        locationiq: { configured: !!_settings.locationiqApiKey, status: "unused", error: null, count: 0 },
        foursquareV3: { configured: !!_settings.foursquareApiKey, status: "unused", error: null, count: 0 },
        foursquareV2: { configured: !!(_settings.foursquareClientId && _settings.foursquareClientSecret), status: "unused", error: null, count: 0 },
        yelp: { configured: !!_settings.yelpApiKey, status: "unused", error: null, count: 0 },
        overpassSearch: { status: "unused", error: null, count: 0 },
        photon: { status: "unused", error: null, count: 0 },
        nominatim: { status: "unused", error: null, count: 0 }
      };

      console.log(`[Places Server v${PLUGIN_VERSION}] Query: "${q}" at lat=${lat}, lon=${lon}`);
      console.log(`[Places Server v${PLUGIN_VERSION}] Configured APIs: Geoapify=${!!_settings.geoapifyApiKey}, LocationIQ=${!!_settings.locationiqApiKey}, FoursquareApiKey=${!!_settings.foursquareApiKey}, YelpApiKey=${!!_settings.yelpApiKey}`);

      const places = await _searchAllProviders(q, lat, lon, radiusMeters, limit * 2, wrapFetch, apiStatus);

      if (places.length === 0) {
        console.log(`[Places Server v${PLUGIN_VERSION}] No places found from any provider.`);
        return { html: "" };
      }

      const top = _processPlaces(q, places, limit, {
        enforceDistanceGate: true,
        enforceConfidenceGate: true,
      });

      if (top.length === 0) {
        return { html: "" };
      }

      // Centralized fallback details fetch for top displayed results
      const fallbackPromises = [];
      let fallbackCount = 0;
      for (const place of top) {
        if (fallbackCount < 2 && (!place.phone || !place.website) && place.lat != null && place.lon != null) {
          fallbackCount++;
          fallbackPromises.push((async () => {
            const fallback = await _getVenueDetailsFromOverpass(place.name, place.lat, place.lon, (url, init) => wrapFetch(url, init, 5000));
            if (fallback) {
              place.phone = place.phone || fallback.phone;
              place.website = place.website || fallback.website;
              if (fallback.openingHours && !place.hours?.display) {
                place.hours = place.hours || { openNow: null, display: null, status: null };
                place.hours.display = fallback.openingHours;
              }
            }
          })());
        }
      }
      if (fallbackPromises.length > 0) {
        await Promise.allSettled(fallbackPromises);
      }

      console.log(`[Places Server v${PLUGIN_VERSION}] Final ${top.length} processed places:`);
      top.forEach((p, idx) => {
        console.log(`  [${idx}] ${p.name} (${(p.distanceMeters / 1609.34).toFixed(1)} mi) - Phone: ${p.phone || "None"} - Website: ${p.website || "None"} - Source: ${p.source} - Hours: ${p.hours ? JSON.stringify(p.hours) : "None"}`);
      });

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
        try {
          body = await request.json();
        } catch (_) {
          if (request.body && typeof request.body === "object") body = request.body;
        }
        const { lat, lon, query } = body;
        const latNum = parseFloat(lat);
        const lonNum = parseFloat(lon);
        if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
          return _jsonResponse({ error: "Invalid coordinates" }, 400);
        }

        const radiusMiles = parseInt(_settings.defaultRadius || "25", 10);
        const radiusMeters = radiusMiles * 1609.34;
        const limit = parseInt(_settings.resultsCount || "5", 10);

        console.log(`[Places Server] Refresh Query: "${query || ""}" at lat=${latNum}, lon=${lonNum}`);
        console.log(`[Places Server] Configured APIs (refresh): Geoapify=${!!_settings.geoapifyApiKey}, LocationIQ=${!!_settings.locationiqApiKey}, FoursquareApiKey=${!!_settings.foursquareApiKey}, YelpApiKey=${!!_settings.yelpApiKey}`);

        const apiStatus = {
          geoapify: { configured: !!_settings.geoapifyApiKey, status: "unused", error: null, count: 0 },
          locationiq: { configured: !!_settings.locationiqApiKey, status: "unused", error: null, count: 0 },
          foursquareV3: { configured: !!_settings.foursquareApiKey, status: "unused", error: null, count: 0 },
          foursquareV2: { configured: !!(_settings.foursquareClientId && _settings.foursquareClientSecret), status: "unused", error: null, count: 0 },
          yelp: { configured: !!_settings.yelpApiKey, status: "unused", error: null, count: 0 },
          overpassSearch: { status: "unused", error: null, count: 0 },
          photon: { status: "unused", error: null, count: 0 },
          nominatim: { status: "unused", error: null, count: 0 }
        };

        const wrapFetch = (url, init = {}, timeoutMs = 15000) => {
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), timeoutMs);
          const mergedInit = { ...init };
          if (!mergedInit.signal) {
            mergedInit.signal = controller.signal;
          }
          const startFetch = Date.now();
          console.log(`[Places Performance v${PLUGIN_VERSION}] Fetch starting (refresh): ${url} (Timeout: ${timeoutMs}ms)`);
          return _fetch(url, mergedInit)
            .then((res) => {
              clearTimeout(id);
              console.log(`[Places Performance v${PLUGIN_VERSION}] Fetch completed (refresh): ${url} in ${Date.now() - startFetch}ms (Status: ${res.status})`);
              return res;
            })
            .catch((err) => {
              clearTimeout(id);
              if (err.name === "AbortError") {
                console.warn(`[Places Performance v${PLUGIN_VERSION}] Fetch timed out (refresh): ${url} (gave up after ${timeoutMs / 1000} seconds)`);
              } else {
                console.warn(`[Places Performance v${PLUGIN_VERSION}] Fetch failed (refresh): ${url} in ${Date.now() - startFetch}ms:`, err);
              }
              throw err;
            });
        };

        const places = await _searchAllProviders(query || "", latNum, lonNum, radiusMeters, limit * 2, wrapFetch, apiStatus);

        if (places.length === 0) {
          console.log(`[Places Server] No places found for refresh query.`);
          return _jsonResponse({ html: "" });
        }

        const top = _processPlaces(query || "", places, limit, {
          enforceDistanceGate: false,
          enforceConfidenceGate: false,
        });

        if (top.length === 0) {
          return _jsonResponse({ html: "" });
        }

        // Centralized fallback details fetch for top displayed results
        const fallbackPromises = [];
        let fallbackCount = 0;
        for (const place of top) {
          if (fallbackCount < 2 && (!place.phone || !place.website) && place.lat != null && place.lon != null) {
            fallbackCount++;
            fallbackPromises.push((async () => {
              const fallback = await _getVenueDetailsFromOverpass(place.name, place.lat, place.lon, (url, init) => wrapFetch(url, init, 5000));
              if (fallback) {
                place.phone = place.phone || fallback.phone;
                place.website = place.website || fallback.website;
                if (fallback.openingHours && !place.hours?.display) {
                  place.hours = place.hours || { openNow: null, display: null, status: null };
                  place.hours.display = fallback.openingHours;
                }
              }
            })());
          }
        }
        if (fallbackPromises.length > 0) {
          await Promise.allSettled(fallbackPromises);
        }

        console.log(`[Places Server] Final ${top.length} processed places (refresh):`);
        top.forEach((p, idx) => {
          console.log(`  [${idx}] ${p.name} (${(p.distanceMeters / 1609.34).toFixed(1)} mi) - Phone: ${p.phone || "None"} - Website: ${p.website || "None"} - Source: ${p.source} - Hours: ${p.hours ? JSON.stringify(p.hours) : "None"}`);
        });

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

  // 1. Try Geoapify FIRST as the main live API
  if (_settings.geoapifyApiKey) {
    const geoStart = Date.now();
    try {
      const geoResults = await _searchGeoapify(query, lat, lon, radiusM, limit, (url, init) => doFetch(url, init, 5000), apiStatus);
      console.log(`[Places Performance v${PLUGIN_VERSION}] Geoapify primary search completed in ${Date.now() - geoStart}ms (found ${geoResults.length} places)`);
      if (geoResults.length > 0) {
        // According to user: "it can do the ENTIRE job" if it has results
        return geoResults;
      }
    } catch (err) {
      console.error(`[Places Performance v${PLUGIN_VERSION}] Geoapify primary search failed:`, err);
    }
  }

  // 2. Try LocationIQ as the next high-quality sequential primary
  if (_settings.locationiqApiKey) {
    const liqStart = Date.now();
    try {
      const liqResults = await _searchLocationIQ(query, lat, lon, limit, (url, init) => doFetch(url, init, 5000), apiStatus);
      console.log(`[Places Performance v${PLUGIN_VERSION}] LocationIQ primary search completed in ${Date.now() - liqStart}ms (found ${liqResults.length} places)`);
      if (liqResults.length > 0) {
        console.log(`[Places Performance v${PLUGIN_VERSION}] Using LocationIQ primary results, skipping other providers.`);
        return liqResults;
      }
    } catch (err) {
      console.error(`[Places Performance v${PLUGIN_VERSION}] LocationIQ primary search failed:`, err);
    }
  }

  const out = [];
  const providerCalls = [];

  // Foursquare as optional quality booster/fallback
  if (_settings.foursquareApiKey || (_settings.foursquareClientId && _settings.foursquareClientSecret)) {
    const fqStart = Date.now();
    providerCalls.push(
      _searchFoursquare(query, lat, lon, radiusM, limit, (url, init) => doFetch(url, init, 10000), apiStatus).then((res) => {
        console.log(`[Places Performance v${PLUGIN_VERSION}] Foursquare search completed in ${Date.now() - fqStart}ms (found ${res.length} places)`);
        return res;
      })
    );
  }

  if (_settings.yelpApiKey) {
    const yelpStart = Date.now();
    providerCalls.push(
      _searchYelp(query, lat, lon, radiusM, limit, (url, init) => doFetch(url, init, 10000), apiStatus).then((res) => {
        console.log(`[Places Performance v${PLUGIN_VERSION}] Yelp search completed in ${Date.now() - yelpStart}ms (found ${res.length} places)`);
        return res;
      })
    );
  }

  if (providerCalls.length > 0) {
    const settled = await Promise.allSettled(providerCalls);
    for (const result of settled) {
      if (result.status === "fulfilled" && Array.isArray(result.value)) {
        out.push(...result.value);
      } else if (result.status === "rejected") {
        console.error(`[Places Performance v${PLUGIN_VERSION}] Provider promise rejected:`, result.reason);
      }
    }
  }

  // If no results from high-quality APIs, fallback to free open-data options
  if (out.length === 0) {
    console.log(`[Places Performance v${PLUGIN_VERSION}] No commercial API results. Triggering general Overpass search...`);
    const ovStart = Date.now();
    try {
      const r = await _searchOverpass(query, lat, lon, radiusM, limit, (url, init) => doFetch(url, init, 5000), apiStatus);
      console.log(`[Places Performance v${PLUGIN_VERSION}] General Overpass search completed in ${Date.now() - ovStart}ms (found ${r.length} places)`);
      out.push(...r);
    } catch (err) {
      console.error(`[Places Performance v${PLUGIN_VERSION}] General Overpass search failed after ${Date.now() - ovStart}ms:`, err);
    }
  }

  // Photon — free geocoder fallback (no key)
  if (out.length === 0) {
    const phStart = Date.now();
    try {
      const r = await _searchPhoton(query, lat, lon, radiusM, limit, (url, init) => doFetch(url, init, 4000), apiStatus);
      console.log(`[Places Performance v${PLUGIN_VERSION}] Photon geocoder fallback completed in ${Date.now() - phStart}ms (found ${r.length} places)`);
      out.push(...r);
    } catch (_) {}
  }

  // Nominatim — free geocoder fallback (no key)
  if (out.length === 0) {
    const nomStart = Date.now();
    try {
      const r = await _searchNominatim(query, lat, lon, limit, (url, init) => doFetch(url, init, 4000), apiStatus);
      console.log(`[Places Performance v${PLUGIN_VERSION}] Nominatim geocoder fallback completed in ${Date.now() - nomStart}ms (found ${r.length} places)`);
      out.push(...r);
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
  const cached = _cache?.get(cacheKey);
  if (cached) return cached;

  const key = _settings.geoapifyApiKey || "0a2341f20dfa4b92952a726eb1e36554";
  
  // Categorization logic based on recommended categories
  const categories = [
    "catering",
    "catering.restaurant",
    "catering.cafe",
    "catering.cafe.dessert",
    "catering.ice_cream",
    "commercial.food_and_drink",
    "service.financial.bank",
    "service.financial.atm",
    "service.fuel",
    "healthcare.pharmacy",
    "commercial.supermarket",
    "accommodation"
  ].join(",");

  const url = 
    `${GEOAPIFY_BASE}?categories=${encodeURIComponent(categories)}` +
    `&name=${encodeURIComponent(query)}` +
    `&filter=circle:${lon},${lat},${Math.round(radiusM)}` +
    `&bias=proximity:${lon},${lat}` +
    `&limit=${limit}` +
    `&apiKey=${key}`;

  const res = await doFetch(url, {}, 5000);
  if (!res.ok) {
    const errText = await res.text();
    const msg = `HTTP status ${res.status}: ${errText}`;
    console.error(`[places] Geoapify API search returned error: ${msg}`);
    if (apiStatus && apiStatus.geoapify) {
      apiStatus.geoapify.status = "error";
      apiStatus.geoapify.error = msg;
    }
    return [];
  }

  const data = await res.json();
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

  if (apiStatus && apiStatus.geoapify) {
    apiStatus.geoapify.status = "success";
    apiStatus.geoapify.count = out.length;
  }

  _cache?.set(cacheKey, out);
  return out;
}

async function _searchFoursquare(query, lat, lon, radiusM, limit, doFetch, apiStatus) {
  const cacheKey = `fq:${query}:${lat}:${lon}:${Math.round(radiusM)}:${limit}`;
  const cached = _cache?.get(cacheKey);
  if (cached) return cached;

  let out = [];

  // V3 Flow
  if (_settings.foursquareApiKey) {
    try {
      let authHeader = _settings.foursquareApiKey;
      const lowerKey = _settings.foursquareApiKey.toLowerCase();
      if (!lowerKey.startsWith("fsq3") && !lowerKey.startsWith("bearer ")) {
        authHeader = `Bearer ${_settings.foursquareApiKey}`;
      }

      const fields = "name,location,geocodes,categories,tel,website,hours,rating,stats,fsq_id,distance,email,social_media,description,chains,price";
      const url =
        `${FOURSQUARE_BASE}?query=${encodeURIComponent(query)}` +
        `&ll=${encodeURIComponent(`${lat},${lon}`)}` +
        `&radius=${Math.round(radiusM)}` +
        `&limit=${limit}` +
        `&fields=${encodeURIComponent(fields)}`;

      let res = await doFetch(url, {
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
          "X-Places-Api-Version": "2025-06-17",
        },
      });

      // Auto-retry with Pro-only fields on quota/credit limits (429/402)
      if (!res.ok && (res.status === 429 || res.status === 402)) {
        console.warn(`[places] Foursquare v3 query returned status ${res.status} (likely credit/quota limit). Retrying with Pro-only fields...`);
        const proFields = "fsq_id,name,location,geocodes,categories,distance,tel,website";
        const retryUrl =
          `${FOURSQUARE_BASE}?query=${encodeURIComponent(query)}` +
          `&ll=${encodeURIComponent(`${lat},${lon}`)}` +
          `&radius=${Math.round(radiusM)}` +
          `&limit=${limit}` +
          `&fields=${encodeURIComponent(proFields)}`;

        res = await doFetch(retryUrl, {
          headers: {
            Authorization: authHeader,
            Accept: "application/json",
            "X-Places-Api-Version": "2025-06-17",
          },
        });
      }

      if (!res.ok) {
        const errText = await res.text();
        const msg = `HTTP status ${res.status}: ${errText}`;
        console.error(`[places] Foursquare v3 API search returned error: ${msg}`);
        if (apiStatus && apiStatus.foursquareV3) {
          apiStatus.foursquareV3.status = "error";
          apiStatus.foursquareV3.error = msg;
        }
      } else {
        const data = await res.json();
        out = (data.results || []).map((r) => {
          const plat = r.geocodes?.main?.latitude;
          const plon = r.geocodes?.main?.longitude;
          return {
            name: r.name,
            address: _fmtFsqAddress(r.location),
            lat: plat,
            lon: plon,
            distanceMeters: r.distance || _haversine(lat, lon, plat, plon),
            phone: r.tel || null,
            website: r.website || null,
            categories: (r.categories || []).map((c) => c.name),
            hours: r.hours?.display ? { display: r.hours.display, openNow: r.hours.open_now } : null,
            rating: r.rating ? r.rating / 2 : null, // 0-10 to 0-5
            reviewCount: r.stats?.total_ratings || null,
            source: "Foursquare",
            sourceUrl: `https://foursquare.com/v/${r.fsq_id}`,
          };
        });
        if (apiStatus && apiStatus.foursquareV3) {
          apiStatus.foursquareV3.status = "success";
          apiStatus.foursquareV3.count = out.length;
        }
      }
    } catch (err) {
      console.error("[places] Foursquare v3 fetch failed:", err);
    }
  }

  // V2 Fallback
  if (out.length === 0 && _settings.foursquareClientId && _settings.foursquareClientSecret) {
    try {
      const url =
        "https://api.foursquare.com/v2/venues/search" +
        `?client_id=${_settings.foursquareClientId}` +
        `&client_secret=${_settings.foursquareClientSecret}` +
        `&v=20231010` +
        `&ll=${lat},${lon}` +
        `&query=${encodeURIComponent(query)}` +
        `&radius=${Math.round(radiusM)}` +
        `&limit=${limit}`;

      const res = await doFetch(url);
      if (!res.ok) {
        const errText = await res.text();
        const msg = `HTTP status ${res.status}: ${errText}`;
        console.error(`[places] Foursquare v2 API search returned error: ${msg}`);
        if (apiStatus && apiStatus.foursquareV2) {
          apiStatus.foursquareV2.status = "error";
          apiStatus.foursquareV2.error = msg;
        }
      } else {
        const data = await res.json();
        out = (data.response?.venues || []).map((v) => {
          const plat = v.location?.lat;
          const plon = v.location?.lng;
          return {
            name: v.name,
            address: _fmtFsqAddress(v.location),
            lat: plat,
            lon: plon,
            distanceMeters: typeof v.location.distance === "number" ? v.location.distance : _haversine(lat, lon, plat, plon),
            phone: v.contact?.phone || null,
            website: v.url || null,
            categories: (v.categories || []).map((c) => c.name),
            hours: null,
            rating: null,
            reviewCount: null,
            source: "Foursquare",
            sourceUrl: `https://foursquare.com/v/${v.id}`,
          };
        });
        if (apiStatus && apiStatus.foursquareV2) {
          apiStatus.foursquareV2.status = "success";
          apiStatus.foursquareV2.count = out.length;
        }
      }
    } catch (err) {
      console.error("[places] Foursquare v2 fetch failed:", err);
    }
  }

  _cache?.set(cacheKey, out);
  return out;
}

async function _searchYelp(query, lat, lon, radiusM, limit, doFetch, apiStatus) {
  const cacheKey = `yp:${query}:${lat}:${lon}:${Math.round(radiusM)}:${limit}`;
  const cached = _cache?.get(cacheKey);
  if (cached) return cached;

  try {
    const url =
      `${YELP_BASE}?term=${encodeURIComponent(query)}` +
      `&latitude=${lat}&longitude=${lon}` +
      `&radius=${Math.round(Math.min(radiusM, 40000))}` +
      `&limit=${limit}`;

    const res = await doFetch(url, {
      headers: {
        Authorization: `Bearer ${_settings.yelpApiKey}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      const msg = `HTTP status ${res.status}: ${errText}`;
      console.error(`[places] Yelp API search returned error: ${msg}`);
      if (apiStatus && apiStatus.yelp) {
        apiStatus.yelp.status = "error";
        apiStatus.yelp.error = msg;
      }
      return [];
    }

    const data = await res.json();
    const out = (data.businesses || []).map((b) => ({
      name: b.name,
      address: b.location?.display_address?.join(", ") || "",
      lat: b.coordinates?.latitude,
      lon: b.coordinates?.longitude,
      distanceMeters: b.distance || _haversine(lat, lon, b.coordinates?.latitude, b.coordinates?.longitude),
      phone: b.display_phone || b.phone || null,
      website: null,
      categories: (b.categories || []).map((c) => c.title),
      hours: null, // Yelp search doesn't return hours
      rating: b.rating || null,
      reviewCount: b.review_count || null,
      source: "Yelp",
      sourceUrl: b.url,
    }));

    if (apiStatus && apiStatus.yelp) {
      apiStatus.yelp.status = "success";
      apiStatus.yelp.count = out.length;
    }

    _cache?.set(cacheKey, out);
    return out;
  } catch (err) {
    console.error("[places] Yelp fetch failed:", err);
    return [];
  }
}

async function _searchOverpass(query, lat, lon, radiusM, limit, doFetch, apiStatus) {
  const cacheKey = `ov:${query}:${lat}:${lon}:${Math.round(radiusM)}:${limit}`;
  const cached = _cache?.get(cacheKey);
  if (cached) return cached;

  const q = `[out:json][timeout:15];
    (
      node["name"~"${query}",i](around:${radiusM},${lat},${lon});
      way["name"~"${query}",i](around:${radiusM},${lat},${lon});
      rel["name"~"${query}",i](around:${radiusM},${lat},${lon});
    );
    out center body;`;

  try {
    const res = await doFetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`, {}, 8000);
    if (!res.ok) {
      const errText = await res.text();
      const msg = `HTTP status ${res.status}: ${errText}`;
      console.error(`[places] Overpass API search returned error: ${msg}`);
      if (apiStatus && apiStatus.overpassSearch) {
        apiStatus.overpassSearch.status = "error";
        apiStatus.overpassSearch.error = msg;
      }
      return [];
    }
    const data = await res.json();
    const out = (data.elements || []).map((el) => {
      const plat = el.lat || el.center?.lat;
      const plon = el.lon || el.center?.lon;
      const t = el.tags || {};
      return {
        name: t.name,
        address: _fmtOsmAddress(t),
        lat: plat,
        lon: plon,
        distanceMeters: _haversine(lat, lon, plat, plon),
        phone: t.phone || t["contact:phone"] || null,
        website: t.website || t["contact:website"] || null,
        categories: t.amenity ? [t.amenity.replace(/_/g, " ")] : [],
        hours: t.opening_hours ? { display: _formatOsmHours(t.opening_hours) } : null,
        rating: null,
        reviewCount: null,
        source: "OpenStreetMap",
        sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      };
    });

    if (apiStatus && apiStatus.overpassSearch) {
      apiStatus.overpassSearch.status = "success";
      apiStatus.overpassSearch.count = out.length;
    }

    _cache?.set(cacheKey, out);
    return out;
  } catch (err) {
    console.error("[places] Overpass fetch failed:", err);
    return [];
  }
}

async function _searchPhoton(query, lat, lon, radiusM, limit, doFetch, apiStatus) {
  const cacheKey = `ph:${query}:${lat}:${lon}:${Math.round(radiusM)}:${limit}`;
  const cached = _cache?.get(cacheKey);
  if (cached) return cached;

  const baseUrl = _settings.photonBaseUrl || DEFAULT_PHOTON_URL;
  const url = `${baseUrl}/api/?q=${encodeURIComponent(query)}&lat=${lat}&lon=${lon}&limit=${limit}`;

  try {
    const res = await doFetch(url);
    if (!res.ok) {
      const errText = await res.text();
      const msg = `HTTP status ${res.status}: ${errText}`;
      console.error(`[places] Photon API search returned error: ${msg}`);
      if (apiStatus && apiStatus.photon) {
        apiStatus.photon.status = "error";
        apiStatus.photon.error = msg;
      }
      return [];
    }
    const data = await res.json();
    const out = (data.features || []).map((f) => {
      const p = f.properties || {};
      const plat = f.geometry?.coordinates?.[1];
      const plon = f.geometry?.coordinates?.[0];
      return {
        name: p.name || p.street || query,
        address: _fmtPhotonAddress(p),
        lat: plat,
        lon: plon,
        distanceMeters: _haversine(lat, lon, plat, plon),
        phone: null,
        website: null,
        categories: p.type ? [p.type.replace(/_/g, " ")] : [],
        hours: null,
        rating: null,
        reviewCount: null,
        source: "OpenStreetMap",
        sourceUrl: p.osm_type && p.osm_id 
          ? `https://www.openstreetmap.org/${p.osm_type}/${p.osm_id}`
          : `https://www.openstreetmap.org/?mlat=${plat}&mlon=${plon}`,
      };
    }).filter(Boolean);

    if (apiStatus && apiStatus.photon) {
      apiStatus.photon.status = "success";
      apiStatus.photon.count = out.length;
    }

    _cache?.set(cacheKey, out);
    return out;
  } catch (err) {
    console.error("[places] Photon fetch failed:", err);
    return [];
  }
}

async function _searchNominatim(query, lat, lon, limit, doFetch, apiStatus) {
  const cacheKey = `nm:${query}:${lat}:${lon}:${limit}`;
  const cached = _cache?.get(cacheKey);
  if (cached) return cached;

  const url =
    `${NOMINATIM_BASE}?q=${encodeURIComponent(query)}` +
    `&format=json&limit=${limit}&addressdetails=1` +
    `&lat=${lat}&lon=${lon}`;

  const res = await doFetch(url, {
    headers: {
      "User-Agent": `degoog-places-slot/${PLUGIN_VERSION}`,
      "Accept-Language": "en",
    },
  });
  if (!res.ok) {
    const errText = await res.text();
    const msg = `HTTP status ${res.status}: ${errText}`;
    console.error(`[places] Nominatim API search returned error: ${msg}`);
    if (apiStatus && apiStatus.nominatim) {
      apiStatus.nominatim.status = "error";
      apiStatus.nominatim.error = msg;
    }
    return [];
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];

  const out = data
    .map((r) => {
      const plat = parseFloat(r.lat);
      const plon = parseFloat(r.lon);
      if (!Number.isFinite(plat) || !Number.isFinite(plon)) return null;
      return {
        name: r.name || r.display_name?.split(",")[0]?.trim() || query,
        address: _fmtNominatimAddress(r),
        lat: plat,
        lon: plon,
        distanceMeters: _haversine(lat, lon, plat, plon),
        phone: null,
        website: null,
        categories: r.type ? [r.type.replace(/_/g, " ")] : [],
        hours: null,
        rating: null,
        reviewCount: null,
        source: "OpenStreetMap",
        sourceUrl: `https://www.openstreetmap.org/?mlat=${plat}&mlon=${plon}`,
      };
    })
    .filter(Boolean);

  if (apiStatus && apiStatus.nominatim) {
    apiStatus.nominatim.status = "success";
    apiStatus.nominatim.count = out.length;
  }

  _cache?.set(cacheKey, out);
  return out;
}

async function _searchLocationIQ(query, lat, lon, limit, doFetch, apiStatus) {
  const cacheKey = `liq:${query}:${lat}:${lon}:${limit}`;
  const cached = _cache?.get(cacheKey);
  if (cached) return cached;

  const key = _settings.locationiqApiKey || "pk.14ed93f5ee290008c448b4a0f07f73ad";
  const url =
    `https://us1.locationiq.com/v1/search?key=${encodeURIComponent(key)}` +
    `&q=${encodeURIComponent(query)}` +
    `&format=json&limit=${limit}&addressdetails=1&extratags=1` +
    `&lat=${lat}&lon=${lon}`;

  const res = await doFetch(url, {}, 5000);
  if (!res.ok) {
    const errText = await res.text();
    const msg = `HTTP status ${res.status}: ${errText}`;
    console.error(`[places] LocationIQ API search returned error: ${msg}`);
    if (apiStatus && apiStatus.locationiq) {
      apiStatus.locationiq.status = "error";
      apiStatus.locationiq.error = msg;
    }
    return [];
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];

  const out = data
    .map((r) => {
      const plat = parseFloat(r.lat);
      const plon = parseFloat(r.lon);
      if (!Number.isFinite(plat) || !Number.isFinite(plon)) return null;

      const typeKey = r.type || r.class;
      const osmName = r.address?.[typeKey] || r.name || r.display_name?.split(",")[0]?.trim() || query;

      // Extract extra data from LocationIQ/OSM extratags
      const xt = r.extratags || {};
      const phone = xt.phone || xt["contact:phone"] || xt["contact:mobile"] || null;
      const website = xt.website || xt["contact:website"] || xt.url || null;
      const openingHours = xt.opening_hours || null;

      return {
        name: osmName,
        address: _fmtNominatimAddress(r),
        lat: plat,
        lon: plon,
        distanceMeters: _haversine(lat, lon, plat, plon),
        phone: phone,
        website: website,
        hours: openingHours ? { display: _formatOsmHours(openingHours) } : null,
        categories: r.type ? [r.type.replace(/_/g, " ")] : [],
        rating: null,
        reviewCount: null,
        source: "LocationIQ",
        sourceUrl: r.osm_type && r.osm_id
          ? `https://www.openstreetmap.org/${r.osm_type}/${r.osm_id}`
          : `https://www.openstreetmap.org/?mlat=${plat}&mlon=${plon}`,
      };
    })
    .filter(Boolean);

  if (apiStatus && apiStatus.locationiq) {
    apiStatus.locationiq.status = "success";
    apiStatus.locationiq.count = out.length;
  }

  _cache?.set(cacheKey, out);
  return out;
}

/* ------------------------------------------------------------------ */
/* Normalization & dedupe                                              */
/* ------------------------------------------------------------------ */

function _dedupeAndMergePlaces(places) {
  const out = [];
  for (const p of places) {
    const norm = _normalizeName(p.name);
    let existing = null;
    for (const e of out) {
      const dist = _haversine(p.lat, p.lon, e.lat, e.lon);
      const eNorm = _normalizeName(e.name);
      const nameSimilar =
        norm.includes(eNorm) || eNorm.includes(norm) || _levenshtein(norm, eNorm) < 3;

      if (dist < 150 && nameSimilar) {
        existing = e;
        break;
      }
    }

    if (existing) {
      // Merge data
      existing.phone = existing.phone || p.phone;
      existing.website = existing.website || p.website;
      existing.hours = existing.hours || p.hours;
      existing.rating = existing.rating || p.rating;
      existing.reviewCount = existing.reviewCount || p.reviewCount;
      // Prefer commercial sources for URL
      if (p.source !== "OpenStreetMap" && p.source !== "Photon" && p.source !== "LocationIQ" && p.source !== "Geoapify") {
        existing.sourceUrl = p.sourceUrl;
        existing.source = p.source;
      }
    } else {
      out.push(p);
    }
  }
  return out;
}

function _processPlaces(query, places, limit, options = {}) {
  let out = _dedupeAndMergePlaces(places);

  // Scoring/Ranking logic based on recommendation
  const normQuery = _normalizeName(query);
  out.forEach(p => {
    const normName = _normalizeName(p.name);
    const nameSim = _levenshtein(normQuery, normName);
    const nameSimilarity = 1 - Math.min(nameSim / Math.max(normQuery.length, normName.length), 1);
    
    // Distance score (0-1), 0 at 25 miles
    const distanceScore = Math.max(0, 1 - (p.distanceMeters / 40233)); 
    
    // Category relevance (simplified)
    const hasCategoryMatch = p.categories.some(c => normQuery.includes(_normalizeName(c)));
    const categoryRelevance = hasCategoryMatch ? 1 : 0.5;

    // Data completeness (phone, website, hours)
    const completeness = (p.phone ? 0.4 : 0) + (p.website ? 0.3 : 0) + (p.hours ? 0.3 : 0);

    p.score = 
      0.45 * nameSimilarity +
      0.25 * distanceScore +
      0.20 * categoryRelevance +
      0.10 * completeness;
  });

  out.sort((a, b) => b.score - a.score);

  if (options.enforceConfidenceGate) {
    const topScore = out[0]?.score || 0;
    const secondScore = out[1]?.score || 0;
    
    const highConfidence = topScore >= 0.72 || (topScore >= 0.65 && secondScore >= 0.65);
    if (!highConfidence) return [];
  }

  if (options.enforceDistanceGate) {
    out = out.filter(p => p.distanceMeters < 80467); // 50 miles
  }

  return out.slice(0, limit);
}

function _normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function _levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}

function _haversine(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function _looksProbablyPlaceQuery(query) {
  const q = String(query || "").trim();
  if (q.length < 2 || q.length > 100) return false;

  const TRIGGER_WORDS = /\b(near me|nearby|nearest|closest|locations?|address|directions?|hours?|open now|phone|menu|reservations?|reviews?|coffee|pizza|tacos|pharmacy|gas|grocery|restaurant|bar|cafe|ice cream)\b/i;
  const NEGATIVE_WORDS = /\b(qwen|python|npm|github|react|docker|linux|error|docs|tutorial|reddit|download|install|meaning|lyrics|wikipedia|cast|streaming|movie|trailer|episode|watch)\b/i;

  if (NEGATIVE_WORDS.test(q)) return false;
  if (TRIGGER_WORDS.test(q)) return true;

  // Title-cased or brand-like check (very simple)
  const words = q.split(/\s+/);
  const isTitleCased = words.every(w => w[0] === w[0].toUpperCase());
  if (isTitleCased && words.length > 0) return true;

  return false;
}

/* ------------------------------------------------------------------ */
/* View Helpers                                                        */
/* ------------------------------------------------------------------ */

function _renderCard(places, query, locationLabel, showGeoBtn, apiStatus) {
  const listHtml = places
    .map((p, idx) => {
      const distStr =
        _settings.distanceUnit === "km"
          ? (p.distanceMeters / 1000).toFixed(1) + " km"
          : (p.distanceMeters / 1609.34).toFixed(1) + " mi";

      const hoursClass = p.hours?.openNow === true ? "places-open" : p.hours?.openNow === false ? "places-closed" : "";
      const hoursBadge = p.hours?.display ? `<span class="places-hours ${hoursClass}">${p.hours.display.split(",")[0]}</span>` : "";

      const ratingHtml = p.rating
        ? `<div class="places-rating">
            <span class="places-stars" style="--rating: ${p.rating}"></span>
            <span class="places-count">(${p.reviewCount || 0})</span>
           </div>`
        : "";

      return `
        <div class="places-card ${idx === 0 ? "places-card-selected" : ""}" 
             data-place-card 
             data-lat="${p.lat}" 
             data-lon="${p.lon}" 
             data-place-name="${_esc(p.name)}">
          <div class="places-card-main">
            <div class="places-name-row">
              <span class="places-name">${_esc(p.name)}</span>
              <span class="places-distance">${distStr}</span>
            </div>
            <div class="places-meta">
              ${hoursBadge}
              <span class="places-category">${_esc(p.categories[0] || "")}</span>
            </div>
            ${ratingHtml}
            <div class="places-address" title="${_esc(p.address)}">${_esc(p.address)}</div>
          </div>
          <div class="places-actions">
            <a href="${_esc(p.website || "#")}" class="places-action-website ${!p.website ? "places-disabled" : ""}" target="_blank" rel="noopener">Website</a>
            <a href="tel:${_esc(p.phone || "")}" class="places-action-call ${!p.phone ? "places-disabled" : ""}">Call</a>
            <button type="button" class="places-action-directions" data-directions-btn data-place-name="${_esc(p.name)}" data-lat="${p.lat}" data-lon="${p.lon}" data-address="${_esc(p.address)}">Directions</button>
          </div>
        </div>
      `;
    })
    .join("");

  const first = places[0];
  const mapHtml = `
    <div class="places-map-panel" 
         data-map-panel 
         data-lat="${first.lat}" 
         data-lon="${first.lon}" 
         data-place-name="${_esc(first.name)}"
         aria-label="Map centered on ${_esc(first.name)}">
      <div class="places-tile-map" 
           data-lat="${first.lat}" 
           data-lon="${first.lon}" 
           data-zoom="15" 
           data-tile-template="${_esc(_settings.customTileUrl || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")}">
        <div class="places-tile-layer"></div>
        <div class="places-map-controls">
          <button type="button" class="places-map-btn" data-zoom-in aria-label="Zoom in">+</button>
          <button type="button" class="places-map-btn" data-zoom-out aria-label="Zoom out">−</button>
        </div>
      </div>
      <a href="https://www.openstreetmap.org/?mlat=${first.lat}&mlon=${first.lon}#map=15/${first.lat}/${first.lon}" 
         class="places-map-link" 
         target="_blank" 
         rel="noopener"
         data-map-link>View on OpenStreetMap</a>
    </div>
  `;

  return `
    <div class="places-wrap" data-places-version="${PLUGIN_VERSION}" data-places-apis='${JSON.stringify(apiStatus || {})}'>
      <div class="places-header">
        <div class="places-title-row">
          <span class="places-title">Local Places</span>
          ${showGeoBtn ? `<button type="button" class="places-geo-btn" data-query="${_esc(query)}">Use my location</button>` : ""}
        </div>
        <span class="places-subhead">near ${_esc(locationLabel)}</span>
      </div>
      <div class="places-content">
        <div class="places-list">${listHtml}</div>
        ${mapHtml}
      </div>
      <div class="places-modal" data-places-modal hidden>
        <div class="places-modal-content">
          <div class="places-modal-header">
            <span>Get Directions</span>
            <button type="button" class="places-modal-close" data-modal-close>&times;</button>
          </div>
          <div class="places-modal-body">
            <a href="#" class="places-modal-option" data-modal-option="google" target="_blank" rel="noopener">Google Maps</a>
            <a href="#" class="places-modal-option" data-modal-option="apple" target="_blank" rel="noopener">Apple Maps</a>
            <a href="#" class="places-modal-option" data-modal-option="osm" target="_blank" rel="noopener">OpenStreetMap</a>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function _getVenueDetailsFromOverpass(name, lat, lon, doFetch) {
  const q = `[out:json][timeout:5];
    (
      node["name"~"${name}",i](around:100,${lat},${lon});
      way["name"~"${name}",i](around:100,${lat},${lon});
    );
    out body;`;
  try {
    const res = await doFetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const el = data.elements?.[0];
    if (!el || !el.tags) return null;
    const t = el.tags;
    return {
      phone: t.phone || t["contact:phone"] || null,
      website: t.website || t["contact:website"] || null,
      openingHours: t.opening_hours || null
    };
  } catch (_) {
    return null;
  }
}

function _fmtFsqAddress(loc) {
  if (!loc) return "";
  if (loc.formatted_address) return loc.formatted_address;
  const parts = [loc.address, loc.cross_street, loc.city, loc.state, loc.postcode].filter(Boolean);
  return parts.join(", ");
}

function _fmtOsmAddress(t) {
  const addr = [
    t["addr:housenumber"],
    t["addr:street"],
    t["addr:city"],
    t["addr:state"],
    t["addr:postcode"]
  ].filter(Boolean);
  if (addr.length > 0) return addr.join(", ");
  return "";
}

function _fmtPhotonAddress(p) {
  const parts = [p.housenumber, p.street, p.city, p.state, p.postcode, p.country].filter(Boolean);
  return parts.join(", ");
}

function _fmtNominatimAddress(r) {
  if (r.address) {
    const a = r.address;
    const parts = [
      a.house_number,
      a.road || a.pedestrian || a.suburb,
      a.city || a.town || a.village || a.municipality,
      a.state,
      a.postcode,
      a.country
    ].filter(Boolean);
    if (parts.length) return parts.join(", ");
  }
  return r.display_name || "";
}

function _formatOsmHours(openingHours) {
  if (!openingHours) return null;
  if (openingHours.toLowerCase() === "24/7") {
    return "Open 24/7";
  }
  
  const daysMap = {
    "Mo": "Mon",
    "Tu": "Tue",
    "We": "Wed",
    "Th": "Thu",
    "Fr": "Fri",
    "Sa": "Sat",
    "Su": "Sun"
  };

  const to12Hr = (t) => {
    const parts = t.split(":");
    if (parts.length !== 2) return t;
    let h = parseInt(parts[0], 10);
    const m = parts[1];
    if (isNaN(h)) return t;
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  };

  const segments = openingHours.split(";").map(s => s.trim()).filter(Boolean);
  const formattedSegments = [];

  for (const seg of segments) {
    if (seg.toLowerCase() === "24/7") {
      formattedSegments.push("Open 24/7");
      continue;
    }
    if (seg.toLowerCase() === "off" || seg.toLowerCase().endsWith("off")) {
      let dayPart = seg.replace(/off/i, "").trim();
      if (dayPart) {
        for (const [k, v] of Object.entries(daysMap)) {
          dayPart = dayPart.replace(new RegExp(k, "g"), v);
        }
        dayPart = dayPart.replace(/-/g, "–");
        formattedSegments.push(`${dayPart}: Closed`);
      } else {
        formattedSegments.push("Closed");
      }
      continue;
    }

    const timeMatch = seg.match(/\d{2}:\d{2}/);
    if (!timeMatch) {
      let cleanSeg = seg;
      for (const [k, v] of Object.entries(daysMap)) {
        cleanSeg = cleanSeg.replace(new RegExp(k, "g"), v);
      }
      cleanSeg = cleanSeg.replace(/-/g, "–");
      formattedSegments.push(cleanSeg);
      continue;
    }

    const timeIndex = timeMatch.index;
    let daysPart = seg.substring(0, timeIndex).trim();
    let timesPart = seg.substring(timeIndex).trim();

    for (const [k, v] of Object.entries(daysMap)) {
      daysPart = daysPart.replace(new RegExp(k, "g"), v);
    }
    daysPart = daysPart.replace(/-/g, "–");

    const timeRanges = timesPart.split(",").map(t => t.trim()).filter(Boolean);
    const formattedRanges = timeRanges.map(range => {
      const parts = range.split("-").map(p => p.trim());
      if (parts.length === 2) {
        return `${to12Hr(parts[0])}–${to12Hr(parts[1])}`;
      }
      return range;
    });

    const timesJoined = formattedRanges.join(", ");
    if (daysPart) {
      if (daysPart.endsWith(":")) {
        formattedSegments.push(`${daysPart} ${timesJoined}`);
      } else {
        formattedSegments.push(`${daysPart}: ${timesJoined}`);
      }
    } else {
      formattedSegments.push(timesJoined);
    }
  }

  return formattedSegments.join(", ");
}

function _esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
