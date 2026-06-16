const PLUGIN_API = `/api/plugin/${encodeURIComponent(__PLUGIN_ID__)}`;
const SETTINGS_URL = `${PLUGIN_API}/settings`;
const COMMANDS_URL = "/api/commands";
const CACHE_TTL_MS = 5 * 60 * 1000;

/** @type {Array<{trigger:string,name:string,description:string,aliases:string[]}> | null} */
let commandCache = null;
let cacheExpiry = 0;
let maxSuggestions = 6;
let debounceTimer = null;
let bangPaintFrame = 0;
let initialized = false;

const escapeHtml = (str) => {
  if (str == null) return "";
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
};

const escapeAttr = (str) =>
  escapeHtml(str).replace(/"/g, "&quot;").replace(/'/g, "&#039;");

function getSearchBarForInput(input) {
  if (!input) return null;
  return input.closest(".search-bar, .results-search-bar");
}

function getBangInput(target) {
  if (!(target instanceof HTMLElement)) return null;
  if (target.id === "search-input" || target.id === "results-search-input") {
    return target;
  }
  return null;
}

function getDropdownForInput(input) {
  if (!input) return null;
  if (input.id === "search-input") {
    return document.getElementById("ac-dropdown-home");
  }
  if (input.id === "results-search-input") {
    return document.getElementById("ac-dropdown-results");
  }
  return null;
}

function shouldShowBang(input) {
  const value = input?.value ?? "";
  if (!value.startsWith("!")) return false;
  return !value.slice(1).includes(" ");
}

function isBangDropdownActive(dropdown) {
  return dropdown?.dataset?.autoBangActive === "true";
}

function clearBangDropdown(dropdown) {
  if (!dropdown) return;
  dropdown.querySelectorAll(".ac-item--bang").forEach((item) => item.remove());
  dropdown.dataset.autoBangActive = "";
  dropdown.dataset.bangTriggers = "";
}

function hideBangDropdown(dropdown) {
  if (!dropdown || !isBangDropdownActive(dropdown)) return;
  clearBangDropdown(dropdown);
  dropdown.style.display = "none";
  dropdown.parentElement?.classList.remove("ac-open");
}

async function fetchCommands() {
  if (commandCache && Date.now() < cacheExpiry) return commandCache;
  try {
    const response = await fetch(COMMANDS_URL, { cache: "no-store" });
    if (!response.ok) return commandCache ?? [];
    const data = await response.json();
    commandCache = data.commands ?? [];
    cacheExpiry = Date.now() + CACHE_TTL_MS;
    return commandCache;
  } catch {
    return commandCache ?? [];
  }
}

function scoreCommand(query, command) {
  const q = query.toLowerCase();
  const trigger = command.trigger.toLowerCase();
  const name = command.name.toLowerCase();
  const aliases = (command.aliases ?? []).map((alias) => alias.toLowerCase());

  if (trigger === q) return 0;
  if (aliases.some((alias) => alias === q)) return 1;
  if (trigger.startsWith(q)) return 10 + trigger.length;
  if (aliases.some((alias) => alias.startsWith(q))) {
    return (
      20 +
      Math.min(...aliases.filter((alias) => alias.startsWith(q)).map((alias) => alias.length))
    );
  }
  if (name.startsWith(q)) return 30 + name.length;

  const triggerIdx = trigger.indexOf(q);
  if (triggerIdx !== -1) return 50 + triggerIdx + trigger.length;

  const nameIdx = name.indexOf(q);
  if (nameIdx !== -1) return 70 + nameIdx + name.length;

  return null;
}

function filterCommands(query, commands) {
  const q = query.toLowerCase();
  if (!q) return commands.slice(0, maxSuggestions);

  const scored = [];
  for (const command of commands) {
    const score = scoreCommand(q, command);
    if (score !== null) scored.push({ command, score });
  }
  scored.sort((left, right) => left.score - right.score);
  return scored.slice(0, maxSuggestions).map((entry) => entry.command);
}

function applyBangSelection(input, dropdown, trigger) {
  if (!input || !trigger) return;
  input.value = `!${trigger} `;
  input.focus();
  hideBangDropdown(dropdown);
}

function createBangItemElement(command) {
  const item = document.createElement("div");
  item.className = "ac-item ac-item--bang";
  item.dataset.trigger = command.trigger;
  item.setAttribute("role", "button");
  item.setAttribute("tabindex", "0");
  item.innerHTML = `<span class="ac-item-copy">
            <span class="ac-item-bang-trigger">!${escapeHtml(command.trigger)}</span>
            <span class="ac-item-bang-name">${escapeHtml(command.name)}</span>
            <span class="ac-item-bang-desc">${escapeHtml(command.description || "")}</span>
          </span>`;
  return item;
}

function updateBangItemElement(item, command) {
  const triggerEl = item.querySelector(".ac-item-bang-trigger");
  const nameEl = item.querySelector(".ac-item-bang-name");
  const descEl = item.querySelector(".ac-item-bang-desc");
  const triggerText = `!${command.trigger}`;
  if (triggerEl && triggerEl.textContent !== triggerText) {
    triggerEl.textContent = triggerText;
  }
  if (nameEl && nameEl.textContent !== command.name) {
    nameEl.textContent = command.name;
  }
  const description = command.description || "";
  if (descEl && descEl.textContent !== description) {
    descEl.textContent = description;
  }
}

function bindBangItem(item, input, dropdown) {
  if (item.dataset.bangBound === "true") return;
  item.dataset.bangBound = "true";
  item.addEventListener("mousedown", (event) => {
    event.preventDefault();
    applyBangSelection(input, dropdown, item.dataset.trigger);
  });
}

function renderBangDropdown(commands, input, dropdown) {
  if (!dropdown || !input) return;
  if (!shouldShowBang(input)) {
    hideBangDropdown(dropdown);
    return;
  }
  if (!commands.length) {
    hideBangDropdown(dropdown);
    return;
  }

  const nextTriggers = commands.map((command) => command.trigger);
  const nextKey = nextTriggers.join("|");
  const prevKey = dropdown.dataset.bangTriggers || "";
  const wasActive = isBangDropdownActive(dropdown);
  const activeTrigger =
    dropdown.querySelector(".ac-item--bang-active")?.dataset.trigger || "";

  if (wasActive && nextKey === prevKey) {
    if (dropdown.style.display !== "block") {
      dropdown.style.display = "block";
      dropdown.parentElement?.classList.add("ac-open");
    }
    return;
  }

  const existingByTrigger = new Map();
  dropdown.querySelectorAll(".ac-item--bang").forEach((item) => {
    if (item.dataset.trigger) existingByTrigger.set(item.dataset.trigger, item);
  });

  dropdown.querySelectorAll(".ac-item:not(.ac-item--bang)").forEach((item) => {
    item.remove();
  });

  for (const command of commands) {
    let item = existingByTrigger.get(command.trigger);
    if (!item) {
      item = createBangItemElement(command);
      bindBangItem(item, input, dropdown);
    } else {
      existingByTrigger.delete(command.trigger);
      updateBangItemElement(item, command);
    }
    dropdown.appendChild(item);
  }

  existingByTrigger.forEach((item) => item.remove());

  dropdown.dataset.bangTriggers = nextKey;
  dropdown.dataset.autoBangActive = "true";

  if (dropdown.style.display !== "block") {
    dropdown.style.display = "block";
  }
  dropdown.parentElement?.classList.add("ac-open");

  if (activeTrigger) {
    dropdown.querySelectorAll(".ac-item--bang").forEach((item) => {
      item.classList.toggle(
        "ac-item--bang-active",
        item.dataset.trigger === activeTrigger,
      );
    });
  }
}

function updateBangDropdownSync(input, dropdown) {
  if (!input || !dropdown || !commandCache) return false;
  if (!shouldShowBang(input)) return false;
  const filtered = filterCommands(input.value.slice(1), commandCache);
  renderBangDropdown(filtered, input, dropdown);
  return true;
}

async function updateBangDropdown(input, dropdown) {
  if (!input || !dropdown) return;
  if (!shouldShowBang(input)) {
    hideBangDropdown(dropdown);
    return;
  }

  const commands = await fetchCommands();
  const filtered = filterCommands(input.value.slice(1), commands);
  renderBangDropdown(filtered, input, dropdown);
}

function queueBangUpdate(input, dropdown) {
  clearTimeout(debounceTimer);

  if (!shouldShowBang(input)) {
    hideBangDropdown(dropdown);
    return;
  }

  const repaint = () => {
    if (!shouldShowBang(input)) {
      hideBangDropdown(dropdown);
      return;
    }
    if (!updateBangDropdownSync(input, dropdown)) {
      updateBangDropdown(input, dropdown);
    }
  };

  if (updateBangDropdownSync(input, dropdown)) {
    queueMicrotask(repaint);
    cancelAnimationFrame(bangPaintFrame);
    bangPaintFrame = requestAnimationFrame(repaint);
    return;
  }

  debounceTimer = setTimeout(repaint, 0);
}

function getHighlightedBangItem(dropdown) {
  if (!dropdown || !isBangDropdownActive(dropdown)) return null;
  return (
    dropdown.querySelector(
      '.ac-item--bang.ac-item--bang-active, .ac-item--bang[aria-selected="true"], .ac-item--bang:hover',
    ) ?? null
  );
}

function useHighlightedBang(input, dropdown, event) {
  const highlighted = getHighlightedBangItem(dropdown);
  if (!highlighted?.dataset.trigger) return false;
  event.preventDefault();
  event.stopPropagation();
  applyBangSelection(input, dropdown, highlighted.dataset.trigger);
  return true;
}

function loadSettings() {
  return fetch(SETTINGS_URL)
    .then((response) => (response.ok ? response.json() : null))
    .then((settings) => {
      const value = parseInt(settings?.maxSuggestions, 10);
      if (Number.isFinite(value) && value > 0) maxSuggestions = value;
    })
    .catch(() => {});
}

function initAutoBang() {
  if (initialized) return;
  initialized = true;

  loadSettings().then(() => fetchCommands());

  document.addEventListener("input", (event) => {
    const input = getBangInput(event.target);
    const dropdown = getDropdownForInput(input);
    if (!input || !dropdown) return;
    if (!shouldShowBang(input)) {
      hideBangDropdown(dropdown);
      return;
    }
    queueBangUpdate(input, dropdown);
  });

  document.addEventListener("focusin", (event) => {
    const input = getBangInput(event.target);
    const dropdown = getDropdownForInput(input);
    if (!input || !dropdown || !shouldShowBang(input)) return;
    queueBangUpdate(input, dropdown);
  });

  document.addEventListener(
    "mousedown",
    (event) => {
      if (!(event.target instanceof Node)) return;
      for (const id of ["search-input", "results-search-input"]) {
        const input = document.getElementById(id);
        const dropdown = getDropdownForInput(input);
        const bar = getSearchBarForInput(input);
        if (!input || !dropdown || !bar) continue;
        if (!isBangDropdownActive(dropdown)) continue;
        if (!shouldShowBang(input)) continue;
        if (bar.contains(event.target)) continue;
        hideBangDropdown(dropdown);
      }
    },
    true,
  );

  document.addEventListener("focusout", (event) => {
    const bar =
      event.target instanceof Element
        ? event.target.closest(".search-bar, .results-search-bar")
        : null;
    if (!bar) return;
    requestAnimationFrame(() => {
      if (bar.contains(document.activeElement)) return;
      const dropdown = bar.querySelector(".ac-dropdown");
      const input = bar.querySelector("#search-input, #results-search-input");
      if (
        dropdown instanceof HTMLElement &&
        input instanceof HTMLInputElement &&
        shouldShowBang(input)
      ) {
        hideBangDropdown(dropdown);
      }
    });
  });

  document.addEventListener(
    "keydown",
    (event) => {
      const input = getBangInput(event.target);
      const dropdown = getDropdownForInput(input);
      if (!input || !dropdown || !isBangDropdownActive(dropdown)) return;
      if (!shouldShowBang(input)) return;

      const items = dropdown.querySelectorAll(".ac-item--bang");
      if (!items.length) return;

      let activeIndex = [...items].findIndex((item) =>
        item.classList.contains("ac-item--bang-active"),
      );

      if (event.key === "ArrowDown") {
        event.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
        items.forEach((item, index) => {
          item.classList.toggle("ac-item--bang-active", index === activeIndex);
        });
        const trigger = items[activeIndex]?.dataset.trigger;
        if (trigger) input.value = `!${trigger} `;
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        activeIndex = Math.max(activeIndex - 1, -1);
        items.forEach((item, index) => {
          item.classList.toggle("ac-item--bang-active", index === activeIndex);
        });
        if (activeIndex === -1) {
          input.value = `!${input.value.slice(1).split(" ")[0]}`;
        } else {
          const trigger = items[activeIndex]?.dataset.trigger;
          if (trigger) input.value = `!${trigger} `;
        }
        return;
      }

      if (event.key === "Escape") {
        hideBangDropdown(dropdown);
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        const highlighted = getHighlightedBangItem(dropdown);
        const trigger =
          highlighted?.dataset.trigger ?? items[items.length - 1]?.dataset.trigger;
        if (trigger) applyBangSelection(input, dropdown, trigger);
        return;
      }

      if (event.key === "Enter" && useHighlightedBang(input, dropdown, event)) {
        return;
      }
    },
    true,
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAutoBang);
} else {
  initAutoBang();
}
