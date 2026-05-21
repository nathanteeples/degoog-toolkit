(function () {
  "use strict";

  const activeAnimations = new WeakMap();

  function initAll(root) {
    const scope = root || document;
    scope
      .querySelectorAll(
        ".coinflip-slot[data-coinflip-slot]:not([data-coinflip-init])",
      )
      .forEach(initSlot);
  }

  function initSlot(slot) {
    slot.dataset.coinflipInit = "1";

    const initialResult = normalizeResult(slot.dataset.result);
    const button = slot.querySelector("[data-coinflip-reroll]");

    if (button) {
      button.addEventListener("click", function () {
        const result = randomResult();
        slot.dataset.flips = String(6 + randomInt(4));
        animateFlip(slot, result);
      });
    }

    setCoinPose(slot, initialResult);
    animateFlip(slot, initialResult);
  }

  function animateFlip(slot, result) {
    clearAnimation(slot);

    if (prefersReducedMotion()) {
      land(slot, result);
      return;
    }

    const coin = slot.querySelector("[data-coinflip-coin]");
    const faces = Array.from(slot.querySelectorAll(".coinflip-slot__face"));
    const spins = Array.from(slot.querySelectorAll("[data-coinflip-spin]"));
    const resultEl = slot.querySelector("[data-coinflip-result]");
    const ticker = slot.querySelector("[data-coinflip-ticker]");
    const button = slot.querySelector("[data-coinflip-reroll]");
    const flips = Math.max(4, parseInt(slot.dataset.flips || "7", 10) || 7);

    if (!coin || faces.length === 0 || spins.length === 0 || !resultEl || !ticker) return;

    const start = rotationFor(normalizeResult(slot.dataset.result));
    const target = rotationFor(result);
    const finish = finishAngle(start, target, flips);
    const duration = 1250 + Math.min(flips, 9) * 80;

    slot.classList.add("is-flipping");
    resultEl.textContent = "Flipping...";
    ticker.textContent = "spinning";
    if (button) button.disabled = true;
    coin.dataset.side = "spinning";

    const state = { frameId: 0 };
    activeAnimations.set(slot, state);
    const startTime = performance.now();

    function frame(now) {
      if (activeAnimations.get(slot) !== state) return;

      const t = Math.min((now - startTime) / duration, 1);
      const yProgress = yAxisProgress(t);
      const yDegrees = start + (finish - start) * yProgress;
      const lift = Math.sin(Math.PI * t);
      const xDegrees = -7 + lift * 22;
      const yOffset = -lift * 24;
      const brightness = 0.96 + lift * 0.16;

      coin.style.transform = coinTransform(yDegrees, xDegrees, yOffset);
      faces.forEach((face) => {
        face.style.filter = `brightness(${brightness.toFixed(3)})`;
      });
      spins.forEach((spin) => {
        spin.style.transform = `rotateZ(${360 * t}deg)`;
      });

      if (t < 1) {
        state.frameId = requestAnimationFrame(frame);
      } else {
        activeAnimations.delete(slot);
        land(slot, result);
      }
    }

    state.frameId = requestAnimationFrame(frame);
  }

  function land(slot, result) {
    clearAnimation(slot);

    const resultEl = slot.querySelector("[data-coinflip-result]");
    const ticker = slot.querySelector("[data-coinflip-ticker]");
    const button = slot.querySelector("[data-coinflip-reroll]");
    const cleanResult = normalizeResult(result);
    const label = cleanResult === "heads" ? "Heads" : "Tails";

    slot.classList.remove("is-flipping");
    slot.dataset.result = cleanResult;
    setCoinPose(slot, cleanResult);
    if (resultEl) resultEl.textContent = label;
    if (ticker) ticker.textContent = "landed " + cleanResult;
    if (button) button.disabled = false;
  }

  function setCoinPose(slot, result) {
    const coin = slot.querySelector("[data-coinflip-coin]");
    const faces = slot.querySelectorAll(".coinflip-slot__face");
    const spins = slot.querySelectorAll("[data-coinflip-spin]");
    if (!coin) return;
    const cleanResult = normalizeResult(result);
    coin.dataset.side = cleanResult;
    coin.style.transform = coinTransform(rotationFor(cleanResult), -7, 0);
    faces.forEach((face) => { face.style.filter = ""; });
    spins.forEach((spin) => {
      spin.style.transform = "rotateZ(0deg)";
    });
  }

  function coinTransform(yDegrees, xDegrees, yOffset) {
    return `translateY(${yOffset}px) rotateX(${xDegrees}deg) rotateY(${yDegrees}deg)`;
  }

  function finishAngle(start, target, rotations) {
    let angle = rotations * 360 + target;
    while (angle <= start + 360) angle += 360;
    return angle;
  }

  function yAxisProgress(t) {
    const ramp = 0.18;
    const velocity = 1 / (1 - ramp / 2);
    if (t < ramp) return (velocity * t * t) / (2 * ramp);
    return velocity * (t - ramp / 2);
  }

  function clearAnimation(slot) {
    const state = activeAnimations.get(slot);
    if (state?.frameId) cancelAnimationFrame(state.frameId);
    activeAnimations.delete(slot);
  }

  function rotationFor(value) {
    return normalizeResult(value) === "tails" ? 180 : 0;
  }

  function normalizeResult(value) {
    return String(value || "").toLowerCase() === "tails" ? "tails" : "heads";
  }

  function randomResult() {
    return randomInt(2) === 0 ? "heads" : "tails";
  }

  function randomInt(max) {
    const limit = Math.max(1, Math.floor(max));
    if (window.crypto && window.crypto.getRandomValues) {
      const bucket = new Uint32Array(1);
      window.crypto.getRandomValues(bucket);
      return bucket[0] % limit;
    }
    return Math.floor(Math.random() * limit);
  }

  function prefersReducedMotion() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function boot() {
    initAll(document);
    if (window.__coinflipSlotObserver) return;
    window.__coinflipSlotObserver = new MutationObserver(function (mutations) {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (
            node.matches &&
            node.matches(
              ".coinflip-slot[data-coinflip-slot]:not([data-coinflip-init])",
            )
          ) {
            initSlot(node);
          } else if (node.querySelectorAll) {
            initAll(node);
          }
        }
      }
    });
    window.__coinflipSlotObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
