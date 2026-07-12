import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { tab } from "./index.js";

test("registers a server-side Shopping tab backed by shopping engines", () => {
  assert.deepEqual(tab, {
    name: "Shopping",
    engineType: "shopping",
    isClientExposed: false,
  });
});

test("Store metadata installs the engine on a compatible degoog release", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8"),
  );
  const plugin = manifest.plugins.find(
    (entry) => entry.path === "plugins/google-shopping-tab",
  );
  const engine = manifest.engines.find(
    (entry) => entry.path === "engines/google-shopping",
  );
  assert.equal(plugin.type, "search-result-tab");
  assert.equal(plugin.minDegoogVersion, "0.23.0");
  assert.deepEqual(plugin.dependencies, [
    "https://github.com/nathanteeples/degoog-toolkit/engines/google-shopping",
  ]);
  assert.equal(engine.minDegoogVersion, "0.23.0");
});

test("Shopping layout overrides RTL grid columns from installed themes", async () => {
  const styles = await readFile(new URL("./style.css", import.meta.url), "utf8");
  assert.match(
    styles,
    /#results-page\.gshop-active #results-main\s*\{[^}]*grid-column:\s*1 \/ -1 !important;/s,
  );
  assert.match(
    styles,
    /> #slot-above-results\s*> \.results-slot-panel\s*\{\s*grid-column:\s*1 \/ -1 !important;/s,
  );
  assert.match(styles, /padding-inline:\s*0\.45rem 2rem;/);
});
