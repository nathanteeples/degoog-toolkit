import { getConfig, getCtx, setCtx, setConfig } from "./src/state.js";
import { parseSettings, settingsSchema, isConfigured } from "./src/settings.js";
import { handle } from "./src/gate.js";
import { routes as pluginRoutes } from "./src/routes.js";

export const middleware = {
  isClientExposed: false,
  name: "OIDC / SSO",
  description:
    "Single sign-on gate for the settings area using any OpenID Connect provider. Adds a home-page avatar for the signed-in user.",
  settingsSchema,
  init(ctx) {
    setCtx(ctx);
  },
  configure(settings) {
    setConfig(parseSettings(settings));
  },
  handle,
};

export const command = {
  isClientExposed: false,
  name: middleware.name,
  description: middleware.description,
  trigger: "oidc",
  aliases: ["oidc-test", "oidc-login"],
  settingsSchema: [
    {
      key: "useAsSettingsGate",
      label: "Use as settings gate",
      type: "toggle",
      description: "Require OIDC sign-in before opening settings.",
    },
    ...settingsSchema,
  ],
  init(ctx) {
    setCtx(ctx);
  },
  configure(settings) {
    setConfig(parseSettings(settings));
  },
  execute() {
    const ctx = getCtx();
    const config = getConfig();
    const loginUrl = ctx ? ctx.routeUrl("login?returnTo=/settings") : "/api/settings/auth";
    const configured = isConfigured(config);
    const providerLabel = config?.providerLabel || "OIDC";
    return {
      title: middleware.name,
      html: configured
        ? `<div class="command-result"><p>OIDC is configured for the settings gate.</p><p><a class="btn" href="${loginUrl}">Test sign in with ${providerLabel}</a></p></div>`
        : '<div class="command-result"><p>OIDC is not fully configured yet. Add an issuer, client details, and at least one admin allow rule or enable "Allow any authenticated user".</p></div>',
    };
  },
};

export const routes = pluginRoutes;

export default command;
