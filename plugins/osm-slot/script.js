(function () {
  var REFRESH_TIMEOUT_MS = 22000;
  var TILE_SIZE = 256;

  function _setButtonState(btn, text, disabled) {
    btn.textContent = text;
    btn.disabled = disabled;
  }

  function _initGeoButtons() {
    document.querySelectorAll(".places-geo-btn:not([data-places-init])").forEach(function (btn) {
      btn.dataset.placesInit = "1";
      btn.addEventListener("click", async function () {
        if (btn.dataset.placesBusy === "true") return;

        if (!navigator.geolocation) {
          _setButtonState(btn, "Not supported", true);
          return;
        }

        btn.dataset.placesBusy = "true";
        _setButtonState(btn, "Locating...", true);

        navigator.geolocation.getCurrentPosition(
          async function (pos) {
            _setButtonState(btn, "Searching...", true);
            var controller = new AbortController();
            var timeout = window.setTimeout(function () {
              controller.abort();
            }, REFRESH_TIMEOUT_MS);

            try {
              const res = await fetch(
                "/api/plugin/" + __PLUGIN_ID__ + "/refresh",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  signal: controller.signal,
                  body: JSON.stringify({
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    query: btn.dataset.query || "",
                  }),
                }
              );
              if (!res.ok) throw new Error("Refresh failed");
              const data = await res.json();
              const wrap = btn.closest(".places-wrap");
              if (wrap && data.html) {
                const temp = document.createElement("div");
                temp.innerHTML = data.html.trim();
                const newWrap = temp.firstElementChild;
                if (newWrap) {
                  wrap.replaceWith(newWrap);
                  _initGeoButtons();
                  _initTileMaps();
                  return;
                }
                _setButtonState(btn, "No results", false);
              } else {
                _setButtonState(btn, "No results", false);
              }
            } catch (e) {
              _setButtonState(
                btn,
                e && e.name === "AbortError" ? "Search timed out" : "Refresh failed",
                false
              );
            } finally {
              window.clearTimeout(timeout);
              btn.dataset.placesBusy = "false";
            }
          },
          function (err) {
            var denied = err && err.code === err.PERMISSION_DENIED;
            _setButtonState(btn, denied ? "Location denied" : "Location unavailable", false);
            btn.dataset.placesBusy = "false";
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      });
    });
  }

  function _initTileMaps() {
    document.querySelectorAll(".places-tile-map:not([data-places-map-init])").forEach(function (map) {
      map.dataset.placesMapInit = "1";
      _renderTileMap(map);

      if (typeof ResizeObserver === "function") {
        var observer = new ResizeObserver(function () {
          _renderTileMap(map);
        });
        observer.observe(map);
      } else {
        window.addEventListener("resize", function () {
          _renderTileMap(map);
        });
      }
    });
  }

  function _renderTileMap(map) {
    var layer = map.querySelector(".places-tile-layer");
    if (!layer) return;

    var template = map.dataset.tileTemplate || "";
    var lat = Number(map.dataset.lat);
    var lon = Number(map.dataset.lon);
    var zoom = Number(map.dataset.zoom || 15);
    var width = Math.max(map.clientWidth, TILE_SIZE);
    var height = Math.max(map.clientHeight, TILE_SIZE);

    if (!template || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(zoom)) {
      return;
    }

    var center = _latLonToTile(lat, lon, zoom);
    var centerPxX = center.x * TILE_SIZE;
    var centerPxY = center.y * TILE_SIZE;
    var startX = Math.floor((centerPxX - width / 2) / TILE_SIZE);
    var endX = Math.floor((centerPxX + width / 2) / TILE_SIZE);
    var startY = Math.floor((centerPxY - height / 2) / TILE_SIZE);
    var endY = Math.floor((centerPxY + height / 2) / TILE_SIZE);
    var maxTile = Math.pow(2, zoom);
    var html = "";

    for (var x = startX; x <= endX; x += 1) {
      for (var y = startY; y <= endY; y += 1) {
        if (y < 0 || y >= maxTile) continue;

        var wrappedX = ((x % maxTile) + maxTile) % maxTile;
        var left = Math.round(x * TILE_SIZE - centerPxX + width / 2);
        var top = Math.round(y * TILE_SIZE - centerPxY + height / 2);
        var src = _tileUrl(template, zoom, wrappedX, y);

        html +=
          '<img class="places-tile" alt="" draggable="false" src="' +
          _escapeAttr(src) +
          '" style="left:' +
          left +
          "px;top:" +
          top +
          'px">';
      }
    }

    layer.innerHTML = html;
  }

  function _latLonToTile(lat, lon, zoom) {
    var sinLat = Math.sin((Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI) / 180);
    var scale = Math.pow(2, zoom);
    return {
      x: ((lon + 180) / 360) * scale,
      y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
    };
  }

  function _tileUrl(template, zoom, x, y) {
    return template
      .replace(/\{z\}/g, String(zoom))
      .replace(/\{x\}/g, String(x))
      .replace(/\{y\}/g, String(y));
  }

  function _escapeAttr(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  _initGeoButtons();
  _initTileMaps();

  var observer = new MutationObserver(function () {
    _initGeoButtons();
    _initTileMaps();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
