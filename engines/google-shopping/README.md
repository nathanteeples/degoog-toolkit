# Google Shopping engine

Provides the `shopping` search type used by the Shopping tab. It requests Google's current Shopping result mode (`udm=28`) through degoog's configured engine transport and returns only standard degoog result fields.

Requires degoog 0.23.0 or newer.

## Filtering

The parser rejects sponsored labels, ad modules, Google ad-click URLs, tracking-only links, malformed product cards, duplicates, and blocked merchants or domains. A configurable per-merchant limit keeps one seller from filling the page. No heuristic can guarantee that every low-quality listing is caught, so the merchant/domain blocklist is available for local control.

## Recommended transport

Choose the engine's outgoing transport under **Settings → Engines → Google Shopping → Advanced**. Google often challenges plain fetch/curl clients; use a browser-backed transport when available. Consent, CAPTCHA, and unrecognized response pages fail explicitly instead of being displayed as product results.
