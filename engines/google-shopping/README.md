# Google Shopping engine

Provides the `shopping` search type used by the Shopping tab. It requests Google's current Shopping result mode (`udm=28`) through degoog's configured engine transport and returns only standard degoog result fields.

Requires degoog 0.23.0 or newer.

## Filtering

The parser rejects sponsored labels, ad modules, Google ad-click URLs, tracking-only links, malformed product cards, duplicates, and blocked merchants or domains. A configurable per-merchant limit keeps one seller from filling the page. No heuristic can guarantee that every low-quality listing is caught, so the merchant/domain blocklist is available for local control.

## Recommended transport

The engine defaults to degoog's built-in **Curl Impersonate** transport because Google often challenges plain fetch/curl clients. You can choose another outgoing transport under **Settings → Engines → Google Shopping → Advanced**; a browser-backed transport is the best fallback when one is installed. Consent, CAPTCHA, and unrecognized response pages fail explicitly instead of being displayed as product results.
