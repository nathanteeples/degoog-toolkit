export const MAX_GRAPH_SERIES = 4;

function stripGraphCommand(value) {
  return String(value || "")
    .trim()
    .replace(/^(?:graph|plot)\b\s*(?::|=)?\s*/i, "");
}

function stripSeriesPrefix(value) {
  return String(value || "")
    .trim()
    .replace(/^y\d*\s*=\s*/i, "")
    .replace(/^f\d*\s*\(\s*x\s*\)\s*=\s*/i, "");
}

export function splitGraphExpressions(input, maxSeries = MAX_GRAPH_SERIES) {
  const source = stripGraphCommand(input);
  const chunks = [];
  let current = "";
  let depth = 0;

  for (const char of source) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);

    if ((char === ";" || char === "\n") && depth === 0) {
      if (current.trim()) chunks.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) chunks.push(current);

  return chunks
    .map(stripSeriesPrefix)
    .filter(Boolean)
    .slice(0, Math.max(1, maxSeries))
    .map((expression, index, expressions) => ({
      expression,
      label: expressions.length > 1 ? `y${index + 1}` : "y",
    }));
}

export function zoomBounds(bounds, factor, focus) {
  const min = Number(bounds?.min);
  const max = Number(bounds?.max);
  const center = Number.isFinite(focus) ? focus : (min + max) / 2;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return null;
  }
  if (!Number.isFinite(factor) || factor <= 0) return null;

  return {
    min: center + (min - center) * factor,
    max: center + (max - center) * factor,
  };
}

export function panBounds(bounds, xRatio, yRatio) {
  const xMin = Number(bounds?.xMin);
  const xMax = Number(bounds?.xMax);
  const yMin = Number(bounds?.yMin);
  const yMax = Number(bounds?.yMax);
  if (
    ![xMin, xMax, yMin, yMax, xRatio, yRatio].every(Number.isFinite) ||
    xMax <= xMin ||
    yMax <= yMin
  ) {
    return null;
  }

  const xOffset = (xMax - xMin) * xRatio;
  const yOffset = (yMax - yMin) * yRatio;
  return {
    xMin: xMin - xOffset,
    xMax: xMax - xOffset,
    yMin: yMin + yOffset,
    yMax: yMax + yOffset,
  };
}
