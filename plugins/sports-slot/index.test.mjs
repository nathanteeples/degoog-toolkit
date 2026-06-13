import assert from "node:assert/strict";
import test from "node:test";

import { routes, slot } from "./index.js";

test("refresh route renders without relying on an undefined request alias", async () => {
  slot.configure({});
  const refreshRoute = routes.find((route) => route.path === "refresh");
  assert.ok(refreshRoute);

  const response = await refreshRoute.handler(
    new Request("http://localhost/api/plugin/sports-slot/refresh?query=lakers%20score"),
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(typeof payload.html, "string");
  assert.ok(payload.html.length > 0);
});
