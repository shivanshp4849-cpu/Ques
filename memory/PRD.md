# ClearPath OS — Frontend PRD

## Problem
Bengaluru traffic-police incident response system — a hackathon project. Build a command-center
frontend (React, CRA + Yarn) that consumes a separate, already-running FastAPI backend at
`REACT_APP_BACKEND_URL/api/...`. Four full-screen pages + landing, with intro-video → logo → landing
transition. Visual style is a dark, glassy, telemetry-grade ops console — not a CRUD app.

## Architecture / Stack
- React 19 (CRA + craco), React Router v7, Tailwind v3 (utility-only; most styles via CSS vars)
- react-leaflet v5 + leaflet 1.9, CartoDB dark tiles
- Native `fetch + ReadableStream` for `POST /api/plan/stream` SSE (no native EventSource)
- Native `WebSocket` for `/api/ws/live` with 3 s → 6 s → 9 s reconnect backoff
- Raw `<canvas>` for Debrief scatter (no chart lib)
- Fonts: `Rajdhani` (display) + `Share Tech Mono` (data/numbers)

## Pages
- `/` Landing — intro mp4 → fade to neon "CLEARPATH OS" logo → glass dashboard hero with 4 module cards
- `/god-mode` Full-screen Leaflet map (Bengaluru), 150 incident markers, 54 station diamonds, map-click → dispatch popup, streaming agent activity (5 steps), red dashed baseline + green diversion + pulsing buffer circle on `spatial`, station flash on `logistics`, tweet/SMS/audio directive card, plan-output bar. Tabs: LIVE MAP / SIMULATE / STRESS TEST (1–8 incident loop, severity bias, mixed/city spread)
- `/sentinel` Phone-frame report device, NLP keyword stub (tree / water / accident / others), 4-stage animated submit pipeline, jittered map drop, 10 s swarm scan (≥3 reports inside 500 m / 5 min → real `/api/plan/stream` at centroid → autonomous-dispatch banner)
- `/intelligence` 3-col read-only dashboard: closure metrics (ROC, PR, recall, precision animated bars), confusion matrix, duration regressor stats; auto-scroll incident feed; cause breakdown / 24-hour heatmap / corridor risk top-10
- `/debrief` Staggered headline opener, raw-canvas predicted-vs-actual scatter with hover tooltip + click-to-link, custom SVG semicircular drift gauge, drift-note callout, 23-anomaly theater block, top-200 incidents-by-error list cross-highlighting the scatter

## Shared (in `/src/components/clearpath/`)
NavBar (sticky, IST clock, ⌘K trigger), CommandPalette (modal, keyboard nav, route jump), Panel, Badge, StatCard, AnimatedBar, AnimatedNumber, Spinner, Skeleton, LiveDot, Gauge, AgentStepRow. Util: `lib/parsePlanStream.js`, `lib/api.js`.

## Status — Implemented (2026-06-21)
- All 4 pages + landing built, navigation working, ⌘K palette working
- Frontend serves cleanly (had to patch `craco.config.js` to strip deprecated v4
  `onAfterSetupMiddleware` / `https` props because `webpack-dev-server@5` is resolved)
- API contract fully wired: `/incidents`, `/stations`, `/metrics`, `/after-action`,
  `/plan/stream` (POST + SSE), `/ws/live` (WS heartbeat → live station availability + reconnect)
- Sentinel NLP is the spec-mandated keyword stub with `// TODO: real Gemini call`
- Lint clean (eslint pass on /pages and /components)
- Note at finish: backend currently returns 404 / empty for some endpoints — that is user-owned
  ("I'll do backend"); UI shows skeletons/zeros gracefully when data is missing.

## Backlog
- P1 — Real Gemini cause classifier in Sentinel (wait for user backend hook)
- P2 — Add WebGL shader for buffer pulse on God Mode (cooler than CSS pulse)
- P2 — Persist Sentinel reports across reload (localStorage)
- P2 — Empty-state copy on every panel when backend is empty (currently shimmer-only)
- P3 — Per-page deep-link state in command palette (e.g. ⌘K → "OPEN INCIDENT FKID004…")

## Test Credentials
N/A — no auth in this frontend pass.
