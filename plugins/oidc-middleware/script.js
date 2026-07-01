(function () {
  const API_BASE = `/api/plugin/${__PLUGIN_ID__}`;
  const MOUNT_ID = "degoog-oidc-user";
  const BUTTON_CLASS = "oidc-settings-gate__button";
  const WRAP_CLASS = "oidc-settings-gate__actions";
  const HINT_CLASS = "oidc-settings-gate__hint";
  const DEBUG_FLAG = "degoog-oidc-debug";
  const DEBUG_BOOT = "degoog-oidc-debug-boot";

  let debugEnabled = false;

  const bootCount = (() => {
    try {
      const next = 1 + Number(sessionStorage.getItem(DEBUG_BOOT) || "0");
      sessionStorage.setItem(DEBUG_BOOT, String(next));
      debugEnabled = sessionStorage.getItem(DEBUG_FLAG) === "1";
      return next;
    } catch {
      return 1;
    }
  })();

  const escapeHtml = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const navType = () => {
    try {
      return performance.getEntriesByType("navigation")[0]?.type || "";
    } catch {
      return "";
    }
  };

  const setDebugEnabled = (value, source, meta) => {
    if (!value) return;
    debugEnabled = true;
    try {
      sessionStorage.setItem(DEBUG_FLAG, "1");
    } catch {}
    console.info("[oidc]", "debug enabled", {
      source,
      boot: bootCount,
      path: window.location.pathname,
      navType: navType(),
      ...(meta || {}),
    });
  };

  const log = (event, data) => {
    if (!debugEnabled) return;
    console.debug("[oidc]", event, {
      boot: bootCount,
      path: window.location.pathname,
      search: window.location.search,
      navType: navType(),
      ...(data || {}),
    });
  };

  const initials = (name, email) => {
    const base = (name || email || "?").trim();
    const parts = base.split(/\s+/);
    const chars =
      parts.length > 1 ? parts[0][0] + parts[1][0] : base.slice(0, 2);
    return chars.toUpperCase();
  };

  const avatarMarkup = (me) =>
    me.picture
      ? `<img class="degoog-oidc-avatar" src="${escapeHtml(me.picture)}" alt="">`
      : `<span class="degoog-oidc-avatar degoog-oidc-avatar-initials">${escapeHtml(
          initials(me.name, me.email),
        )}</span>`;

  const wire = (wrap) => {
    const trigger = wrap.querySelector(".degoog-oidc-trigger");
    const menu = wrap.querySelector(".degoog-oidc-menu");
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const opening = menu.hidden;
      menu.hidden = !opening;
      trigger.setAttribute("aria-expanded", String(opening));
    });
    document.addEventListener("click", (e) => {
      if (wrap.contains(e.target)) return;
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    });
    wrap.querySelector(".degoog-oidc-logout").addEventListener("click", async () => {
      log("logout.click", { apiBase: API_BASE });
      try {
        await fetch(`${API_BASE}/logout`, {
          method: "POST",
          credentials: "same-origin",
        });
      } catch (err) {
        console.error("[oidc] logout failed", err);
      }
      log("logout.reload");
      window.location.reload();
    });
  };

  const enhanceSettingsGate = async () => {
    const form = document.getElementById("settings-auth-form");
    const gate = document.querySelector(".settings-auth-gate-inner");
    const errorEl = document.getElementById("settings-auth-error");
    if (!form || !gate || !errorEl) return;

    try {
      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      log("settings-gate.fetch.start", {
        hasForm: Boolean(form),
        hasGate: Boolean(gate),
        hasError: Boolean(errorEl),
        returnTo,
      });
      const response = await fetch(`/api/settings/auth?returnTo=${encodeURIComponent(returnTo)}`, {
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      const data = await response.json();
      setDebugEnabled(data?.debug === true, "settings-auth", {
        responseStatus: response.status,
        providerLabel: data?.providerLabel || "",
      });
      log("settings-gate.fetch.response", {
        status: response.status,
        ok: response.ok,
        data,
      });
      if (!data || typeof data.loginUrl !== "string" || !data.loginUrl) return;

      const providerLabel =
        typeof data.providerLabel === "string" && data.providerLabel.trim()
          ? data.providerLabel.trim()
          : "OIDC";

      form.hidden = true;
      form.setAttribute("aria-hidden", "true");

      const wrapper = document.createElement("div");
      wrapper.className = WRAP_CLASS;

      const button = document.createElement("button");
      button.type = "button";
      button.className = BUTTON_CLASS;
      const icon = document.createElement("i");
      icon.className = "fa-solid fa-right-to-bracket";
      icon.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.textContent = `Sign in with ${providerLabel}`;
      button.appendChild(icon);
      button.appendChild(label);
      button.addEventListener("click", function () {
        window.location.assign(data.loginUrl);
      });

      const hint = document.createElement("p");
      hint.className = HINT_CLASS;
      hint.textContent =
        data.autoRedirect === true
          ? "Redirecting to your OpenID Connect provider."
          : "This degoog admin panel is protected by OpenID Connect.";

      wrapper.appendChild(button);
      wrapper.appendChild(hint);
      errorEl.insertAdjacentElement("beforebegin", wrapper);
      log("settings-gate.rendered", {
        providerLabel,
        loginUrl: data.loginUrl,
        autoRedirect: data.autoRedirect === true,
      });

      if (data.autoRedirect === true) {
        log("settings-gate.redirect", { loginUrl: data.loginUrl });
        window.location.assign(data.loginUrl);
      }
    } catch (err) {
      console.error("[oidc] settings gate check failed", err);
    }
  };

  const render = (me) => {
    if (document.getElementById(MOUNT_ID)) return;
    log("avatar.render", {
      email: me.email || "",
      name: me.name || "",
      hasPicture: Boolean(me.picture),
    });
    const wrap = document.createElement("div");
    wrap.id = MOUNT_ID;
    wrap.className = "degoog-oidc-user";
    wrap.innerHTML = `
      <button type="button" class="degoog-oidc-trigger" aria-haspopup="true" aria-expanded="false">
        ${avatarMarkup(me)}
      </button>
      <div class="degoog-oidc-menu" hidden>
        <p class="degoog-oidc-name">${escapeHtml(me.name || me.email)}</p>
        ${me.email ? `<p class="degoog-oidc-email">${escapeHtml(me.email)}</p>` : ""}
        <button type="button" class="degoog-oidc-logout">Sign out</button>
      </div>`;
    document.body.appendChild(wrap);
    wire(wrap);
  };

  const boot = async () => {
    log("boot.start", { apiBase: API_BASE });
    await enhanceSettingsGate();
    try {
      const res = await fetch(`${API_BASE}/me`, { credentials: "same-origin" });
      let me = null;
      if (res.ok) {
        me = await res.json();
        setDebugEnabled(me?.debug === true, "me", {
          responseStatus: res.status,
          providerLabel: me?.providerLabel || "",
        });
      }
      log("me.response", {
        status: res.status,
        ok: res.ok,
        body: me,
      });
      if (!res.ok) return;
      if (me && me.authenticated) render(me);
    } catch (err) {
      console.error("[oidc] session check failed", err);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
