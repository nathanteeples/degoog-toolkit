import assert from "node:assert/strict";
import test from "node:test";
import { analyzePlaceIntent } from "./intent-engine.mjs";

const positiveFixtures = [
  ["Example Coffee", { kind: "business", searchText: "Example Coffee" }],
  ["Sample Outlet", { kind: "business", searchText: "Sample Outlet" }],
  ["Demo Outlet", { kind: "business", searchText: "Demo Outlet" }],
  ["Acme Shop near me", { kind: "business", searchText: "Acme Shop", confidence: "high" }],
  ["ExampleGoods", { kind: "business", searchText: "ExampleGoods" }],
  ["Value General", { kind: "business", searchText: "Value General" }],
  ["Sample Cafe", { kind: "business", searchText: "Sample Cafe" }],
  ["Noodles and Partners", { kind: "business", searchText: "Noodles and Partners" }],
  ["Morning Brew", { kind: "business", searchText: "Morning Brew" }],
  ["Alex's Pizza", { kind: "business", searchText: "Alex's Pizza" }],
  ["cafes around Example City", {
    kind: "category",
    searchText: "cafes",
    locationText: "Example City",
  }],
  ["directions to Example Tower", {
    kind: "landmark",
    searchText: "Example Tower",
    mode: "global",
  }],
  ["show me museums close to downtown Sample City", {
    kind: "category",
    searchText: "museums",
    locationText: "downtown Sample City",
  }],
  ["Example Coffee near Sample City", {
    kind: "business",
    searchText: "Example Coffee",
    locationText: "Sample City",
  }],
  ["Sample Cafe near Main Avenue", {
    kind: "business",
    searchText: "Sample Cafe",
    locationText: "Main Avenue",
  }],
  ["where acme", { kind: "business", searchText: "acme", confidence: "high" }],
  ["jade tea near example city", {
    kind: "business",
    searchText: "jade tea",
    locationText: "example city",
  }],
  ["sweet treat near central plaza", {
    kind: "business",
    searchText: "sweet treat",
    locationText: "central plaza",
  }],
  ["central plaza", {
    kind: "landmark",
    searchText: "central plaza",
    mode: "global",
  }],
  ["jade tea", { kind: "business", searchText: "jade tea" }],
  ["acme near me", { kind: "business", searchText: "acme", confidence: "high" }],
  ["where is acme", { kind: "business", searchText: "acme", confidence: "high" }],
  ["where is example tower", {
    kind: "landmark",
    searchText: "example tower",
    mode: "global",
  }],
  ["where is example family club", {
    kind: "business",
    searchText: "example family club",
  }],
  ["where is example club", {
    kind: "business",
    searchText: "example club",
  }],
  ["example plaza", {
    kind: "landmark",
    searchText: "example plaza",
    mode: "global",
  }],
  ["Acme Tacos", { kind: "business", searchText: "Acme Tacos" }],
  ["Sample Pizza Bites", { kind: "business", searchText: "Sample Pizza Bites" }],
  ["ABCD", { kind: "business", searchText: "ABCD" }],
  ["doctor near me", { kind: "category", searchText: "doctor", confidence: "high" }],
  ["pizza open near me", { kind: "category", searchText: "pizza", confidence: "high" }],
  ["acme foods", { kind: "business", searchText: "acme foods" }],
  ["sample kitchen", { kind: "business", searchText: "sample kitchen" }],
  ["example coffee", { kind: "business", searchText: "example coffee" }],
];

for (const [query, expected] of positiveFixtures) {
  test(`recognizes ${query}`, () => {
    const actual = analyzePlaceIntent(query);
    assert.ok(actual);
    assert.deepEqual(
      Object.fromEntries(Object.keys(expected).map((key) => [key, actual[key]])),
      expected,
    );
  });
}

for (const query of [
  "time in Example City",
  "pizza calories and nutrition",
  "where to buy ketchup",
  "weather Example City",
  "react hooks",
  "python list comprehension",
  "play minesweeper",
  "100 miles in km",
  "concrete crack near pool",
  "crack near pool",
  "dog near fence",
  "concrete crack near Example City",
  "ExampleGoods near pool",
  "restaurants near pool",
  "coffee near pool",
  "crack in concrete near pool",
  "speedtest",
  "speed test",
  "time in Test Region",
  "what time in Example City",
  "weather in Sample Town",
  "until christmas",
  "stopwatch",
  "countdown",
  "play snake",
  "minesweeper",
  "define pizza",
  "pizza recipe",
  "what is pizza",
  "where is speedtest",
  "helium",
  "Helium",
  "hydrogen",
  "oxygen",
  "argon",
  "where is helium",
]) {
  test(`rejects ${query}`, () => {
    assert.equal(analyzePlaceIntent(query), null);
  });
}
