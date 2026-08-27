# Little Days

A calm, text-first, choice-driven life simulation about how small experiences accumulate into a person.

## Current prototype

This repository currently contains the first coded mobile UI system for the childhood MVP. The interface is based on the Little Days visual direction: warm paper tones, editorial typography, simple line icons, restrained color, and story-first information hierarchy.

Included prototype screens:

- Life event + choices
- People / relationships
- Self / developing personality
- Memories timeline
- Home
- School
- Life overview
- More navigation

The current event choice is persisted in `localStorage` so the prototype already demonstrates a tiny piece of continuity rather than behaving like a static mockup.

## Run locally

No build step or dependency install is required.

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

You can also use any simple static-file server. Opening `index.html` directly works for the UI, though the service worker only registers when served over HTTP/HTTPS.

## PWA

The prototype includes:

- `manifest.webmanifest`
- offline app-shell caching through `sw.js`
- an SVG app icon
- mobile safe-area handling

## Structure

```text
index.html
styles.css
app.js
manifest.webmanifest
sw.js
icon.svg
```

This is intentionally dependency-free for the first visual prototype. The simulation engine and game content can be separated into modules once the MVP state model and event architecture are introduced.
