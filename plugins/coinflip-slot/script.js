(function () {
  "use strict";

  const ART = {
    heads: [
      "      ▓▓▓▓▓▓▓▓▓▓      ",
      "    ▓▓          ▓▓    ",
      "  ▓▓  ░░▓▓  ▓▓░░  ▓▓  ",
      "▓▓    ░░▓▓  ▓▓░░    ▓▓",
      "▓▓  ░░░░▓▓  ▓▓░░░░  ▓▓",
      "▓▓  ░░░░▓▓▓▓▓▓░░░░  ▓▓",
      "▓▓  ░░░░▓▓  ▓▓░░░░  ▓▓",
      "▓▓  ░░░░▓▓  ▓▓░░░░  ▓▓",
      "  ▓▓  ░░▓▓  ▓▓░░  ▓▓  ",
      "    ▓▓░░      ░░▓▓    ",
      "      ▓▓▓▓▓▓▓▓▓▓      ",
      "██████████████████████",
    ].join("\n"),
    tails: [
      "      ▓▓▓▓▓▓▓▓▓▓      ",
      "    ▓▓          ▓▓    ",
      "  ▓▓    ░░▓▓░░░░░░▓▓  ",
      "▓▓    ░░▓▓▓▓▓▓░░░░░░▓▓",
      "▓▓  ░░░░▓▓░░░░░░░░░░▓▓",
      "▓▓  ░░░░░░▓▓░░░░░░░░▓▓",
      "▓▓  ░░░░░░░░▓▓░░░░░░▓▓",
      "▓▓  ░░░░▓▓▓▓▓▓░░░░░░▓▓",
      "  ▓▓  ░░░░▓▓░░░░░░▓▓  ",
      "    ▓▓░░░░░░░░░░▓▓    ",
      "      ▓▓▓▓▓▓▓▓▓▓      ",
      "██████████████████████",
    ].join("\n"),
    edge: [
      "          ▓▓          ",
      "          ▓▓          ",
      "          ▓▓          ",
      "          ██          ",
      "          ██          ",
      "          ██          ",
      "          ██          ",
      "          ██          ",
      "          ▓▓          ",
      "          ▓▓          ",
      "          ▓▓          ",
      "██████████████████████",
    ].join("\n"),
    thin: [
      "           ░          ",
      "           ▒          ",
      "           ▓          ",
      "           █          ",
      "           █          ",
      "           █          ",
      "           █          ",
      "           █          ",
      "           ▓          ",
      "           ▒          ",
      "           ░          ",
      "██████████████████████",
    ].join("\n"),
  };

  const FRAME_ORDER = [
    "heads",
    "edge",
    "tails",
    "thin",
    "heads",
    "edge",
    "tails",
    "edge",
  ];
  const activeTimers = new WeakMap();

  function initAll(root) {
    const scope = root || document;
    scope
      .querySelectorAll(".coinflip-slot[data-coinflip-slot]:not([data-coinflip-init])")
      .forEach(initSlot);
  }

  function initSlot(slot) {
    slot.dataset.coinflipInit = "1";

    const initialResult = normalizeResult(slot.dataset.result);
    const button = slot.querySelector("[data-coinflip-reroll]");

    if (button) {
      button.addEventListener("click", function () {
        const result = randomResult();
        slot.dataset.result = result;
        slot.dataset.flips = String(11 + randomInt(7));
        animateFlip(slot, result);
      });
    }

    animateFlip(slot, initialResult);
  }

  function animateFlip(slot, result) {
    clearTimer(slot);

    if (prefersReducedMotion()) {
      land(slot, result);
      return;
    }

    const coin = slot.querySelector("[data-coinflip-coin]");
    const resultEl = slot.querySelector("[data-coinflip-result]");
    const ticker = slot.querySelector("[data-coinflip-ticker]");
    const flips = Math.max(8, parseInt(slot.dataset.flips || "12", 10) || 12);

    if (!coin || !resultEl || !ticker) return;

    slot.classList.add("is-flipping");
    resultEl.textContent = "Flipping...";
    ticker.textContent = "heads? tails?";

    let frame = 0;
    function tick() {
      const phase = FRAME_ORDER[frame % FRAME_ORDER.length];
      coin.textContent = ART[phase];
      ticker.textContent = phase === "tails" ? "tails?" : "heads?";
      frame += 1;

      if (frame <= flips) {
        const delay = 54 + frame * 13;
        activeTimers.set(slot, window.setTimeout(tick, delay));
      } else {
        activeTimers.set(slot, window.setTimeout(function () {
          land(slot, result);
        }, 120));
      }
    }

    tick();
  }

  function land(slot, result) {
    clearTimer(slot);

    const coin = slot.querySelector("[data-coinflip-coin]");
    const resultEl = slot.querySelector("[data-coinflip-result]");
    const ticker = slot.querySelector("[data-coinflip-ticker]");
    const cleanResult = normalizeResult(result);
    const label = cleanResult === "heads" ? "Heads" : "Tails";

    slot.classList.remove("is-flipping");
    slot.dataset.result = cleanResult;
    if (coin) coin.textContent = ART[cleanResult];
    if (resultEl) resultEl.textContent = label;
    if (ticker) ticker.textContent = "landed " + cleanResult;
  }

  function clearTimer(slot) {
    const timer = activeTimers.get(slot);
    if (timer) window.clearTimeout(timer);
    activeTimers.delete(slot);
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
            node.matches(".coinflip-slot[data-coinflip-slot]:not([data-coinflip-init])")
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
