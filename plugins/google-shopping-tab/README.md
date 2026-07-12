# Shopping tab

Adds a clean product grid to degoog with merchant filtering and relevance or price sorting. Installing this tab also installs the companion **Google Shopping** engine.

Requires degoog 0.23.0 or newer.

The engine fetches Google Shopping on the server and removes sponsored cards, ad-click destinations, malformed listings, duplicates, and merchants on your blocklist. Product thumbnails continue through degoog's signed image proxy.

## Transport setup

Google frequently serves consent or JavaScript challenges to basic HTTP clients. Open **Settings → Engines → Google Shopping → Advanced** and select the outgoing HTTP client transport you want degoog to use. A browser-backed transport such as 4play, Browserless, or Camoufox is the most reliable choice when one is installed.

All Shopping requests use that selected engine transport. The extension does not make a direct browser request to Google and does not fall back to an unconfigured transport.

## Result controls

- Sort by relevance or price.
- Filter the current page by merchant.
- Configure region, language, minimum rating, seller diversity, and blocked merchants under the Google Shopping engine settings.
