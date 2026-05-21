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
    const resultEl = slot.querySelector("[data-coinflip-result]");
    const ticker = slot.querySelector("[data-coinflip-ticker]");
    const button = slot.querySelector("[data-coinflip-reroll]");
    const flips = Math.max(4, parseInt(slot.dataset.flips || "7", 10) || 7);

    if (!coin || !resultEl || !ticker) return;
    if (!coin.animate) {
      land(slot, result);
      return;
    }

    const start = rotationFor(normalizeResult(slot.dataset.result));
    const target = rotationFor(result);
    const finish = flips * 360 + target;

    slot.classList.add("is-flipping");
    resultEl.textContent = "Flipping...";
    ticker.textContent = "spinning";
    if (button) button.disabled = true;

    const animation = coin.animate(
      [
        {
          transform: `rotateX(-10deg) rotateY(${start}deg) rotateZ(-2deg)`,
          filter: "brightness(0.96)",
        },
        {
          transform: `rotateX(12deg) rotateY(${Math.floor(finish * 0.42)}deg) rotateZ(5deg)`,
          filter: "brightness(1.15)",
          offset: 0.42,
        },
        {
          transform: `rotateX(-7deg) rotateY(${finish}deg) rotateZ(0deg)`,
          filter: "brightness(1)",
        },
      ],
      {
        duration: 1250 + Math.min(flips, 9) * 80,
        easing: "cubic-bezier(.18,.76,.22,1)",
        fill: "forwards",
      },
    );

    activeAnimations.set(slot, animation);
    animation.onfinish = function () {
      activeAnimations.delete(slot);
      land(slot, result);
    };
    animation.oncancel = function () {
      activeAnimations.delete(slot);
    };
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
    if (!coin) return;
    coin.style.transform = `rotateX(-7deg) rotateY(${rotationFor(result)}deg)`;
  }

  function clearAnimation(slot) {
    const animation = activeAnimations.get(slot);
    if (animation) animation.cancel();
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
