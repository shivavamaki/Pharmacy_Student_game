# Adventurer's Hall — UI direction

Pharmacy Guild uses an original pixel-art apothecary guild inspired by tabletop fantasy adventures. The visual system pairs midnight stone, teal cloth, antique gold, and parchment with readable Thai text. This is a presentation change; enrollment, permissions, API routes, and D1 data retain their existing behavior.

## Components

- Entrance: illustrated guild hall, chapter markers, parchment sign-in panel.
- Character sheet: guild shield, player name and current role, Level / XP strip.
- Navigation: original 16 × 16 SVG silhouettes with adjacent text and active-page indication.
- Quest and team cards: light paper with square bronze borders.
- Admin and registration forms: two columns on desktop, one on small screens.
- Adventure Recap: expandable journal sections with the same parchment treatment.
- Accessibility: visible keyboard focus, skip link, decorative icons hidden from assistive technology, text labels, reduced-motion support, and no automatic new animations.

## Assets and typography

`frontend/assets/guild-hall.webp` is the project artwork, generated using the built-in Imagegen tool, then encoded as WebP for delivery (1536 × 1024, approximately 405 KiB). No external image host is needed. `guild-crest.svg` and `guild-icons.mjs` contain original code-native pixel shapes. Thai text uses available Tahoma/system fonts; small English labels use a monospace stack. There are no new font services or CSP allowances.

Artwork prompt: original 16-bit pixel-art adventurer guild inside an ancient apothecary castle, stone arches and a dragon relief, amber torches, teal mountains at dusk, potion shelves, parchment quest board, open book and twenty-sided dice; wide environment composition, no characters, no interface or logos, crisp square pixels, midnight navy, teal and antique gold.

## Deployment

Deploy the frontend from `migration/cloudflare-foundation`, output directory `frontend`. No Worker deployment or SQL migration is required for this theme. The dev Pages project remains the review environment; this does not merge or cut over the production app.
