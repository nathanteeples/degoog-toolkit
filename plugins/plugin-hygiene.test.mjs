import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const pluginsDir = path.resolve("plugins");
const manifest = JSON.parse(await readFile("package.json", "utf8"));
const pluginFolders = manifest.plugins.map(({ path: pluginPath }) =>
  path.basename(pluginPath),
);

test("all registered plugins keep required metadata and client exposure", async () => {
  for (const folder of pluginFolders) {
    const pluginDir = path.join(pluginsDir, folder);
    const author = JSON.parse(
      await readFile(path.join(pluginDir, "author.json"), "utf8"),
    );
    assert.deepEqual(
      author,
      { name: "SoPat712", url: "https://github.com/SoPat712" },
      `${folder}: author.json`,
    );

    const module = await import(
      `${pathToFileURL(path.join(pluginDir, "index.js")).href}?hygiene=${Date.now()}-${folder}`
    );
    for (const route of module.routes || []) {
      if (/^(?:delete|remove|clear)$/i.test(route.path)) {
        assert.notEqual(
          String(route.method).toLowerCase(),
          "get",
          `${folder}: mutating route ${route.path} must not use GET`,
        );
      }
    }
    const capabilities = new Set();
    for (const [name, value] of Object.entries(module)) {
      if (
        value &&
        typeof value === "object" &&
        (typeof value.execute === "function" ||
          typeof value.executeSearch === "function" ||
          typeof value.intercept === "function" ||
          typeof value.handle === "function")
      ) {
        capabilities.add(value);
        assert.equal(
          typeof value.isClientExposed,
          "boolean",
          `${folder}: ${name} must declare isClientExposed`,
        );
      }
    }
  }
});

test("plugin assets avoid inline handlers and hard-coded install ids", async () => {
  for (const folder of pluginFolders) {
    const pluginDir = path.join(pluginsDir, folder);
    const files = await readdir(pluginDir);
    for (const file of files) {
      if (!/\.(?:js|mjs|html)$/.test(file) || file.endsWith(".test.mjs")) {
        continue;
      }
      const source = await readFile(path.join(pluginDir, file), "utf8");
      assert.doesNotMatch(
        source,
        /\son(?:click|change|input|error|load|submit|keydown|keyup)\s*=/i,
        `${folder}/${file}: inline event handler`,
      );
      if (file === "script.js") {
        assert.doesNotMatch(
          source,
          /\/api\/plugin\/[a-z0-9_-]+/i,
          `${folder}/${file}: hard-coded installed plugin id`,
        );
        const scanObservers = source.match(/new MutationObserver\(scan\)/g) || [];
        assert.ok(
          scanObservers.length <= 1,
          `${folder}/${file}: duplicate scan observers`,
        );
      }
      if (source.includes("ctx.createCache(")) {
        assert.match(
          source,
          /ctx\?*\.useCache|ctx\.useCache/,
          `${folder}/${file}: prefer Valkey-aware useCache before createCache fallback`,
        );
      }
    }
  }
});

test("full-width plugin cards flatten the host slot panel", async () => {
  for (const folder of pluginFolders) {
    const pluginDir = path.join(pluginsDir, folder);
    const files = await readdir(pluginDir);
    let usesFullWidthCard = false;

    for (const file of files) {
      if (
        !/\.(?:js|mjs|html)$/.test(file) ||
        file.endsWith(".test.mjs")
      ) {
        continue;
      }
      const source = await readFile(path.join(pluginDir, file), "utf8");
      if (source.includes("slot-full-width")) {
        usesFullWidthCard = true;
        break;
      }
    }

    if (!usesFullWidthCard) {
      continue;
    }

    const styles = await readFile(path.join(pluginDir, "style.css"), "utf8");
    assert.match(
      styles,
      /\.results-slot-panel:has\([^}]*slot-full-width/s,
      `${folder}: full-width cards must flatten the host results panel`,
    );
  }
});
