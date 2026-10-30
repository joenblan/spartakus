# Spartakus: street-phase prototype

Browser prototype of one real-time street phase (Day 5, 5 January 1919), built from `street-phase-prototype.md`.

Stack: Vite + TypeScript + plain Canvas, Vitest for tests.

```
npm install
npm test            # unit tests (simulation runs in Node, no browser)
npm run typecheck   # also checks src/sim against a DOM-free lib
npm run dev         # browser build (rendering arrives in milestone 2)
```

Layout:
- `src/sim/` simulation, fixed 1 s tick, seeded RNG, no DOM. `step(sim)` advances one second.
- `src/data/tuning.json` every tuning number (spec §11 plus a few keys the spec states in prose).
- `src/data/map.json` street graph (spec §2).
- `src/render/`, `src/ui/` later milestones.

Places where the spec is silent are marked `// SPEC-GAP` in the code.
