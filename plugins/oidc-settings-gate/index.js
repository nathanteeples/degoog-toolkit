import { setCtx, setConfig } from "./src/state.js";
import { parseSettings, settingsSchema } from "./src/settings.js";
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
  settingsSchema: [
    {
      key: "useAsSettingsGate",
      label: "Use as settings gate",
      type: "toggle",
      description: "Require OIDC sign-in before opening settings.",
    },
    ...settingsSchema,
  ],
  configure(settings) {
    setConfig(parseSettings(settings));
  },
  execute() {
    return {
      title: middleware.name,
      html: "<p>Configure OIDC / SSO from Settings.</p>",
    };
  },
};

export const routes = pluginRoutes;

export default command;
