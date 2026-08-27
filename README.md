# Little Days

A calm, text-first, choice-driven life simulation about how small experiences accumulate into a person.

## Current prototype

The repository now contains a playable childhood simulation foundation rather than a static UI demo.

A new life generates its own:

- name and birthplace
- household structure
- household finances and home conditions
- guardians, possible siblings and grandmother
- a future school friend and teacher
- hidden personality tendencies
- health state
- interests
- school ability state
- persistent memories and event history

The game begins at birth and advances through childhood. Time moves faster in early childhood and slows once school begins. The current MVP ends at age 13 so adolescence can be built as a separate phase later.

## Simulation loop

Each event is selected from the current world state. Choices apply declarative effects to personality, relationships, interests, education, health, or money. Some choices create lasting memories. The next event is then selected from the updated life state.

```text
World state
   ↓
Eligible events
   ↓
Player choice
   ↓
Effects + history + memories
   ↓
Time advances
   ↓
Updated world state
```

The save lives in `localStorage`, so refreshing the page does not erase the current childhood.

## UI

The interface follows the Little Days mobile system: warm paper tones, editorial typography, simple line icons, restrained color, and story-first information hierarchy.

Current screens:

- Life / active event
- People / relationships
- Self / developing personality
- Memories
- Home
- School
- Life overview
- More

Most underlying simulation values are intentionally translated into human-readable descriptions instead of exposed as gamey percentages.

## Project structure

```text
index.html
styles.css
app.js

game/
  engine.js      # world generation, time, effects, derived state
  content.js     # declarative childhood event templates and content pools

manifest.webmanifest
sw.js
icon.svg
```

Content is separated from simulation logic so the event library can grow without turning the engine into a wall of event-specific conditionals.

## Run locally

No build step or dependency install is required.

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

Opening `index.html` directly can render the UI, but serving over HTTP is recommended because the app uses ES modules and a service worker.

## PWA

The prototype includes:

- `manifest.webmanifest`
- offline app-shell caching through `sw.js`
- an SVG app icon
- mobile safe-area handling

## Next development targets

1. Expand the event library toward the 100–200-event childhood target.
2. Add stronger conditional event requirements and weighted probabilities.
3. Add independent NPC state changes between player interactions.
4. Add explicit developmental systems for attachment, confidence, regulation, and trust.
5. Add richer memory callbacks so older childhood events directly reference earlier experiences.
6. Add automated simulation tests before increasing content volume.
