// Places slot plugin — local place recognition powered by the HERE Search API
// (hybrid of /browse with verified category codes and /discover free-text).

const PLUGIN_NAME = "Places - alpha";
const PLUGIN_VERSION = "4.1.0";
const PLUGIN_DESCRIPTION =
  "Local place recognition — shows nearby businesses and POIs with address, hours, phone, directions, and interactive map.";

let _settings = {};
let _fetch = (...args) => fetch(...args);
let _cache = null;

const HERE_BROWSE = "https://browse.search.hereapi.com/v1/browse";
const HERE_DISCOVER = "https://discover.search.hereapi.com/v1/discover";

// Verified HERE category-id map (keyword -> id). Anything not matched here
// falls through to /discover free-text search.
const HERE_CATEGORY_MAP = [
  { re: /\b(doctors?|physicians?|clinics?)\b/i, codes: "800-8000-0155,800-8000-0158" },
  { re: /\b(dentists?|dental)\b/i, codes: "800-8000-0154" },
  { re: /\b(hospitals?)\b/i, codes: "800-8000-0159" },
  { re: /\b(pharmac(?:y|ies)|drug ?stores?)\b/i, codes: "600-6400-0000" },
  { re: /\b(vets?|veterinar(?:y|ian|ians))\b/i, codes: "800-8000-0162" },
  { re: /\b(restaurants?|diners?)\b/i, codes: "100-1000-0000" },
  { re: /\b(coffee|cafe?s?|caf\u00e9s?)\b/i, codes: "100-1100-0010" },
  { re: /\b(bars?|pubs?)\b/i, codes: "200-2000-0011" },
  { re: /\b(baker(?:y|ies))\b/i, codes: "600-6300-0244" },
  { re: /\b(breweries|brewery)\b/i, codes: "300-3000-0350" },
  { re: /\b(gas ?stations?|fuel|petrol)\b/i, codes: "700-7600-0000" },
  { re: /\b(banks?)\b/i, codes: "700-7000-0107" },
  { re: /\b(hotels?|motels?)\b/i, codes: "500-5000-0053" },
  { re: /\b(gyms?|fitness)\b/i, codes: "800-8600-0191" },
  { re: /\b(librar(?:y|ies))\b/i, codes: "800-8300-0175" },
];

function _matchCategory(query) {
  for (const entry of HERE_CATEGORY_MAP) {
    if (entry.re.test(query)) return entry.codes;
  }
  return null;
}

function _configure(s) {
  _settings = {
    hereApiKey: s?.hereApiKey || "",
    defaultLat: s?.defaultLat || "",
    defaultLon: s?.defaultLon || "",
    defaultLocationLabel: s?.defaultLocationLabel || "Home",
    useBrowserGeolocation: s?.useBrowserGeolocation === true || s?.useBrowserGeolocation === "true",
    defaultRadius: s?.defaultRadius || "25",
    resultsCount: s?.resultsCount || "5",
    distanceUnit: s?.distanceUnit || "miles",
    customTileUrl: s?.customTileUrl || "",
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
      key: "hereApiKey",
      label: "HERE API key",
      type: "password",
      required: true,
      secret: true,
      description:
        "Required. Powers all place lookups via the HERE Search API. Get a free key at developer.here.com.",
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
      placeholder: "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
      description:
        "Optional raster tile template for the map. Supports {z}, {x}, and {y}. Leave blank to use the default CartoDB Voyager map tiles.",
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
      Math.abs(lon) <= 180 &&
      !!_settings.hereApiKey
    );
  },

  trigger(query) {
    return _looksProbablyPlaceQuery(query);
  },

  async execute(query, context) {
    // Defense-in-depth. Never trust trigger alone.
    const queryClass = _classifyPlaceQuery(query);
    if (!queryClass) {
      return { html: "" };
    }

    try {
      const q = query.trim();

      const lat = parseFloat(_settings.defaultLat);
      const lon = parseFloat(_settings.defaultLon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return { html: "" };
      }
      if (!_settings.hereApiKey) {
        return { html: "" };
      }

      const radiusMiles = parseInt(_settings.defaultRadius || "25", 10);
      const radiusMeters = radiusMiles * 1609.34;
      const limit = parseInt(_settings.resultsCount || "5", 10);
      const doFetch = typeof context?.fetch === "function" ? context.fetch : _fetch;

      const wrapFetch = _makeWrapFetch(doFetch, "");

      const apiStatus = {
        here: { configured: !!_settings.hereApiKey, status: "unused", error: null, count: 0 },
      };

      console.log(`[Places Server v${PLUGIN_VERSION}] Query: "${q}" at lat=${lat}, lon=${lon}`);

      const places = await _searchHere(q, lat, lon, radiusMeters, limit * 2, wrapFetch, apiStatus);

      if (places.length === 0) {
        console.log(`[Places Server v${PLUGIN_VERSION}] No places found from HERE.`);
        return { html: "" };
      }

      let top = _processHerePlaces(places, radiusMeters, limit);

      // Optimistic name/brand queries (no category/local-intent/chain/zip signal)
      // only render when HERE returns a confident name/brand match. This keeps
      // false positives on informational/tech queries near zero.
      if (queryClass === "name") {
        top = top.filter((p) => _isConfidentNameMatch(q, p));
      }

      if (top.length === 0) {
        return { html: "" };
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
        if (!_settings.hereApiKey) {
          return _jsonResponse({ html: "" });
        }

        const radiusMiles = parseInt(_settings.defaultRadius || "25", 10);
        const radiusMeters = radiusMiles * 1609.34;
        const limit = parseInt(_settings.resultsCount || "5", 10);

        console.log(`[Places Server] Refresh Query: "${query || ""}" at lat=${latNum}, lon=${lonNum}`);

        const apiStatus = {
          here: { configured: !!_settings.hereApiKey, status: "unused", error: null, count: 0 },
        };

        const wrapFetch = _makeWrapFetch(_fetch, " (refresh)");

        const places = await _searchHere(query || "", latNum, lonNum, radiusMeters, limit * 2, wrapFetch, apiStatus);

        if (places.length === 0) {
          console.log(`[Places Server] No places found for refresh query.`);
          return _jsonResponse({ html: "" });
        }

        let top = _processHerePlaces(places, radiusMeters, limit);

        if (_classifyPlaceQuery(query || "") === "name") {
          top = top.filter((p) => _isConfidentNameMatch(query || "", p));
        }

        if (top.length === 0) {
          return _jsonResponse({ html: "" });
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

function _makeWrapFetch(doFetch, tag) {
  return (url, init = {}, timeoutMs = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const mergedInit = { ...init };
    if (!mergedInit.signal) {
      mergedInit.signal = controller.signal;
    }
    const startFetch = Date.now();
    console.log(`[Places Performance v${PLUGIN_VERSION}] Fetch starting${tag}: ${url} (Timeout: ${timeoutMs}ms)`);
    return doFetch(url, mergedInit)
      .then((res) => {
        clearTimeout(id);
        console.log(`[Places Performance v${PLUGIN_VERSION}] Fetch completed${tag}: ${url} in ${Date.now() - startFetch}ms (Status: ${res.status})`);
        return res;
      })
      .catch((err) => {
        clearTimeout(id);
        if (err.name === "AbortError") {
          console.warn(`[Places Performance v${PLUGIN_VERSION}] Fetch timed out${tag}: ${url} (gave up after ${timeoutMs / 1000} seconds)`);
        } else {
          console.warn(`[Places Performance v${PLUGIN_VERSION}] Fetch failed${tag}: ${url} in ${Date.now() - startFetch}ms:`, err);
        }
        throw err;
      });
  };
}

/* ------------------------------------------------------------------ */
/* HERE Search                                                         */
/* ------------------------------------------------------------------ */

async function _searchHere(query, lat, lon, radiusM, limit, doFetch, apiStatus) {
  const apiKey = _settings.hereApiKey;
  if (!apiKey) {
    if (apiStatus?.here) {
      apiStatus.here.status = "error";
      apiStatus.here.error = "Missing HERE API key";
    }
    return [];
  }

  const radius = Math.max(1, Math.round(radiusM));
  const cappedLimit = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 100);
  const codes = _matchCategory(query);
  const mode = codes ? "browse" : "discover";

  const cacheKey = `here:${mode}:${query}:${lat}:${lon}:${radius}:${cappedLimit}`;
  const cached = _cache?.get(cacheKey);
  if (cached) {
    if (apiStatus?.here) {
      apiStatus.here.status = "success";
      apiStatus.here.count = cached.length;
    }
    return cached;
  }

  let url;
  if (codes) {
    // /browse accepts at + in=circle + categories together.
    url =
      `${HERE_BROWSE}?at=${encodeURIComponent(`${lat},${lon}`)}` +
      `&in=${encodeURIComponent(`circle:${lat},${lon};r=${radius}`)}` +
      `&categories=${encodeURIComponent(codes)}` +
      `&limit=${cappedLimit}` +
      `&apiKey=${encodeURIComponent(apiKey)}`;
  } else {
    // /discover 400s if both at + in=circle are passed; use in=circle alone.
    url =
      `${HERE_DISCOVER}?q=${encodeURIComponent(query)}` +
      `&in=${encodeURIComponent(`circle:${lat},${lon};r=${radius}`)}` +
      `&limit=${cappedLimit}` +
      `&apiKey=${encodeURIComponent(apiKey)}`;
  }

  try {
    const res = await doFetch(url, {}, 10000);
    if (!res.ok) {
      const errText = await res.text();
      const msg = `HTTP status ${res.status}: ${errText}`;
      console.error(`[places] HERE ${mode} returned error: ${msg}`);
      if (apiStatus?.here) {
        apiStatus.here.status = "error";
        apiStatus.here.error = msg;
      }
      return [];
    }
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    const out = items.map((item) => _mapHereItem(item, lat, lon)).filter(Boolean);

    if (apiStatus?.here) {
      apiStatus.here.status = "success";
      apiStatus.here.count = out.length;
    }

    _cache?.set(cacheKey, out);
    return out;
  } catch (err) {
    console.error("[places] HERE search failed:", err);
    if (apiStatus?.here) {
      apiStatus.here.status = "error";
      apiStatus.here.error = err.message;
    }
    return [];
  }
}

function _mapHereItem(item, lat, lon) {
  if (!item || !item.position) return null;
  const plat = item.position.lat;
  const plon = item.position.lng;
  if (plat == null || plon == null) return null;

  const contact = Array.isArray(item.contacts) ? item.contacts[0] : null;
  const phone = contact?.phone?.[0]?.value || null;
  const website = contact?.www?.[0]?.value || null;

  const categories = [];
  if (Array.isArray(item.categories)) {
    for (const c of item.categories) {
      if (c && c.primary && c.name) categories.push(c.name);
    }
  }
  const chainName = item.chains?.[0]?.name || null;
  if (chainName && !categories.includes(chainName)) categories.push(chainName);
  // Brand signals used by the optimistic name-query confidence gate.
  const ontologyId = item.chains?.[0]?.id || item.ontologyId || null;

  let hours = null;
  const oh = Array.isArray(item.openingHours) ? item.openingHours[0] : null;
  if (oh) {
    hours = {
      openNow: typeof oh.isOpen === "boolean" ? oh.isOpen : null,
      display: Array.isArray(oh.text) ? oh.text.join(", ") : null,
      status: null,
    };
  }

  const distanceMeters =
    typeof item.distance === "number" ? item.distance : _haversine(lat, lon, plat, plon);

  return {
    id: item.id || null,
    name: item.title || "",
    address: item.address?.label || "",
    lat: plat,
    lon: plon,
    distanceMeters,
    phone,
    website,
    categories,
    hours,
    rating: null,
    reviewCount: null,
    price: null,
    description: null,
    brandName: chainName,
    ontologyId,
    source: "HERE",
    sourceUrl: `https://wego.here.com/?map=${plat},${plon},16,normal`,
  };
}

/* ------------------------------------------------------------------ */
/* Processing                                                          */
/* ------------------------------------------------------------------ */

function _processHerePlaces(rawPlaces, radiusM, limit) {
  const maxDist = radiusM * 1.1;
  const out = [];
  const seenIds = new Set();

  for (const p of rawPlaces) {
    if (!p) continue;
    // Drop anything well beyond the configured radius.
    if (Number.isFinite(p.distanceMeters) && p.distanceMeters > maxDist) continue;

    // Dedupe by HERE id.
    if (p.id) {
      if (seenIds.has(p.id)) continue;
    }

    // Dedupe by name + proximity (same business returned twice).
    const norm = String(p.name || "").toLowerCase().trim();
    let isDuplicate = false;
    for (const e of out) {
      const eNorm = String(e.name || "").toLowerCase().trim();
      if (
        norm &&
        norm === eNorm &&
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lon) &&
        Number.isFinite(e.lat) &&
        Number.isFinite(e.lon) &&
        _haversine(p.lat, p.lon, e.lat, e.lon) < 100
      ) {
        isDuplicate = true;
        break;
      }
    }
    if (isDuplicate) continue;

    if (p.id) seenIds.add(p.id);
    out.push(p);
    // Keep HERE's relevance order; stop once we have enough.
    if (out.length >= limit) break;
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function _renderCard(places, query, locationLabel, showGeoBtn, apiStatus) {
  const unit = _settings.distanceUnit || "miles";
  const unitAbbr = unit === "km" ? "km" : "mi";

  const cards = places
    .map((p, index) => {
      const distVal = unit === "km" ? p.distanceMeters / 1000 : p.distanceMeters / 1609.34;
      const dist = distVal < 0.1 ? "<0.1" : distVal.toFixed(1);
      const displayAddress = _shortAddress(p.address);

      const stars = p.rating
        ? `<span class="places-stars">${"★".repeat(Math.round(p.rating))}${"☆".repeat(5 - Math.round(p.rating))}</span>` +
          `<span class="places-rating-num">${p.rating.toFixed(1)}</span>`
        : "";
      const reviews = p.reviewCount ? `<span class="places-review-count">(${p.reviewCount})</span>` : "";
      const ratingHtml = stars ? `<span class="places-rating">${stars}${reviews}</span>` : "";

      const hoursHtml = p.hours
        ? (() => {
            const badge = p.hours.openNow === true
              ? `<span class="places-hours places-hours-open">Open now</span>`
              : p.hours.openNow === false
                ? `<span class="places-hours places-hours-closed">Closed</span>`
                : "";
            const detail = p.hours.status || p.hours.display || "";
            const detailHtml = detail
              ? `<span class="places-hours-detail" title="${_esc(detail)}">${_esc(detail)}</span>`
              : "";
            return badge + detailHtml;
          })()
        : "";

      const catsHtml = p.categories
        .slice(0, 3)
        .map((c) => `<span class="places-category">${_esc(c)}</span>`)
        .join("") || "";

      const priceHtml = p.price ? `<span class="places-price">${"$".repeat(p.price)}</span>` : "";

      const descHtml = p.description
        ? `<p class="places-description" title="${_esc(p.description)}">${_esc(p.description.substring(0, 100))}${p.description.length > 100 ? "…" : ""}</p>`
        : "";

      return `
<div
  class="places-card${index === 0 ? " places-card-selected" : ""}"
  data-place-card
  data-lat="${_esc(String(p.lat))}"
  data-lon="${_esc(String(p.lon))}"
  data-place-name="${_esc(p.name)}"
  tabindex="0"
  role="button"
  aria-label="Show ${_esc(p.name)} on the map"
>
  <div class="places-card-header">
    <h3 class="places-name">${_esc(p.name)}</h3>
    <span class="places-distance">${dist} ${unitAbbr}</span>
  </div>
  <div class="places-meta">
    ${ratingHtml}
    ${hoursHtml}
    ${catsHtml}
    ${priceHtml}
  </div>
  <p class="places-address" title="${_esc(p.address)}">${_esc(displayAddress)}</p>
  ${descHtml}
  <div class="places-actions">
    <div class="places-action-item">
      <a class="places-circle-btn places-action-call${p.phone ? "" : " places-disabled"}" ${p.phone ? `href="tel:${_esc(p.phone)}"` : ""} title="Call" aria-label="Call">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
        </svg>
      </a>
      <span class="places-action-text">Call</span>
    </div>
    <div class="places-action-item">
      <a class="places-circle-btn places-action-website${p.website ? "" : " places-disabled"}" ${p.website ? `href="${_esc(p.website)}" target="_blank" rel="noopener noreferrer"` : ""} title="Website" aria-label="Website">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
      </a>
      <span class="places-action-text">Website</span>
    </div>
    <div class="places-action-item">
      <button class="places-circle-btn places-action-directions${(p.lat && p.lon) ? "" : " places-disabled"}" ${(p.lat && p.lon) ? `data-directions-btn data-place-name="${_esc(p.name)}" data-lat="${p.lat}" data-lon="${p.lon}" data-address="${_esc(p.address)}"` : ""} type="button" title="Directions" aria-label="Directions">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
        </svg>
      </button>
      <span class="places-action-text">Directions</span>
    </div>
  </div>
</div>`;
    })
    .join("");

  const geoBtn = showGeoBtn
    ? `<button type="button" class="places-geo-btn" data-query="${_esc(query)}">Use my location</button>`
    : "";
  const mapHtml = _renderMap(places);

  return `
<div class="places-wrap slot-full-width" data-places-version="${PLUGIN_VERSION}" data-places-apis="${_esc(JSON.stringify(apiStatus || {}))}">
  <div class="places-header">
    <span class="places-label">Places</span>
    <span class="places-subhead">near ${_esc(locationLabel)}</span>
    ${geoBtn}
  </div>
  <div class="places-layout">
    <div class="places-grid">
      ${cards}
    </div>
    ${mapHtml}
  </div>
  <div class="places-modal" data-places-modal hidden>
    <div class="places-modal-backdrop" data-modal-close></div>
    <div class="places-modal-content">
      <div class="places-modal-header">
        <span class="places-modal-title">Get directions</span>
        <button class="places-modal-close-btn" data-modal-close type="button">&times;</button>
      </div>
      <div class="places-modal-body">
        <a class="places-modal-option" data-modal-option="apple" href="#" target="_blank" rel="noopener noreferrer">Apple Maps</a>
        <a class="places-modal-option" data-modal-option="google" href="#" target="_blank" rel="noopener noreferrer">Google Maps</a>
        <a class="places-modal-option" data-modal-option="osm" href="#" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
      </div>
    </div>
  </div>
</div>`;
}

function _renderMap(places) {
  const mapPlace = places.find((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (!mapPlace) return "";

  const tileUrl = (_settings.customTileUrl && _isTileTemplate(_settings.customTileUrl))
    ? _settings.customTileUrl
    : "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png";

  const viewUrl =
    "https://www.openstreetmap.org/" +
    `?mlat=${encodeURIComponent(mapPlace.lat)}` +
    `&mlon=${encodeURIComponent(mapPlace.lon)}` +
    `#map=15/${encodeURIComponent(mapPlace.lat)}/${encodeURIComponent(mapPlace.lon)}`;

  return `
    <aside
      class="places-map"
      data-map-panel
      data-lat="${_esc(String(mapPlace.lat))}"
      data-lon="${_esc(String(mapPlace.lon))}"
      data-place-name="${_esc(mapPlace.name)}"
      aria-label="Map centered on ${_esc(mapPlace.name)}"
    >
      <div
        class="places-tile-map"
        data-tile-template="${_esc(tileUrl)}"
        data-lat="${_esc(String(mapPlace.lat))}"
        data-lon="${_esc(String(mapPlace.lon))}"
        data-zoom="15"
        role="img"
        aria-label="Map for ${_esc(mapPlace.name)}"
      >
        <div class="places-tile-layer"></div>
        <span class="places-map-pin" aria-hidden="true"></span>
        <div class="places-zoom-controls">
          <button class="places-zoom-btn" data-zoom-in type="button" aria-label="Zoom in">+</button>
          <button class="places-zoom-btn" data-zoom-out type="button" aria-label="Zoom out">−</button>
        </div>
      </div>
      <a class="places-map-link" data-map-link href="${_esc(viewUrl)}" target="_blank" rel="noopener noreferrer">View larger map</a>
    </aside>`;
}

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

function _tileToLatLon(x, y, zoom) {
  const n = Math.pow(2, zoom);
  const lon = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
  const lat = latRad * 180 / Math.PI;
  return { lat, lon };
}

/* ------------------------------------------------------------------ */
/* Conservative place query gate                                       */
/* ------------------------------------------------------------------ */

const LOCAL_INTENT_RE =
  /\b(near me|nearby|nearest|closest|locations?|address|directions?|hours?|open now|phone|menu|reservations?|reviews?|in [a-z .'-]+|near [a-z .'-]+)\b/i;

const PLACE_CATEGORY_RE =
  /\b(restaurant|restaurants|tavern|tap|bar|grill|cafe|coffee|pizza|diner|bakery|brewery|pub|pharmacy|grocery|supermarket|market|bank|hotel|motel|gas station|store|shop|salon|gym|doctor|dentist|hospital|urgent care|auto|car wash|costco|target|walmart|home depot|lowe'?s|starbucks|mcdonald'?s|chipotle|domino'?s)\b/i;

// Known chains/brands that are unambiguously physical places (can trigger as single words with local intent nearby).
const KNOWN_CHAIN_RE =
  /\b(costco|target|walmart|starbucks|mcdonald'?s|burger\s*king|wendy'?s|taco\s*bell|chipotle|domino'?s|pizza\s*hut|papa\s*john'?s|subway|dunkin'?|dunkin\s*donuts|kfc|five\s*guys|shake\s*shack|in-n-out|chick-fil-a|panera|olive\s*garden|red\s*lobster|longhorn|texas\s*roadhouse|cracker\s*barrel|ihop|denny'?s|applebee'?s|chili'?s|outback|buffalo\s*wild\s*wings|home\s*depot|lowe'?s|menards|best\s*buy|staples|office\s*depot|petco|petsmart|whole\s*foods|trader\s*joe'?s|kroger|safeway|albertsons|publix|wegmans|cvs|walgreens|rite\s*aid|sheetz|wawa|buc-ee'?s|flying\s*j|love'?s|pilot|speedway|shell|bp|exxon|mobil|sunoco|citgo|marathon|7-eleven|circle\s*k|royal\s*farms)\b/i;

const NON_PLACE_RE =
  /\b(how to|what is|why|when|who|reddit|github|docs|documentation|install|download|error|fix|linux|macos|windows|npm|pip|python|javascript|typescript|docker|nginx|proxmox|ai|llm|model|qwen|claude|gpt|gemini|ollama|benchmark|review|vs|price|best)\b/i;

const GENERAL_INFO_RE =
  /\b(tutorial|course|book|pdf|lyrics|chords|movie|show|cast|actor|actress|season|episode|news|wiki|wikipedia|definition|meaning|synonym|antonym|pronunciation|translate|translation|weather|forecast|stock|chart|price|convert|converter|calculator|calculate|history|biography|photo|image|picture|wallpaper|video|youtube|song|album|lyrics|map|maps|recipe|ingredients|cooking)\b/i;

const TECH_SCIENCE_RE =
  /\b(react|angular|vue|svelte|node|npm|pip|python|javascript|typescript|golang|rust|java|c\+\+|c#|php|html|css|sql|git|docker|kubernetes|aws|azure|gcp|api|json|xml|csv|yaml|markdown|github|gitlab|bitbucket|stackoverflow|mdn|w3schools|npm|package|library|framework|module|class|function|object|array|string|number|boolean|null|undefined|regexp|regex|compiler|interpreter|theory|theorem|equation|formula|chemical|molecule|atom|cell|organism|species|evolution|math|physics|chemistry|biology)\b/i;

const URL_OR_CODE_RE =
  /https?:\/\/|www\.|[{}[\]<>]|=>|==|!=|\/etc\/|\.js\b|\.ts\b|\.py\b|\.sh\b|@[a-z0-9_-]+/i;

function _normalizeQuery(query) {
  return String(query || "")
    .trim()
    .replace(/\s+/g, " ");
}

function _wordCount(query) {
  return _normalizeQuery(query).split(/\s+/).filter(Boolean).length;
}

function _hasCityOrZipHint(query) {
  return /\b\d{5}(?:-\d{4})?\b/.test(query) || /\b[A-Z]{2}\b/.test(query);
}

// Words that, on their own, are too generic/non-commercial to optimistically
// treat as a brand/business name. Keeps the name-query relaxation honest.
const GENERIC_NAME_STOPWORDS = new Set([
  "the", "and", "for", "you", "your", "are", "was", "what", "when", "where",
  "why", "how", "who", "yes", "no", "ok", "okay", "hello", "hi", "hey",
  "good", "bad", "new", "old", "free", "love", "life", "time", "day", "today",
  "tomorrow", "yesterday", "now", "here", "there", "this", "that", "them",
  "thanks", "please", "help", "info", "about", "home", "work", "name",
]);

// Classifies a query for Places triggering.
//   "strong" -> category / local-intent / known-chain / city-zip signal; render any nearby result (legacy behavior).
//   "name"   -> short, plausible brand/business name; render ONLY on a confident HERE match.
//   null     -> do not trigger.
function _classifyPlaceQuery(rawQuery) {
  const query = _normalizeQuery(rawQuery);
  const lower = query.toLowerCase();

  if (!query || query.length < 3) return null;
  if (query.length > 80) return null;
  if (URL_OR_CODE_RE.test(query)) return null;

  // Obvious informational/software/scientific/tech searches must never trigger.
  if (NON_PLACE_RE.test(lower) || GENERAL_INFO_RE.test(lower) || TECH_SCIENCE_RE.test(lower)) {
    return null;
  }

  // Strong signals: local intent, place category, a known chain, or a city/state/zip hint.
  const hasLocalIntent = LOCAL_INTENT_RE.test(lower);
  const hasCategory = PLACE_CATEGORY_RE.test(lower);
  const hasChain = KNOWN_CHAIN_RE.test(lower);
  const hasLocationHint = _hasCityOrZipHint(lower);
  if (hasLocalIntent || hasCategory || hasChain || hasLocationHint) return "strong";

  // Optimistic brand/business-name admission: a short alphabetic name that
  // survives the reject lists above. The widget still only renders if HERE
  // returns a confident match (see _isConfidentNameMatch), so an unmatched
  // word produces no output.
  if (_looksLikeNameQuery(query)) return "name";

  return null;
}

function _looksLikeNameQuery(query) {
  const tokens = _normalizeQuery(query).split(/\s+/).filter(Boolean);
  if (tokens.length < 1 || tokens.length > 3) return false;

  for (const token of tokens) {
    // Each token must read like a name word: starts with a letter, only
    // letters plus internal apostrophes/hyphens/ampersands/dots. No digits.
    if (!/^[a-z][a-z'’&.-]*$/i.test(token)) return false;
  }

  const compact = tokens.join("");
  if (compact.length < 3) return false;

  // A lone generic stopword (e.g. "the", "good") is not a business name.
  if (tokens.length === 1 && GENERIC_NAME_STOPWORDS.has(tokens[0].toLowerCase())) {
    return false;
  }

  return true;
}

function _looksProbablyPlaceQuery(rawQuery) {
  return _classifyPlaceQuery(rawQuery) !== null;
}

function _normalizeMatchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 0..1 similarity between a query and a place name, combining substring
// containment with token overlap so "tim hortons" matches "Tim Hortons" and
// "starbucks" matches "STARBUCKS" but random words do not.
function _nameMatchScore(query, name) {
  const q = _normalizeMatchText(query);
  const n = _normalizeMatchText(name);
  if (!q || !n) return 0;
  if (q === n) return 1;

  const qTokens = q.split(" ").filter(Boolean);
  const nTokens = new Set(n.split(" ").filter(Boolean));
  if (qTokens.length === 0 || nTokens.size === 0) return 0;

  // Full containment of the query phrase within the name (or vice versa).
  if (n.includes(q) || q.includes(n)) {
    return Math.min(q.length, n.length) >= 3 ? 0.95 : 0;
  }

  let matched = 0;
  for (const t of qTokens) {
    if (nTokens.has(t)) {
      matched += 1;
    } else if (t.length >= 5) {
      // Allow a near-token match for longer words (minor spelling drift).
      for (const nt of nTokens) {
        if (nt.length >= 5 && (nt.startsWith(t.slice(0, 5)) || t.startsWith(nt.slice(0, 5)))) {
          matched += 0.8;
          break;
        }
      }
    }
  }
  return matched / qTokens.length;
}

// A place is a confident match for an optimistic name query when its name (or
// brand) closely matches the query. A HERE chain/ontology brand signal lowers
// the bar slightly. Radius is already enforced by _processHerePlaces.
function _isConfidentNameMatch(query, place) {
  if (!place) return false;
  const nameScore = _nameMatchScore(query, place.name);
  const brandScore = place.brandName ? _nameMatchScore(query, place.brandName) : 0;
  const score = Math.max(nameScore, brandScore);
  if (score >= 0.7) return true;
  if (score >= 0.5 && (place.brandName || place.ontologyId)) return true;
  return false;
}

function _shortAddress(address) {
  if (typeof address !== "string") return "";

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 2) return address;

  const compact = parts.filter((part) => !_looksPostalCode(part) && !_looksCountry(part));
  if (compact.length >= 2) return compact.slice(-2).join(", ");

  return parts.slice(0, 2).join(", ");
}

function _looksPostalCode(part) {
  return /^[A-Z]?\d[A-Z\d]?[-\s]?\d[A-Z]{0,2}$/i.test(part) || /^\d{4,10}(-\d{3,6})?$/.test(part);
}

function _looksCountry(part) {
  return /^(united states|usa|us|united kingdom|uk|canada|australia|new zealand)$/i.test(part);
}

function _isTileTemplate(url) {
  return (
    /^https?:\/\//i.test(url) &&
    url.includes("{z}") &&
    url.includes("{x}") &&
    url.includes("{y}")
  );
}

function _mapBounds(places) {
  const points = places.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const minLatRaw = Math.min(...lats);
  const maxLatRaw = Math.max(...lats);
  const minLonRaw = Math.min(...lons);
  const maxLonRaw = Math.max(...lons);
  const latPad = Math.max(0.01, (maxLatRaw - minLatRaw) * 0.25);
  const lonPad = Math.max(0.01, (maxLonRaw - minLonRaw) * 0.25);

  return {
    minLat: Math.max(-90, minLatRaw - latPad).toFixed(6),
    maxLat: Math.min(90, maxLatRaw + latPad).toFixed(6),
    minLon: Math.max(-180, minLonRaw - lonPad).toFixed(6),
    maxLon: Math.min(180, maxLonRaw + lonPad).toFixed(6),
  };
}

function _haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (n) => (n * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function _esc(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
