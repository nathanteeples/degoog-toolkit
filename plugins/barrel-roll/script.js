(function () {
  "use strict";

  var activeClass = "barrel-roll-active";
  var tiltedClass = "barrel-roll-tilted";

  function processMarkers() {
    var markers = document.querySelectorAll(".barrel-roll-marker");

    // Clean up classes if no markers are present in the DOM (e.g. navigated away)
    if (markers.length === 0) {
      document.body.classList.remove(activeClass);
      document.body.classList.remove(tiltedClass);
      return;
    }

    for (var i = 0; i < markers.length; i++) {
      var marker = markers[i];
      if (marker.getAttribute("data-processed") === "true") {
        continue;
      }
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

    // Lock scrolling so no scrollbars flash during rotation
    var origOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    // Pivot around the current viewport center relative to body
    // (body.getBoundingClientRect().top accounts for any scroll position)
    var bodyRect = target.getBoundingClientRect();
    var pivotX = (window.innerWidth  / 2) - bodyRect.left;
    var pivotY = (window.innerHeight / 2) - bodyRect.top;
    target.style.transformOrigin = pivotX + "px " + pivotY + "px";

    // Remove class first to restart animation if already active
    target.classList.remove(activeClass);
    // Force reflow so removing and re-adding the class restarts the animation
    void target.offsetWidth;
    target.classList.add(activeClass);

    function cleanup() {
      target.classList.remove(activeClass);
      target.style.transformOrigin = "";
      document.documentElement.style.overflow = origOverflow;
      target.removeEventListener("animationend", cleanup);
    }

    target.addEventListener("animationend", cleanup);
    // Fallback in case animationend doesn't fire
    setTimeout(cleanup, 2200);
  }

  function doTilt() {
    var target = document.body;
    var bodyRect = target.getBoundingClientRect();
    var pivotX = (window.innerWidth  / 2) - bodyRect.left;
    var pivotY = (window.innerHeight / 2) - bodyRect.top;
    target.style.transformOrigin = pivotX + "px " + pivotY + "px";
    target.classList.add(tiltedClass);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", processMarkers);
  } else {
    processMarkers();
  }

  var observer = new MutationObserver(processMarkers);
  observer.observe(document.body, { childList: true, subtree: true });
})();
