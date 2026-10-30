# charity: water – Water Quest (React)

A responsive, accessible tap-the-can game built with React, TypeScript, and Vite, featuring charity: water branding and mechanics.

## Features

- **Goal**: Collect 20 yellow jerry cans within 30 seconds.
- **Scoring & Penalties**:
  - +1 point for each yellow jerry can tapped.
  - -1 point penalty for clicking an empty tile or missing a can before it despawns (score cannot drop below 0).
- **Audio-visual & Animation**:
  - Can pop-up animations.
  - Multi-colored victory confetti celebration when reaching 20+ cans.
  - Randomized dynamic victory and encouragement messages upon round completion.
- **Accessibility**:
  - Full keyboard support (Space / Enter to tap tiles).
  - Polite ARIA live regions and status descriptions for screen readers.
  - Respects `prefers-reduced-motion`.
- **Responsive Layout**:
  - Mobile-friendly grid and controls tailored to all screen sizes.

## Development

- Start dev server: `npm run dev`
- Build production bundle: `npm run build`
- Preview production build: `npm run preview`
