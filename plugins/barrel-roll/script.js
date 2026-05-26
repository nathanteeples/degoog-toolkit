(function () {
  "use strict";

  var DURATION = 1000; // ms — matches the CSS animation duration

  function processMarkers() {
    var markers = document.querySelectorAll(".barrel-roll-marker");

    if (markers.length === 0) {
      document.body.classList.remove("barrel-roll-active");
      document.body.classList.remove("barrel-roll-tilted");
      document.documentElement.classList.remove("barrel-roll-clipping");
      return;
    }

    for (var i = 0; i < markers.length; i++) {
      var marker = markers[i];
      if (marker.getAttribute("data-processed") === "true") continue;
      marker.setAttribute("data-processed", "true");

      var action = marker.getAttribute("data-action");
      if (action === "roll") {
        doBarrelRoll();
      } else if (action === "tilt" || action === "askew") {
        doTilt();
      }
    }
  }

  function doBarrelRoll() {
    var target = document.body;
    var html = document.documentElement;

    // Pivot around the VISIBLE viewport center, not the document center.
    // body.getBoundingClientRect().top is negative when scrolled down, which
    // means pivotY > innerHeight/2 — correctly compensating for scroll offset.
    var rect = target.getBoundingClientRect();
    var pivotX = (window.innerWidth  / 2) - rect.left;
    var pivotY = (window.innerHeight / 2) - rect.top;
    target.style.transformOrigin = pivotX + "px " + pivotY + "px";

    // Clip at the <html> level so rotating corners don't trigger scrollbars
    html.classList.add("barrel-roll-clipping");

    // Restart animation cleanly
    target.classList.remove("barrel-roll-active");
    void target.offsetWidth; // force reflow
    target.classList.add("barrel-roll-active");

    function cleanup() {
      target.classList.remove("barrel-roll-active");
      target.style.transformOrigin = "";
      html.classList.remove("barrel-roll-clipping");
      target.removeEventListener("animationend", cleanup);
    }

    target.addEventListener("animationend", cleanup, { once: true });
    // Fallback cleanup slightly after CSS duration
    setTimeout(cleanup, DURATION + 100);
  }

  function doTilt() {
    var target = document.body;
    var rect = target.getBoundingClientRect();
    var pivotX = (window.innerWidth  / 2) - rect.left;
    var pivotY = (window.innerHeight / 2) - rect.top;
    target.style.transformOrigin = pivotX + "px " + pivotY + "px";
    target.classList.add("barrel-roll-tilted");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", processMarkers);
  } else {
    processMarkers();
  }

  var observer = new MutationObserver(processMarkers);
  observer.observe(document.body, { childList: true, subtree: true });
})();
