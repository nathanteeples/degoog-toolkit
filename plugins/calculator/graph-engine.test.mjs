import assert from "node:assert/strict";
import test from "node:test";

import {
  panBounds,
  splitGraphExpressions,
  zoomBounds,
} from "./graph-engine.mjs";

test("splits and labels multiple graph expressions", () => {
  assert.deepEqual(splitGraphExpressions("graph y=sin(x); f2(x)=x^2; 4"), [
    { expression: "sin(x)", label: "y1" },
    { expression: "x^2", label: "y2" },
    { expression: "4", label: "y3" },
  ]);
});

test("keeps separators inside parentheses and caps series count", () => {
  assert.deepEqual(
    splitGraphExpressions("max(x, 2); x; x^2; x^3; x^4"),
    [
      { expression: "max(x, 2)", label: "y1" },
      { expression: "x", label: "y2" },
      { expression: "x^2", label: "y3" },
      { expression: "x^3", label: "y4" },
    ],
  );
});

test("zooms and pans finite graph bounds", () => {
  assert.deepEqual(zoomBounds({ min: -10, max: 10 }, 0.5, 0), {
    min: -5,
    max: 5,
  });
  assert.deepEqual(
    panBounds(
      { xMin: -10, xMax: 10, yMin: -5, yMax: 5 },
      0.25,
      -0.5,
    ),
    { xMin: -15, xMax: 5, yMin: -10, yMax: 0 },
  );
});
