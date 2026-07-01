(function () {
  const API_BASE = `/api/plugin/${__PLUGIN_ID__}`;
  const MOUNT_ID = "degoog-oidc-user";

  const escapeHtml = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

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
      try {
        await fetch(`${API_BASE}/logout`, {
          method: "POST",
          credentials: "same-origin",
        });
      } catch (err) {
        console.error("[oidc] logout failed", err);
      }
      window.location.reload();
    });
  };

  const render = (me) => {
    if (document.getElementById(MOUNT_ID)) return;
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
    try {
      const res = await fetch(`${API_BASE}/me`, { credentials: "same-origin" });
      if (!res.ok) return;
      const me = await res.json();
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
