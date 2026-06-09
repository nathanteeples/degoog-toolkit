import assert from "node:assert/strict";
import test from "node:test";
import slot, { testNameResultRelevance } from "./index.js";

const MILE = 1609.34;

test("rejects distant partial chain matches", () => {
  assert.equal(
    testNameResultRelevance(
      "jack and coke",
      {
        name: "Janie and Jack",
        brandName: "Janie and Jack",
        ontologyId: "chain:example",
        distanceMeters: 11.4 * MILE,
      },
      25 * MILE,
    ),
    false,
  );
});

test("rejects nearby partial matches missing meaningful query tokens", () => {
  assert.equal(
    testNameResultRelevance(
      "jack and coke",
      {
        name: "Janie and Jack",
        brandName: "Janie and Jack",
        ontologyId: "chain:example",
        distanceMeters: 2 * MILE,
      },
      25 * MILE,
    ),
    false,
  );
});

test("keeps strong exact business matches throughout the radius", () => {
  assert.equal(
    testNameResultRelevance(
      "Walmart",
      {
        name: "Walmart",
        brandName: null,
        ontologyId: null,
        distanceMeters: 14 * MILE,
      },
      25 * MILE,
    ),
    true,
  );
});

test("allows nearby branded fuzzy matches with full token coverage", () => {
  assert.equal(
    testNameResultRelevance(
      "Home Goods",
      {
        name: "HomeGoods",
        brandName: "HomeGoods",
        ontologyId: "chain:homegoods",
        distanceMeters: 3.8 * MILE,
      },
      25 * MILE,
    ),
    true,
  );
});

test("requires whole-token matches for short bare business names", () => {
  assert.equal(
    testNameResultRelevance(
      "aapl",
      {
        name: "Aap",
        brandName: null,
        ontologyId: null,
        distanceMeters: 18.8 * MILE,
      },
      25 * MILE,
    ),
    false,
  );
  assert.equal(
    testNameResultRelevance(
      "goog",
      {
        name: "Good Guy Vapes",
        brandName: "Good Guy Vapes",
        ontologyId: "chain:good-guy-vapes",
        distanceMeters: 2.8 * MILE,
      },
      25 * MILE,
    ),
    false,
  );
  assert.equal(
    testNameResultRelevance(
      "IHOP",
      {
        name: "IHOP",
        brandName: "IHOP",
        ontologyId: "chain:ihop",
        distanceMeters: 4 * MILE,
      },
      10 * MILE,
    ),
    true,
  );
  assert.equal(
    testNameResultRelevance(
      "ulta",
      {
        name: "Ulta Beauty",
        brandName: "Ulta Beauty",
        ontologyId: "chain:ulta-beauty",
        distanceMeters: 3 * MILE,
      },
      10 * MILE,
    ),
    true,
  );
});

test("defaults nearby searches to a 10 mile radius", () => {
  const radiusSetting = slot.settingsSchema.find(
    (field) => field.key === "defaultRadius",
  );
  assert.equal(radiusSetting?.default, "10");
  assert.deepEqual(radiusSetting?.options, ["2", "5", "10", "15", "25", "50"]);
});

test("uses the 10 mile radius when no saved radius exists", async () => {
  slot.configure({
    hereApiKey: "test-key",
    defaultLat: "40.494628",
    defaultLon: "-74.799765",
    defaultLocationLabel: "Home",
    resultsCount: "5",
    useOsmGeocoder: false,
    useBrowserGeolocation: false,
  });

  let requestedRadius = "";
  const result = await slot.execute("Starbucks", {
    fetch: async (url) => {
      requestedRadius = new URL(url).searchParams.get("in") || "";
      return {
        ok: true,
        status: 200,
        json: async () => ({ items: [] }),
        text: async () => "",
      };
    },
  });

  assert.match(requestedRadius, /;r=16093$/);
  assert.deepEqual(result, { html: "" });
});

test("renders empty HTML when HERE only returns distant partial matches", async () => {
  slot.configure({
    hereApiKey: "test-key",
    defaultLat: "40.494628",
    defaultLon: "-74.799765",
    defaultLocationLabel: "Home",
    defaultRadius: "25",
    resultsCount: "5",
    useOsmGeocoder: false,
    useBrowserGeolocation: false,
  });

  const hereItems = [
    {
      id: "janie-bridgewater",
      title: "Janie and Jack",
      position: { lat: 40.5864, lng: -74.61871 },
      distance: 11.4 * MILE,
      chains: [{ id: "chain:janie-and-jack", name: "Janie and Jack" }],
      address: { label: "400 Commons Way, Bridgewater, NJ" },
    },
    {
      id: "janie-chicago",
      title: "Janie and Jack",
      position: { lat: 40.31497, lng: -74.66039 },
      distance: 14.4 * MILE,
      chains: [{ id: "chain:janie-and-jack", name: "Janie and Jack" }],
      address: { label: "3535 N Broadway, Chicago, IL" },
    },
  ];

  const result = await slot.execute("jack and coke", {
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ items: hereItems }),
      text: async () => "",
    }),
  });

  assert.deepEqual(result, { html: "" });
});

for (const [query, item] of [
  [
    "aapl",
    {
      id: "aap-piscataway",
      title: "Aap",
      position: { lat: 40.55, lng: -74.45 },
      distance: 18.8 * MILE,
      address: { label: "Piscataway, NJ 08854-3839" },
    },
  ],
  [
    "goog",
    {
      id: "good-guy-vapes",
      title: "Good Guy Vapes",
      position: { lat: 40.51, lng: -74.82 },
      distance: 2.8 * MILE,
      chains: [{ id: "chain:good-guy-vapes", name: "Good Guy Vapes" }],
      address: { label: "Flemington, NJ 08822-1600" },
    },
  ],
]) {
  test(`does not render unrelated HERE result for ${query}`, async () => {
    slot.configure({
      hereApiKey: "test-key",
      defaultLat: "40.494628",
      defaultLon: "-74.799765",
      defaultLocationLabel: "Home",
      defaultRadius: "25",
      resultsCount: "5",
      useOsmGeocoder: false,
      useBrowserGeolocation: false,
    });

    const result = await slot.execute(query, {
      fetch: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ items: [item] }),
        text: async () => "",
      }),
    });

    assert.deepEqual(result, { html: "" });
  });
}
