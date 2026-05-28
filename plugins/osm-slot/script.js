(function () {
  var REFRESH_TIMEOUT_MS = 22000;

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

  _initGeoButtons();

  var observer = new MutationObserver(_initGeoButtons);
  observer.observe(document.body, { childList: true, subtree: true });
})();
