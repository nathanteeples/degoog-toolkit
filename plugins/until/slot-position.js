/** Degoog stores Position under settings key `slotPosition` (see SLOT_POSITION_SETTING_KEY). */

export function readSlotPosition(settings = {}, fallback = "at-a-glance") {
  const raw = settings.slotPosition ?? settings.position;
  const chosen = String(raw ?? fallback).trim();
  return chosen || fallback;
}

/** Glance uses POST /api/slots/glance and always passes context.results as an array. */
export function shouldRenderSlotForContext(context, selectedSlotPosition) {
  const isGlanceRequest = Array.isArray(context?.results);
  if (selectedSlotPosition === "at-a-glance") {
    return isGlanceRequest;
  }
  return !isGlanceRequest;
}

/** #at-a-glance receives raw plugin HTML (no results-slot-panel shell). */
export function finalizeSlotHtml(html, context, selectedSlotPosition) {
  const content = String(html ?? "");
  if (!content.trim()) return content;
  if (
    selectedSlotPosition === "at-a-glance" &&
    Array.isArray(context?.results)
  ) {
    return `<div class="glance-box">${content}</div>`;
  }
  return content;
}
