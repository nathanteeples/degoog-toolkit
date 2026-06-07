import assert from "node:assert/strict";
import test from "node:test";
import {
  createNominatimGeocoder,
  NOMINATIM_NEGATIVE_TTL_MS,
  NOMINATIM_POSITIVE_TTL_MS,
} from "./nominatim-geocoder.mjs";

function response(features, ok = true) {
  return {
    ok,
    async json() {
      return { features };
    },
  };
}

test("geocodes and caches a matching feature", async () => {
  const calls = [];
  const writes = [];
  const cacheValues = new Map();
  const geocoder = createNominatimGeocoder({
    fetch: async (url, init) => {
      calls.push({ url, init });
      return response([{
        geometry: { coordinates: [-74.6597, 40.3497] },
        properties: { geocoding: { label: "Princeton, New Jersey, United States", type: "city" } },
      }]);
    },
    cache: {
      get: (key) => cacheValues.get(key),
      set: (key, value, ttl) => {
        cacheValues.set(key, value);
        writes.push({ ttl });
      },
    },
  });

  const first = await geocoder.geocode("Princeton");
  const second = await geocoder.geocode("Princeton");
  assert.equal(first.source, "nominatim");
  assert.equal(second.cached, true);
  assert.equal(calls.length, 1);
  assert.equal(writes[0].ttl, NOMINATIM_POSITIVE_TTL_MS);
  assert.match(calls[0].init.headers["User-Agent"], /degoog-toolkit-places/);
});

test("negative results use the shorter cache lifetime", async () => {
  const writes = [];
  const geocoder = createNominatimGeocoder({
    fetch: async () => response([]),
    cache: { get: () => null, set: (_key, value, ttl) => writes.push({ value, ttl }) },
  });

  assert.equal(await geocoder.geocode("not a real place"), null);
  assert.equal(writes[0].value.empty, true);
  assert.equal(writes[0].ttl, NOMINATIM_NEGATIVE_TTL_MS);
});

test("serializes requests and enforces one second spacing", async () => {
  let clock = 1000;
  const sleeps = [];
  const geocoder = createNominatimGeocoder({
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    fetch: async (url) => response([{
      geometry: { coordinates: [-74, 40] },
      properties: {
        geocoding: {
          label: `${new URL(url).searchParams.get("q")}, New Jersey`,
          type: "city",
        },
      },
    }]),
  });

  await Promise.all([geocoder.geocode("Princeton"), geocoder.geocode("Trenton")]);
  assert.deepEqual(sleeps, [1000]);
});

test("returns null on provider failure", async () => {
  const geocoder = createNominatimGeocoder({
    fetch: async () => {
      throw new Error("offline");
    },
  });
  assert.equal(await geocoder.geocode("Princeton"), null);
});

